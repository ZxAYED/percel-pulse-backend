import { Role } from "@prisma/client";
import express from "express";
import RoleValidation from "../../middlewares/RoleValidation";
import validateJSON from "../../middlewares/validateJSON";
import { AgentController } from "./agent.controller";
import {
  agentUpdateStatusSchema,
} from "./agent.validation";

const router = express.Router();

router.get("/parcels", RoleValidation(Role.AGENT), AgentController.getMyParcels);
router.post(
  "/update-parcel-status",
  RoleValidation(Role.AGENT),
  validateJSON(agentUpdateStatusSchema),
  AgentController.updateMyParcelStatus
);

export const AgentRoutes = router;
