import { Role } from "@prisma/client";
import express from "express";
import RoleValidation from "../../middlewares/RoleValidation";
import { CustomerController } from "./customer.controller";
import validateJSON from "../../middlewares/validateJSON";
import { bookParcelSchema } from "./customer.validation";

const router = express.Router();

router.post(
  "/parcels/book",
  RoleValidation(Role.CUSTOMER),
  validateJSON(bookParcelSchema),
  CustomerController.bookParcel
);
router.get("/parcels", RoleValidation(Role.CUSTOMER), CustomerController.myParcels);
router.get("/parcels/:id", RoleValidation(Role.CUSTOMER), CustomerController.parcelDetails);
router.get("/parcels/:id/track", RoleValidation(Role.CUSTOMER), CustomerController.parcelTracking);
router.get(
  "/parcels/:id/track/current",
  RoleValidation(Role.CUSTOMER),
  CustomerController.currentParcelLocation
);
router.get(
  "/dashboard/metrics",
  RoleValidation(Role.CUSTOMER),
  CustomerController.getDashboardMetrics
);

export const CustomerRoutes = router;
