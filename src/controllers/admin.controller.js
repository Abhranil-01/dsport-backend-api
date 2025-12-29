import { asyncHandler } from "../utils/asyncHandler.js";
import { ApiError } from "../utils/ApiError.js";
import { ApiResponse } from "../utils/ApiResponse.js";
import { Admin } from "../models/admin.model.js";
import jwt from "jsonwebtoken";
import { uploadFileOnCloudinary } from "../utils/uploadFilesOnCloudinary.js";
import { sendEmail } from "../utils/sendEmail.js";

/* helper */
const generateUniqueUsername = async (fullname) => {
  // abhranil kundu -> abhranilkundu
  const baseUsername = fullname
    .toLowerCase()
    .replace(/\s+/g, "");

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

  // 📧 SEND EMAIL
  await sendEmail({
    to: email,
    subject: "Admin Account Created",
    html: `
      <h2>Welcome to Dsport Admin Panel</h2>
      <p>Your admin account has been created.</p>
      <p><b>Username:</b> ${username}</p>
      <p><b>Email:</b> ${email}</p>
      <p><b>Password:</b> ${password}</p>
      <p>Please login and change your password.</p>
    `,
  });

  res.status(201).json(
    new ApiResponse(201, admin, "Admin created successfully")
  );
});



/* LOGIN */
export const loginAdmin = asyncHandler(async (req, res) => {
  const { identifier, password } = req.body;
console.log("jjo");

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

  res
    // .cookie("adminAccessToken", accessToken, {
    //   httpOnly: true,
    //   secure: true,
    //   sameSite: "strict",
    // })
    // .cookie("adminRefreshToken", refreshToken, {
    //   httpOnly: true,
    //   secure: true,
    //   sameSite: "strict",
    // })
    .json(new ApiResponse(200, {admin,accessToken,refreshToken}, "Admin logged in"));
});


/* LOGOUT */
export const logoutAdmin = asyncHandler(async (req, res) => {
  await Admin.findByIdAndUpdate(req.admin._id, {
    $unset: { refreshToken: 1 },
  });

  res
    .clearCookie("adminAccessToken")
    .clearCookie("adminRefreshToken")
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

  const admins = await Admin.find(filter).select(
    "-password -refreshToken"
  );

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

  await sendEmail({
    to: admin.email,
    subject: "Password Reset OTP",
    html: `
      <h2>Password Reset Request</h2>
      <p>Your OTP is:</p>
      <h1>${otp}</h1>
      <p>This OTP will expire in 10 minutes.</p>
    `,
  });

  res.json(new ApiResponse(200, {}, "OTP sent to email"));
});import crypto from "crypto";

export const resetPasswordWithOtp = asyncHandler(async (req, res) => {
  const { email, otp, newPassword } = req.body;

  const hashedOtp = crypto
    .createHash("sha256")
    .update(otp)
    .digest("hex");

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

  res.json(
    new ApiResponse(200, {}, "Password reset successful")
  );
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
    await sendEmail({
      to: admin.email,
      subject: "Profile Updated Successfully",
      html: `
        <h3>Profile Update</h3>
        <p>Your admin profile has been updated successfully.</p>
        ${fullname ? `<p><b>Updated Name:</b> ${fullname}</p>` : ""}
      `,
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
  await sendEmail({
    to: admin.email,
    subject: "Admin Role Updated",
    html: `
      <h3>Role Update Notification</h3>
      <p>Your admin role has been updated.</p>
      <p><b>New Role:</b> ${admin.role}</p>
    `,
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
  await sendEmail({
    to: admin.email,
    subject: "Admin Account Deleted",
    html: `
      <h3>Account Removal Notice</h3>
      <p>Your admin account has been removed from the system.</p>
      <p>If this was a mistake, please contact the Super Admin.</p>
    `,
  });

  res.json(new ApiResponse(200, {}, "Admin deleted"));
});

/* GET MY PROFILE */
export const getMyProfile = asyncHandler(async (req, res) => {
  const admin = await Admin.findById(req.admin._id)
    .select("-password -refreshToken");

  if (!admin) {
    throw new ApiError(404, "Admin not found");
  }

  res.json(
    new ApiResponse(
      200,
      admin,
      "Admin profile fetched successfully"
    )
  );
});
