import status from "http-status";
import catchAsync from "../../../shared/catchAsync";
import sendResponse from "../../../shared/sendResponse";
import { UserDataServices } from "./user.service";
import { Request } from "express";

const getAllUsers = catchAsync(async (req, res) => {
  const result = await UserDataServices.getAllUsers(req.query);

  sendResponse(res, {
    statusCode: status.OK,
    success: true,
    message: "All users fetched successfully.",
    data: result,
  });
});

const myProfileInfo = catchAsync(async (req: Request & { user?: any }, res) => {
  const result = await UserDataServices.myProfileInfo(req.user.id);

  sendResponse(res, {
    statusCode: status.OK,
    success: true,
    message: "My Profile Info Fetched Successfuly.",
    data: result,
  });
});


export const UserDataController = {
  getAllUsers,

  myProfileInfo,

};
