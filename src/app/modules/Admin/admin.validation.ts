import { z } from "zod";

export const assignAgentSchema = z.object({
  parcelId: z.string().uuid(),
  agentId: z.string().uuid(),
});

export const updateParcelStatusSchema = z.object({
  parcelId: z.string().uuid(),
  status: z.enum(["BOOKED", "PICKED_UP", "IN_TRANSIT", "DELIVERED", "FAILED"]),
  remarks: z.string().max(500).optional(),
});
