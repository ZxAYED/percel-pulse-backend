import status from "http-status";
import PDFDocument from "pdfkit";
import catchAsync from "../../../shared/catchAsync";
import sendResponse from "../../../shared/sendResponse";
import { AdminService } from "./admin.service";

const getMetrics = catchAsync(async (req, res) => {
  const result = await AdminService.getDashboardMetrics();
  sendResponse(res, {
    statusCode: status.OK,
    success: true,
    message: "Admin metrics fetched.",
    data: result,
  });
});

const getParcels = catchAsync(async (req, res) => {
  const result = await AdminService.listParcels(req.query);
  sendResponse(res, {
    statusCode: status.OK,
    success: true,
    message: "Parcels fetched.",
    data: result,
  });
});

const assignAgent = catchAsync(async (req: any, res) => {
  const result = await AdminService.assignAgent({
    parcelId: req.body.parcelId,
    agentId: req.body.agentId,
    assignedById: req.user.id,
  });
  sendResponse(res, {
    statusCode: status.OK,
    success: true,
    message: "Agent assigned.",
    data: result,
  });
});

const updateParcelStatus = catchAsync(async (req: any, res) => {
  const result = await AdminService.updateParcelStatus({
    parcelId: req.body.parcelId,
    status: req.body.status,
    remarks: req.body.remarks,
    updatedById: req.user.id,
  });
  sendResponse(res, {
    statusCode: status.OK,
    success: true,
    message: "Parcel status updated.",
    data: result,
  });
});

const exportParcelsCSV = catchAsync(async (req, res) => {
  const csv = await AdminService.exportParcelsCSV(req.query);
  res.setHeader("Content-Type", "text/csv");
  res.setHeader("Content-Disposition", "attachment; filename=\"parcels.csv\"");
  res.status(status.OK).send(csv);
});

const exportUsersCSV = catchAsync(async (req, res) => {
  const csv = await AdminService.exportUsersCSV(req.query);
  res.setHeader("Content-Type", "text/csv");
  res.setHeader("Content-Disposition", "attachment; filename=\"users.csv\"");
  res.status(status.OK).send(csv);
});

const exportParcelsPDF = catchAsync(async (req, res) => {
  const csv = await AdminService.exportParcelsCSV(req.query);
  const rows = csv.split("\n").map((line) => line.split(","));
  const doc = new PDFDocument({ margin: 40, size: "A4" });
  res.setHeader("Content-Type", "application/pdf");
  res.setHeader("Content-Disposition", "attachment; filename=\"parcels.pdf\"");
  doc.pipe(res);
  doc.fontSize(18).text("Parcel Report", { align: "center" });
  doc.moveDown();
  doc.fontSize(10);
  for (let i = 0; i < rows.length; i++) {
    doc.text(rows[i].join("  "), { lineBreak: true });
  }
  doc.end();
});

const exportUsersPDF = catchAsync(async (req, res) => {
  const csv = await AdminService.exportUsersCSV(req.query);
  const rows = csv.split("\n").map((line) => line.split(","));
  const doc = new PDFDocument({ margin: 40, size: "A4" });
  res.setHeader("Content-Type", "application/pdf");
  res.setHeader("Content-Disposition", "attachment; filename=\"users.pdf\"");
  doc.pipe(res);
  doc.fontSize(18).text("Users Report", { align: "center" });
  doc.moveDown();
  doc.fontSize(10);
  for (let i = 0; i < rows.length; i++) {
    doc.text(rows[i].join("  "), { lineBreak: true });
  }
  doc.end();
});

export const AdminController = {
  getMetrics,
  getParcels,
  assignAgent,
  exportParcelsCSV,
  exportParcelsPDF,
  exportUsersCSV,
  exportUsersPDF,
  updateParcelStatus,
};
