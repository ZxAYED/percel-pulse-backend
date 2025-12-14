import fs from "fs";
import mime from "mime-types"; // ✅ auto detect content-type
import { supabase } from "./supabaseClient";

export const uploadImageToSupabase = async (
  localFilePath: string,
  fileName: string
) => {
  // console.log({ localFilePath, fileName });

  const fileBuffer = fs.readFileSync(localFilePath);

  // Dynamically detect content type from file extension
  const contentType = mime.lookup(localFilePath);

  if (!contentType || !contentType.startsWith("image/")) {
    throw new Error("Unsupported or invalid image type");
  }

  const filePath = `images/${fileName}`;

  const { data: uploadData, error: uploadError } = await supabase.storage
    .from("attachments")
    // .from("certificates")
    .upload(filePath, fileBuffer, {
      contentType: contentType,
      upsert: true,
    });

  if (uploadError) {
    console.error("❌ Upload failed:", uploadError);
    throw uploadError;
  }

  const { data: urlData } = supabase.storage
    .from("attachments")
    .getPublicUrl(filePath);

  if (!urlData?.publicUrl) {
    console.error("❌ Failed to get public URL");
    throw new Error("Public URL not found");
  }

  return urlData.publicUrl;
};
