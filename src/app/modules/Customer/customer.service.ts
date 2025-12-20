import { ParcelStatus, PaymentStatus, PaymentType } from "@prisma/client";
import axios from "axios";
import { buildDynamicFilters } from "../../../helpers/buildDynamicFilters";
import { paginationHelper } from "../../../helpers/paginationHelper";
import prisma from "../../../shared/prisma";
import { sendParcelBookedEmail } from "../../../utils/sendParcelNotification";
import { uploadQrPayloadToSupabase } from "../../middlewares/uploadImageToSupabase";

const geocodeAddress = async (address: string) => {
  try {
    const key = process.env.GOOGLE_MAPS_API_KEY as string;
    if (!key) return null;
    const params = new URLSearchParams({ address, key });
    const url = `https://maps.googleapis.com/maps/api/geocode/json?${params.toString()}`;
    const { data } = await axios.get(url);
    const loc = data?.results?.[0]?.geometry?.location;
    if (loc && typeof loc.lat === "number" && typeof loc.lng === "number") {
      return { lat: loc.lat, lng: loc.lng };
    }
    return null;
  } catch {
    return null;
  }
};

const generateTrackingNumber = async () => {
  let tn = "";
  let exists = true;
  while (exists) {
    tn = `PP-${Date.now()}-${Math.floor(Math.random() * 1e6)
      .toString()
      .padStart(6, "0")}`;
    const found = await prisma.parcel.findUnique({ where: { trackingNumber: tn } });
    exists = !!found;
  }
  return tn;
};

const bookParcel = async (
  customerId: string,
  payload: {
    pickupAddress: string;
    deliveryAddress: string;
    referenceCode?: string;
    parcelType: string;
    parcelSize: string;
    weightKg?: number;
    instructions?: string;
    paymentType: "COD" | "PREPAID";
    codAmount?: number;
    expectedPickupAt?: Date | string;
    expectedDeliveryAt?: Date | string;
    pickupLat?: number;
    pickupLng?: number;
    deliveryLat?: number;
    deliveryLng?: number;
    barcode?: string;
  }
) => {
  const trackingNumber = await generateTrackingNumber();
  const hasPickupCoords =
    typeof payload.pickupLat === "number" && typeof payload.pickupLng === "number";
  const hasDeliveryCoords =
    typeof payload.deliveryLat === "number" && typeof payload.deliveryLng === "number";
  const pickup = hasPickupCoords ? null : await geocodeAddress(payload.pickupAddress);
  const delivery = hasDeliveryCoords ? null : await geocodeAddress(payload.deliveryAddress);

  let result = await prisma.parcel.create({
    data: {
      trackingNumber,
      referenceCode: payload.referenceCode ?? null,
      pickupAddress: payload.pickupAddress,
      pickupLat: hasPickupCoords ? payload.pickupLat! : pickup?.lat ?? null,
      pickupLng: hasPickupCoords ? payload.pickupLng! : pickup?.lng ?? null,
      deliveryAddress: payload.deliveryAddress,
      deliveryLat: hasDeliveryCoords ? payload.deliveryLat! : delivery?.lat ?? null,
      deliveryLng: hasDeliveryCoords ? payload.deliveryLng! : delivery?.lng ?? null,
      parcelType: payload.parcelType,
      parcelSize: payload.parcelSize,
      weightKg: payload.weightKg ?? null,
      instructions: payload.instructions ?? null,
      paymentType:
        payload.paymentType === "COD" ? PaymentType.COD : PaymentType.PREPAID,
      codAmount: payload.paymentType === "COD" ? payload.codAmount ?? 0 : null,
      status: ParcelStatus.BOOKED,
      statusHistory: {
        create: {
          status: ParcelStatus.BOOKED,
          remarks: "Parcel booked",
          updatedById: customerId,
        },
      },
      expectedPickupAt: payload.expectedPickupAt
        ? new Date(payload.expectedPickupAt)
        : null,
      expectedDeliveryAt: payload.expectedDeliveryAt
        ? new Date(payload.expectedDeliveryAt)
        : null,
      barcode: payload.barcode ?? null,
      customerId,
    },
    select: {
      id: true,
      trackingNumber: true,
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
      qrCodeUrl: true,
      createdAt: true,
    },
  });
  try {
    const baseUrl = (process.env.FRONTEND_BASE_URL || "http://localhost:5173").replace(
      /\/$/,
      ""
    );
    const qrPayload = `${baseUrl}/customer/parcels/${result.id}`;
    const uploaded = await uploadQrPayloadToSupabase(qrPayload, result.trackingNumber);
    result = await prisma.parcel.update({
      where: { id: result.id },
      data: { qrCodeUrl: uploaded.url },
      select: {
        id: true,
        trackingNumber: true,
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
        qrCodeUrl: true,
        createdAt: true,
      },
    });
  } catch {}
  try {
    const customer = await prisma.user.findUnique({
      where: { id: customerId },
      select: { email: true, name: true },
    });
    if (customer?.email) {
      await sendParcelBookedEmail(customer.email, {
        trackingNumber: result.trackingNumber,
        pickupAddress: result.pickupAddress,
        deliveryAddress: result.deliveryAddress,
        expectedPickupAt: result.expectedPickupAt as any,
        expectedDeliveryAt: result.expectedDeliveryAt as any,
      });
    }
  } catch {}
  return result;
};

