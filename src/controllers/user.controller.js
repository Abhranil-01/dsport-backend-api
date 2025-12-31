import { asyncHandler } from "../utils/asyncHandler.js";
import { ApiError } from "../utils/ApiError.js";
import { User } from "../models/user.model.js";
import { ApiResponse } from "../utils/ApiResponse.js";
import jwt from "jsonwebtoken";
import nodemailer from "nodemailer";
import otpGenerator from "otp-generator";
const generateAccessTokenAndRefreshToken = async (userId) => {
  try {
    const user = await User.findById(userId);

    const accessToken = await user.generateAccessToken();
    const refreshToken = await user.generateRefreshToken();

    user.refreshToken = refreshToken;
    await user.save({
      validateBeforeSave: false,
    });

    return { accessToken, refreshToken };
  } catch (error) {
    console.log(error);

    throw new ApiError(
      500,
      "Error generating tokens when generating access token and refresh token"
    );
  }
};

const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST,
  port: process.env.SMTP_PORT,
  secure: false, // true for port 465, false for other ports
  auth: {
    user: process.env.SMTP_MAIL,
    pass: process.env.SMTP_PASSWORD,
  },
});
const userRegister = asyncHandler(async (req, res) => {
  const { fullname, email } = req.body;

  if (!fullname || !email) {
    throw new ApiError(400, "All fields are required");
  }

  let user = await User.findOne({ email });

  const otp = otpGenerator.generate(6, {
    upperCaseAlphabets: false,
    specialChars: false,
    lowerCaseAlphabets: false,
  });

  // If user exists but not verified → resend OTP + update details
  if (user && !user.isVerified) {
    user.fullname = fullname;
    user.otp = otp;
    user.otpExpiry = new Date(Date.now() + 5 * 60 * 1000);
    await user.save();
  }

  // If user exists and verified → throw error
  else if (user && user.isVerified) {
    throw new ApiError(409, "User already exists");
  }

  // If user does NOT exist → create user
  else {
    user = await User.create({
      fullname,
      email,
      otp,
      otpExpiry: new Date(Date.now() + 5 * 60 * 1000),
      isVerified: false,
    });
  }

  // Send OTP email
  await transporter.sendMail({
    from: process.env.SMTP_MAIL,
    to: email,
    subject: "OTP for Registration",
    text: `Your OTP is ${otp}. Valid for 5 minutes.`,
  });

  res
    .status(201)
    .json(new ApiResponse(201, {}, "OTP sent. Verify to complete registration."));
});

const getUser = asyncHandler(async (req, res) => {
  if (!req.user) {
    return res.status(401).json({
      loggedIn: false,
      message: "Not authenticated",
    });
  }

  return res.status(200).json({
    loggedIn: true,
    user: req.user,
  });
});
const loginUser = asyncHandler(async (req, res) => {
  const { email } = req.body;

  if (!email) throw new ApiError(400, "Email is required");

  const user = await User.findOne({ email });

  // User not found
  if (!user) throw new ApiError(404, "User not found");

  // User must be verified to login
  if (!user.isVerified)
    throw new ApiError(400, "User not verified. Complete registration first.");

  const otp = otpGenerator.generate(6, {
    upperCaseAlphabets: false,
    specialChars: false,
    lowerCaseAlphabets: false,
  });

  user.otp = otp;
  user.otpExpiry = new Date(Date.now() + 5 * 60 * 1000);
  await user.save();

  await transporter.sendMail({
    from: process.env.SMTP_MAIL,
    to: email,
    subject: "OTP for Login",
    text: `Your OTP is ${otp}.`,
  });

  res.status(200).json(new ApiResponse(200, {}, "OTP sent successfully"));
});


