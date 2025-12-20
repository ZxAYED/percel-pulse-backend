import { z } from "zod";

export const agentUpdateStatusSchema = z.object({
  parcelId: z.string().uuid(),
  status: z.enum(["PICKED_UP", "IN_TRANSIT", "DELIVERED", "FAILED"]),
  remarks: z.string().max(500).optional(),
});

const numberFromString = z
  .string()
  .refine((v: string) => v.trim() !== "" && !Number.isNaN(Number(v)))
  .transform((v: string) => Number(v));

const num = z.union([z.number(), numberFromString]);

export const agentLocationUpdateSchema = z.object({
  parcelId: z.string().uuid(),
  latitude: num,
  longitude: num,
  speedKph: num.optional(),
  heading: num.optional(),
});
