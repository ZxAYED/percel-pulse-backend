import express from "express";
import { UserController } from "./auth.controller";
import RoleValidation from "../../middlewares/RoleValidation";
import { USER_ROLE } from "@prisma/client";

const router = express.Router();

router.post("/register", UserController.register);
router.post("/create-user", UserController.createUser);
router.post("/resend-otp", UserController.resendOtp);
router.post("/verify-otp", UserController.verifyOtp);
router.post("/login", UserController.loginUser);
router.post("/refresh-token", UserController.refreshToken);
router.post("/reset-password", UserController.resetPassword);
router.post("/request-reset-password", UserController.requestPasswordReset);
router.post(
  "/change-password",
  RoleValidation(USER_ROLE.customer, USER_ROLE.admin),
  UserController.changePassword
);

export const AuthRoutes = router;
