
import { Role } from "@prisma/client";
import express from "express";
import RoleValidation from "../../middlewares/RoleValidation";
import { AdminController } from "./admin.controller";
import validateJSON from "../../middlewares/validateJSON";
import { assignAgentSchema, updateParcelStatusSchema } from "./admin.validation";

const router = express.Router();

router.get("/dashboard/metrics", RoleValidation(Role.ADMIN), AdminController.getMetrics);
router.get("/parcels", RoleValidation(Role.ADMIN), AdminController.getParcels);
router.post(
  "/assign-agent",
  RoleValidation(Role.ADMIN),
  validateJSON(assignAgentSchema),
  AdminController.assignAgent
);
router.post(
  "/update-parcel-status",
  RoleValidation(Role.ADMIN),
  validateJSON(updateParcelStatusSchema),
  AdminController.updateParcelStatus
);
router.get("/export/parcels/csv", RoleValidation(Role.ADMIN), AdminController.exportParcelsCSV);
router.get("/export/parcels/pdf", RoleValidation(Role.ADMIN), AdminController.exportParcelsPDF);
router.get("/export/users/csv", RoleValidation(Role.ADMIN), AdminController.exportUsersCSV);
router.get("/export/users/pdf", RoleValidation(Role.ADMIN), AdminController.exportUsersPDF);

export const AdminRoutes = router;
