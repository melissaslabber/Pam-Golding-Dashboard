import { createClient, type SupabaseClient } from "@supabase/supabase-js";

const projectUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "https://qnggpboyiohwjltrvrqj.supabase.co";
const publishableKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "";

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

export async function restoreStaffAccess(): Promise<SupabaseProfile | null> {
  if (!supabase) return null;
  const { data: sessionData } = await supabase.auth.getSession();
  if (!sessionData.session) return null;
  const { data, error } = await supabase.rpc("current_staff_profile");
  if (error) throw error;
  const profile = Array.isArray(data) ? data[0] : data;
  return profile ? profile as SupabaseProfile : null;
}

export async function releaseStaffSession() {
  if (supabase) await supabase.auth.signOut();
}

export async function createStaffProfile(input: {
  name: string;
  shortName: string;
  initials: string;
  role: "manager" | "agent" | "assistant";
  email: string;
  cellphone: string;
  accessCode: string;
  teamId?: string;
  newTeamName?: string;
}) {
  if (!supabase) throw new Error("Supabase is not configured.");
  const { data, error } = await supabase.rpc("manager_create_profile", {
    person_name: input.name,
    person_short_name: input.shortName,
    person_initials: input.initials,
    person_role: input.role,
    person_email: input.email,
    person_cellphone: input.cellphone,
    person_access_code: input.accessCode,
    target_team_id: input.teamId || null,
    new_team_name: input.newTeamName || null,
  });
  if (error) throw error;
  return data;
}

export async function updateStaffProfile(input: { profileId:string; name:string; role:"manager"|"agent"|"assistant"; email:string; cellphone:string; teamId?:string; separate?:boolean }) {
  if (!supabase) throw new Error("Supabase is not configured.");
  const { data, error } = await supabase.rpc("manager_update_profile", {
    target_profile_id: input.profileId, person_name: input.name, person_role: input.role,
    person_email: input.email, person_cellphone: input.cellphone,
    destination_team_id: input.teamId || null, create_separate_team: Boolean(input.separate),
  });
  if (error) throw error;
  return data;
}

export async function deactivateStaffProfile(profileId:string) {
  if (!supabase) throw new Error("Supabase is not configured.");
  const { error } = await supabase.rpc("manager_set_profile_active", { target_profile_id:profileId, enabled:false });
  if (error) throw error;
}

export async function resetStaffAccessCode(profileId:string, newAccessCode:string) {
  if (!supabase) throw new Error("Supabase is not configured.");
  const { error } = await supabase.rpc("manager_reset_access_code", { target_profile_id:profileId, new_access_code:newAccessCode });
  if (error) throw error;
}
