import { supabase } from "./supabase";

export type PortfolioMonth = {
  month: string;
  newProperties: number;
  newTenantLeases?: number;
  leaseRenewals?: number;
  totalLeases: number;
  totalLeaseValue: number;
};

export type StaffManagementRecord = {
  profileId: string;
  region: string;
  office: string;
  managerProfileId: string;
  strengths: string;
  developmentAreas: string;
  issues: string;
  coachingPlan: string;
  months: PortfolioMonth[];
  updatedAt?: string;
};

export async function loadStaffManagementRecords() {
  if (!supabase) return [] as StaffManagementRecord[];
  const { data, error } = await supabase
    .from("staff_management_records")
    .select("target_profile_id,payload,updated_at")
    .order("updated_at", { ascending: false });
  if (error) throw error;
  return (data || []).map((row: any) => {
    const payload = row.payload || {};
    return {
      ...payload,
      profileId: row.target_profile_id,
      months: (payload.months || []).map((item: any) => ({
        month: item.month,
        newProperties: Number(item.newProperties ?? item.gained ?? 0),
        newTenantLeases: Number(
          item.newTenantLeases ?? item.totalLeases ?? item.leaseRenewals ?? 0,
        ),
        leaseRenewals: Number(item.leaseRenewals ?? 0),
        totalLeases: Number(item.totalLeases ?? item.leaseRenewals ?? 0),
        totalLeaseValue: Number(item.totalLeaseValue ?? 0),
      })),
      updatedAt: row.updated_at,
    };
  }) as StaffManagementRecord[];
}

export async function saveStaffManagementRecord(record: StaffManagementRecord) {
  if (!supabase) throw new Error("Supabase is not configured.");
  const { profileId, updatedAt: _updatedAt, ...payload } = record;
  const { error } = await supabase.from("staff_management_records").upsert(
    {
      target_profile_id: profileId,
      payload,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "target_profile_id" },
  );
  if (error) throw error;
}

export async function hasManagerAccessCode() {
  if (!supabase) throw new Error("Supabase is not configured.");
  const { data, error } = await supabase.rpc("manager_code_status");
  if (error) throw error;
  return Boolean(data);
}

export async function createManagerAccessCode(code: string) {
  if (!supabase) throw new Error("Supabase is not configured.");
  const { data, error } = await supabase.rpc("set_manager_access_code", {
    new_code: code,
  });
  if (error) throw error;
  return Boolean(data);
}

export async function verifyManagerAccessCode(code: string) {
  if (!supabase) throw new Error("Supabase is not configured.");
  const { data, error } = await supabase.rpc("verify_manager_access_code", {
    attempted_code: code,
  });
  if (error) throw error;
  return Boolean(data);
}
