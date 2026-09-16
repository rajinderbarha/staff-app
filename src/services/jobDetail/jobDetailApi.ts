import { authenticatedRequest } from "../api/authenticatedClient";
import { ApiResult } from "../api/types";
import { CustomerCallDTO, JobMobileDetailDTO, JobTimelineDTO } from "./types";

/** GET /v1/staff/service-jobs/{job_id}/mobile-detail (Phase J). */
export function getJobDetail(jobId: string, signal?: AbortSignal): Promise<ApiResult<JobMobileDetailDTO>> {
  return authenticatedRequest<JobMobileDetailDTO>(`/v1/staff/service-jobs/${jobId}/mobile-detail`, { method: "GET", signal });
}

/** GET /v1/staff/service-jobs/{job_id}/mobile-timeline (Phase J). */
export function getJobTimeline(jobId: string, signal?: AbortSignal): Promise<ApiResult<JobTimelineDTO>> {
  return authenticatedRequest<JobTimelineDTO>(`/v1/staff/service-jobs/${jobId}/mobile-timeline`, { method: "GET", signal });
}

/**
 * Simple, already-supported transitions only (spec section 8) -- these
 * call the REAL existing execution endpoints
 * (app/engines/execution/home_service_router.py), never a new mobile-only
 * mutation. Neither endpoint accepts a body/version/idempotency key today
 * (audited) -- duplicate-submission protection is enforced client-side
 * (busy-state guard) until the backend adds one.
 */
export function acceptJob(jobId: string): Promise<ApiResult<Record<string, unknown>>> {
  return authenticatedRequest(`/v1/staff/service-jobs/${jobId}/accept`, { method: "POST", unsafeToRetry: true });
}

export function startTravel(jobId: string): Promise<ApiResult<Record<string, unknown>>> {
  return authenticatedRequest(`/v1/staff/service-jobs/${jobId}/on-the-way`, { method: "POST", unsafeToRetry: true });
}

export function markArrived(jobId: string): Promise<ApiResult<Record<string, unknown>>> {
  return authenticatedRequest(`/v1/staff/service-jobs/${jobId}/reached-site`, { method: "POST", unsafeToRetry: true });
}

/**
 * Records a tap on Call and returns the number to dial. The backend releases
 * the number only here, so every dialer opening is on record. `unsafeToRetry`
 * because a silent retry would record a second tap.
 */
export function recordCustomerCall(jobId: string): Promise<ApiResult<CustomerCallDTO>> {
  return authenticatedRequest<CustomerCallDTO>(`/v1/staff/service-jobs/${jobId}/customer-call`, { method: "POST", unsafeToRetry: true });
}

/**
 * POST /v1/staff/service-jobs/{job_id}/customer-contacted
 *
 * Satisfies the contact-first task by RECORDING that the conversation
 * happened -- it does not place a call and does not change job status. The
 * masked-calling engine writes the same event by itself when a bridged call
 * genuinely connects; this endpoint covers the technician who reached the
 * customer some other way, and every deployment where no telephony vendor is
 * configured (`MASKED_CALLING_NOT_CONFIGURED`), which would otherwise leave
 * the task permanently unsatisfiable and the job stuck on `accepted`.
 *
 * Idempotent on the backend, so a double-tap cannot stack timeline events.
 */
export function logCustomerContacted(jobId: string, requirements?: string): Promise<ApiResult<Record<string, unknown>>> {
  return authenticatedRequest(`/v1/staff/service-jobs/${jobId}/customer-contacted`, {
    method: "POST",
    body: requirements ? { requirements } : {},
  });
}

/**
 * POST /v1/staff/service-jobs/{job_id}/start-inspection
 *
 * The Inspection screen's own endpoints assume the job is already
 * `inspection_started`; nothing else in the app performs this transition.
 */
export function startInspection(jobId: string): Promise<ApiResult<Record<string, unknown>>> {
  return authenticatedRequest(`/v1/staff/service-jobs/${jobId}/start-inspection`, { method: "POST", unsafeToRetry: true });
}
