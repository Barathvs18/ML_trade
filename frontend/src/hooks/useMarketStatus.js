import { useQuery } from "@tanstack/react-query";
import { getMarketStatus } from "../api/market";
import { queryKeys } from "../api/queryKeys";

export function useMarketStatus(enabled = true) {
  return useQuery({
    queryKey: queryKeys.marketStatus,
    queryFn: getMarketStatus,
    enabled,
    staleTime: 25_000,
    refetchInterval: 30_000,
    retry: 1,
  });
}
