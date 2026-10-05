import React from "react";
import { act, renderHook, waitFor } from "@testing-library/react-native";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useTabBadge, badgeQueryKeys } from "../placeholders/badges";

function wrapperFor(client: QueryClient) {
  return ({ children }: { children: React.ReactNode }) => <QueryClientProvider client={client}>{children}</QueryClientProvider>;
}

describe("useTabBadge", () => {
  it("updates when its screen invalidates the data, instead of keeping the count from login", async () => {
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    let unread = 11;
    const fetcher = jest.fn(async () => unread);
    const { result } = renderHook(() => useTabBadge(badgeQueryKeys.unreadNotifications, fetcher), { wrapper: wrapperFor(client) });
    await waitFor(() => expect(result.current).toBe("11"));

    unread = 10; // the technician read one notification
    await act(async () => { await client.invalidateQueries({ queryKey: ["notifications"] }); });
    await waitFor(() => expect(result.current).toBe("10"));
  });

  it("hides the badge at zero and never throws when the fetch fails", async () => {
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    const { result } = renderHook(() => useTabBadge(["jobs", "tab-badge", "t"], async () => { throw new Error("offline"); }), { wrapper: wrapperFor(client) });
    await waitFor(() => expect(client.getQueryState(["jobs", "tab-badge", "t"])?.status).toBe("success"));
    expect(result.current).toBeUndefined();
  });
});
