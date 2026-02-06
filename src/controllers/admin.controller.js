import { asyncHandler } from "../utils/asyncHandler.js";
import { ApiError } from "../utils/ApiError.js";
import { ApiResponse } from "../utils/ApiResponse.js";
import { Admin } from "../models/admin.model.js";
import jwt from "jsonwebtoken";
import { uploadFileOnCloudinary } from "../utils/uploadFilesOnCloudinary.js";
import { addEmailJob } from "../utils/addEmailJob.js";
import { adminAccountDeletedTemplate, adminRoleUpdatedTemplate, profileUpdatedTemplate, sendCredentialsTemplate } from "../utils/adminEmailTemplate.js";
import  crypto  from 'crypto';

/* helper */
const generateUniqueUsername = async (fullname) => {
  // abhranil kundu -> abhranilkundu
  const baseUsername = fullname.toLowerCase().replace(/\s+/g, "");

  let username = baseUsername;
  let count = 0;

  while (await Admin.exists({ username })) {
    count++;
    username = `${baseUsername}${count}`;
  }

  return username;
};

const generateAccessTokenAndRefreshToken = async (adminId) => {
  const admin = await Admin.findById(adminId);

  const accessToken = admin.generateAccessToken();
  const refreshToken = admin.generateRefreshToken();

  admin.refreshToken = refreshToken;
  await admin.save({ validateBeforeSave: false });

  return { accessToken, refreshToken };
};

/* CREATE ADMIN (SUPER ADMIN) */
export const createAdminBySuperAdmin = asyncHandler(async (req, res) => {
  const { fullname, email, password, role } = req.body;

  const existingEmail = await Admin.findOne({ email });
  if (existingEmail) {
    throw new ApiError(409, "Email is already registered");
  }

  const username = await generateUniqueUsername(fullname);

  const admin = await Admin.create({
    fullname,
    email,
    password,
    role,
    username,
  });


  await addEmailJob({
    to: email,
    subject: "Welcome to Dsport Admin Panel",
    html: sendCredentialsTemplate({
      fullname,
      username,
      email,
      password,
      role
    }),
    priority: 1,
  });

  res
    .status(201)
    .json(new ApiResponse(201, admin, "Admin created successfully"));
});

/* LOGIN */
export const loginAdmin = asyncHandler(async (req, res) => {
  const { identifier, password } = req.body;

  if (!identifier || !password) {
    throw new ApiError(400, "All fields are required");
  }

  const admin = await Admin.findOne({
    $or: [{ email: identifier }, { username: identifier }],
  });

  if (!admin) throw new ApiError(404, "Admin not found");

  const isValid = await admin.isPasswordCorrect(password);
  if (!isValid) throw new ApiError(401, "Invalid credentials");

  const accessToken = admin.generateAccessToken();
  const refreshToken = admin.generateRefreshToken();

  admin.refreshToken = refreshToken;
  await admin.save({ validateBeforeSave: false });

  const isProduction = process.env.NODE_ENV === "production";

  const cookieOptions = {
    httpOnly: true,
    secure: isProduction,
    sameSite: isProduction ? "none" : "lax",
    domain: isProduction ? ".dsportdb.online" : undefined,
    path: "/",
  };

  res
    .cookie("adminAccessToken", accessToken, cookieOptions)
    .cookie("adminRefreshToken", refreshToken, cookieOptions)
    .json(
      new ApiResponse(
        200,
        { admin, accessToken, refreshToken },
        "Admin logged in"
      )
    );
});

/* LOGOUT */
export const logoutAdmin = asyncHandler(async (req, res) => {
  await Admin.findByIdAndUpdate(req.admin._id, {
    $unset: { refreshToken: 1 },
  });

  const isProduction = process.env.NODE_ENV === "production";

  const cookieOptions = {
    httpOnly: true,
    secure: isProduction,
    sameSite: isProduction ? "none" : "lax",
    domain: isProduction ? ".dsportdb.online" : undefined,
    path: "/",
  };

  res
    .clearCookie("adminAccessToken", cookieOptions)
    .clearCookie("adminRefreshToken", cookieOptions)
    .json(new ApiResponse(200, {}, "Admin logged out"));
});

/* REFRESH TOKEN */
export const refreshAccessToken = asyncHandler(async (req, res) => {
  const token = req.cookies.adminRefreshToken;

  if (!token) throw new ApiError(401, "No refresh token");

  const decoded = jwt.verify(token, process.env.REFRESH_TOKEN_SECRET);

  const admin = await Admin.findById(decoded._id);

  if (!admin || admin.refreshToken !== token) {
    throw new ApiError(401, "Invalid refresh token");
  }

  const newAccessToken = admin.generateAccessToken();
  const newRefreshToken = admin.generateRefreshToken();

  admin.refreshToken = newRefreshToken;
  await admin.save({ validateBeforeSave: false });

  res
    .cookie("adminAccessToken", newAccessToken, {
      httpOnly: true,
      secure: true,
      sameSite: "strict",
    })
    .cookie("adminRefreshToken", newRefreshToken, {
      httpOnly: true,
      secure: true,
      sameSite: "strict",
    })
    .json(new ApiResponse(200, {}, "Token refreshed"));
});

