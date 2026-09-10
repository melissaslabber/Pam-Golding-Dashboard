import { createClient, type SupabaseClient } from "@supabase/supabase-js";

const projectUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "https://qnggpboyiohwjltrvrqj.supabase.co";
const publishableKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "";

export const supabaseConfigured = Boolean(projectUrl && publishableKey);

export const supabase: SupabaseClient | null = supabaseConfigured
  ? createClient(projectUrl, publishableKey, {
      auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: false },
      realtime: { params: { eventsPerSecond: 10 } },
    })
  : null;

export type SupabaseProfile = {
  profile_id: string;
  full_name: string;
  short_name: string;
  initials: string;
  role: "manager" | "agent" | "assistant";
  team_id: string;
};

export async function claimStaffAccess(code: string): Promise<SupabaseProfile> {
  if (!supabase) throw new Error("Supabase is not configured.");
  const { data: session } = await supabase.auth.getSession();
  if (!session.session) {
    const { error } = await supabase.auth.signInAnonymously();
    if (error) throw error;
  }
  const { data, error } = await supabase.rpc("claim_access_code", { code });
  if (error) throw error;
  const profile = Array.isArray(data) ? data[0] : data;
  if (!profile) throw new Error("That access code is not recognised.");
  return profile as SupabaseProfile;
}

export async function releaseStaffSession() {
  if (supabase) await supabase.auth.signOut();
}

