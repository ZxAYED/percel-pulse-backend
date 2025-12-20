// src/middlewares/formDataParser.ts
import multer from "multer";

const upload = multer(); // memory storage

export const parseFormData = upload.none(); // for text-only form-data
