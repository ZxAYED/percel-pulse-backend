import { Request, RequestHandler } from "express";
import catchAsync from "../../../shared/catchAsync";
import sendResponse from "../../../shared/sendResponse";
import status from "http-status";
import { UserService } from "./auth.service";

const register: RequestHandler = catchAsync(async (req, res) => {
  const result = await UserService.register(req.body);

  sendResponse(res, {
    statusCode: status.CREATED,
    success: true,
    message: "User registered successfully.",
    data: result,
  });
});

const createUser: RequestHandler = catchAsync(async (req, res) => {
  const result = await UserService.createUser(req.body);

  sendResponse(res, {
    statusCode: status.OK,
    success: true,
    message: "User Registration Successfuly. Please verify your email.",
    data: result,
  });
});
const resendOtp: RequestHandler = catchAsync(async (req, res) => {
  const result = await UserService.resendOtp(req.body.email);

  sendResponse(res, {
    statusCode: status.OK,
    success: true,
    message: "OTP resent successfully.",
    data: result,
  });
});
const verifyOtp: RequestHandler = catchAsync(async (req, res) => {
  const result = await UserService.verifyOtp(req.body.email, req.body.otp);

  sendResponse(res, {
    statusCode: status.OK,
    success: true,
    message: "OTP verified successfully.",
    data: result,
  });
});
const changePassword: RequestHandler = catchAsync(async (req:Request & {user?:any}, res) => {

  const payload={
    ...req.body, 
    id:req.user?.id
  }


  const result = await UserService.changePassword(payload);

  sendResponse(res, {
    statusCode: status.OK,
    success: true,
    message: "Password changed successfully.",
    data: result,
  });
});

const loginUser: RequestHandler = catchAsync(async (req, res) => {
  const result = await UserService.loginUser(req.body);
  const { refreshToken, ...others } = result;

  res.cookie("refreshToken", refreshToken, {
    secure: process.env.NODE_ENV === "production",
    httpOnly: true,
  });

  sendResponse(res, {
    statusCode: status.OK,
    success: true,
    message: "User Login Successfuly.",
    data: result,
  });
});

const refreshToken: RequestHandler = catchAsync(async (req, res) => {
  const refreshToken = req.cookies.refreshToken; 
  console.log({ refreshToken });

  const result = await UserService.refreshAccessToken(refreshToken);

  sendResponse(res, {
    statusCode: status.OK,
    success: true,
    message: "Access token refreshed successfully.",
    data: result,
  });
});


const requestPasswordReset: RequestHandler = catchAsync(async (req, res) => {
  const result = await UserService.requestPasswordReset(req.body.email);

  sendResponse(res, {
    statusCode: status.OK,
    success: true,
    message: "Password reset OTP sent successfully.",
    data: result,
  });
});
const resetPassword: RequestHandler = catchAsync(async (req, res) => {
  const result = await UserService.resetPassword(req.body);

  sendResponse(res, {
    statusCode: status.OK,
    success: true,
    message: "Password reset successfully.",
    data: result,
  });
});






export const UserController = {
  register,
  createUser,
  loginUser,
  refreshToken,
  resendOtp,
  verifyOtp,
  changePassword,
  requestPasswordReset,
  resetPassword
};
