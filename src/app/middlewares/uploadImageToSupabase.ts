import fs from "fs";
import mime from "mime-types";
import { supabase } from "./supabaseClient";
import AppError from "../Errors/AppError";
import type { Express } from "express";

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
