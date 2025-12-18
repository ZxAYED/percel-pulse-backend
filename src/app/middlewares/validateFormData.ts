import { NextFunction, Request, Response } from "express";
import { AnyZodObject } from "zod";

const validateFormData =
  (schema: AnyZodObject) =>
  (req: Request, res: Response, next: NextFunction) => {
    try {
      if (!req.body?.data) {
        return res.status(400).json({
          success: false,
          message: "Missing 'data' field in form-data",
        });
      }

      let raw = req.body.data;

      if (raw === "undefined" || raw === "" || !raw) {
        return res.status(400).json({
          success: false,
          message: "'data' field cannot be empty",
        });
      }

      let jsonData;
      try {
        jsonData = JSON.parse(raw);
      } catch (err) {
        return res.status(400).json({
          success: false,
          message: `"${raw}" is not valid JSON`,
        });
      }

      const parsed = schema.parse(jsonData);
      req.body = parsed;

      next();
    } catch (error: any) {
      return res.status(400).json({
        success: false,
        message: "Validation failed",
        errors: error.errors,
      });
    }
  };

export default validateFormData;
