import express from "express";

import RoleValidation from "../../middlewares/RoleValidation";
import { UserDataController } from "./user.controller";
const router = express.Router();

router.get("/all-users",  RoleValidation("ADMIN","admin"),
 UserDataController.getAllUsers);
router.get(
  "/me",
  RoleValidation("CUSTOMER","customer","ADMIN","admin"),
  UserDataController.myProfileInfo
);

export const UserDataRoutes = router;
