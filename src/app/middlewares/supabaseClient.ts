import { createClient } from "@supabase/supabase-js";
import dotenv from "dotenv";

// dotenv লোড করো যেন environment variables পাওয়া যায়
dotenv.config();

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseAnonKey = process.env.SUPABASE_ANON_KEY;

if (!supabaseUrl) {
  throw new Error("SUPABASE_URL is not defined in environment variables");
}

if (!supabaseAnonKey) {
  throw new Error("SUPABASE_ANON_KEY is not defined in environment variables");
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey);
