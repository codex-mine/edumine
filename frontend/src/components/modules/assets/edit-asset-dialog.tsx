"use client";

import { useState } from "react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { loginErrorMessage } from "@/hooks/use-auth";
import { useAssetCategoriesQuery, useAssetRoomsQuery, useUpdateAssetMutation } from "@/hooks/use-assets";
import { ASSET_CONDITION_LABELS, type Asset, type AssetCondition } from "@/lib/api/assets";

const NONE = "__none__";
const CONDITIONS: AssetCondition[] = ["new", "good", "fair", "damaged", "disposed"];

export function EditAssetDialog({ trigger, asset }: { trigger: React.ReactNode; asset: Asset }) {
  const [open, setOpen] = useState(false);
  const [categoryId, setCategoryId] = useState(asset.category_id);
  const [name, setName] = useState(asset.name);
  const [roomId, setRoomId] = useState(asset.room_id ?? "");
  const [quantity, setQuantity] = useState(String(asset.quantity));
  const [condition, setCondition] = useState<AssetCondition>(asset.condition);
  const [purchaseDate, setPurchaseDate] = useState(asset.purchase_date ?? "");
  const [purchaseValue, setPurchaseValue] = useState(asset.purchase_value != null ? String(asset.purchase_value) : "");
  const [error, setError] = useState<string | null>(null);

  const categoriesQuery = useAssetCategoriesQuery();
  const roomsQuery = useAssetRoomsQuery();
  const updateMutation = useUpdateAssetMutation();
  const categories = categoriesQuery.data ?? [];
  const rooms = roomsQuery.data ?? [];

  function resetFromAsset() {
    setCategoryId(asset.category_id);
    setName(asset.name);
    setRoomId(asset.room_id ?? "");
    setQuantity(String(asset.quantity));
    setCondition(asset.condition);
    setPurchaseDate(asset.purchase_date ?? "");
    setPurchaseValue(asset.purchase_value != null ? String(asset.purchase_value) : "");
  }

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setError(null);
    try {
      await updateMutation.mutateAsync({
        assetId: asset.id,
        payload: {
          category_id: categoryId,
          name,
          room_id: roomId || null,
          quantity: Number(quantity),
          condition,
          purchase_date: purchaseDate || null,
          purchase_value: purchaseValue ? Number(purchaseValue) : null,
        },
      });
      setOpen(false);
    } catch (mutationError) {
      setError(loginErrorMessage(mutationError));
    }
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (next) resetFromAsset();
        setError(null);
      }}
    >
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Edit asset</DialogTitle>
          <DialogDescription>
            Quantity, condition, and room changes are recorded in this asset&apos;s change history.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="flex flex-col gap-3">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="edit_asset_category">Category</Label>
            <Select value={categoryId} onValueChange={setCategoryId}>
              <SelectTrigger id="edit_asset_category">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {categories.map((category) => (
                  <SelectItem key={category.id} value={category.id}>
                    {category.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="edit_asset_name">Name</Label>
            <Input id="edit_asset_name" value={name} onChange={(e) => setName(e.target.value)} required />
          </div>

          <div className="flex flex-col gap-3 sm:flex-row">
            <div className="flex flex-1 flex-col gap-1.5">
              <Label htmlFor="edit_asset_quantity">Quantity</Label>
              <Input
                id="edit_asset_quantity"
                type="number"
                min={0}
                step="1"
                value={quantity}
                onChange={(e) => setQuantity(e.target.value)}
                required
              />
            </div>
            <div className="flex flex-1 flex-col gap-1.5">
              <Label htmlFor="edit_asset_condition">Condition</Label>
              <Select value={condition} onValueChange={(value) => setCondition(value as AssetCondition)}>
                <SelectTrigger id="edit_asset_condition">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {CONDITIONS.map((c) => (
                    <SelectItem key={c} value={c}>
                      {ASSET_CONDITION_LABELS[c]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="edit_asset_room">Room location</Label>
            <Select value={roomId || NONE} onValueChange={(value) => setRoomId(value === NONE ? "" : value)}>
              <SelectTrigger id="edit_asset_room">
                <SelectValue placeholder="Unassigned" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={NONE}>Unassigned</SelectItem>
                {rooms.map((room) => (
                  <SelectItem key={room.id} value={room.id}>
                    {room.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="flex flex-col gap-3 sm:flex-row">
            <div className="flex flex-1 flex-col gap-1.5">
              <Label htmlFor="edit_asset_purchase_date">Purchase date</Label>
              <Input
                id="edit_asset_purchase_date"
                type="date"
                value={purchaseDate}
                onChange={(e) => setPurchaseDate(e.target.value)}
              />
            </div>
            <div className="flex flex-1 flex-col gap-1.5">
              <Label htmlFor="edit_asset_purchase_value">Purchase value</Label>
              <Input
                id="edit_asset_purchase_value"
                type="number"
                min={0}
                step="0.01"
                value={purchaseValue}
                onChange={(e) => setPurchaseValue(e.target.value)}
              />
            </div>
          </div>

          {error && <p className="text-sm text-destructive">{error}</p>}

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setOpen(false)} disabled={updateMutation.isPending}>
              Cancel
            </Button>
            <Button type="submit" disabled={updateMutation.isPending}>
              Save changes
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
