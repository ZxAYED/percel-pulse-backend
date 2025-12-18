import express from "express";
import { AdminRoutes } from "../modules/Admin/admin.routes";
import { AgentRoutes } from "../modules/Agent/agent.routes";
import { AuthRoutes } from "../modules/Auth/auth.route";
import { CustomerRoutes } from "../modules/Customer/customer.routes";
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
  {
    path: "/admin",
    route: AdminRoutes,
  },
  {
    path: "/agent",
    route: AgentRoutes,
  },
  {
    path: "/customer",
    route: CustomerRoutes,
  },
  
];

moduleRoutes.forEach((route) => router.use(route.path, route.route));

export default router;
