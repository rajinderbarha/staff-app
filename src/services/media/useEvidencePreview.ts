import { useEffect, useState } from "react";
import { ENV } from "../../config/environment";
import { getAccessToken } from "../auth/tokenCoordinator";

/**
 * A viewable URI for one private evidence photo.
 *
 * Evidence is served only to an authenticated caller by
 * GET /v1/media/{id}/view. Handing that URL to <Image> with an Authorization
 * header does not work on Android here -- the request reaches the server
 * without credentials and comes back 404 -- so the bytes are fetched through
 * an authenticated request and shown as a data URI instead.
 */
const MAX_PREVIEW_BYTES = 6 * 1024 * 1024;
const MAX_CACHED = 24;
const cache = new Map<string, string>();

function remember(fileId: string, uri: string) {
  cache.set(fileId, uri);
  if (cache.size > MAX_CACHED) {
    const oldest = cache.keys().next().value;
    if (oldest !== undefined) cache.delete(oldest);
  }
}

function toBase64(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  let binary = "";
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunk));
  }
  return btoa(binary);
}

export async function loadEvidencePreview(fileId: string): Promise<string | null> {
  const cached = cache.get(fileId);
  if (cached) return cached;
  const token = getAccessToken();
  if (!token) return null;
  try {
    const response = await fetch(`${ENV.apiBaseUrl}/v1/media/${encodeURIComponent(fileId)}/view`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!response.ok) return null;
    const type = response.headers.get("content-type") ?? "image/jpeg";
    if (!type.startsWith("image/")) return null;
    const buffer = await response.arrayBuffer();
    if (buffer.byteLength === 0 || buffer.byteLength > MAX_PREVIEW_BYTES) return null;
    const uri = `data:${type};base64,${toBase64(buffer)}`;
    remember(fileId, uri);
    return uri;
  } catch {
    return null; // A missing preview leaves the placeholder; it never breaks the screen.
  }
}

export function useEvidencePreview(fileId: string): string | undefined {
  const [uri, setUri] = useState<string | undefined>(() => cache.get(fileId));
  useEffect(() => {
    let active = true;
    if (cache.has(fileId)) {
      setUri(cache.get(fileId));
      return;
    }
    loadEvidencePreview(fileId).then(result => { if (active && result) setUri(result); });
    return () => { active = false; };
  }, [fileId]);
  return uri;
}

/** Test-only. */
export function __clearEvidencePreviewCache(): void {
  cache.clear();
}
