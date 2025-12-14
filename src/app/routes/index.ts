import express from "express";
import { AuthRoutes } from "../modules/Auth/auth.route";
import { UserDataRoutes } from "../modules/User/user.route";



const router = express.Router();

const moduleRoutes = [
  {
    path: "/auth",
    route: AuthRoutes,
  },
  {
    path: "/user",
    route: UserDataRoutes,
  },
  
];

moduleRoutes.forEach((route) => router.use(route.path, route.route));

export default router;
