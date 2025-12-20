import { ParcelStatus, PaymentStatus, PaymentType } from "@prisma/client";
import app from "../../../app";
import { buildDynamicFilters } from "../../../helpers/buildDynamicFilters";
import { paginationHelper } from "../../../helpers/paginationHelper";
import prisma from "../../../shared/prisma";
import { sendParcelStatusUpdateEmail } from "../../../utils/sendParcelNotification";
import AppError from "../../Errors/AppError";

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

const listActiveAssignedParcels = async (agentId: string, options: any) => {
  const page = Number(options.page) > 0 ? Number(options.page) : 1;
  const limit = Number(options.limit) > 0 ? Number(options.limit) : 100;
  const skip = (page - 1) * limit;
  const sortBy = options.sortBy || "updatedAt";
  const sortOrder = "desc";
  const dynamic = buildDynamicFilters(options, AssignedParcelSearchableFields);
  const whereConditions = {
    AND: [
      dynamic,
      { status: { in: [ParcelStatus.BOOKED, ParcelStatus.PICKED_UP, ParcelStatus.IN_TRANSIT] } },
      { agentAssignment: { agentId } },
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

  const parcelIds = parcels.map((p) => p.id);
  const latestLocations = parcelIds.length
    ? await prisma.locationTracking.findMany({
        where: { parcelId: { in: parcelIds } },
        orderBy: { recordedAt: "desc" },
        distinct: ["parcelId"],
        select: {
          parcelId: true,
          latitude: true,
          longitude: true,
          speedKph: true,
          heading: true,
          recordedAt: true,
        },
      })
    : [];
  const latestByParcelId = new Map(
    latestLocations.map((p) => [p.parcelId, p])
  );

  const data = parcels.map((p) => ({
    ...p,
    currentLocation: latestByParcelId.get(p.id) || null,
  }));

  const summary = {
    count: total,
    booked: data.filter((p) => p.status === ParcelStatus.BOOKED).length,
    pickedUp: data.filter((p) => p.status === ParcelStatus.PICKED_UP).length,
    inTransit: data.filter((p) => p.status === ParcelStatus.IN_TRANSIT).length,
  };

  const markers = data.flatMap((p) => {
    const out: any[] = [];
    if (typeof p.pickupLat === "number" && typeof p.pickupLng === "number") {
      out.push({
        type: "pickup",
        parcelId: p.id,
        trackingNumber: p.trackingNumber,
        status: p.status,
        latitude: p.pickupLat,
        longitude: p.pickupLng,
      });
    }
    if (typeof p.deliveryLat === "number" && typeof p.deliveryLng === "number") {
      out.push({
        type: "delivery",
        parcelId: p.id,
        trackingNumber: p.trackingNumber,
        status: p.status,
        latitude: p.deliveryLat,
        longitude: p.deliveryLng,
      });
    }
    if (p.currentLocation) {
      out.push({
        type: "current",
        parcelId: p.id,
        trackingNumber: p.trackingNumber,
        status: p.status,
        latitude: p.currentLocation.latitude,
        longitude: p.currentLocation.longitude,
        recordedAt: p.currentLocation.recordedAt,
        speedKph: p.currentLocation.speedKph,
        heading: p.currentLocation.heading,
      });
    }
    return out;
  });

  const meta = {
    page,
    limit,
    total,
    totalPages: Math.ceil(total / limit),
  };
  return { data, meta, summary, markers };
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
    throw new AppError(403, "You are not assigned to this parcel");
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
      updatedById: payload.agentId,
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
    throw new AppError(403, "You are not assigned to this parcel");
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

const getDashboardMetrics = async (agentId: string) => {
  const last30 = new Date();
  last30.setDate(last30.getDate() - 30);

  const next7 = new Date();
  next7.setDate(next7.getDate() + 7);

  const startOfToday = new Date();
  startOfToday.setHours(0, 0, 0, 0);

  const whereAssigned = {
    agentAssignment: { agentId },
  };

  const [
    totalAssigned,
    byStatus,
    assignedToday,
    deliveredToday,
    codOutstandingAgg,
    upcomingPickups,
    upcomingDeliveries,
    recentParcels,
    deliveredLast30,
  ] = await Promise.all([
    prisma.parcel.count({ where: whereAssigned }),
    prisma.parcel.groupBy({
      by: ["status"],
      where: whereAssigned,
      _count: { _all: true },
    }),
    prisma.agentAssignment.count({
      where: { agentId, assignedAt: { gte: startOfToday } },
    }),
    prisma.parcel.count({
      where: {
        ...whereAssigned,
        status: ParcelStatus.DELIVERED,
        deliveredAt: { gte: startOfToday },
      },
    }),
    prisma.parcel.aggregate({
      where: {
        ...whereAssigned,
        paymentType: PaymentType.COD,
        paymentStatus: PaymentStatus.PENDING,
        status: { not: ParcelStatus.FAILED },
      },
      _sum: { codAmount: true },
    }),
    prisma.parcel.count({
      where: {
        ...whereAssigned,
        status: ParcelStatus.BOOKED,
        expectedPickupAt: { gte: new Date(), lte: next7 },
      },
    }),
    prisma.parcel.count({
      where: {
        ...whereAssigned,
        status: { in: [ParcelStatus.PICKED_UP, ParcelStatus.IN_TRANSIT, ParcelStatus.BOOKED] },
        expectedDeliveryAt: { gte: new Date(), lte: next7 },
      },
    }),
    prisma.parcel.findMany({
      where: whereAssigned,
      orderBy: { updatedAt: "desc" },
      take: 5,
      select: {
        id: true,
        trackingNumber: true,
        status: true,
        pickupAddress: true,
        deliveryAddress: true,
        expectedPickupAt: true,
        expectedDeliveryAt: true,
        updatedAt: true,
        customer: { select: { id: true, name: true, phone: true } },
        agentAssignment: { select: { assignedAt: true, acceptedAt: true, startedAt: true } },
      },
    }),
    prisma.parcel.findMany({
      where: { ...whereAssigned, status: ParcelStatus.DELIVERED, deliveredAt: { gte: last30 } },
      select: { deliveredAt: true },
    }),
  ]);

  const countsByStatus: Record<string, number> = {};
  for (const row of byStatus) {
    countsByStatus[String(row.status)] = row._count._all;
  }

  const active =
    (countsByStatus[ParcelStatus.BOOKED] || 0) +
    (countsByStatus[ParcelStatus.PICKED_UP] || 0) +
    (countsByStatus[ParcelStatus.IN_TRANSIT] || 0);

  const deliveredByDay: Record<string, number> = {};
  for (const p of deliveredLast30) {
    if (!p.deliveredAt) continue;
    const d = p.deliveredAt.toISOString().slice(0, 10);
    deliveredByDay[d] = (deliveredByDay[d] || 0) + 1;
  }

  return {
    cards: {
      totalAssigned,
      activeAssigned: active,
      bookedParcels: countsByStatus[ParcelStatus.BOOKED] || 0,
      pickedUpParcels: countsByStatus[ParcelStatus.PICKED_UP] || 0,
      inTransitParcels: countsByStatus[ParcelStatus.IN_TRANSIT] || 0,
      deliveredParcels: countsByStatus[ParcelStatus.DELIVERED] || 0,
      failedParcels: countsByStatus[ParcelStatus.FAILED] || 0,
      assignedToday,
      deliveredToday,
      codOutstandingAmount: codOutstandingAgg._sum.codAmount || 0,
      upcomingPickups,
      upcomingDeliveries,
    },
    deliveredByDay,
    recentParcels,
  };
};

export const AgentService = {
  listAssignedParcels,
  listActiveAssignedParcels,
  updateParcelStatusByAgent,
  recordLocationUpdate,
  getDashboardMetrics,
};
