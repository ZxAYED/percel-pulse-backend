import { Role } from "@prisma/client";
import bcrypt from "bcrypt";
import status from "http-status";
import { Secret } from "jsonwebtoken";
import config from "../../../config";
import { jwtHelpers } from "../../../helpers/jwtHelpers";
import prisma from "../../../shared/prisma";
import { sendOtpEmail } from "../../../utils/sendOtpEmail";
import { sendPasswordResetOtp } from "../../../utils/sendResetPasswordOtp";
import AppError from "../../Errors/AppError";

interface RegisterPayload {
  email: string;
  password: string;
  role: Role;
  name?: string;
}

const generateOtp = () =>
  Math.floor(100000 + Math.random() * 900000).toString();

const register = async (payload: RegisterPayload) => {
  const { email, password, role, name } = payload;

  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) {
    throw new AppError(status.CONFLICT, "Email already exists");
  }

  const hashed = await bcrypt.hash(password, 12);

  const user = await prisma.user.create({
    data: {
      name: name || email.split("@")[0],
      phone: null,
      email,
      password: hashed,
      role,
      isActive: true,
      isVerified: false,
    },
    select: {
      id: true,
      email: true,
      role: true,
      name: true,
    },
  });

  const otp = generateOtp();
  const expires = new Date(Date.now() + 5 * 60 * 1000);
  await prisma.user.update({
    where: { id: user.id },
    data: {
      verificationOtp: otp,
      verificationOtpExpiresAt: expires,
    },
  });
  await sendOtpEmail(email, otp);

  return {
    user: {
      id: user.id,
      email: user.email,
      role: user.role,
      name: user.name,
    },
    otpSent: true,
    otpExpiresAt: expires,
  };
};



const resendOtp = async (email: string) => {
  const user = await prisma.user.findUnique({ where: { email } });
  if (!user) {
    throw new AppError(status.NOT_FOUND, "User not found");
  }
  const otp = generateOtp();
  const expires = new Date(Date.now() + 5 * 60 * 1000);
  await prisma.user.update({
    where: { id: user.id },
    data: {
      verificationOtp: otp,
      verificationOtpExpiresAt: expires,
      isVerified: false,
    },
  });
  await sendOtpEmail(email, otp);
  return { message: "OTP resent", expiresAt: expires };
};

const verifyOtp = async (email: string, otp: string) => {
  const user = await prisma.user.findUnique({
    where: { email },
    select: {
      id: true,
      verificationOtp: true,
      verificationOtpExpiresAt: true,
      isVerified: true,
    },
  });
  if (!user) {
    throw new AppError(status.NOT_FOUND, "User not found");
  }
  if (!user.verificationOtp || !user.verificationOtpExpiresAt) {
    throw new AppError(status.BAD_REQUEST, "No OTP to verify");
  }
  if (user.verificationOtp !== otp) {
    throw new AppError(status.UNAUTHORIZED, "Invalid OTP");
  }
  if (new Date(user.verificationOtpExpiresAt).getTime() < Date.now()) {
    throw new AppError(status.UNAUTHORIZED, "OTP expired");
  }
  await prisma.user.update({
    where: { id: user.id },
    data: {
      isVerified: true,
      verificationOtp: null,
      verificationOtpExpiresAt: null,
    },
  });
  return { message: "Email verified successfully" };
};

const loginUser = async (payload: { email: string; password: string }) => {
  const user = await prisma.user.findUnique({
    where: { email: payload.email },
  });

  if (!user) {
    throw new AppError(status.NOT_FOUND, "User not found");
  }

  if (!user.isVerified) {
    throw new AppError(status.FORBIDDEN, "Email not verified. Please verify OTP sent to your email.");
  }

  const isCorrectPassword = await bcrypt.compare(
    payload.password,
    user.password
  );
  if (!isCorrectPassword) {
    throw new AppError(status.UNAUTHORIZED, "Incorrect password");
  }

  await prisma.user.update({
    where: { id: user.id },
    data: { lastLoginAt: new Date() },
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
      name: user.name,
      email: user.email,
      phone: user.phone,
      role: user.role,
    },
    accessToken,
  };
};

const refreshAccessToken = async (token: string) => {
  throw new AppError(status.BAD_REQUEST, "Refresh token disabled");
};

interface ChangePasswordPayload {
  id: string;
  oldPassword: string;
  newPassword: string;
}

const changePassword = async (payload: ChangePasswordPayload) => {
  const { id, oldPassword, newPassword } = payload;

  const user = await prisma.user.findUnique({ where: { id } });

  if (!user) {
    throw new AppError(status.NOT_FOUND, "User not found");
  }

  const isCorrectPassword = await bcrypt.compare(oldPassword, user.password);
  if (!isCorrectPassword) {
    throw new AppError(status.UNAUTHORIZED, "Old password is incorrect");
  }

  const hashedNewPassword = await bcrypt.hash(newPassword, 12);

  await prisma.user.update({
    where: { id },
    data: { password: hashedNewPassword },
  });

  return { message: "Password changed successfully" };
};

const requestPasswordReset = async (email: string) => {
  const user = await prisma.user.findUnique({ where: { email } });
  if (!user) throw new AppError(status.NOT_FOUND, "User not found");
  const otp = generateOtp();
  const expires = new Date(Date.now() + 5 * 60 * 1000);
  await prisma.user.update({
    where: { id: user.id },
    data: {
      verificationOtp: otp,
      verificationOtpExpiresAt: expires,
    },
  });
  await sendPasswordResetOtp(email, otp);
  return { otpSent: true, otpExpiresAt: expires };
};


const resetPassword = async (payload: { email: string; otp: string; newPassword: string }) => {
  const user = await prisma.user.findUnique({
    where: { email: payload.email },
    select: {
      id: true,
      verificationOtp: true,
      verificationOtpExpiresAt: true,
    },
  });
  if (!user) throw new AppError(status.NOT_FOUND, "User not found");
  if (!user.verificationOtp || !user.verificationOtpExpiresAt) {
    throw new AppError(status.BAD_REQUEST, "No reset OTP found");
  }
  if (user.verificationOtp !== payload.otp) {
    throw new AppError(status.UNAUTHORIZED, "Invalid OTP");
  }
  if (new Date(user.verificationOtpExpiresAt).getTime() < Date.now()) {
    throw new AppError(status.UNAUTHORIZED, "OTP expired");
  }
  const hashed = await bcrypt.hash(payload.newPassword, 12);
  await prisma.user.update({
    where: { id: user.id },
    data: {
      password: hashed,
      verificationOtp: null,
      verificationOtpExpiresAt: null,
    },
  });
  return { message: "Password has been reset successfully" };
};


export const UserService = {
  register,

  loginUser,
  resendOtp,
  refreshAccessToken,
  verifyOtp,
  changePassword,
  requestPasswordReset,
  resetPassword
};
