"use client";

import { useAuth } from "@/hooks/use-auth";
import { hasBetaFeature, type BetaFeature } from "@/lib/auth/beta-features";

/**
 * Boolean gate for a per-profile beta feature flag (see
 * `@/lib/auth/beta-features`). Mirrors `useCan`: returns `false` while the
 * profile is still loading so a not-yet-opted-in user never sees a flash
 * of beta UI during the initial load window.
 *
 * Example:
 *   const chatMedia = useBetaFeature(CHAT_MEDIA_BETA);
 *   {chatMedia && <AttachButton />}
 */
export function useBetaFeature(feature: BetaFeature): boolean {
  const { profileLoading, profile } = useAuth();
  if (profileLoading || !profile) return false;
  return hasBetaFeature(profile.beta_features, feature);
}
