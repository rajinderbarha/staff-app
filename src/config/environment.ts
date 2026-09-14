/**
 * Validated, immutable environment configuration (Phase F spec section 3).
 * This is the ONLY place `process.env.EXPO_PUBLIC_*` is read for networking
 * concerns -- feature code imports `ENV` from here, never `process.env`
 * directly. Expo only exposes variables prefixed `EXPO_PUBLIC_` to client
 * bundles (documented below); anything without that prefix stays server/
 * build-time only and is never available here by design -- do not add a
 * secret without that prefix and expect it to work, and never add one WITH
 * that prefix expecting it to stay secret.
 *
 * Public (bundled into the client, safe to be public):
 *   EXPO_PUBLIC_ENV                    - local | test | staging | production
 *   EXPO_PUBLIC_API_BASE_URL           - required outside "local"
 *   EXPO_PUBLIC_UNIVERSAL_LINK_HOST    - optional (Phase E deep linking)
 *   EXPO_PUBLIC_API_TIMEOUT_MS         - optional, defaults below
 *   EXPO_PUBLIC_ALLOW_INSECURE_HTTP    - optional, "true" to permit plain HTTP
 *                                        outside local dev (IP-based staging
 *                                        deploys that have no TLS yet)
 */
export type AppEnvironment = "local" | "test" | "staging" | "production";

export interface Environment {
  readonly appEnv: AppEnvironment;
  readonly apiBaseUrl: string;
  readonly apiTimeoutMs: number;
  readonly bootstrapTimeoutMs: number;
}

const DEFAULT_LOCAL_BASE_URL = "http://localhost:8000";
const DEFAULT_API_TIMEOUT_MS = 15_000;
const DEFAULT_BOOTSTRAP_TIMEOUT_MS = 10_000;

function normalizeBaseUrl(raw: string): string {
  return raw.trim().replace(/\/+$/, "");
}

function parseAppEnv(raw: string | undefined): AppEnvironment {
  if (raw === "local" || raw === "test" || raw === "staging" || raw === "production") return raw;
  return "local";
}

/**
 * Expo only inlines EXPO_PUBLIC_* values into a release bundle where they are
 * read as literal `process.env.EXPO_PUBLIC_X` dot-access. Passing the whole
 * `process.env` object around (or destructuring it) is NOT inlined, and the
 * runtime process.env of a release build does not carry these values -- so a
 * `= process.env` default works under Metro in dev and silently yields an
 * empty env (appEnv "local", localhost base URL) in an EAS release APK.
 * Every variable must therefore be named explicitly here.
 */
function readPublicEnv(): Partial<NodeJS.ProcessEnv> {
  return {
    EXPO_PUBLIC_ENV: process.env.EXPO_PUBLIC_ENV,
    EXPO_PUBLIC_API_BASE_URL: process.env.EXPO_PUBLIC_API_BASE_URL,
    EXPO_PUBLIC_API_TIMEOUT_MS: process.env.EXPO_PUBLIC_API_TIMEOUT_MS,
    EXPO_PUBLIC_ALLOW_INSECURE_HTTP: process.env.EXPO_PUBLIC_ALLOW_INSECURE_HTTP,
  };
}

/**
 * Builds and validates the environment config. Throws with a clear message
 * rather than silently falling back to a wrong/insecure default -- a
 * missing/invalid base URL outside local dev must fail loudly at startup,
 * not surface later as a mysterious network error.
 */
export function buildEnvironment(env: Partial<NodeJS.ProcessEnv> = readPublicEnv()): Environment {
  const appEnv = parseAppEnv(env.EXPO_PUBLIC_ENV);
  const rawBaseUrl = env.EXPO_PUBLIC_API_BASE_URL?.trim();

  let apiBaseUrl: string;
  if (appEnv === "local") {
    // No hardcoded localhost in production: this branch is unreachable
    // once appEnv is staging/production, and DEFAULT_LOCAL_BASE_URL is
    // only ever used for local dev when the developer hasn't set one.
    apiBaseUrl = normalizeBaseUrl(rawBaseUrl || DEFAULT_LOCAL_BASE_URL);
  } else {
    if (!rawBaseUrl) {
      throw new Error(
        `EXPO_PUBLIC_API_BASE_URL is required when EXPO_PUBLIC_ENV="${appEnv}". ` +
        "Refusing to fall back to a fabricated or local default outside local dev.",
      );
    }
    apiBaseUrl = normalizeBaseUrl(rawBaseUrl);
  }

  let parsed: URL;
  try {
    parsed = new URL(apiBaseUrl);
  } catch {
    throw new Error(`EXPO_PUBLIC_API_BASE_URL is not a valid URL: "${apiBaseUrl}"`);
  }

  // Real bug found while testing on a physical device over LAN: this only
  // ever matched simulator-loopback hostnames, never the private LAN IP a
  // physical device actually uses to reach the dev machine -- even though
  // the .env file's own documented workflow ("Physical device: replace
  // with your computer's local IP address") assumes exactly that works.
  // RFC1918 private ranges only, still appEnv==="local"-gated below.
  const isPrivateLanIp = /^(10\.|127\.|192\.168\.|172\.(1[6-9]|2\d|3[01])\.)/.test(parsed.hostname);
  const isLocalHost = parsed.hostname === "localhost" || parsed.hostname === "10.0.2.2" || isPrivateLanIp;
  // Explicit, opt-in escape hatch for the IP-based staging VPS, which serves
  // the API on plain http://<public-ip>:8000 with no TLS terminator in front
  // of it (see docker-compose.ip.yml). The guard stays on by default -- this
  // has to be turned on deliberately in .env, so an unencrypted transport is
  // never something you get by accident, only something you chose.
  const allowInsecureHttp = env.EXPO_PUBLIC_ALLOW_INSECURE_HTTP === "true";
  if (parsed.protocol !== "https:" && !(appEnv === "local" && isLocalHost) && !allowInsecureHttp) {
    throw new Error(
      `EXPO_PUBLIC_API_BASE_URL must use HTTPS outside local development (got "${parsed.protocol}" for appEnv="${appEnv}"). ` +
      "Set EXPO_PUBLIC_ALLOW_INSECURE_HTTP=true to allow plain HTTP against an IP-based deploy that has no TLS yet.",
    );
  }

  const apiTimeoutMs = Number(env.EXPO_PUBLIC_API_TIMEOUT_MS) || DEFAULT_API_TIMEOUT_MS;

  return Object.freeze({
    appEnv,
    apiBaseUrl,
    apiTimeoutMs,
    bootstrapTimeoutMs: DEFAULT_BOOTSTRAP_TIMEOUT_MS,
  });
}

export const ENV: Environment = buildEnvironment();
