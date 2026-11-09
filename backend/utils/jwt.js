import jwt from "jsonwebtoken";

const generateToken = (user) => {
    try {
        return jwt.sign({ id: user._id, role: user.role}, process.env.JWT_SECRET, {expiresIn: "2d"})
    } catch (error) {
        throw new Error("User not found");
    }
}

const verifyToken = (token) => {
    try {
        return jwt.verify(token, process.env.JWT_SECRET)
    } catch (error) {
        throw new Error("Invalid token");
    }
}

export { generateToken, verifyToken };