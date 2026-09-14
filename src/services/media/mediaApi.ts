import { ENV } from "../../config/environment";
import { getAccessToken } from "../auth/tokenCoordinator";
import { ApiResult } from "../api/types";
import { parseJsonText, isSuccessEnvelope, isProblemDetail } from "../api/responseParser";
import { mapProblemDetail, mapNetworkFailure, mapUnknownFailure } from "../api/errorMapper";

export interface UploadedMediaAsset {
  id: string;
  content_type?: string;
  size_bytes?: number;
}

/** A camera photo is several MB, and the server relays it on to storage
 * before it answers, so the 15s default meant for JSON calls is too tight. */
const UPLOAD_TIMEOUT_MS = 60_000;

/**
 * Evidence photo upload for checklist items (Phase K). Deliberately its own
 * minimal client rather than a change to authenticatedRequest -- that
 * shared client always JSON-encodes the body (services/api/apiClient.ts),
 * and widening it for one multipart caller would touch every existing
 * consumer. Still routes only through the Phase F token accessor
 * (getAccessToken) -- never reads SecureStore directly.
 */
export async function uploadChecklistEvidence(
  jobId: string,
  fileUri: string,
  fileName: string,
  mimeType: string,
): Promise<ApiResult<UploadedMediaAsset>> {
  return _upload(fileUri, fileName, mimeType, "checklist_photo", "service_job", jobId);
}

/** Personal document upload (Phase R) -- owner is the technician's own
 * user identity, never a job. Reuses the existing "provider_document"
 * media context (already validated server-side for PDF/image, 10MB) --
 * never a second storage system or an unregistered context. */
export async function uploadStaffDocument(
  fileUri: string, fileName: string, mimeType: string, ownerUserId: string,
): Promise<ApiResult<UploadedMediaAsset>> {
  return _upload(fileUri, fileName, mimeType, "provider_document", "user", ownerUserId);
}

/** Profile photo upload (Phase R) -- calls the dedicated POST
 * /v1/me/profile-photo endpoint (app/engines/media/new_router.py), which
 * both stores the image under the correct role-specific media context
 * ("staff_profile_photo" for technicians) AND writes User.avatar_url +
 * profile_photo_media_id server-side in one step -- no separate "update
 * avatar_url" call needed afterward. */
export async function uploadProfilePhoto(
  fileUri: string, fileName: string, mimeType: string,
): Promise<ApiResult<{ id: string; preview_url?: string; public_url?: string }>> {
  const form = new FormData();
  form.append("file", localFile(fileUri, fileName, mimeType));
  return postMultipart("/v1/me/profile-photo", form);
}

async function _upload(
  fileUri: string, fileName: string, mimeType: string,
  mediaContext: string, ownerType: string, ownerId: string,
): Promise<ApiResult<UploadedMediaAsset>> {
  const form = new FormData();
  form.append("file", localFile(fileUri, fileName, mimeType));
  form.append("media_context", mediaContext);
  form.append("owner_type", ownerType);
  form.append("owner_id", ownerId);
  return postMultipart("/v1/media/upload", form);
}

/** React Native's file-part shape: the native networking layer reads the
 * bytes from `uri` itself, so the photo never passes through JS memory. */
function localFile(uri: string, name: string, type: string): Blob {
  return { uri, name, type } as unknown as Blob;
}

/**
 * Sends the form through React Native's XMLHttpRequest, never the global
 * fetch. Since SDK 56, Expo installs expo/fetch as the global fetch, and it
 * cannot encode a `{ uri, name, type }` file part -- it throws "Unsupported
 * FormDataPart implementation" while building the body, before any request
 * leaves the phone. Every upload failed that way, and because the failure
 * surfaced as a thrown error it was reported as "Check your connection".
 * XHR is the transport React Native's own fetch is built on, and it still
 * reads `uri` parts natively. Tests never saw the breakage because
 * jest.config.js pins them to React Native's fetch.
 *
 * Never rejects: every failure resolves to an ApiResult error.
 */
function postMultipart<T>(path: string, form: FormData): Promise<ApiResult<T>> {
  const accessToken = getAccessToken();
  if (!accessToken) {
    return Promise.resolve({ ok: false, error: { code: "AUTH_REQUIRED", category: "auth", safeMessage: "Please sign in to continue.", retryable: false } });
  }
  return new Promise(resolve => {
    const xhr = new XMLHttpRequest();
    xhr.onload = () => resolve(toResult<T>(xhr.status, xhr.responseText));
    xhr.onerror = () => resolve({ ok: false, error: mapNetworkFailure("offline") });
    xhr.ontimeout = () => resolve({ ok: false, error: mapNetworkFailure("timeout") });
    try {
      xhr.open("POST", new URL(path, ENV.apiBaseUrl).toString());
      xhr.setRequestHeader("Authorization", `Bearer ${accessToken}`);
      xhr.timeout = UPLOAD_TIMEOUT_MS;
      xhr.send(form);
    } catch (err) {
      resolve({ ok: false, error: mapUnknownFailure(undefined, undefined, err) });
    }
  });
}

function toResult<T>(status: number, body: string): ApiResult<T> {
  const parsed = parseJsonText(body);
  if (status >= 200 && status < 300 && isSuccessEnvelope<T>(parsed)) {
    return { ok: true, data: parsed.data, meta: parsed.meta, links: parsed.links };
  }
  if (isProblemDetail(parsed)) {
    return { ok: false, error: mapProblemDetail(parsed, "authenticated") };
  }
  return { ok: false, error: mapUnknownFailure(status) };
}
