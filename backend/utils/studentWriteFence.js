import Student from "../models/Student.js";

export const isTransactionWriteConflict = (error) =>
    error?.code === "WRITE_FENCE_CONFLICT" ||
    error?.code === 112 ||
    error?.codeName === "WriteConflict" ||
    (typeof error?.hasErrorLabel === "function" &&
        error.hasErrorLabel("TransientTransactionError"));

export const acquireStudentWriteFence = async (studentId, session) => {
    const snapshot = await Student.findById(studentId)
        .select("_id __v")
        .session(session);

    if (!snapshot) return null;

    const versionFilter =
        snapshot.__v === undefined
            ? { __v: { $exists: false } }
            : { __v: snapshot.__v };
    const result = await Student.updateOne(
        { _id: snapshot._id, ...versionFilter },
        { $inc: { __v: 1 } },
        { session }
    );

    if (result.matchedCount !== 1) {
        const error = new Error("Student changed during the operation.");
        error.code = "WRITE_FENCE_CONFLICT";
        throw error;
    }

    const student = await Student.findById(snapshot._id).session(session);
    if (!student) {
        const error = new Error("Student changed during the operation.");
        error.code = "WRITE_FENCE_CONFLICT";
        throw error;
    }

    return student;
};
