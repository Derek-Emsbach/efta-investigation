"use client";

import { useState, useEffect, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import type { SubscriptionTier, InvestigatorStats, InvestigatorRank } from "@efta/shared";
import { getRankAbbreviation } from "@/lib/access-control";

const XP_THRESHOLDS: Record<InvestigatorRank, number> = {
  "Junior Detective": 0,
  "Detective": 100,
  "Detective Sergeant": 500,
  "Detective Lieutenant": 1500,
  "Detective Captain": 4000,
  "Chief Inspector": 10000,
};

const RANK_ORDER: InvestigatorRank[] = [
  "Junior Detective",
  "Detective",
  "Detective Sergeant",
  "Detective Lieutenant",
  "Detective Captain",
  "Chief Inspector",
];

function getNextRankThreshold(rank: InvestigatorRank): number | null {
  const idx = RANK_ORDER.indexOf(rank);
  if (idx === RANK_ORDER.length - 1) return null;
  return XP_THRESHOLDS[RANK_ORDER[idx + 1]];
}

interface ProfileData {
  id: string;
  email: string | null;
  display_name: string | null;
  subscription_tier: SubscriptionTier | null;
  bio_short: string | null;
}

export default function AccountPage() {
  const router = useRouter();
  const [profile, setProfile] = useState<ProfileData | null>(null);
  const [stats, setStats] = useState<InvestigatorStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saveError, setError] = useState<string | null>(null);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);

  // Editable fields
  const [displayName, setDisplayName] = useState("");
  const [bio, setBio] = useState("");

  const supabase = createClient();

  useEffect(() => {
    async function load() {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        router.push("/login");
        return;
      }

      const { data: p } = await supabase
        .from("profiles")
        .select("id, email, display_name, subscription_tier, bio_short")
        .eq("id", user.id)
        .single();

      if (p) {
        setProfile(p as ProfileData);
        setDisplayName(p.display_name ?? "");
        setBio(p.bio_short ?? "");
      }

      if (p?.subscription_tier === "investigator") {
        const { data: s } = await supabase
          .from("investigator_stats")
          .select("*")
          .eq("user_id", user.id)
          .single();
        setStats(s as InvestigatorStats | null);
      }

      setLoading(false);
    }
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function handleSave(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!profile) return;
    setSaving(true);
    setError(null);
    setSaveSuccess(false);

    const res = await fetch("/api/account/profile", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ display_name: displayName.trim(), bio_short: bio.slice(0, 160) }),
    });

    if (!res.ok) {
      const data = await res.json();
      setError(data.error ?? "Failed to save.");
    } else {
      setSaveSuccess(true);
      setProfile((p) => p ? { ...p, display_name: displayName.trim(), bio_short: bio } : p);
    }
    setSaving(false);
  }

  async function handleSignOut() {
    await supabase.auth.signOut();
    router.push("/");
  }

  async function handleDeleteAccount() {
    const res = await fetch("/api/account", { method: "DELETE" });
    if (res.ok) {
      await supabase.auth.signOut();
      router.push("/");
    }
  }

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="text-text-muted text-sm">Loading…</div>
      </div>
    );
  }

  const tierLabel = profile?.subscription_tier === "investigator"
    ? "Investigator"
    : profile?.subscription_tier === "subscriber"
      ? "Subscriber"
      : "Viewer";

  return (
    <div className="mx-auto max-w-xl px-4 py-12">
      {/* Back to site */}
      <div className="mb-6">
        <Link href="/" className="text-xs text-text-muted hover:text-text-secondary transition-colors">
          ← Back to The Epstein Crimes
        </Link>
      </div>

      <h1 className="mb-1 font-display text-3xl font-bold text-text-primary">My Account</h1>
      <p className="mb-8 text-sm text-text-muted">{profile?.email}</p>

      {/* Tier badge */}
      <div className="mb-8 flex items-center gap-3 rounded-lg border border-border-default bg-surface px-5 py-4">
        <div>
          <p className="text-xs uppercase tracking-wider text-text-muted">Account type</p>
          <p className="font-semibold text-text-primary">{tierLabel}</p>
        </div>
        {profile?.subscription_tier === "investigator" && stats && (
          <>
            <div className="mx-4 h-8 w-px bg-border-default" />
            <div>
              <p className="text-xs uppercase tracking-wider text-text-muted">Rank</p>
              <p className="font-semibold text-accent-gold">{stats.current_rank}</p>
            </div>
            <div className="mx-4 h-8 w-px bg-border-default" />
            <div>
              <p className="text-xs uppercase tracking-wider text-text-muted">XP</p>
              <p className="font-semibold text-text-primary">{stats.xp_total.toLocaleString()}</p>
            </div>
          </>
        )}
        {profile?.subscription_tier === "investigator" && (
          <div className="ml-auto">
            <Link
              href="/investigate"
              className="rounded bg-accent-red px-3 py-1.5 text-xs font-semibold text-white hover:bg-accent-red/90 transition-colors"
            >
              Go to Workspace →
            </Link>
          </div>
        )}
      </div>

      {/* XP progress bar for investigators */}
      {profile?.subscription_tier === "investigator" && stats && (() => {
        const nextThreshold = getNextRankThreshold(stats.current_rank);
        const currentThreshold = XP_THRESHOLDS[stats.current_rank];
        if (nextThreshold === null) return null;
        const progress = Math.min(
          100,
          ((stats.xp_total - currentThreshold) / (nextThreshold - currentThreshold)) * 100,
        );
        return (
          <div className="mb-8 rounded-lg border border-border-default bg-surface px-5 py-4">
            <div className="mb-2 flex items-center justify-between text-xs text-text-muted">
              <span>{stats.current_rank}</span>
              <span>Next: {RANK_ORDER[RANK_ORDER.indexOf(stats.current_rank) + 1]} ({nextThreshold.toLocaleString()} XP)</span>
            </div>
            <div className="h-2 w-full overflow-hidden rounded-full bg-surface">
              <div
                className="h-2 rounded-full bg-accent-gold transition-all duration-700"
                style={{ width: `${progress}%` }}
              />
            </div>
            <p className="mt-2 text-right text-[11px] text-text-muted">
              {stats.xp_total.toLocaleString()} / {nextThreshold.toLocaleString()} XP
            </p>
          </div>
        );
      })()}

      {/* Profile settings form */}
      <form onSubmit={handleSave} className="space-y-5">
        <h2 className="font-display text-lg font-semibold text-text-primary">Profile</h2>

        <div>
          <label htmlFor="displayName" className="mb-1 block text-xs font-semibold uppercase tracking-wider text-text-muted">
            Display Name
          </label>
          <input
            id="displayName"
            type="text"
            value={displayName}
            onChange={(e) => setDisplayName(e.target.value)}
            maxLength={40}
            required
            className="w-full rounded border border-border-default bg-background px-4 py-2.5 text-text-primary placeholder:text-text-muted/50 focus:border-accent-red focus:outline-none focus:ring-2 focus:ring-accent-red/20"
          />
        </div>

        <div>
          <label htmlFor="bio" className="mb-1 block text-xs font-semibold uppercase tracking-wider text-text-muted">
            Short Bio <span className="font-normal normal-case tracking-normal">(shown on your profile)</span>
          </label>
          <textarea
            id="bio"
            value={bio}
            onChange={(e) => setBio(e.target.value)}
            maxLength={160}
            rows={3}
            placeholder="A short sentence about you…"
            className="w-full rounded border border-border-default bg-background px-4 py-2.5 text-text-primary placeholder:text-text-muted/50 focus:border-accent-red focus:outline-none focus:ring-2 focus:ring-accent-red/20 resize-none"
          />
          <p className="mt-1 text-right text-[11px] text-text-muted">{bio.length}/160</p>
        </div>

        {saveError && (
          <div className="rounded border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
            {saveError}
          </div>
        )}
        {saveSuccess && (
          <div className="rounded border border-green-200 bg-green-50 px-3 py-2 text-sm text-green-700">
            Profile saved.
          </div>
        )}

        <button
          type="submit"
          disabled={saving}
          className="rounded bg-accent-red px-5 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-accent-red/90 disabled:opacity-50"
        >
          {saving ? "Saving…" : "Save Changes"}
        </button>
      </form>

      {/* Actions */}
      <div className="mt-10 border-t border-border-default pt-6 space-y-3">
        <button
          onClick={handleSignOut}
          className="block w-full rounded border border-border-default px-4 py-2.5 text-sm font-medium text-text-secondary hover:text-text-primary hover:border-text-muted transition-colors"
        >
          Sign Out
        </button>

        {!confirmDelete ? (
          <button
            onClick={() => setConfirmDelete(true)}
            className="block w-full text-center text-xs text-text-muted hover:text-red-600 transition-colors py-1"
          >
            Delete account
          </button>
        ) : (
          <div className="rounded border border-red-200 bg-red-50 p-4 text-sm">
            <p className="mb-3 text-red-700">
              This permanently deletes your account and all your content. This cannot be undone.
            </p>
            <div className="flex gap-3">
              <button
                onClick={handleDeleteAccount}
                className="rounded bg-red-600 px-4 py-2 text-xs font-semibold text-white hover:bg-red-700 transition-colors"
              >
                Yes, delete my account
              </button>
              <button
                onClick={() => setConfirmDelete(false)}
                className="text-xs text-red-600 hover:underline"
              >
                Cancel
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
