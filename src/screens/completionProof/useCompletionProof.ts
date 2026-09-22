import { useCallback, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import * as api from "../../services/completionProof/completionProofApi";
import { saveChecklistItemResponse } from "../../services/inspection/inspectionApi";
import { uploadChecklistEvidence } from "../../services/media/mediaApi";
import { AppError } from "../../services/api/types";

function queryKey(jobId: string) {
  return ["jobs", "completionProof", jobId] as const;
}

/** Completion Proof data + guarded mutations (Phase N). Every mutation
 * discards its own result in favor of a fresh authoritative refetch. */
export function useCompletionProof(jobId: string) {
  const queryClient = useQueryClient();
  const key = queryKey(jobId);

  const [mutating, setMutating] = useState(false);
  const [mutationError, setMutationError] = useState<AppError | null>(null);
  const [uploadingCategory, setUploadingCategory] = useState<"before" | "after" | null>(null);
  const [savingItemId, setSavingItemId] = useState<string | null>(null);
  const [uploadingItemId, setUploadingItemId] = useState<string | null>(null);

  const query = useQuery({
    queryKey: key,
    queryFn: async ({ signal }) => {
      const result = await api.getCompletionProofDetail(jobId, signal);
      if (!result.ok) throw result.error;
      return result.data;
    },
    enabled: Boolean(jobId),
    refetchOnMount: "always",
    // Handover is confirmed from the customer app/chat, so no technician
    // mutation can refresh this screen at the moment that external action
    // happens. Keep the short-lived waiting state authoritative.
    refetchInterval: query => {
      const proof = query.state.data?.proof;
      return proof?.status === "submitted" &&
        (proof.handover_status === "requested" || proof.handover_status === "customer_unavailable")
        ? 5000
        : false;
    },
  });

  const refresh = useCallback(async () => {
    // Completion mutations change the projections behind Job Detail, My Work
    // and Home as well as this screen. Invalidating only the private proof key
    // left the technician navigating back into stale workflow state.
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ["jobs"] }),
      queryClient.invalidateQueries({ queryKey: ["technician"] }),
    ]);
  }, [queryClient]);

  const runMutation = useCallback(async (fn: () => Promise<{ ok: boolean; error?: AppError }>) => {
    if (mutating) return { ok: false as const };
    setMutating(true);
    setMutationError(null);
    try {
      const result = await fn();
      if (!result.ok) {
        setMutationError(result.error ?? null);
        return { ok: false as const, error: result.error };
      }
      await refresh();
      return { ok: true as const };
    } finally {
      setMutating(false);
    }
  }, [mutating, refresh]);

  const saveDraft = useCallback((body: { resolution_summary?: string; final_service_notes?: string }) =>
    runMutation(() => api.saveDraft(jobId, body)), [runMutation, jobId]);

  const saveFinalCheck = useCallback(async (
    instanceId: string, itemId: string,
    responseValue: Record<string, unknown> | null,
    evidence: { file_id: string }[] | null,
  ) => {
    // Only the SAME item is guarded: a blanket "one save at a time" dropped
    // the technician's answer to a second check while the first was still
    // saving, and nothing retried it.
    if (savingItemId === itemId) return { ok: false as const };
    setSavingItemId(itemId);
    try {
      return await runMutation(() => saveChecklistItemResponse(instanceId, itemId, responseValue, evidence));
    } finally {
      setSavingItemId(null);
    }
  }, [savingItemId, runMutation]);

  const uploadFinalCheckEvidence = useCallback(async (itemId: string, fileUri: string, fileName: string, mimeType: string) => {
    if (uploadingItemId) return { ok: false as const };
    setUploadingItemId(itemId);
    setMutationError(null);
    try {
      const result = await uploadChecklistEvidence(jobId, fileUri, fileName, mimeType);
      if (!result.ok) {
        setMutationError(result.error);
        return { ok: false as const, error: result.error };
      }
      return { ok: true as const, fileId: result.data.id };
    } finally {
      setUploadingItemId(null);
    }
  }, [uploadingItemId, jobId]);

  const removeEvidence = useCallback((category: "before" | "after", fileId: string) =>
    runMutation(() => api.removeEvidence(jobId, category, fileId)), [runMutation, jobId]);

  const addEvidenceFromUpload = useCallback(async (category: "before" | "after", fileUri: string, fileName: string, mimeType: string) => {
    if (uploadingCategory) return { ok: false as const };
    setUploadingCategory(category);
    try {
      const upload = await uploadChecklistEvidence(jobId, fileUri, fileName, mimeType);
      if (!upload.ok) {
        setMutationError(upload.error);
        return { ok: false as const, error: upload.error };
      }
      return await runMutation(() => api.addEvidence(jobId, category, upload.data.id));
    } finally {
      setUploadingCategory(null);
    }
  }, [uploadingCategory, jobId, runMutation]);

  const submit = useCallback(() => runMutation(() => api.submitCompletionProof(jobId)), [runMutation, jobId]);
  const requestHandover = useCallback(() => runMutation(() => api.requestHandover(jobId)), [runMutation, jobId]);
  const sendReminder = useCallback(() => runMutation(() => api.sendHandoverReminder(jobId)), [runMutation, jobId]);
  const markCustomerUnavailable = useCallback(() => runMutation(() => api.markCustomerUnavailable(jobId)), [runMutation, jobId]);

  return {
    data: query.data,
    isLoading: query.isLoading,
    isError: query.isError,
    error: query.error as AppError | null,
    isRefetching: query.isRefetching,
    refetch: query.refetch,
    mutating, mutationError, uploadingCategory, savingItemId, uploadingItemId,
    saveDraft, saveFinalCheck, uploadFinalCheckEvidence, addEvidenceFromUpload, removeEvidence, submit, requestHandover, sendReminder, markCustomerUnavailable,
  };
}
