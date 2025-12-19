import { ParcelStatus, PaymentType } from "@prisma/client";
import status from "http-status";
import { buildDynamicFilters } from "../../../helpers/buildDynamicFilters";
import { paginationHelper } from "../../../helpers/paginationHelper";
import prisma from "../../../shared/prisma";
import { sendParcelStatusUpdateEmail } from "../../../utils/sendParcelNotification";
import AppError from "../../Errors/AppError";

const getDashboardMetrics = async () => {
  const totalUsers = await prisma.user.count();

  const [
    totalParcels,
    failedParcels,
    deliveredParcels,
    codAgg,
  ] = await Promise.all([
    prisma.parcel.count(),
    prisma.parcel.count({ where: { status: ParcelStatus.FAILED } }),
    prisma.parcel.count({ where: { status: ParcelStatus.DELIVERED } }),
    prisma.parcel.aggregate({
      _sum: { codAmount: true },
      where: { paymentType: PaymentType.COD },
    }),
  ]);

  return {
    totals: {
      users: totalUsers,
      parcels: totalParcels,
      delivered: deliveredParcels,
      failed: failedParcels,
      codTotal: codAgg._sum.codAmount || 0,
    },
  };
};

const ParcelSearchableFields: any = [
  "trackingNumber",
  "referenceCode",
  "pickupAddress",
  "deliveryAddress",
];

const listParcels = async (options: any) => {
  const { page, limit, skip, sortBy, sortOrder } =
    paginationHelper.calculatePagination(options);
  const whereConditions = buildDynamicFilters(options, ParcelSearchableFields);
  const total = await prisma.parcel.count({ where: whereConditions });
  const parcels = await prisma.parcel.findMany({
    where: whereConditions,
    skip,
    take: limit,
    orderBy: { [sortBy]: sortOrder },
    select: {
      id: true,
      trackingNumber: true,
      referenceCode: true,
      pickupAddress: true,
      deliveryAddress: true,
      parcelType: true,
      parcelSize: true,
      weightKg: true,
      paymentType: true,
      paymentStatus: true,
      codAmount: true,
      status: true,
      expectedPickupAt: true,
      expectedDeliveryAt: true,
      deliveredAt: true,
      failedAt: true,
      createdAt: true,
      updatedAt: true,
      customer: {
        select: { id: true, name: true, email: true, phone: true },
      },
      agentAssignment: {
        select: {
          id: true,
          assignedAt: true,
          acceptedAt: true,
          agent: { select: { id: true, name: true, email: true, phone: true } },
        },
      },
    },
  });
  const meta = {
    page,
    limit,
    total,
    totalPages: Math.ceil(total / limit),
  };
  return { data: parcels, meta };
};

const assignAgent = async (payload: {
  parcelId: string;
  agentId: string;
  assignedById: string;
}) => {
  const parcel = await prisma.parcel.findUnique({
    where: { id: payload.parcelId },
    select: { id: true },
  });
  if (!parcel) {
    throw new AppError(status.NOT_FOUND, "Parcel not found");
  }
  const agent = await prisma.user.findUnique({
    where: { id: payload.agentId },
   
  });
  if (!agent || String(agent.role) !== "AGENT") {
    throw new AppError(status.NOT_FOUND, "Agent not found or invalid role");
  }

  const existing = await prisma.agentAssignment.findUnique({
    where: { parcelId: payload.parcelId },
    select: { agentId: true },
  });
  if (existing?.agentId) {
    if (existing.agentId === payload.agentId) {
      throw new AppError(status.CONFLICT, "Agent already assigned to this parcel");
    }
    throw new AppError(status.CONFLICT, "Parcel already assigned to another agent");
  }

  const assignment = await prisma.agentAssignment.create({
    data: {
      parcelId: payload.parcelId,
      agentId: payload.agentId,
      assignedById: payload.assignedById,
    },
    select: {
      id: true,
      parcelId: true,
      agentId: true,
      assignedAt: true,
      agent: { select: { id: true, name: true, email: true, phone: true } },
    },
  });
  return assignment;
};

