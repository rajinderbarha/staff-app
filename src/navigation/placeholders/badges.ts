import { useQuery } from "@tanstack/react-query";

/**
 * Navigation-safe badge data source (spec section 6). Badge counts are
 * intentionally decoupled from screen content -- a badge fetch failure
 * must never break tab navigation, so a fetcher always resolves to a count
 * (0 on failure) and never throws or suspends.
 */
export interface BadgeAdapter {
  fetchUnreadNotificationCount(): Promise<number>;
  fetchActionableJobCount(): Promise<number>;
}

/** Keys live under the same prefixes the feature screens invalidate, so a
 * badge refreshes the moment its screen changes the data: reading a
 * notification invalidates ["notifications"], settling a job ["jobs"]. */
export const badgeQueryKeys = {
  unreadNotifications: ["notifications", "tab-badge", "unread-count"] as const,
  actionableJobs: ["jobs", "tab-badge", "awaiting-acceptance"] as const,
};

/** Badges also re-check on their own: new assignments and notifications
 * arrive from the server, not from anything this device did. */
const BADGE_REFRESH_MS = 60_000;

export const defaultBadgeAdapter: BadgeAdapter = {
  async fetchUnreadNotificationCount() {
    const { getUnreadCount } = await import("../../services/notifications/notificationsApi");
    const result = await getUnreadCount();
    return result.ok ? result.data.unread_count : 0;
  },
  // Jobs that need the technician's answer: newly assigned and not yet
  // accepted or declined. This was a stub that always returned 0.
  async fetchActionableJobCount() {
    const { getMobileJobs } = await import("../../services/jobs/jobsApi");
    const result = await getMobileJobs({ view: "active", workflowStatus: "assigned", limit: 100 });
    if (!result.ok) return 0;
    return result.data.has_more ? 100 : result.data.results.length;
  },
};

export function useTabBadge(queryKey: readonly unknown[], fetcher: () => Promise<number>): string | undefined {
  const { data } = useQuery({
    queryKey,
    queryFn: async () => {
      try {
        return await fetcher();
      } catch {
        return 0;
      }
    },
    refetchInterval: BADGE_REFRESH_MS,
    staleTime: BADGE_REFRESH_MS / 2,
    retry: false,
  });
  if (!data || data <= 0) return undefined;
  return data > 99 ? "99+" : String(data);
}
