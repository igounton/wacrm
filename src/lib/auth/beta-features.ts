/**
 * Beta feature flags, stored per-profile in `profiles.beta_features`
 * (a `TEXT[]`, migration 011). A feature is "on" for an account when its
 * key is present in that array; the owner opts in by editing the column
 * in Supabase Studio:
 *
 *   UPDATE profiles
 *   SET beta_features = array_append(beta_features, 'chat_media')
 *   WHERE email = 'someone@example.com';
 *
 * This module is the single source of truth for the keys + the membership
 * check so the client hook (`useBetaFeature`) and the server routes gate
 * on exactly the same logic.
 */

/** Agent-initiated media sends in the inbox composer (issue #213). */
export const CHAT_MEDIA_BETA = "chat_media";

export type BetaFeature = typeof CHAT_MEDIA_BETA;

/**
 * Whether an opted-in feature list contains `feature`. Pure + null-safe so
 * both the client (reading `profile.beta_features`) and the server
 * (reading the row from Supabase) share one implementation.
 */
export function hasBetaFeature(
  betaFeatures: readonly string[] | null | undefined,
  feature: BetaFeature,
): boolean {
  return betaFeatures?.includes(feature) ?? false;
}
