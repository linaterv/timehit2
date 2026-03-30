import { useQuery, useMutation, useQueryClient, type QueryKey } from "@tanstack/react-query";
import { api } from "@/lib/api";

export function useApiQuery<T>(key: QueryKey, path: string, enabled = true) {
  return useQuery<T>({
    queryKey: key,
    queryFn: () => api<T>(path),
    enabled,
  });
}

export function useApiMutation<TData = unknown, TBody = unknown>(
  method: "POST" | "PATCH" | "PUT" | "DELETE",
  path: string | ((body: TBody) => string),
  invalidateKeys?: QueryKey[]
) {
  const qc = useQueryClient();
  return useMutation<TData, unknown, TBody>({
    mutationFn: async (body) => {
      const url = typeof path === "function" ? path(body) : path;
      return api<TData>(url, {
        method,
        body: method !== "DELETE" ? JSON.stringify(body) : undefined,
      });
    },
    onSuccess: () => {
      invalidateKeys?.forEach((k) => qc.invalidateQueries({ queryKey: k }));
    },
  });
}
