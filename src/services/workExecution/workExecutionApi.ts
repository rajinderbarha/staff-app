import { authenticatedRequest } from "../api/authenticatedClient";
import { ApiResult } from "../api/types";
import { WorkExecutionDetailDTO, WorkSessionDTO, PartsRequestDTO, PartsCatalogItemDTO, CreatePartsRequestBody } from "./types";

export function getWorkExecutionDetail(jobId: string, signal?: AbortSignal): Promise<ApiResult<WorkExecutionDetailDTO>> {
  return authenticatedRequest<WorkExecutionDetailDTO>(`/v1/staff/service-jobs/${jobId}/mobile-work-execution`, { method: "GET", signal });
}

export function startWork(jobId: string): Promise<ApiResult<WorkSessionDTO>> {
  return authenticatedRequest<WorkSessionDTO>(`/v1/staff/service-jobs/${jobId}/mobile-work-execution/start`, { method: "POST", unsafeToRetry: true });
}

export function pauseWork(jobId: string, reason?: string): Promise<ApiResult<WorkSessionDTO>> {
  return authenticatedRequest<WorkSessionDTO>(`/v1/staff/service-jobs/${jobId}/mobile-work-execution/pause`, { method: "POST", body: { reason: reason ?? null }, unsafeToRetry: true });
}

export function resumeWork(jobId: string): Promise<ApiResult<WorkSessionDTO>> {
  return authenticatedRequest<WorkSessionDTO>(`/v1/staff/service-jobs/${jobId}/mobile-work-execution/resume`, { method: "POST", unsafeToRetry: true });
}

export function finishWork(jobId: string): Promise<ApiResult<Record<string, unknown>>> {
  return authenticatedRequest(`/v1/staff/service-jobs/${jobId}/mobile-work-execution/finish`, { method: "POST", unsafeToRetry: true });
}

/** The provider's inventory the technician picks parts from, scoped to a job
 * assigned to them. */
export function listPartsCatalog(jobId: string, search?: string, signal?: AbortSignal): Promise<ApiResult<{ items: PartsCatalogItemDTO[] }>> {
  const term = search?.trim();
  const query = term ? `?search=${encodeURIComponent(term)}` : "";
  return authenticatedRequest<{ items: PartsCatalogItemDTO[] }>(`/v1/staff/service-jobs/${jobId}/parts-catalog${query}`, { method: "GET", signal });
}

/** Reuses the EXISTING, already-technician-authorized parts-request endpoint
 * (app/engines/execution/home_service_router.py) -- never a second parts engine.
 * The backend sends the request straight to the customer's chat, so a silent
 * retry would ask them twice. */
export function createPartsRequest(jobId: string, body: CreatePartsRequestBody): Promise<ApiResult<PartsRequestDTO>> {
  return authenticatedRequest<PartsRequestDTO>(`/v1/staff/service-jobs/${jobId}/parts-requests`, { method: "POST", body, unsafeToRetry: true });
}

/** Cancels a part request nobody has decided on yet, so a customer who never
 * answers in chat cannot block finishing the job. */
export function cancelPartsRequest(jobId: string, partsRequestId: string): Promise<ApiResult<PartsRequestDTO>> {
  return authenticatedRequest<PartsRequestDTO>(`/v1/staff/service-jobs/${jobId}/parts-requests/${partsRequestId}/cancel`, { method: "POST", unsafeToRetry: true });
}

/** Reuses the EXISTING checklist_catalog staff response endpoint. */
export function saveWorkChecklistResponse(
  instanceId: string, itemId: string,
  responseValue: Record<string, unknown> | null,
  evidence: { file_id: string }[] | null,
): Promise<ApiResult<Record<string, unknown>>> {
  return authenticatedRequest(`/v1/staff/service-jobs/checklist-instances/${instanceId}/responses/${itemId}`, {
    method: "POST", body: { response_value: responseValue, evidence }, unsafeToRetry: true,
  });
}
