import express, { Application, NextFunction, Request, Response } from "express";
import cors from "cors";

import router from "./app/routes";
import status from "http-status";
import globalErrorHandler from "./app/middlewares/globalErrorHandler";
import cookieParser from "cookie-parser";

const app: Application = express();

app.use(cors({
  origin: ["https://unnig-couier.vercel.app","http://localhost:5173"],
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
