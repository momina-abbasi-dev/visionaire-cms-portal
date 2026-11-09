// const adminOnly = (req, res, next) => {
//     if (req.user.role !== "admin") {
//         res.status(403).json({message: "Access denied"});
//     }
//     next();
// }

const authRoles = (...roles) => {
     return (req, res, next) => {
        if(!req.user || !roles.includes(req.user.role)) {
            return res.status(403).json({message: "Access denied"})
        }
        next();
    }
}

export {authRoles};
// export { adminOnly };