const verifyOtp = asyncHandler(async (req, res) => {
  const { email, otp } = req.body;

  if (!email || !otp) {
    throw new ApiError(400, "Email and OTP are required");
  }
console.log("f",otp);

  const user = await User.findOne({ email });
  if (!user) throw new ApiError(404, "User not found");

  const cleanedOtp = otp.trim();
console.log("d",user.otp,cleanedOtp);

  if (user.otp !== cleanedOtp) {
    throw new ApiError(400, "Invalid OTP");
  }

  if (user.otpExpiry < Date.now()) {
    throw new ApiError(400, "OTP expired");
  }

  user.isVerified = true;
  user.otp = null;
  user.otpExpiry = null;
  await user.save();

  const { accessToken, refreshToken } =
    await generateAccessTokenAndRefreshToken(user._id);
  const isProduction = process.env.NODE_ENV === "production";
const cookieOptions = {
   httpOnly: true,
    secure: isProduction,               // true only in production
    sameSite: isProduction ? "none" : "lax",
    domain: isProduction ? ".dsportdb.online" : undefined,
    path: "/",
};
  res
    .status(200)
    .cookie("accessToken", accessToken, cookieOptions)
    .cookie("refreshToken", refreshToken, cookieOptions)
    .json(
      new ApiResponse(
        200,
        { user, accessToken, refreshToken },
        "OTP verified successfully"
      )
    );
});






const logoutUser = asyncHandler(async (req, res) => {
  await User.findByIdAndUpdate(
    req.user._id,
    { $unset: { refreshToken: 1 } },
    { new: true }
  );

  const isProduction = process.env.NODE_ENV === "production";

  const cookieOptions = {
    httpOnly: true,
    secure: isProduction,                 // true in production
    sameSite: isProduction ? "none" : "lax",
    domain: isProduction ? ".dsportdb.online" : undefined,
    path: "/",
  };

  return res
    .status(200)
    .clearCookie("accessToken", cookieOptions)
    .clearCookie("refreshToken", cookieOptions)
    .json(new ApiResponse(200, {}, "User logged Out Successfully"));
});


const refreshAccessToken = asyncHandler(async (req, res) => {
  const incomingToken = req.cookies.refreshToken || req.body.refreshToken;

  if (!incomingToken) throw new ApiError(401, "Unauthorized");

  const decoded = jwt.verify(incomingToken, process.env.REFRESH_TOKEN_SECRET);

  const user = await User.findById(decoded._id);
  if (!user) throw new ApiError(401, "Invalid token");

  if (incomingToken !== user.refreshToken) {
    throw new ApiError(401, "Expired refresh token");
  }

  const { accessToken, refreshToken } =
    await generateAccessTokenAndRefreshToken(user._id);

  res
    .cookie("accessToken", accessToken, { httpOnly: true, secure: true })
    .cookie("refreshToken", refreshToken, { httpOnly: true, secure: true })
    .json(new ApiResponse(200, { accessToken, refreshToken }));
});

const resendOtp = asyncHandler(async (req, res) => {
  const { email, purpose } = req.body;
  // purpose = "register" | "login"

  if (!email || !purpose) {
    throw new ApiError(400, "Email and purpose are required");
  }

  const user = await User.findOne({ email });

  if (!user) {
    if (purpose === "register") {
      throw new ApiError(404, "User not found. Please register first.");
    }
    if (purpose === "login") {
      throw new ApiError(404, "User not found. Please sign up first.");
    }
  }

  // Registration: user exists but not verified
  if (purpose === "register" && user.isVerified) {
    throw new ApiError(400, "User already verified. Please login.");
  }

  // Login: user must be verified
  if (purpose === "login" && !user.isVerified) {
    throw new ApiError(400, "User not verified. Complete registration first.");
  }

  // Generate new OTP
  const otp = otpGenerator.generate(6, {
    upperCaseAlphabets: false,
    lowerCaseAlphabets: false,
    specialChars: false,
  });

  user.otp = otp;
  user.otpExpiry = Date.now() + 5 * 60 * 1000; // 5 min expiry
  await user.save();

  const mailOptions = {
    from: process.env.SMTP_MAIL,
    to: email,
    subject: "Your OTP",
    text: `Your new OTP is ${otp}. It is valid for 5 minutes.`,
  };

  transporter.sendMail(mailOptions, (err) => {
    if (err) console.log("Resend OTP email error:", err);
  });

  return res
    .status(200)
    .json(new ApiResponse(200, {}, "OTP resent successfully"));
});

export {
  userRegister,
  loginUser,
  logoutUser,
  refreshAccessToken,
  resendOtp,
  verifyOtp,
  getUser,
};
