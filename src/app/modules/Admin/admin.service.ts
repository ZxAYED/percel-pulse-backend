import { ParcelStatus, PaymentType, Role } from "@prisma/client";
import { buildDynamicFilters } from "../../../helpers/buildDynamicFilters";
import { paginationHelper } from "../../../helpers/paginationHelper";
import prisma from "../../../shared/prisma";

const getDashboardMetrics = async () => {
  const totalUsers = await prisma.user.count();
  const admins = await prisma.user.count({ where: { role: Role.ADMIN } });
  const customers = await prisma.user.count({ where: { role: Role.CUSTOMER } });
  const last30 = new Date();
  last30.setDate(last30.getDate() - 30);

  const recentParcels = await prisma.parcel.findMany({
    where: { createdAt: { gte: last30 } },
    select: {
      createdAt: true,
      status: true,
      paymentType: true,
      codAmount: true,
    },
  });

  const bookingsByDay: Record<string, number> = {};
  const failedByDay: Record<string, number> = {};
  const codByDay: Record<string, number> = {};

  for (const p of recentParcels) {
    const d = p.createdAt.toISOString().slice(0, 10);
    bookingsByDay[d] = (bookingsByDay[d] || 0) + 1;
    if (p.status === ParcelStatus.FAILED) {
      failedByDay[d] = (failedByDay[d] || 0) + 1;
    }
    if (p.paymentType === PaymentType.COD && typeof p.codAmount === "number") {
      codByDay[d] = (codByDay[d] || 0) + p.codAmount;
    }
  }

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
      admins,
      customers,
      parcels: totalParcels,
      delivered: deliveredParcels,
      failed: failedParcels,
      codTotal: codAgg._sum.codAmount || 0,
    },
    bookingsByDay,
    failedByDay,
    codByDay,
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
    throw new Error("Parcel not found");
  }
  const agent = await prisma.user.findUnique({
    where: { id: payload.agentId },
    select: { id: true, role: true, name: true, email: true, phone: true },
  });
  if (!agent || String(agent.role) !== "AGENT") {
    throw new Error("Agent not found or invalid role");
  }
  const assignment = await prisma.agentAssignment.upsert({
    where: { parcelId: payload.parcelId },
    update: { agentId: payload.agentId, assignedById: payload.assignedById },
    create: {
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
      status: true,
      deliveredAt: true,
      failedAt: true,
      updatedAt: true,
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

export const AdminService = {
  getDashboardMetrics,
  listParcels,
  assignAgent,
  updateParcelStatus,
  exportParcelsCSV,
  exportUsersCSV,
};