/* GET ALL ADMINS (SUPER ADMIN) */
export const getAllAdmins = asyncHandler(async (req, res) => {
  const { search, role } = req.query;

  const filter = {};

  if (search) {
    filter.$or = [
      { username: { $regex: search, $options: "i" } },
      { fullname: { $regex: search, $options: "i" } },
      { email: { $regex: search, $options: "i" } },
    ];
  }

  if (role) {
    filter.role = role;
  }

  const admins = await Admin.find(filter).select("-password -refreshToken");

  res.json(new ApiResponse(200, admins));
});

/* UPDATE OWN PASSWORD */

export const forgotPassword = asyncHandler(async (req, res) => {
  const { email } = req.body;

  const admin = await Admin.findOne({ email });
  if (!admin) {
    throw new ApiError(404, "Admin not found");
  }

  // Generate 6 digit OTP
  const otp = Math.floor(100000 + Math.random() * 900000).toString();

  admin.otp = crypto.createHash("sha256").update(otp).digest("hex");
  admin.otpExpiry = Date.now() + 10 * 60 * 1000; // 10 mins
  await admin.save({ validateBeforeSave: false });

 
  await addEmailJob({
    to: admin.email,
    subject: "Dsport Admin Panel – Password Reset OTP",
    html: forgotPasswordOtpTemplate({
      fullname,otp
    }),
    priority: 1,
  });
  res.json(new ApiResponse(200, {}, "OTP sent to email"));
});

export const resetPasswordWithOtp = asyncHandler(async (req, res) => {
  const { email, otp, newPassword } = req.body;

  const hashedOtp = crypto.createHash("sha256").update(otp).digest("hex");

  const admin = await Admin.findOne({
    email,
    otp: hashedOtp,
    otpExpiry: { $gt: Date.now() },
  });

  if (!admin) {
    throw new ApiError(400, "Invalid or expired OTP");
  }

  admin.password = newPassword;
  admin.otp = undefined;
  admin.otpExpiry = undefined;

  await admin.save();

  res.json(new ApiResponse(200, {}, "Password reset successful"));
});

/* UPDATE OWN IMAGE + PHONE */
export const updateMyProfile = asyncHandler(async (req, res) => {
  const { fullname } = req.body;

  let avatarUrl;
  if (req.file) {
    const upload = await uploadFileOnCloudinary(req.file.path);
    if (!upload) throw new ApiError(500, "Upload failed");
    avatarUrl = upload.secure_url;
  }

  const admin = await Admin.findByIdAndUpdate(
    req.admin._id,
    {
      ...(fullname && { fullname }),
      ...(avatarUrl && { avatar: avatarUrl }),
    },
    { new: true }
  ).select("-password -refreshToken");

  // 📧 SEND EMAIL
await addEmailJob({
  to: admin.email,
  subject: "Dsport Admin Profile Updated",
  html: profileUpdatedTemplate({ fullname }),
  priority:1
});


  res.json(new ApiResponse(200, admin, "Profile updated"));
});

/* UPDATE ROLE (SUPER ADMIN) */
export const updateAdminRole = asyncHandler(async (req, res) => {
  const admin = await Admin.findByIdAndUpdate(
    req.params.id,
    { role: req.body.role },
    { new: true }
  );

  if (!admin) {
    throw new ApiError(404, "Admin not found");
  }

  // 📧 SEND EMAIL
await addEmailJob({
  to: admin.email,
  subject: "Dsport Admin Role Updated",
  html: adminRoleUpdatedTemplate({ role: admin.role }),
  priority:1
});


  res.json(new ApiResponse(200, admin, "Role updated"));
});

/* DELETE ADMIN (SUPER ADMIN) */
export const deleteAdminDetails = asyncHandler(async (req, res) => {
  const admin = await Admin.findById(req.params.id);

  if (!admin) {
    throw new ApiError(404, "Admin not found");
  }

  await Admin.findByIdAndDelete(req.params.id);

  // 📧 SEND EMAIL
await addEmailJob({
  to: admin.email,
  subject: "Dsport Admin Account Removed",
  html: adminAccountDeletedTemplate(),
  priority:1
});


  res.json(new ApiResponse(200, {}, "Admin deleted"));
});

/* GET MY PROFILE */
export const getMyProfile = asyncHandler(async (req, res) => {
  const admin = await Admin.findById(req.admin._id).select(
    "-password -refreshToken"
  );

  if (!admin) {
    throw new ApiError(404, "Admin not found");
  }

  res.json(new ApiResponse(200, admin, "Admin profile fetched successfully"));
});
