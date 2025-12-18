import { z } from "zod";

export const bookParcelSchema = z
  .object({
    pickupAddress: z.string().min(3),
    deliveryAddress: z.string().min(3),
    parcelType: z.string().min(1),
    parcelSize: z.string().min(1),
    weightKg: z.number().positive().optional(),
    paymentType: z.enum(["COD", "PREPAID"]),
    codAmount: z.number().positive().optional(),
    expectedPickupAt: z.union([z.string(), z.date()]).optional(),
    expectedDeliveryAt: z.union([z.string(), z.date()]).optional(),
  })
  .refine(
    (v) => v.paymentType !== "COD" || typeof v.codAmount === "number",
    { message: "codAmount required for COD", path: ["codAmount"] }
  );
