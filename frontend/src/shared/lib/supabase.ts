import { createClient } from "@supabase/supabase-js";
import { env } from "@/shared/config/env";

// null mientras no haya credenciales, para poder desarrollar sin Supabase
export const supabase =
  env.supabaseUrl && env.supabaseAnonKey ? createClient(env.supabaseUrl, env.supabaseAnonKey) : null;
