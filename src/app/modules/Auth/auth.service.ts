import prisma from "../../../shared/prisma";
import bcrypt from "bcrypt";
import config from "../../../config";
import { Secret } from "jsonwebtoken";
import { jwtHelpers } from "../../../helpers/jwtHelpers";
import AppError from "../../Errors/AppError";
import status from "http-status";
import { ORGANISATION_ROLE, User, USER_ROLE } from "@prisma/client";
import { sendOtpEmail } from "../../../utils/sendOtpEmail";
import { sendPasswordResetOtp } from "../../../utils/sendResetPasswordOtp";

interface RegisterPayload {
  email: string;
  password: string;
  role: "admin" | "agent" | "customer";
  name?: string;
}

const register = async (payload: RegisterPayload) => {
  const { email, password, role, name } = payload;

  if (!email || !password || !role) {
    throw new AppError(status.BAD_REQUEST, "Missing required fields");
  }

  if (password.length < 8) {
    throw new AppError(status.BAD_REQUEST, "Password must be at least 8 characters");
  }

  const normalizedRole = role.toLowerCase();

  if (!["admin", "customer"].includes(normalizedRole)) {
    throw new AppError(status.BAD_REQUEST, "Role not supported");
  }

  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) {
    throw new AppError(status.CONFLICT, "Email already exists");
  }

  const hashed = await bcrypt.hash(password, 12);

  const firstName = name ? name.split(" ")[0] : email.split("@")[0];
  const lastName = name ? name.split(" ").slice(1).join(" ") : "";

  const user = await prisma.user.create({
    data: {
      first_name: firstName,
      last_name: lastName,
      phone: "N/A",
      email,
      password: hashed,
      organisation_name: "N/A",
      role: normalizedRole === "admin" ? USER_ROLE.admin : USER_ROLE.customer,
      organisation_role: ORGANISATION_ROLE.agency,
      is_verified: true,
    },
    select: {
      id: true,
      email: true,
      role: true,
      first_name: true,
      last_name: true,
    },
  });

  const accessToken = jwtHelpers.generateToken(
    {
      id: user.id,
      email: user.email,
      role: user.role,
    },
    config.jwt.access_token_secret as Secret,
    config.jwt.access_token_expires_in as string
  );

  return {
    user: {
      id: user.id,
      email: user.email,
      role: user.role,
      name: [user.first_name, user.last_name].filter(Boolean).join(" "),
    },
    accessToken,
  };
};

const createUser = async (payload: User) => {
  // Step 1: Check if user already exists
  const isUserExist = await prisma.user.findFirst({
    where: { email: payload.email },
  });

  if (isUserExist) {
    throw new AppError(status.CONFLICT, "User Already Exist");
  }

  // Step 2: Hash password
  const hashPassword = await bcrypt.hash(payload.password, 12);

  // Step 3: Generate OTP (4 digits) & expiry (e.g., 10 minutes)
  const otp = Math.floor(1000 + Math.random() * 9000).toString();
  const otpExpiresAt = new Date(Date.now() + 5 * 60 * 1000);

  // Step 4: Prepare user data
  const userData = {
    ...payload,
    password: hashPassword,
    otp,
    otp_expires_at: otpExpiresAt,
    is_verified: false,
    role: USER_ROLE.customer,
    organisation_role: ORGANISATION_ROLE.advertiser,
  };

  console.log("📨 OTP generated:", otp);

  // // Step 5: Save user (exclude OTP in response)
  const result = await prisma.user.create({
    data: userData,
    select: {
      id: true,
      email: true,
      phone: true,
      is_verified: true,
    },
  });

  sendOtpEmail(payload.email, otp);

  return result;
};

const resendOtp = async (email: string) => {
  // Step 1: Find user by email
  const user = await prisma.user.findUnique({ where: { email } });

  if (!user) {
    throw new AppError(status.NOT_FOUND, "User not found");
  }

  if (user.is_verified) {
    throw new AppError(status.BAD_REQUEST, "User already verified");
  }

  // Step 2: Generate new OTP and expiry
  const otp = Math.floor(1000 + Math.random() * 9000).toString();
  const otpExpiresAt = new Date(Date.now() + 5 * 60 * 1000); // 5 minutes from now

  // Step 3: Update user record with new OTP
  await prisma.user.update({
    where: { email },
    data: {
      otp,
      otp_expires_at: otpExpiresAt,
    },
  });

  console.log("📨 New OTP generated:", otp);

  // Step 4: Send OTP email
  await sendOtpEmail(email, otp);

  return { message: "OTP resent successfully" };
};

const verifyOtp = async (email: string, otp: string) => {
  // Step 1: Find user by email
  const user = await prisma.user.findUnique({ where: { email } });

  if (!user) {
    throw new AppError(status.NOT_FOUND, "User not found");
  }

  if (user.is_verified) {
    throw new AppError(status.BAD_REQUEST, "User already verified");
  }

  // Step 2: Check OTP match
  if (user.otp !== otp) {
    throw new AppError(status.UNAUTHORIZED, "Invalid OTP");
  }

  // Step 3: Check OTP expiry
  if (user.otp_expires_at && user.otp_expires_at < new Date()) {
    throw new AppError(status.UNAUTHORIZED, "OTP has expired");
  }

  // Step 4: Mark user as verified and clear OTP
  const updatedUser = await prisma.user.update({
    where: { email },
    data: {
      is_verified: true,
      otp: null,
      otp_expires_at: null,
    },
    select: {
      id: true,
      email: true,
      phone: true,
      is_verified: true,
    },
  });

  return updatedUser;
};

