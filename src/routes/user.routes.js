import { Router } from "express";
import {
  getUser,
  loginUser,
  logoutUser,
  refreshAccessToken,
  resendOtp,
  userRegister,
  verifyOtp,
} from "../controllers/user.controller.js";
import { verifyJWT } from "../middlewares/auth.middleware.js";
const router = Router();

router.route("/register").post(userRegister);
router.route("/login").post(loginUser);
router.route("/userotpverification").post(verifyOtp);
// router.route("/userotpverification").post(userVerified);
router.route("/logout").post(verifyJWT, logoutUser);
router.route("/refresh-token").post(refreshAccessToken);
// router.route("/otp-login").post(verifyOtpAndLogin)
router.route("/resend-otp").post(resendOtp);
router.route("/getuser").get(verifyJWT, getUser);
export default router;
