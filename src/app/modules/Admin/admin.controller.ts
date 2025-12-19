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

const getUsers = catchAsync(async (req, res) => {
  const result = await AdminService.listUsers(req.query);
  sendResponse(res, {
    statusCode: status.OK,
    success: true,
    message: "Users fetched.",
    data: result,
  });
});

const getAssignments = catchAsync(async (req, res) => {
  const result = await AdminService.listAssignments(req.query);
  sendResponse(res, {
    statusCode: status.OK,
    success: true,
    message: "Assignments fetched.",
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

const exportSingleParcelCSV = catchAsync(async (req, res) => {
  const csv = await AdminService.exportSingleParcelCSV({
    parcelId: req.query.parcelId as any,
    trackingNumber: req.query.trackingNumber as any,
  });
  const fileName = `parcel-${(req.query.trackingNumber || req.query.parcelId || "single") as string}.csv`;
  res.setHeader("Content-Type", "text/csv");
  res.setHeader("Content-Disposition", `attachment; filename="${fileName}"`);
  res.status(status.OK).send(csv);
});

const exportSingleParcelPDF = catchAsync(async (req, res) => {
  const parcel = await AdminService.getSingleParcelForExport({
    parcelId: req.query.parcelId as any,
    trackingNumber: req.query.trackingNumber as any,
  });
  const doc = new PDFDocument({ margin: 40, size: "A4" });
  const fileName = `parcel-${parcel.trackingNumber}.pdf`;
  res.setHeader("Content-Type", "application/pdf");
  res.setHeader("Content-Disposition", `attachment; filename="${fileName}"`);
  doc.pipe(res);
  doc.fontSize(18).text("Parcel Report", { align: "center" });
  doc.moveDown();
  doc.fontSize(11);
  const fields: Array<[string, any]> = [
    ["Tracking Number", parcel.trackingNumber],
    ["Reference", parcel.referenceCode || ""],
    ["Status", parcel.status],
    ["Payment Type", parcel.paymentType],
    ["Payment Status", parcel.paymentStatus],
    ["COD Amount", parcel.codAmount ?? ""],
    ["Parcel Type", parcel.parcelType],
    ["Parcel Size", parcel.parcelSize],
    ["Weight (kg)", parcel.weightKg ?? ""],
    ["Pickup Address", parcel.pickupAddress],
    ["Delivery Address", parcel.deliveryAddress],
    ["Expected Pickup", parcel.expectedPickupAt ?? ""],
    ["Expected Delivery", parcel.expectedDeliveryAt ?? ""],
    ["Delivered At", parcel.deliveredAt ?? ""],
    ["Failed At", parcel.failedAt ?? ""],
    ["Created At", parcel.createdAt],
    ["Customer", `${parcel.customer?.name || ""} (${parcel.customer?.email || ""})`],
    [
      "Agent",
      parcel.agentAssignment?.agent
        ? `${parcel.agentAssignment.agent.name} (${parcel.agentAssignment.agent.email})`
        : "",
    ],
  ];
  for (const [k, v] of fields) {
    doc.text(`${k}: ${v}`);
  }
  doc.moveDown();
  doc.fontSize(12).text("Status History");
  doc.moveDown(0.5);
  doc.fontSize(10);
  if (!parcel.statusHistory || parcel.statusHistory.length === 0) {
    doc.text("No status history");
  } else {
    for (const h of parcel.statusHistory) {
      doc.text(
        `${h.createdAt} - ${h.status}${h.remarks ? ` - ${h.remarks}` : ""}${
          h.updatedBy?.name ? ` - by ${h.updatedBy.name}` : ""
        }`
      );
    }
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
  getUsers,
  getAssignments,
  assignAgent,
  exportParcelsCSV,
  exportParcelsPDF,
  exportSingleParcelCSV,
  exportSingleParcelPDF,
  exportUsersCSV,
  exportUsersPDF,
  updateParcelStatus,
};
