import { supabase } from "./supabase";

export async function loadVisibleProfiles() {
  if (!supabase) return [];
  const { data, error } = await supabase
    .from("profiles")
    .select("id,team_id,full_name,short_name,initials,role,email,cellphone")
    .eq("active", true)
    .order("full_name");
  if (error) throw error;
  return data || [];
}

export type RecordKind = "task" | "appointment" | "maintenance" | "renewal" | "new_lease";
export type SharedRecord<T = Record<string, unknown>> = {
  client_id: string;
  team_id: string;
  record_type: RecordKind;
  payload: T;
  archived?: boolean;
};

export async function loadSharedRecords() {
  if (!supabase) return [] as SharedRecord[];
  const { data, error } = await supabase
    .from("organiser_records")
    .select("client_id,team_id,record_type,payload,archived")
    .order("updated_at", { ascending: false });
  if (error) throw error;
  return (data || []) as SharedRecord[];
}

export async function saveSharedRecord<T extends Record<string, unknown>>(
  recordType: RecordKind,
  teamId: string,
  profileId: string,
  payload: T,
) {
  if (!supabase) throw new Error("Supabase is not configured.");
  const localId = String(payload.id);
  const clientId = `${recordType}:${teamId}:${localId}`;
  const { error } = await supabase.from("organiser_records").upsert(
    {
      client_id: clientId,
      team_id: teamId,
      record_type: recordType,
      payload,
      archived: Boolean(payload.archived),
      created_by: profileId,
      updated_by: profileId,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "client_id" },
  );
  if (error) throw error;
}

export async function deleteSharedRecord(recordType: RecordKind, teamId: string, localId: string | number) {
  if (!supabase) throw new Error("Supabase is not configured.");
  const { error } = await supabase
    .from("organiser_records")
    .delete()
    .eq("client_id", `${recordType}:${teamId}:${localId}`);
  if (error) throw error;
}

export function subscribeToSharedRecords(onChange: () => void) {
  if (!supabase) return () => undefined;
  const client = supabase;
  const channel = client
    .channel("organiser-live")
    .on("postgres_changes", { event: "*", schema: "public", table: "organiser_records" }, onChange)
    .subscribe();
  return () => { void client.removeChannel(channel); };
}

export type SharedNotification = {
  id: number;
  recipient_profile_id: string;
  message: string;
  section: string;
  reminder_key?: string | null;
  read: boolean;
  created_at: string;
};

export async function loadMyNotifications() {
  if (!supabase) return [] as SharedNotification[];
  const { data, error } = await supabase
    .from("notifications")
    .select("id,recipient_profile_id,message,section,reminder_key,read,created_at")
    .order("created_at", { ascending: false })
    .limit(100);
  if (error) throw error;
  return (data || []) as SharedNotification[];
}

export async function createTeamNotifications(rows: Array<{recipientProfileId:string;teamId:string;message:string;section:string;reminderKey?:string}>) {
  if (!supabase || !rows.length) return;
  const { error } = await supabase.from("notifications").insert(rows.map(row => ({
    recipient_profile_id: row.recipientProfileId,
    team_id: row.teamId,
    message: row.message,
    section: row.section,
    reminder_key: row.reminderKey || null,
  })));
  if (error && error.code !== "23505") throw error;
}

export async function markNotificationRead(id:number) {
  if (!supabase) return;
  const { error } = await supabase.from("notifications").update({ read:true }).eq("id", id);
  if (error) throw error;
}

export function subscribeToMyNotifications(onChange: () => void) {
  if (!supabase) return () => undefined;
  const client = supabase;
  const channel = client.channel("my-notifications")
    .on("postgres_changes", { event:"*", schema:"public", table:"notifications" }, onChange)
    .subscribe();
  return () => { void client.removeChannel(channel); };
}
