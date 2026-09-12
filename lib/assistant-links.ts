import { supabase } from "./supabase";

export type AssistantAgentLink = {
  assistantProfileId: string;
  agentProfileId: string;
};

export async function loadAssistantAgentLinks(): Promise<AssistantAgentLink[]> {
  if (!supabase) return [];
  const { data, error } = await supabase
    .from("assistant_agent_links")
    .select("assistant_profile_id,agent_profile_id");
  if (error) throw error;
  return (data || []).map((row: any) => ({
    assistantProfileId: row.assistant_profile_id,
    agentProfileId: row.agent_profile_id,
  }));
}

export async function saveAssistantAgentLinks(
  assistantProfileId: string,
  agentProfileIds: string[],
) {
  if (!supabase) return;
  const { error: deleteError } = await supabase
    .from("assistant_agent_links")
    .delete()
    .eq("assistant_profile_id", assistantProfileId);
  if (deleteError) throw deleteError;
  if (!agentProfileIds.length) return;
  const { error } = await supabase.from("assistant_agent_links").insert(
    agentProfileIds.map((agentProfileId) => ({
      assistant_profile_id: assistantProfileId,
      agent_profile_id: agentProfileId,
    })),
  );
  if (error) throw error;
}
