import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import {
  createAsset,
  createAssetCategory,
  getAsset,
  listAssetCategories,
  listAssetLogs,
  listAssetRooms,
  listAssets,
  updateAsset,
  updateAssetCategory,
  type AssetCondition,
  type CreateAssetCategoryPayload,
  type CreateAssetPayload,
  type UpdateAssetCategoryPayload,
  type UpdateAssetPayload,
} from "@/lib/api/assets";

// --- Asset categories --------------------------------------------------------------------

export const assetCategoriesQueryKey = ["assets", "categories"] as const;

export function useAssetCategoriesQuery() {
  return useQuery({ queryKey: assetCategoriesQueryKey, queryFn: listAssetCategories });
}

export function useCreateAssetCategoryMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (payload: CreateAssetCategoryPayload) => createAssetCategory(payload),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: assetCategoriesQueryKey }),
  });
}

export function useUpdateAssetCategoryMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ categoryId, payload }: { categoryId: string; payload: UpdateAssetCategoryPayload }) =>
      updateAssetCategory(categoryId, payload),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: assetCategoriesQueryKey }),
  });
}

// --- Rooms ---------------------------------------------------------------------------------

export const assetRoomsQueryKey = ["assets", "rooms"] as const;

export function useAssetRoomsQuery() {
  return useQuery({ queryKey: assetRoomsQueryKey, queryFn: listAssetRooms });
}

// --- Assets ----------------------------------------------------------------------------------

export const assetsQueryKey = (params: {
  category_id?: string;
  room_id?: string;
  condition?: AssetCondition;
  search?: string;
  page: number;
  limit: number;
}) => ["assets", "list", params] as const;

export function useAssetsQuery(params: {
  category_id?: string;
  room_id?: string;
  condition?: AssetCondition;
  search?: string;
  page: number;
  limit: number;
}) {
  return useQuery({ queryKey: assetsQueryKey(params), queryFn: () => listAssets(params) });
}

export const assetQueryKey = (assetId: string) => ["assets", "detail", assetId] as const;

export function useAssetQuery(assetId: string | null) {
  return useQuery({
    queryKey: assetQueryKey(assetId ?? ""),
    queryFn: () => getAsset(assetId as string),
    enabled: Boolean(assetId),
  });
}

function invalidateAssetQueries(queryClient: ReturnType<typeof useQueryClient>, assetId?: string) {
  queryClient.invalidateQueries({ queryKey: ["assets", "list"] });
  if (assetId) {
    queryClient.invalidateQueries({ queryKey: assetQueryKey(assetId) });
    queryClient.invalidateQueries({ queryKey: assetLogsQueryKey(assetId) });
  }
}

export function useCreateAssetMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (payload: CreateAssetPayload) => createAsset(payload),
    onSuccess: () => invalidateAssetQueries(queryClient),
  });
}

export function useUpdateAssetMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ assetId, payload }: { assetId: string; payload: UpdateAssetPayload }) =>
      updateAsset(assetId, payload),
    onSuccess: (_data, variables) => invalidateAssetQueries(queryClient, variables.assetId),
  });
}

// --- Asset logs --------------------------------------------------------------------------------

export const assetLogsQueryKey = (assetId: string) => ["assets", "logs", assetId] as const;

export function useAssetLogsQuery(assetId: string | null) {
  return useQuery({
    queryKey: assetLogsQueryKey(assetId ?? ""),
    queryFn: () => listAssetLogs(assetId as string),
    enabled: Boolean(assetId),
  });
}
