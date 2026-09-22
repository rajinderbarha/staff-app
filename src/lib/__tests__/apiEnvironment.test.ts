import { authApi } from "../api";

jest.mock("../../config/environment", () => ({
  ENV: { apiBaseUrl: "https://staff-api.example.test" },
}));

const originalFetch = global.fetch;
afterEach(() => {
  global.fetch = originalFetch;
});

it("uses the same validated base URL as the active API client", async () => {
  global.fetch = jest.fn().mockResolvedValue({
    ok: true,
    json: async () => ({ data: { access_token: "token" } }),
  } as Partial<Response>);

  await authApi.login("staff@example.test", "password");

  expect(global.fetch).toHaveBeenCalledWith(
    "https://staff-api.example.test/v1/auth/login",
    expect.objectContaining({ method: "POST" }),
  );
});
