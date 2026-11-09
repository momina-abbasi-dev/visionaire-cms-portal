import mongoose from "mongoose";

const connectDB = async (req, res) => {
    try {
        const conn = await mongoose.connect(process.env.MONGO_URI);
        console.log("MongoDB is connected");
    } catch (error) {
        console.error("MongoDB Connection failed" + error.message);
        process.exit(1);
    }
}

export default connectDB;