const listMyParcels = async (customerId: string, options: any) => {
  const { page, limit, skip, sortBy, sortOrder } =
    paginationHelper.calculatePagination(options);
  const whereDynamic = buildDynamicFilters(options, [
    "trackingNumber",
    "pickupAddress",
    "deliveryAddress",
    "status",
    "paymentType",
    "paymentStatus",
  ]);
  const where = {
    AND: [whereDynamic, { customerId }],
  };
  const total = await prisma.parcel.count({ where });
  const rows = await prisma.parcel.findMany({
    where,
    skip,
    take: limit,
    orderBy: { [sortBy]: sortOrder },
    select: {
      id: true,
      trackingNumber: true,
      pickupAddress: true,
      deliveryAddress: true,
      parcelType: true,
      parcelSize: true,
      paymentType: true,
      paymentStatus: true,
      codAmount: true,
      status: true,
      expectedPickupAt: true,
      expectedDeliveryAt: true,
      deliveredAt: true,
      failedAt: true,
      createdAt: true,
      agentAssignment: {
        select: {
          agent: { select: { id: true, name: true, email: true, phone: true } },
          assignedAt: true,
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
  return { data: rows, meta };
};

const getParcelById = async (customerId: string, parcelId: string) => {
  const parcel = await prisma.parcel.findUnique({
    where: { id: parcelId },
    select: {
      id: true,
      trackingNumber: true,
      customerId: true,
      pickupAddress: true,
      pickupLat: true,
      pickupLng: true,
      deliveryAddress: true,
      deliveryLat: true,
      deliveryLng: true,
      parcelType: true,
      parcelSize: true,
      weightKg: true,
      instructions: true,
      paymentType: true,
      paymentStatus: true,
      codAmount: true,
      status: true,
      expectedPickupAt: true,
      expectedDeliveryAt: true,
      deliveredAt: true,
      failedAt: true,
      qrCodeUrl: true,
      barcode: true,
      createdAt: true,
      agentAssignment: {
        select: {
          agent: { select: { id: true, name: true, email: true, phone: true } },
          assignedAt: true,
        },
      },
      statusHistory: {
        select: {
          status: true,
          remarks: true,
          createdAt: true,
          updatedBy: { select: { id: true, name: true, role: true } },
        },
        orderBy: { createdAt: "desc" },
      },
    },
  });
  if (!parcel || parcel.customerId !== customerId) {
    throw new Error("Parcel not found");
  }
  return parcel;
};

const getParcelTracking = async (customerId: string, parcelId: string) => {
  const parcel = await prisma.parcel.findUnique({
    where: { id: parcelId },
    select: { customerId: true },
  });
  if (!parcel || parcel.customerId !== customerId) {
    throw new Error("Parcel not found");
  }
  const locations = await prisma.locationTracking.findMany({
    where: { parcelId },
    orderBy: { recordedAt: "desc" },
    take: 100,
    select: {
      latitude: true,
      longitude: true,
      speedKph: true,
      heading: true,
      recordedAt: true,
    },
  });
  return { points: locations };
};

const getCurrentParcelLocation = async (customerId: string, parcelId: string) => {
  const parcel = await prisma.parcel.findUnique({
    where: { id: parcelId },
    select: { customerId: true },
  });
  if (!parcel || parcel.customerId !== customerId) {
    throw new Error("Parcel not found");
  }
  const point = await prisma.locationTracking.findFirst({
    where: { parcelId },
    orderBy: { recordedAt: "desc" },
    select: {
      latitude: true,
      longitude: true,
      speedKph: true,
      heading: true,
      recordedAt: true,
    },
  });
  return { point };
};

const getDashboardMetrics = async (customerId: string) => {
  const last30 = new Date();
  last30.setDate(last30.getDate() - 30);

  const next7 = new Date();
  next7.setDate(next7.getDate() + 7);

  const [
    totalParcels,
    byStatus,
    codPendingAgg,
    prepaidPaidAgg,
    upcomingPickups,
    upcomingDeliveries,
    recentParcels,
    last30Parcels,
  ] = await Promise.all([
    prisma.parcel.count({ where: { customerId } }),
    prisma.parcel.groupBy({
      by: ["status"],
      where: { customerId },
      _count: { _all: true },
    }),
    prisma.parcel.aggregate({
      where: {
        customerId,
        paymentType: PaymentType.COD,
        paymentStatus: PaymentStatus.PENDING,
      },
      _sum: { codAmount: true },
    }),
    prisma.parcel.aggregate({
      where: {
        customerId,
        paymentType: PaymentType.PREPAID,
        paymentStatus: PaymentStatus.PAID,
      },
      _count: { _all: true },
    }),
    prisma.parcel.count({
      where: {
        customerId,
        status: ParcelStatus.BOOKED,
        expectedPickupAt: { gte: new Date(), lte: next7 },
      },
    }),
    prisma.parcel.count({
      where: {
        customerId,
        status: { in: [ParcelStatus.BOOKED, ParcelStatus.PICKED_UP, ParcelStatus.IN_TRANSIT] },
        expectedDeliveryAt: { gte: new Date(), lte: next7 },
      },
    }),
    prisma.parcel.findMany({
      where: { customerId },
      orderBy: { createdAt: "desc" },
      take: 5,
      select: {
        id: true,
        trackingNumber: true,
        pickupAddress: true,
        deliveryAddress: true,
        status: true,
        paymentType: true,
        paymentStatus: true,
        codAmount: true,
        createdAt: true,
      },
    }),
    prisma.parcel.findMany({
      where: { customerId, createdAt: { gte: last30 } },
      select: { createdAt: true },
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

  const bookingsByDay: Record<string, number> = {};
  for (const p of last30Parcels) {
    const d = p.createdAt.toISOString().slice(0, 10);
    bookingsByDay[d] = (bookingsByDay[d] || 0) + 1;
  }

  return {
    cards: {
      totalParcels,
      activeParcels: active,
      deliveredParcels: countsByStatus[ParcelStatus.DELIVERED] || 0,
      failedParcels: countsByStatus[ParcelStatus.FAILED] || 0,
      bookedParcels: countsByStatus[ParcelStatus.BOOKED] || 0,
      pickedUpParcels: countsByStatus[ParcelStatus.PICKED_UP] || 0,
      inTransitParcels: countsByStatus[ParcelStatus.IN_TRANSIT] || 0,
      codPendingAmount: codPendingAgg._sum.codAmount || 0,
      prepaidPaidCount: prepaidPaidAgg._count._all,
      upcomingPickups,
      upcomingDeliveries,
    },
    bookingsByDay,
    recentParcels,
  };
};

export const CustomerService = {
  bookParcel,
  listMyParcels,
  getParcelById,
  getParcelTracking,
  getCurrentParcelLocation,
  getDashboardMetrics,
};
