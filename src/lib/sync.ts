"use client";

import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { pickPersisted, useLife, type PersistedLife } from "./store";
import { uid } from "./time";

/**
 * Optional cloud sync. When NEXT_PUBLIC_SUPABASE_URL and a public key are set, the
 * persisted slice of the store is mirrored to a single `life_state` row per user
 * (anonymous auth), and realtime updates from other devices are applied live.
 * Without env vars the app stays fully local.
 */
const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

export const cloudConfigured = Boolean(url && key);

let supabase: SupabaseClient | null = null;
let started = false;
const clientId = uid();

export async function startCloudSync() {
  if (!cloudConfigured || started) return;
  started = true;
  supabase = createClient(url!, key!);
  const store = useLife;
  store.getState().setUi({ syncStatus: "connecting" });

  try {
    let { data: sessionData } = await supabase.auth.getSession();
    if (!sessionData.session) {
      const { error } = await supabase.auth.signInAnonymously();
      if (error) throw error;
      sessionData = (await supabase.auth.getSession()).data;
    }
    const userId = sessionData.session?.user.id;
    if (!userId) throw new Error("no session");

    const { data: row, error } = await supabase
      .from("life_state")
      .select("state, updated_at")
      .eq("user_id", userId)
      .maybeSingle();
    if (error) throw error;

    let applyingRemote = false;
    const apply = (state: PersistedLife) => {
      applyingRemote = true;
      store.getState().applyRemote(state);
      applyingRemote = false;
    };

    const push = async () => {
      const state = pickPersisted(store.getState());
      await supabase!.from("life_state").upsert({
        user_id: userId,
        state,
        client_id: clientId,
        updated_at: new Date(state.updatedAt).toISOString(),
      });
    };

    const remote = row?.state as PersistedLife | undefined;
    if (remote && remote.updatedAt > store.getState().updatedAt) apply(remote);
    else await push();

    let timer: number | undefined;
    store.subscribe((s, prev) => {
      if (applyingRemote || s.updatedAt === prev.updatedAt) return;
      window.clearTimeout(timer);
      timer = window.setTimeout(() => void push(), 1200);
    });

    supabase
      .channel(`life_state:${userId}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "life_state", filter: `user_id=eq.${userId}` },
        (payload) => {
          const next = payload.new as { state?: PersistedLife; client_id?: string } | undefined;
          if (!next?.state || next.client_id === clientId) return;
          if (next.state.updatedAt > store.getState().updatedAt) apply(next.state);
        },
      )
      .subscribe();

    store.getState().setUi({ syncStatus: "cloud" });
  } catch (err) {
    console.warn("[life-os] cloud sync unavailable:", err);
    store.getState().setUi({ syncStatus: "error" });
  }
}