const updateParcelStatus = async (payload: {
  parcelId: string;
  status: string;
  remarks?: string;
  updatedById: string;
}) => {
  const targetStatus = String(payload.status).toUpperCase() as keyof typeof ParcelStatus;
  const now = new Date();
  const updateData: any = { status: ParcelStatus[targetStatus] };
  if (targetStatus === "DELIVERED") {
    updateData.deliveredAt = now;
  }
  if (targetStatus === "FAILED") {
    updateData.failedAt = now;
  }
  const updated = await prisma.parcel.update({
    where: { id: payload.parcelId },
    data: updateData,
    select: {
      id: true,
      trackingNumber: true,
      status: true,
      deliveredAt: true,
      failedAt: true,
      updatedAt: true,
      customer: { select: { email: true, name: true } },
    },
  });
  await prisma.parcelStatusHistory.create({
    data: {
      parcelId: payload.parcelId,
      status: ParcelStatus[targetStatus],
      updatedById: payload.updatedById,
      remarks: payload.remarks || null,
    },
  });
  try {
    if (updated.customer?.email) {
      await sendParcelStatusUpdateEmail(updated.customer.email, {
        trackingNumber: updated.trackingNumber,
        status: String(updated.status),
        deliveredAt: updated.deliveredAt as any,
        failedAt: updated.failedAt as any,
        remarks: payload.remarks || null,
      });
    }
  } catch {}
  return updated;
};

