import { z } from "zod";

export const bookParcelSchema = z
  .object({
    pickupAddress: z.string().min(3),
    deliveryAddress: z.string().min(3),
    referenceCode: z.string().min(1).optional(),
    parcelType: z.string().min(1),
    parcelSize: z.string().min(1),
    weightKg: z.number().positive().optional(),
    instructions: z.string().max(1000).optional(),
    pickupLat: z.number().min(-90).max(90).optional(),
    pickupLng: z.number().min(-180).max(180).optional(),
    deliveryLat: z.number().min(-90).max(90).optional(),
    deliveryLng: z.number().min(-180).max(180).optional(),
    paymentType: z.enum(["COD", "PREPAID"]),
    codAmount: z.number().positive().optional(),
    expectedPickupAt: z.union([z.string(), z.date()]).optional(),
    expectedDeliveryAt: z.union([z.string(), z.date()]).optional(),
    proofOfPickupUrl: z.string().url().optional(),
    proofOfDeliveryUrl: z.string().url().optional(),
    qrCodeUrl: z.string().url().optional(),
    barcode: z.string().min(1).optional(),
  })
  .refine(
    (v) => v.paymentType !== "COD" || typeof v.codAmount === "number",
    { message: "codAmount required for COD", path: ["codAmount"] }
  )
  .refine(
    (v) => v.paymentType !== "PREPAID" || v.codAmount === undefined,
    { message: "codAmount must be omitted for PREPAID", path: ["codAmount"] }
  )
  .refine(
    (v) =>
      (!v.pickupLat && !v.pickupLng) ||
      (typeof v.pickupLat === "number" && typeof v.pickupLng === "number"),
    { message: "pickupLat and pickupLng must both be provided", path: ["pickupLat"] }
  )
  .refine(
    (v) =>
      (!v.deliveryLat && !v.deliveryLng) ||
      (typeof v.deliveryLat === "number" && typeof v.deliveryLng === "number"),
    { message: "deliveryLat and deliveryLng must both be provided", path: ["deliveryLat"] }
  );
