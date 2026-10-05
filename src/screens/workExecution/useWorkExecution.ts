import { useCallback, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import * as workExecutionApi from "../../services/workExecution/workExecutionApi";
import { AppError } from "../../services/api/types";
import { CreatePartsRequestBody } from "../../services/workExecution/types";

function queryKey(jobId: string) {
  return ["jobs", "workExecution", jobId] as const;
}

/**
 * Work Execution data + guarded mutations (Phase M). Every mutation
 * discards its own result in favor of a fresh authoritative refetch --
 * session state/readiness are never advanced client-side.
 */
export function useWorkExecution(jobId: string) {
  const queryClient = useQueryClient();
  const key = queryKey(jobId);

  const [mutating, setMutating] = useState(false);
  const [mutationError, setMutationError] = useState<AppError | null>(null);

  const query = useQuery({
    queryKey: key,
    queryFn: async ({ signal }) => {
      const result = await workExecutionApi.getWorkExecutionDetail(jobId, signal);
      if (!result.ok) throw result.error;
      return result.data;
    },
    enabled: Boolean(jobId),
    refetchInterval: (q) => (q.state.data?.work_session?.state === "active" ? 30000 : false),
  });

  // Also refresh Job Detail, the Jobs list and Home. "Back" returns to the
  // Job Detail already in the stack rather than pushing a fresh one, so it
  // must be told the job moved on or it shows the stage the technician left.
  const refresh = useCallback(async () => {
    await queryClient.invalidateQueries({ queryKey: key });
    void queryClient.invalidateQueries({ queryKey: ["jobs"] });
    void queryClient.invalidateQueries({ queryKey: ["technician"] });
  }, [queryClient, key]);

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

  const startWork = useCallback(() => runMutation(() => workExecutionApi.startWork(jobId)), [runMutation, jobId]);
  const pauseWork = useCallback((reason?: string) => runMutation(() => workExecutionApi.pauseWork(jobId, reason)), [runMutation, jobId]);
  const resumeWork = useCallback(() => runMutation(() => workExecutionApi.resumeWork(jobId)), [runMutation, jobId]);
  const finishWork = useCallback(() => runMutation(() => workExecutionApi.finishWork(jobId)), [runMutation, jobId]);

  const requestPart = useCallback((body: CreatePartsRequestBody) =>
    runMutation(() => workExecutionApi.createPartsRequest(jobId, body)), [runMutation, jobId]);
  const cancelPart = useCallback((partsRequestId: string) =>
    runMutation(() => workExecutionApi.cancelPartsRequest(jobId, partsRequestId)), [runMutation, jobId]);

  const saveChecklistResponse = useCallback((instanceId: string, itemId: string, value: Record<string, unknown> | null, evidence: { file_id: string }[] | null) =>
    runMutation(() => workExecutionApi.saveWorkChecklistResponse(instanceId, itemId, value, evidence)), [runMutation]);

  return {
    data: query.data,
    isLoading: query.isLoading,
    isError: query.isError,
    error: query.error as AppError | null,
    isRefetching: query.isRefetching,
    refetch: query.refetch,
    mutating, mutationError,
    startWork, pauseWork, resumeWork, finishWork, requestPart, cancelPart, saveChecklistResponse,
  };
}
