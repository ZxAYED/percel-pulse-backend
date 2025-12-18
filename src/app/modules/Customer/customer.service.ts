import { ParcelStatus, PaymentType } from "@prisma/client";
import axios from "axios";
import { buildDynamicFilters } from "../../../helpers/buildDynamicFilters";
import { paginationHelper } from "../../../helpers/paginationHelper";
import prisma from "../../../shared/prisma";

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
    parcelType: string;
    parcelSize: string;
    weightKg?: number;
    paymentType: "COD" | "PREPAID";
    codAmount?: number;
    expectedPickupAt?: Date | string;
    expectedDeliveryAt?: Date | string;
  }
) => {
  const trackingNumber = await generateTrackingNumber();
  const pickup = await geocodeAddress(payload.pickupAddress);
  const delivery = await geocodeAddress(payload.deliveryAddress);

  const result = await prisma.parcel.create({
    data: {
      trackingNumber,
      referenceCode: undefined,
      pickupAddress: payload.pickupAddress,
      pickupLat: pickup?.lat ?? null,
      pickupLng: pickup?.lng ?? null,
      deliveryAddress: payload.deliveryAddress,
      deliveryLat: delivery?.lat ?? null,
      deliveryLng: delivery?.lng ?? null,
      parcelType: payload.parcelType,
      parcelSize: payload.parcelSize,
      weightKg: payload.weightKg ?? null,
      paymentType:
        payload.paymentType === "COD" ? PaymentType.COD : PaymentType.PREPAID,
      codAmount: payload.paymentType === "COD" ? payload.codAmount ?? 0 : null,
      status: ParcelStatus.BOOKED,
      expectedPickupAt: payload.expectedPickupAt
        ? new Date(payload.expectedPickupAt)
        : null,
      expectedDeliveryAt: payload.expectedDeliveryAt
        ? new Date(payload.expectedDeliveryAt)
        : null,
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
      createdAt: true,
    },
  });
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

export const CustomerService = {
  bookParcel,
  listMyParcels,
  getParcelById,
  getParcelTracking,
};
