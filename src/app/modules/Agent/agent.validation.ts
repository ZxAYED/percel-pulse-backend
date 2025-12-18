import { z } from "zod";

export const agentUpdateStatusSchema = z.object({
  parcelId: z.string().uuid(),
  status: z.enum(["PICKED_UP", "IN_TRANSIT", "DELIVERED", "FAILED"]),
  remarks: z.string().max(500).optional(),
});