const escapeCSV = (val: any) => {
  if (val === null || val === undefined) return "";
  const str = String(val);
  if (/[",\n]/.test(str)) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
};

const exportParcelsCSV = async (options: any) => {
  const whereConditions = buildDynamicFilters(options, [
    "trackingNumber",
    "referenceCode",
    "pickupAddress",
    "deliveryAddress",
    "status",
    "paymentType",
    "paymentStatus",
  ]);
  const rows = await prisma.parcel.findMany({
    where: whereConditions,
    orderBy: { createdAt: "desc" },
    select: {
      trackingNumber: true,
      referenceCode: true,
      status: true,
      paymentType: true,
      paymentStatus: true,
      codAmount: true,
      parcelType: true,
      parcelSize: true,
      weightKg: true,
      pickupAddress: true,
      deliveryAddress: true,
      expectedPickupAt: true,
      expectedDeliveryAt: true,
      deliveredAt: true,
      failedAt: true,
      createdAt: true,
      customer: { select: { name: true, email: true, phone: true } },
      agentAssignment: {
        select: { agent: { select: { name: true, email: true, phone: true } } },
      },
    },
  });
  const header = [
    "Tracking Number",
    "Reference",
    "Status",
    "Payment Type",
    "Payment Status",
    "COD Amount",
    "Parcel Type",
    "Parcel Size",
    "Weight (kg)",
    "Pickup Address",
    "Delivery Address",
    "Expected Pickup",
    "Expected Delivery",
    "Delivered At",
    "Failed At",
    "Created At",
    "Customer Name",
    "Customer Email",
    "Customer Phone",
    "Agent Name",
    "Agent Email",
    "Agent Phone",
  ];
  const dataRows = rows.map((r) => [
    escapeCSV(r.trackingNumber),
    escapeCSV(r.referenceCode),
    escapeCSV(r.status),
    escapeCSV(r.paymentType),
    escapeCSV(r.paymentStatus),
    escapeCSV(r.codAmount),
    escapeCSV(r.parcelType),
    escapeCSV(r.parcelSize),
    escapeCSV(r.weightKg),
    escapeCSV(r.pickupAddress),
    escapeCSV(r.deliveryAddress),
    escapeCSV(r.expectedPickupAt),
    escapeCSV(r.expectedDeliveryAt),
    escapeCSV(r.deliveredAt),
    escapeCSV(r.failedAt),
    escapeCSV(r.createdAt),
    escapeCSV(r.customer?.name),
    escapeCSV(r.customer?.email),
    escapeCSV(r.customer?.phone),
    escapeCSV(r.agentAssignment?.agent?.name),
    escapeCSV(r.agentAssignment?.agent?.email),
    escapeCSV(r.agentAssignment?.agent?.phone),
  ]);
  const csv = [header.join(","), ...dataRows.map((row) => row.join(","))].join("\n");
  return csv;
};

const exportUsersCSV = async (options: any) => {
  const whereConditions = buildDynamicFilters(options, ["name", "email", "phone", "role"]);
  const rows = await prisma.user.findMany({
    where: whereConditions,
    orderBy: { createdAt: "desc" },
    select: {
      name: true,
      email: true,
      phone: true,
      role: true,
      isActive: true,
      createdAt: true,
      lastLoginAt: true,
    },
  });
  const header = [
    "Name",
    "Email",
    "Phone",
    "Role",
    "Active",
    "Created At",
    "Last Login",
  ];
  const dataRows = rows.map((r) => [
    escapeCSV(r.name),
    escapeCSV(r.email),
    escapeCSV(r.phone),
    escapeCSV(r.role),
    escapeCSV(r.isActive),
    escapeCSV(r.createdAt),
    escapeCSV(r.lastLoginAt),
  ]);
  const csv = [header.join(","), ...dataRows.map((row) => row.join(","))].join("\n");
  return csv;
};

const listUsers = async (options: any) => {
  const { page, limit, skip, sortBy, sortOrder } =
    paginationHelper.calculatePagination(options);
  const whereConditions = buildDynamicFilters(options, ["name", "email", "phone"]);
  const total = await prisma.user.count({ where: whereConditions });
  const users = await prisma.user.findMany({
    where: whereConditions,
    skip,
    take: limit,
    orderBy: { [sortBy]: sortOrder },
    select: {
      id: true,
      name: true,
      email: true,
      phone: true,
      role: true,
      isActive: true,
      isVerified: true,
      createdAt: true,
      lastLoginAt: true,
    },
  });
  const meta = {
    page,
    limit,
    total,
    totalPages: Math.ceil(total / limit),
  };
  return { data: users, meta };
};

const listAssignments = async (options: any) => {
  const { page, limit, skip } = paginationHelper.calculatePagination(options);
  const sortBy = options.sortBy || "assignedAt";
  const sortOrder = "desc";

  const and: any[] = [];
  if (options.agentId) and.push({ agentId: String(options.agentId) });
  if (options.parcelId) and.push({ parcelId: String(options.parcelId) });

  if (options.searchTerm?.trim()) {
    const t = String(options.searchTerm);
    and.push({
      OR: [
        { agent: { name: { contains: t, mode: "insensitive" } } },
        { agent: { email: { contains: t, mode: "insensitive" } } },
        { parcel: { trackingNumber: { contains: t, mode: "insensitive" } } },
        { parcel: { referenceCode: { contains: t, mode: "insensitive" } } },
        { parcel: { pickupAddress: { contains: t, mode: "insensitive" } } },
        { parcel: { deliveryAddress: { contains: t, mode: "insensitive" } } },
      ],
    });
  }

  const where = and.length > 0 ? { AND: and } : {};

  const total = await prisma.agentAssignment.count({ where });
  const rows = await prisma.agentAssignment.findMany({
    where,
    skip,
    take: limit,
    orderBy: { [sortBy]: sortOrder },
    select: {
      id: true,
      parcelId: true,
      agentId: true,
      assignedById: true,
      assignedAt: true,
      acceptedAt: true,
      startedAt: true,
      completedAt: true,
      agent: { select: { id: true, name: true, email: true, phone: true } },
      parcel: {
        select: {
          id: true,
          trackingNumber: true,
          referenceCode: true,
          status: true,
          createdAt: true,
          pickupAddress: true,
          deliveryAddress: true,
        },
      },
    },
  });

  const grouped = await prisma.agentAssignment.groupBy({
    by: ["agentId"],
    _count: { _all: true },
  });
  const summaryByAgent = grouped
    .sort((a, b) => (b._count._all ?? 0) - (a._count._all ?? 0))
    .map((g) => ({ agentId: g.agentId, parcels: g._count._all ?? 0 }));

  const meta = {
    page,
    limit,
    total,
    totalPages: Math.ceil(total / limit),
  };
  return { data: rows, meta, summaryByAgent };
};

const getSingleParcelForExport = async (payload: {
  parcelId?: string;
  trackingNumber?: string;
}) => {
  const parcelId = payload.parcelId ? String(payload.parcelId) : "";
  const trackingNumber = payload.trackingNumber ? String(payload.trackingNumber) : "";
  if (!parcelId && !trackingNumber) {
    throw new Error("parcelId or trackingNumber is required");
  }
  const parcel = await prisma.parcel.findFirst({
    where: parcelId ? { id: parcelId } : { trackingNumber },
    select: {
      id: true,
      trackingNumber: true,
      referenceCode: true,
      status: true,
      paymentType: true,
      paymentStatus: true,
      codAmount: true,
      parcelType: true,
      parcelSize: true,
      weightKg: true,
      pickupAddress: true,
      deliveryAddress: true,
      expectedPickupAt: true,
      expectedDeliveryAt: true,
      deliveredAt: true,
      failedAt: true,
      createdAt: true,
      customer: { select: { name: true, email: true, phone: true } },
      agentAssignment: {
        select: {
          assignedAt: true,
          acceptedAt: true,
          agent: { select: { name: true, email: true, phone: true } },
        },
      },
      statusHistory: {
        select: {
          status: true,
          remarks: true,
          createdAt: true,
          updatedBy: { select: { name: true, role: true } },
        },
        orderBy: { createdAt: "asc" },
      },
    },
  });
  if (!parcel) throw new Error("Parcel not found");
  return parcel;
};

const exportSingleParcelCSV = async (payload: {
  parcelId?: string;
  trackingNumber?: string;
}) => {
  const p = await getSingleParcelForExport(payload);
  const header = [
    "Tracking Number",
    "Reference",
    "Status",
    "Payment Type",
    "Payment Status",
    "COD Amount",
    "Parcel Type",
    "Parcel Size",
    "Weight (kg)",
    "Pickup Address",
    "Delivery Address",
    "Expected Pickup",
    "Expected Delivery",
    "Delivered At",
    "Failed At",
    "Created At",
    "Customer Name",
    "Customer Email",
    "Customer Phone",
    "Agent Name",
    "Agent Email",
    "Agent Phone",
  ];
  const row = [
    escapeCSV(p.trackingNumber),
    escapeCSV(p.referenceCode),
    escapeCSV(p.status),
    escapeCSV(p.paymentType),
    escapeCSV(p.paymentStatus),
    escapeCSV(p.codAmount),
    escapeCSV(p.parcelType),
    escapeCSV(p.parcelSize),
    escapeCSV(p.weightKg),
    escapeCSV(p.pickupAddress),
    escapeCSV(p.deliveryAddress),
    escapeCSV(p.expectedPickupAt),
    escapeCSV(p.expectedDeliveryAt),
    escapeCSV(p.deliveredAt),
    escapeCSV(p.failedAt),
    escapeCSV(p.createdAt),
    escapeCSV(p.customer?.name),
    escapeCSV(p.customer?.email),
    escapeCSV(p.customer?.phone),
    escapeCSV(p.agentAssignment?.agent?.name),
    escapeCSV(p.agentAssignment?.agent?.email),
    escapeCSV(p.agentAssignment?.agent?.phone),
  ];
  return [header.join(","), row.join(",")].join("\n");
};

export const AdminService = {
  getDashboardMetrics,
  listParcels,
  listUsers,
  listAssignments,
  assignAgent,
  updateParcelStatus,
  exportParcelsCSV,
  exportSingleParcelCSV,
  getSingleParcelForExport,
  exportUsersCSV,
};
