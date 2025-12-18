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

export const AgentController = {
  getMyParcels,
  updateMyParcelStatus,
};
