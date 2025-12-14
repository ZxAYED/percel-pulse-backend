import express from "express";

import RoleValidation from "../../middlewares/RoleValidation";
import { UserDataController } from "./user.controller";
import { USER_ROLE } from "@prisma/client";
const router = express.Router();

router.get("/all-users",  RoleValidation( USER_ROLE.admin),
 UserDataController.getAllUsers);
router.get(
  "/me",
  RoleValidation(USER_ROLE.customer, USER_ROLE.admin),
  UserDataController.myProfileInfo
);

export const UserDataRoutes = router;
