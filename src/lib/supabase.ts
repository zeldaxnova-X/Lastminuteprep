import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "https://aiddngocebksoudlrvoh.supabase.co";
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "sb_publishable_XwMkcgE8AXWvrPaXsRU_Tw_UlhaT7dI";

export const supabase = createClient(supabaseUrl, supabaseAnonKey);
