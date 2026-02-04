/**
 * Conversation history retention configuration
 *
 * Currently all users have the same retention period (30 days).
 * In the future, this can be extended to support per-plan retention:
 * - Free: 3 days
 * - Starter: 7 days
 * - Pro: Unlimited
 * - Max: Unlimited
 */

export const RETENTION_CONFIG = {
  // Default retention period in days for all users
  defaultDays: 30,

  // Future: Per-plan retention (in days)
  // byPlan: {
  //   free: 3,
  //   starter: 7,
  //   pro: -1, // -1 means unlimited
  //   max: -1,
  // },
} as const;

/**
 * Get retention days for a user based on their plan
 * Currently returns the default value for all users
 */
export function getRetentionDays(_plan?: string): number {
  // Future: Return plan-specific retention
  // if (plan && RETENTION_CONFIG.byPlan[plan]) {
  //   return RETENTION_CONFIG.byPlan[plan];
  // }
  return RETENTION_CONFIG.defaultDays;
}

/**
 * Get the cutoff date for conversation retention
 * Conversations older than this date should not be shown/should be deleted
 */
export function getRetentionCutoffDate(plan?: string): Date {
  const days = getRetentionDays(plan);
  if (days < 0) {
    // Unlimited retention - return a very old date
    return new Date(0);
  }
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - days);
  return cutoff;
}
