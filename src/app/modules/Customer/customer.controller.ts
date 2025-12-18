import status from "http-status";
import catchAsync from "../../../shared/catchAsync";
import sendResponse from "../../../shared/sendResponse";
import { CustomerService } from "./customer.service";

const bookParcel = catchAsync(async (req: any, res) => {
  const result = await CustomerService.bookParcel(req.user.id, req.body);
  sendResponse(res, {
    statusCode: status.CREATED,
    success: true,
    message: "Parcel booked successfully.",
    data: result,
  });
});

const myParcels = catchAsync(async (req: any, res) => {
  const result = await CustomerService.listMyParcels(req.user.id, req.query);
  sendResponse(res, {
    statusCode: status.OK,
    success: true,
    message: "My parcels fetched.",
    data: result,
  });
});

const parcelDetails = catchAsync(async (req: any, res) => {
  const result = await CustomerService.getParcelById(req.user.id, req.params.id);
  sendResponse(res, {
    statusCode: status.OK,
    success: true,
    message: "Parcel details fetched.",
    data: result,
  });
});

const parcelTracking = catchAsync(async (req: any, res) => {
  const result = await CustomerService.getParcelTracking(req.user.id, req.params.id);
  sendResponse(res, {
    statusCode: status.OK,
    success: true,
    message: "Parcel tracking points fetched.",
    data: result,
  });
});

export const CustomerController = {
  bookParcel,
  myParcels,
  parcelDetails,
  parcelTracking,
};
