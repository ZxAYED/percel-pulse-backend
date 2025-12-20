import { NextFunction, Request, Response } from "express";
import status from "http-status";

const globalErrorHandler = (
  err: any,
  req: Request,
  res: Response,
  next: NextFunction
) => {
  // console.log(err);
  res.status(err.statusCode ?? status.INTERNAL_SERVER_ERROR).json({
    success: false,
    message: err.message || "Something went wrong",
  });
};


export default globalErrorHandler