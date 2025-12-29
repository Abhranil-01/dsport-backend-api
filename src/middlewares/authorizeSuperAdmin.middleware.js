export const authorizeSuperAdmin = (req, res, next) => {
  if (req.admin.role !== "superadmin") {
    throw new ApiError(403, "Only Super Admin allowed");
  }
  next();
};
