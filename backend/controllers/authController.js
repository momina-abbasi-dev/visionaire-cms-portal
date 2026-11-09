import User from "../models/User.js";
import { generateToken } from "../utils/jwt.js";

const login = async (req, res) => {
    const {email, password} = req.body;
    try {
        const user = await User.findOne({ email });
        if (!user || user.status !== "active") {
            return res.status(401).json({ message: "Invalid email or password" });
        }
        const isMatch = await user.comparePassword(password);
        if (!isMatch) {
            return res.status(401).json({ message: "Invalid email or password" });
        }
        const token = generateToken(user);
        res.status(200).json({ message: "User logged in successfully", user: {
            id: user._id,
            name: user.name,
            role: user.role
        }, token });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
}

export { login };