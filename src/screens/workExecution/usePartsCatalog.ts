import { keepPreviousData, useQuery } from "@tanstack/react-query";
import * as workExecutionApi from "../../services/workExecution/workExecutionApi";
import { AppError } from "../../services/api/types";
import { useDebouncedValue } from "../../hooks/useDebouncedValue";

/**
 * The provider's inventory a technician picks a part from. Fetched only
 * while the picker is open, with a server-side search so a large catalogue
 * never has to load in full. Stock is re-read each time the picker opens.
 */
export function usePartsCatalog(jobId: string, search: string, enabled: boolean) {
  const term = useDebouncedValue(search.trim(), 300);
  const query = useQuery({
    queryKey: ["jobs", "partsCatalog", jobId, term] as const,
    queryFn: async ({ signal }) => {
      const result = await workExecutionApi.listPartsCatalog(jobId, term, signal);
      if (!result.ok) throw result.error;
      return result.data.items;
    },
    enabled: enabled && Boolean(jobId),
    placeholderData: keepPreviousData,
  });

  return {
    items: query.data ?? [],
    isLoading: query.isLoading,
    isError: query.isError,
    error: query.error as AppError | null,
    refetch: query.refetch,
    /** The list shown is the catalogue for this exact search term. */
    searchTerm: term,
  };
}
