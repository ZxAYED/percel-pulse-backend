import { Role } from "@prisma/client";
import express from "express";
import RoleValidation from "../../middlewares/RoleValidation";
import validateJSON from "../../middlewares/validateJSON";
import { AgentController } from "./agent.controller";
import {
  agentLocationUpdateSchema,
  agentUpdateStatusSchema,
} from "./agent.validation";

const router = express.Router();

router.get("/parcels", RoleValidation(Role.AGENT), AgentController.getMyParcels);
router.get(
  "/parcels/active",
  RoleValidation(Role.AGENT),
  AgentController.getMyActiveParcels
);
router.get(
  "/dashboard/metrics",
  RoleValidation(Role.AGENT),
  AgentController.getDashboardMetrics
);
router.post(
  "/update-parcel-status",
  RoleValidation(Role.AGENT),
  validateJSON(agentUpdateStatusSchema),
  AgentController.updateMyParcelStatus
);

router.post(
  "/location",
  RoleValidation(Role.AGENT),
  validateJSON(agentLocationUpdateSchema),
  AgentController.recordLocationUpdate
);

export const AgentRoutes = router;
