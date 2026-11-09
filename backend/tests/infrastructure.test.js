import assert from "node:assert/strict";
import { after, before, test } from "node:test";
import mongoose from "mongoose";
import {
    connectTestDatabase,
    disconnectTestDatabase,
} from "./support/testDatabase.js";
import { createTestApp } from "./support/testApp.js";

before(async () => {
    await connectTestDatabase();
});

after(async () => {
    await disconnectTestDatabase();
});

test("connects only to the local transaction-capable test database", () => {
    assert.equal(mongoose.connection.name, "visionaire_educore_stage1_test");
    assert.equal(
        mongoose.connection.getClient().topology.description.type,
        "ReplicaSetWithPrimary"
    );
    assert.ok(
        ["127.0.0.1", "localhost", "::1"].includes(mongoose.connection.host)
    );
});

test("mounts existing Stage 1 routes without starting a network listener", () => {
    const app = createTestApp();
    assert.equal(typeof app, "function");
    assert.equal(typeof app.listen, "function");
});
