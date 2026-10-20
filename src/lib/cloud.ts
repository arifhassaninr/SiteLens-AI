import type { AuditResult } from "@/lib/audit";
import { getBrowserSupabase } from "@/lib/supabase";

export type CloudReport = { id: string; user_id: string; result: AuditResult; is_public: boolean; created_at: string };

export async function saveCloudAudit(result: AuditResult): Promise<{ id?: string; message: string }> {
  const db = getBrowserSupabase();
  if (!db) return { message: "Cloud saving is off until Supabase is configured." };
  const { data: userData, error: authError } = await db.auth.getUser();
  if (authError || !userData.user) return { message: "Sign in to sync reports to the cloud." };
  const { data, error } = await db.from("reports")
    .insert({ user_id: userData.user.id, result, is_public: false })
    .select("id").single();
  if (error) return { message: `Cloud save failed: ${error.message}` };
  return { id: data.id as string, message: "Saved privately to Supabase." };
}

export async function fetchCloudAudits(): Promise<CloudReport[]> {
  const db = getBrowserSupabase();
  if (!db) return [];
  const { data: userData } = await db.auth.getUser();
  if (!userData.user) return [];
  const { data, error } = await db.from("reports")
    .select("id, user_id, result, is_public, created_at")
    .eq("user_id", userData.user.id)
    .order("created_at", { ascending: false }).limit(50);
  if (error) throw Error(error.message);
  return (data ?? []) as CloudReport[];
}
