import status from "http-status";
import catchAsync from "../../../shared/catchAsync";
import sendResponse from "../../../shared/sendResponse";
import { AgentService } from "./agent.service";

const getMyParcels = catchAsync(async (req: any, res) => {
  const result = await AgentService.listAssignedParcels(req.user.id, req.query);
  sendResponse(res, {
    statusCode: status.OK,
    success: true,
    message: "Assigned parcels fetched.",
    data: result,
  });
});

const getMyActiveParcels = catchAsync(async (req: any, res) => {
  const result = await AgentService.listActiveAssignedParcels(req.user.id, req.query);
  sendResponse(res, {
    statusCode: status.OK,
    success: true,
    message: "Active route data fetched.",
    data: result,
  });
});

const updateMyParcelStatus = catchAsync(async (req: any, res) => {
  const result = await AgentService.updateParcelStatusByAgent({
    agentId: req.user.id,
    parcelId: req.body.parcelId,
    status: req.body.status,
    remarks: req.body.remarks,
  });
  sendResponse(res, {
    statusCode: status.OK,
    success: true,
    message: "Parcel status updated.",
    data: result,
  });
});

const getDashboardMetrics = catchAsync(async (req: any, res) => {
  const result = await AgentService.getDashboardMetrics(req.user.id);
  sendResponse(res, {
    statusCode: status.OK,
    success: true,
    message: "Agent dashboard metrics fetched.",
    data: result,
  });
});

const recordLocationUpdate = catchAsync(async (req: any, res) => {
  const result = await AgentService.recordLocationUpdate({
    agentId: req.user.id,
    parcelId: req.body.parcelId,
    latitude: req.body.latitude,
    longitude: req.body.longitude,
    speedKph: req.body.speedKph,
    heading: req.body.heading,
  });
  sendResponse(res, {
    statusCode: status.OK,
    success: true,
    message: "Location updated.",
    data: result,
  });
});

export const AgentController = {
  getMyParcels,
  getMyActiveParcels,
  updateMyParcelStatus,
  getDashboardMetrics,
  recordLocationUpdate,
};
