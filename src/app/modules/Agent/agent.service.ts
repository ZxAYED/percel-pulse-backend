import { ParcelStatus } from "@prisma/client";
import app from "../../../app";
import { buildDynamicFilters } from "../../../helpers/buildDynamicFilters";
import { paginationHelper } from "../../../helpers/paginationHelper";
import prisma from "../../../shared/prisma";

const AssignedParcelSearchableFields: any = [
  "trackingNumber",
  "referenceCode",
  "pickupAddress",
  "deliveryAddress",
];

const listAssignedParcels = async (agentId: string, options: any) => {
  const { page, limit, skip, sortBy, sortOrder } =
    paginationHelper.calculatePagination(options);
  const dynamic = buildDynamicFilters(options, AssignedParcelSearchableFields);
  const whereConditions = {
    AND: [
      dynamic,
      {
        agentAssignment: {
          agentId: agentId,
        },
      },
    ],
  };
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
      pickupLat: true,
      pickupLng: true,
      deliveryAddress: true,
      deliveryLat: true,
      deliveryLng: true,
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
      customer: { select: { id: true, name: true, email: true, phone: true } },
      agentAssignment: {
        select: {
          id: true,
          assignedAt: true,
          acceptedAt: true,
          startedAt: true,
          completedAt: true,
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

const updateParcelStatusByAgent = async (payload: {
  agentId: string;
  parcelId: string;
  status: string;
  remarks?: string;
}) => {
  const assignment = await prisma.agentAssignment.findUnique({
    where: { parcelId: payload.parcelId },
    select: { agentId: true },
  });
  if (!assignment || assignment.agentId !== payload.agentId) {
    throw new Error("You are not assigned to this parcel");
  }
  const targetStatus = String(payload.status).toUpperCase() as keyof typeof ParcelStatus;
  const now = new Date();
  const updateData: any = { status: ParcelStatus[targetStatus] };
  if (targetStatus === "DELIVERED") updateData.deliveredAt = now;
  if (targetStatus === "FAILED") updateData.failedAt = now;
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
      updatedById: payload.agentId,
      remarks: payload.remarks || null,
    },
  });
  return updated;
};

const recordLocationUpdate = async (payload: {
  agentId: string;
  parcelId: string;
  latitude: number;
  longitude: number;
  speedKph?: number;
  heading?: number;
}) => {
  const assignment = await prisma.agentAssignment.findUnique({
    where: { parcelId: payload.parcelId },
    select: { agentId: true },
  });
  if (!assignment || assignment.agentId !== payload.agentId) {
    throw new Error("You are not assigned to this parcel");
  }
  const point = await prisma.locationTracking.create({
    data: {
      parcelId: payload.parcelId,
      agentId: payload.agentId,
      latitude: payload.latitude,
      longitude: payload.longitude,
      speedKph: payload.speedKph ?? null,
      heading: payload.heading ?? null,
    },
    select: {
      latitude: true,
      longitude: true,
      speedKph: true,
      heading: true,
      recordedAt: true,
    },
  });
  const broadcast: any = app.get("broadcastParcelLocation");
  broadcast?.(payload.parcelId, {
    parcelId: payload.parcelId,
    latitude: point.latitude,
    longitude: point.longitude,
    speedKph: point.speedKph,
    heading: point.heading,
    recordedAt: point.recordedAt,
  });
  return point;
};

export const AgentService = {
  listAssignedParcels,
  updateParcelStatusByAgent,
  recordLocationUpdate,
};
