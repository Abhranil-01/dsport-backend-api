export const authorizeSuperandAdmin = (req, res, next) => {
  if (!req.admin) {
    return res.status(401).json({ message: "Unauthorized" });
  }

  if (!["superadmin", "admin"].includes(req.admin.role)) {
    return res.status(403).json({
      message: "Access denied. Only super admins and admins allowed.",
    });
  }

  next();
};
