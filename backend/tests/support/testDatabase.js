import mongoose from "mongoose";
import { MongoMemoryReplSet } from "mongodb-memory-server";

const TEST_DATABASE_NAME = "visionaire_educore_stage1_test";
const TRANSACTION_PROBE_COLLECTION = "__stage1_transaction_probe";
const LOCAL_HOSTS = new Set(["127.0.0.1", "localhost", "::1"]);

let replicaSet;
let verifiedTestDatabase = false;

const isLocalUriForTestDatabase = (uri) => {
    try {
        const parsed = new URL(uri);
        const databaseName = decodeURIComponent(parsed.pathname.slice(1));
        return (
            parsed.protocol === "mongodb:" &&
            LOCAL_HOSTS.has(parsed.hostname) &&
            !parsed.username &&
            !parsed.password &&
            databaseName === TEST_DATABASE_NAME
        );
    } catch {
        return false;
    }
};

const assertTestDatabaseConnection = () => {
    const connection = mongoose.connection;
    const topologyType =
        connection.getClient()?.topology?.description?.type;

    if (
        !verifiedTestDatabase ||
        !LOCAL_HOSTS.has(connection.host) ||
        connection.name !== TEST_DATABASE_NAME ||
        topologyType !== "ReplicaSetWithPrimary"
    ) {
        throw new Error(
            "Refusing database operation: connection is not the verified local Stage 1 test replica set."
        );
    }
};

const throwCollectedErrors = (primaryError, cleanupErrors, message) => {
    if (primaryError && cleanupErrors.length === 0) throw primaryError;
    const errors = primaryError
        ? [primaryError, ...cleanupErrors]
        : cleanupErrors;
    if (errors.length === 0) return;

    const combinedError = new Error(
        `${message}\n${errors
            .map((error) => error.stack || String(error))
            .join("\n")}`,
        { cause: primaryError || errors[0] }
    );
    combinedError.errors = errors;
    throw combinedError;
};

const verifyTransactionRollback = async () => {
    const database = mongoose.connection.db;
    let session;
    let operationError;

    try {
        await database.createCollection(TRANSACTION_PROBE_COLLECTION);
        const collection = database.collection(TRANSACTION_PROBE_COLLECTION);
        const documentId = new mongoose.Types.ObjectId();

        session = await mongoose.startSession();
        session.startTransaction();
        await collection.insertOne(
            { _id: documentId, purpose: "transaction rollback verification" },
            { session }
        );
        await session.abortTransaction();

        const persistedDocument = await collection.findOne({ _id: documentId });
        if (persistedDocument) {
            throw new Error("Transaction rollback verification failed.");
        }
    } catch (error) {
        operationError = error;
    }

    const cleanupErrors = [];
    if (session?.inTransaction()) {
        try {
            await session.abortTransaction();
        } catch (error) {
            cleanupErrors.push(error);
        }
    }
    if (session) {
        try {
            await session.endSession();
        } catch (error) {
            cleanupErrors.push(error);
        }
    }
    try {
        await database
            .dropCollection(TRANSACTION_PROBE_COLLECTION)
            .catch((error) => {
                if (error.code !== 26 && error.codeName !== "NamespaceNotFound") {
                    throw error;
                }
            });
    } catch (error) {
        cleanupErrors.push(error);
    }

    throwCollectedErrors(
        operationError,
        cleanupErrors,
        "Transaction probe failed and cleanup reported additional errors."
    );
};

export const connectTestDatabase = async () => {
    if (mongoose.connection.readyState !== 0 || replicaSet) {
        throw new Error(
            "Test database startup requires a disconnected Mongoose connection."
        );
    }

    try {
        replicaSet = await MongoMemoryReplSet.create({
            replSet: {
                count: 1,
                dbName: TEST_DATABASE_NAME,
                storageEngine: "wiredTiger",
            },
        });

        const generatedUri = replicaSet.getUri(TEST_DATABASE_NAME);
        if (!isLocalUriForTestDatabase(generatedUri)) {
            throw new Error("Generated test database URI failed local safety checks.");
        }

        await mongoose.connect(generatedUri, {
            serverSelectionTimeoutMS: 10_000,
        });

        verifiedTestDatabase = true;
        assertTestDatabaseConnection();
        await verifyTransactionRollback();
        assertTestDatabaseConnection();

        return mongoose.connection;
    } catch (startupError) {
        verifiedTestDatabase = false;
        const cleanupErrors = [];
        try {
            await mongoose.disconnect();
        } catch (error) {
            cleanupErrors.push(error);
        }
        if (replicaSet) {
            const failedReplicaSet = replicaSet;
            replicaSet = undefined;
            try {
                await failedReplicaSet.stop();
            } catch (error) {
                cleanupErrors.push(error);
            }
        }
        throwCollectedErrors(
            startupError,
            cleanupErrors,
            "Failed to start the isolated test database; cleanup also reported errors."
        );
    }
};

export const clearTestDatabase = async () => {
    assertTestDatabaseConnection();
    await mongoose.connection.dropDatabase();
};

export const disconnectTestDatabase = async () => {
    const cleanupErrors = [];

    try {
        if (verifiedTestDatabase && mongoose.connection.readyState === 1) {
            assertTestDatabaseConnection();
            await mongoose.connection.dropDatabase();
        }
    } catch (error) {
        cleanupErrors.push(error);
    }

    verifiedTestDatabase = false;
    try {
        await mongoose.disconnect();
    } catch (error) {
        cleanupErrors.push(error);
    }
    if (replicaSet) {
        const activeReplicaSet = replicaSet;
        replicaSet = undefined;
        try {
            await activeReplicaSet.stop();
        } catch (error) {
            cleanupErrors.push(error);
        }
    }

    if (cleanupErrors.length > 0) {
        throwCollectedErrors(
            null,
            cleanupErrors,
            "Failed to clean up the isolated test database."
        );
    }
};
