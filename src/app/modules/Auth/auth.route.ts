import express from "express";
import RoleValidation from "../../middlewares/RoleValidation";
import validateJSON from "../../middlewares/validateJSON";
import { UserController } from "./auth.controller";
import {
  changePasswordSchema,
  loginSchema,
  registerSchema,
  requestResetPasswordSchema,
  resendOtpSchema,
  resetPasswordSchema,
  verifyOtpSchema,
} from "./auth.validation";

const router = express.Router();

router.post("/register", validateJSON(registerSchema), UserController.register);
router.post("/resend-otp", validateJSON(resendOtpSchema), UserController.resendOtp);
router.post("/verify-otp", validateJSON(verifyOtpSchema), UserController.verifyOtp);
router.post("/login", validateJSON(loginSchema), UserController.loginUser);
router.post("/refresh-token", UserController.refreshToken);
router.post("/reset-password", validateJSON(resetPasswordSchema), UserController.resetPassword);
router.post(
  "/request-reset-password",
  validateJSON(requestResetPasswordSchema),
  UserController.requestPasswordReset
);
router.post(
  "/change-password",
  RoleValidation("CUSTOMER","customer","ADMIN","admin"),
  validateJSON(changePasswordSchema),
  UserController.changePassword
);

export const AuthRoutes = router;