const loginUser = async (payload: { email: string; password: string }) => {
  // Step 1: Find user by email
  const user = await prisma.user.findUnique({
    where: { email: payload.email },
  });

  if (!user) {
    throw new AppError(status.NOT_FOUND, "User not found");
  }

  // Step 2: Check if user is verified
  if (!user.is_verified) {
    throw new AppError(
      status.UNAUTHORIZED,
      "User not verified. Please verify your email/OTP."
    );
  }

  // Step 3: Verify password
  const isCorrectPassword = await bcrypt.compare(
    payload.password,
    user.password
  );
  if (!isCorrectPassword) {
    throw new AppError(status.UNAUTHORIZED, "Incorrect password");
  }

  // Step 4: Generate access & refresh tokens
  const accessToken = jwtHelpers.generateToken(
    {
      id: user.id,
      email: user.email,
      first_name: user.first_name,
      last_name: user.last_name,
      role: user.role,
      organisation_role: user.organisation_role,
      organisation_name: user.organisation_name,
      phone: user.phone,
    },
    config.jwt.access_token_secret as Secret,
    config.jwt.access_token_expires_in as string
  );

  const refreshToken = jwtHelpers.generateToken(
    { email: user.email },
    config.jwt.refresh_token_secret as Secret,
    config.jwt.refresh_token_expires_in as string
  );

  // Step 5: Return user info + tokens (exclude password)
  return {
    user: {
      id: user.id,
      first_name: user.first_name,
      last_name: user.last_name,
      email: user.email,
      phone: user.phone,
      role: user.role,
      organisation_role: user.organisation_role,
      organisation_name: user.organisation_name,
      is_verified: user.is_verified,
    },
    accessToken,
    refreshToken,
  };
};

const refreshAccessToken = async (token: string) => {
  try {
    // validate refresh token
    const decoded = jwtHelpers.verifyToken(
      token,
      config.jwt.refresh_token_secret as Secret
    );

    const { email } = decoded;

    const userData = await prisma.user.findFirst({
      where: { email },
    });

    if (!userData) {
      throw new AppError(status.NOT_FOUND, "User not found");
    }

    const accessToken = jwtHelpers.generateToken(
      {
        id: userData.id,
        email: userData.email,
        first_name: userData.first_name,
        last_name: userData.last_name,
        role: userData.role,
        organisation_role: userData.organisation_role,
        phone: userData.phone,
      },
      config.jwt.access_token_secret as Secret,
      config.jwt.access_token_expires_in as string
    );

    return {
      accessToken,
    };
  } catch (err) {
    throw new AppError(status.UNAUTHORIZED, "Invalid refresh token");
  }
};

interface ChangePasswordPayload {
  id: string;
  oldPassword: string;
  newPassword: string;
}

const changePassword = async (payload: ChangePasswordPayload) => {
  const { id, oldPassword, newPassword } = payload;

  // Step 1: Find user by id
  const user = await prisma.user.findUnique({ where: { id } });

  if (!user) {
    throw new AppError(status.NOT_FOUND, "User not found");
  }

  // Step 2: Verify old password
  const isCorrectPassword = await bcrypt.compare(oldPassword, user.password);
  if (!isCorrectPassword) {
    throw new AppError(status.UNAUTHORIZED, "Old password is incorrect");
  }

  // Step 3: Hash new password
  const hashedNewPassword = await bcrypt.hash(newPassword, 12);

  // Step 4: Update password in database
  await prisma.user.update({
    where: { id },
    data: { password: hashedNewPassword },
  });

  return { message: "Password changed successfully" };
};


const requestPasswordReset = async (email: string) => {
  const user = await prisma.user.findUnique({ where: { email } });
  if (!user) throw new AppError(status.NOT_FOUND, "User not found");

  // Generate 4-digit OTP
  const otp = Math.floor(1000 + Math.random() * 9000).toString();

  // Set expiry 5 minutes from now
  const otpExpiresAt = new Date(Date.now() + 5 * 60 * 1000); // 5 minutes

  // Update user with OTP
  await prisma.user.update({
    where: { email },
    data: {
      password_reset_otp: otp,
      password_reset_expires: otpExpiresAt,
    },
  });

  // Send OTP to user email
  await sendPasswordResetOtp(email, otp);

  return { message: "Password reset OTP sent to your email" };
};


interface ResetPasswordPayload {
  email: string;
  otp: string;        // 4-digit OTP
  newPassword: string;
}

const resetPassword = async (payload: ResetPasswordPayload & { opt?: string }) => {
  const { email, otp, newPassword, opt } = payload;
  const otpCode = otp || opt; // use otp if present, otherwise opt

  const user = await prisma.user.findUnique({ where: { email } });
  if (!user) throw new AppError(status.NOT_FOUND, "User not found");

  if (!user.password_reset_otp || user.password_reset_otp !== otpCode) {
    throw new AppError(status.UNAUTHORIZED, "Invalid OTP");
  }

  if (!user.password_reset_expires || user.password_reset_expires < new Date()) {
    throw new AppError(status.UNAUTHORIZED, "OTP has expired");
  }

  const hashedPassword = await bcrypt.hash(newPassword, 12);

  await prisma.user.update({
    where: { email },
    data: {
      password: hashedPassword,
      password_reset_otp: null,
      password_reset_expires: null,
    },
  });

  return { message: "Password has been reset successfully" };
};


export const UserService = {
  register,
  createUser,
  loginUser,
  resendOtp,
  refreshAccessToken,
  verifyOtp,
  changePassword,
  requestPasswordReset,
  resetPassword
};
