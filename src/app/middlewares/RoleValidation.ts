import { NextFunction, Request, Response } from "express";
import { jwtHelpers } from "../../helpers/jwtHelpers";
import config from "../../config";
import { Secret } from "jsonwebtoken";
import prisma from "../../shared/prisma";

const RoleValidation = (...roles: string[]) => {
  return async (
    req: Request & { user?: any },
    res: Response,
    next: NextFunction
  ) => {
    try {
      const token = req.headers.authorization;

      if (!token) {
        res
          .status(401)
          .json({ success: false, message: "You are not authorized !" });
        return;
      }

      const verifiedUser = jwtHelpers.verifyToken(
        token,
        config.jwt.access_token_secret as Secret
      );
      
      if (roles.length && !roles.includes(verifiedUser.role)) {
        res.status(403).json({
          success: false,
          message: "Forbidden! You don't have access.",
        });
        return;
      }

      const User = await prisma.user.findUnique({
        where: {
          email: verifiedUser.email,
        },
        select: {
          id: true,
          email: true,
        },
      });

      // console.log(user);

      req.user = User;

      next();
    } catch (error: any) {
      res.status(401).json({
        success: false,
        message: "Unauthorized access!",
      });
    }
  };
};

export default RoleValidation;
