import cors from "cors";
import express, { Application, NextFunction, Request, Response } from "express";

import cookieParser from "cookie-parser";
import status from "http-status";
import globalErrorHandler from "./app/middlewares/globalErrorHandler";
import router from "./app/routes";

const app: Application = express();

app.use(cors({
<<<<<<< HEAD
  origin: ["https://parcel-pulse-service.netlify.app","http://localhost:5173"],
=======
  origin: ["","http://localhost:5173"],
>>>>>>> 17f3d7978381f8f080332edd438f622d1360979f
  credentials: true,
}));

app.use(cookieParser());

// parser
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.use("/api", router);
app.use(globalErrorHandler);

app.get("/", (req: Request, res: Response) => {
  res.send("Server is running 🎉🎉");
});

app.use((req: Request, res: Response, next: NextFunction) => {
  res.status(status.NOT_FOUND).json({
    success: false,
    message: "API NOT FOUND",
    error: {
      path: req.originalUrl,
      message: "Your requested path is not found",
    },
  });
});

export default app;
