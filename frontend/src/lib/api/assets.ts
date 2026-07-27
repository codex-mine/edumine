import { apiClient, getPaginated, type PageMeta } from "@/lib/api/client";

export type AssetCondition = "new" | "good" | "fair" | "damaged" | "disposed";
export type AssetChangeType = "quantity_update" | "condition_update" | "relocation" | "disposal";

export const ASSET_CONDITION_LABELS: Record<AssetCondition, string> = {
  new: "New",
  good: "Good",
  fair: "Fair",
  damaged: "Damaged",
  disposed: "Disposed",
};

export const ASSET_CHANGE_TYPE_LABELS: Record<AssetChangeType, string> = {
  quantity_update: "Quantity changed",
  condition_update: "Condition changed",
  relocation: "Relocated",
  disposal: "Disposed",
};

// --- Asset categories ------------------------------------------------------------------

export interface AssetCategory {
  id: string;
  name: string;
  created_at: string;
}

export interface CreateAssetCategoryPayload {
  name: string;
}

export interface UpdateAssetCategoryPayload {
  name?: string;
}

export async function listAssetCategories(): Promise<AssetCategory[]> {
  const { data } = await apiClient.get<AssetCategory[]>("/assets/categories");
  return data;
}

export async function createAssetCategory(payload: CreateAssetCategoryPayload): Promise<AssetCategory> {
  const { data } = await apiClient.post<AssetCategory>("/assets/categories", payload);
  return data;
}

export async function updateAssetCategory(
  categoryId: string,
  payload: UpdateAssetCategoryPayload
): Promise<AssetCategory> {
  const { data } = await apiClient.patch<AssetCategory>(`/assets/categories/${categoryId}`, payload);
  return data;
}

// --- Rooms -------------------------------------------------------------------------------

export interface AssetRoom {
  id: string;
  name: string;
  capacity: number | null;
}

export async function listAssetRooms(): Promise<AssetRoom[]> {
  const { data } = await apiClient.get<AssetRoom[]>("/assets/rooms");
  return data;
}

// --- Assets --------------------------------------------------------------------------------

export interface Asset {
  id: string;
  category_id: string;
  category_name: string;
  name: string;
  room_id: string | null;
  room_name: string | null;
  quantity: number;
  condition: AssetCondition;
  purchase_date: string | null;
  purchase_value: number | null;
  created_at: string;
  updated_at: string;
}

export interface CreateAssetPayload {
  category_id: string;
  name: string;
  room_id?: string;
  quantity?: number;
  condition?: AssetCondition;
  purchase_date?: string;
  purchase_value?: number;
}

export interface UpdateAssetPayload {
  category_id?: string;
  name?: string;
  room_id?: string | null;
  quantity?: number;
  condition?: AssetCondition;
  purchase_date?: string | null;
  purchase_value?: number | null;
}

export async function createAsset(payload: CreateAssetPayload): Promise<Asset> {
  const { data } = await apiClient.post<Asset>("/assets", payload);
  return data;
}

export async function listAssets(params: {
  category_id?: string;
  room_id?: string;
  condition?: AssetCondition;
  search?: string;
  page: number;
  limit: number;
}): Promise<{ items: Asset[]; meta: PageMeta }> {
  return getPaginated<Asset>("/assets", params);
}

export async function getAsset(assetId: string): Promise<Asset> {
  const { data } = await apiClient.get<Asset>(`/assets/${assetId}`);
  return data;
}

export async function updateAsset(assetId: string, payload: UpdateAssetPayload): Promise<Asset> {
  const { data } = await apiClient.patch<Asset>(`/assets/${assetId}`, payload);
  return data;
}

// --- Asset logs ----------------------------------------------------------------------------

export interface AssetLog {
  id: string;
  asset_id: string;
  change_type: AssetChangeType;
  previous_value: string | null;
  new_value: string | null;
  updated_by: string;
  updated_by_name: string;
  created_at: string;
}

export async function listAssetLogs(assetId: string): Promise<AssetLog[]> {
  const { data } = await apiClient.get<AssetLog[]>(`/assets/${assetId}/logs`);
  return data;
}
