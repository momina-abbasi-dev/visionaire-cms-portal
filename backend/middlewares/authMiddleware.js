import User from "../models/User.js";
import { verifyToken } from "../utils/jwt.js";

const protect = async (req, res, next) => {
    const authHeader = req.headers.authorization;
    if(!authHeader || !authHeader.startsWith("Bearer ")) {
        return res.status(401).json("No token provided");
    }
    const token = authHeader.split(" ")[1];

    let decoded;
    try {
        decoded = verifyToken(token);
    } catch (error) {
        return res.status(401).json({message: "Invalid token"});
    }

    if (!decoded.id) {
        return res.status(401).json({message: "Invalid token"});
    }

    let user;
    try {
        user = await User.findById(decoded.id).select("_id role status");
    } catch (error) {
        console.error("Authentication user lookup failed:", error);
        return res.status(503).json({message: "Authentication service unavailable"});
    }

    if (!user || user.status !== "active") {
        return res.status(401).json({message: "Invalid or inactive account"});
    }

    req.user = { id: user._id.toString(), role: user.role };
    return next();
}

export { protect };