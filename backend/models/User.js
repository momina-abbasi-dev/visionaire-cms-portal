import mongoose from "mongoose";
import bcrypt from "bcryptjs";

const UserSchema = new mongoose.Schema(
    {
        name: {
            type: String,
            required: true,
            trim: true,
        },

        cnic: {
            type: String,
            required: true,
            unique: true,
            trim: true,
        },

        email: {
            type: String,
            required: true,
            unique: true,
            trim: true,
            lowercase: true,
        },

        password: {
            type: String,
            required: true,
        },

        role: {
            type: String,
            enum: ["student", "teacher", "admin"],
            required: true,
        },

        studentId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "Student",
        },

        teacherId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "Teacher",
        },

        status: {
            type: String,
            enum: ["active", "suspended"],
            default: "active",
        },
    },
    {
        timestamps: true,
    }
);


UserSchema.pre("save", async function () {
    if (!this.isModified("password")) {
        return;
    }

    const salt = await bcrypt.genSalt(10);

    this.password = await bcrypt.hash(
        this.password,
        salt
    );
});


UserSchema.methods.comparePassword = async function (enteredPassword) {
    return await bcrypt.compare(
        enteredPassword,
        this.password
    );
};


export default mongoose.model("User", UserSchema);