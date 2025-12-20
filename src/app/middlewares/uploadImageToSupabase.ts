import { createClient } from "@supabase/supabase-js";
import fs from "fs";
import mime from "mime-types";
import qrcode from "qrcode";
import AppError from "../Errors/AppError";

const supabaseUrl = process.env.SUPABASE_URL ?? process.env.SUPABASE_PROJECT_URL;
const supabaseKey =
  process.env.SUPABASE_SERVICE_KEY ??
  process.env.SUPABASE_ANON_KEY;

if (!supabaseUrl) {
  throw new Error("SUPABASE_URL (or SUPABASE_PROJECT_URL) is not defined");
}
if (!supabaseKey) {
  throw new Error(
    "SUPABASE_SERVICE_KEY (or SUPABSE_SERVICE_KEY / SUPABASE_ANON_KEY) is not defined"
  );
}

export const supabase = createClient(supabaseUrl, supabaseKey);

export const uploadImageToSupabase = async (
  localFilePath: string,
  fileName: string
) => {
  const fileBuffer = fs.readFileSync(localFilePath);

  const contentType = mime.lookup(localFilePath);

  if (!contentType || !contentType.startsWith("image/")) {
    throw new Error("Unsupported or invalid image type");
  }

  const bucket = process.env.SUPABASE_BUCKET || "attachments";
  const filePath = `images/${fileName}`;

  const { error: uploadError } = await supabase.storage
    .from(bucket)
    .upload(filePath, fileBuffer, {
      contentType: contentType,
      upsert: true,
    });

  if (uploadError) {
    throw uploadError;
  }

  const { data: urlData } = supabase.storage.from(bucket).getPublicUrl(filePath);

  if (!urlData?.publicUrl) {
    throw new Error("Public URL not found");
  }

  return urlData.publicUrl;
};

export const uploadImageBufferToSupabase = async (
  file: Express.Multer.File,
  fileName: string,
  oldPath?: string | null
) => {
  if (!file || !file.buffer) {
    throw new AppError(400, "Invalid file. Ensure multer uses memoryStorage.");
  }
  const bucket = process.env.SUPABASE_BUCKET || "attachments";
  if (oldPath) {
    await supabase.storage.from(bucket).remove([oldPath]);
  }
  const ext = file.originalname.split(".").pop();
  const newPath = `images/${fileName}.${ext}`;
  const { error } = await supabase.storage
    .from(bucket)
    .upload(newPath, file.buffer, {
      contentType: file.mimetype,
      upsert: true,
    });
  if (error) throw new AppError(400, error.message);
  const { data } = supabase.storage.from(bucket).getPublicUrl(newPath);
  return {
    url: data.publicUrl,
    path: newPath,
  };
};

export const uploadPngBufferToSupabase = async (
  buffer: Buffer,
  fileName: string,
  oldPath?: string | null
) => {
  if (!buffer || !Buffer.isBuffer(buffer) || buffer.length === 0) {
    throw new AppError(400, "Invalid buffer");
  }
  const bucket = process.env.SUPABASE_BUCKET || "attachments";
  if (oldPath) {
    await supabase.storage.from(bucket).remove([oldPath]);
  }
  const newPath = `images/qrcodes/${fileName}.png`;
  const { error } = await supabase.storage.from(bucket).upload(newPath, buffer, {
    contentType: "image/png",
    upsert: true,
  });
  if (error) throw new AppError(400, error.message);
  const { data } = supabase.storage.from(bucket).getPublicUrl(newPath);
  return {
    url: data.publicUrl,
    path: newPath,
  };
};

export const generateQrPngBuffer = async (payload: string) => {
  const buffer = await qrcode.toBuffer(payload, {
    errorCorrectionLevel: "M",
    width: 256,
    margin: 2,
    type: "png",
  });
  if (!Buffer.isBuffer(buffer) || buffer.length === 0) {
    throw new AppError(400, "Failed to generate QR code");
  }
  return buffer;
};

export const uploadQrPayloadToSupabase = async (
  payload: string,
  fileName: string,
  oldPath?: string | null
) => {
  const buffer = await generateQrPngBuffer(payload);
  return uploadPngBufferToSupabase(buffer, fileName, oldPath);
};

export const deleteImageFromSupabase = async (path: string) => {
  if (!path) {
    throw new AppError(400, "No Path Found to Delete");
  }
  const bucket = process.env.SUPABASE_BUCKET || "attachments";
  const { error } = await supabase.storage.from(bucket).remove([path]);
  if (error) {
    throw new AppError(400, error.message);
  }
};
