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
import { useAssetCategoriesQuery, useAssetRoomsQuery, useCreateAssetMutation } from "@/hooks/use-assets";
import { ASSET_CONDITION_LABELS, type AssetCondition } from "@/lib/api/assets";

const NONE = "__none__";
const CONDITIONS: AssetCondition[] = ["new", "good", "fair", "damaged", "disposed"];

export function RegisterAssetDialog({ trigger }: { trigger: React.ReactNode }) {
  const [open, setOpen] = useState(false);
  const [categoryId, setCategoryId] = useState("");
  const [name, setName] = useState("");
  const [roomId, setRoomId] = useState("");
  const [quantity, setQuantity] = useState("1");
  const [condition, setCondition] = useState<AssetCondition>("good");
  const [purchaseDate, setPurchaseDate] = useState("");
  const [purchaseValue, setPurchaseValue] = useState("");
  const [error, setError] = useState<string | null>(null);

  const categoriesQuery = useAssetCategoriesQuery();
  const roomsQuery = useAssetRoomsQuery();
  const createMutation = useCreateAssetMutation();
  const categories = categoriesQuery.data ?? [];
  const rooms = roomsQuery.data ?? [];

  function resetForm() {
    setCategoryId("");
    setName("");
    setRoomId("");
    setQuantity("1");
    setCondition("good");
    setPurchaseDate("");
    setPurchaseValue("");
  }

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setError(null);
    if (!categoryId) {
      setError("Select an asset category");
      return;
    }
    try {
      await createMutation.mutateAsync({
        category_id: categoryId,
        name,
        room_id: roomId || undefined,
        quantity: Number(quantity),
        condition,
        purchase_date: purchaseDate || undefined,
        purchase_value: purchaseValue ? Number(purchaseValue) : undefined,
      });
      setOpen(false);
      resetForm();
    } catch (mutationError) {
      setError(loginErrorMessage(mutationError));
    }
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (!next) setError(null);
      }}
    >
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Register asset</DialogTitle>
          <DialogDescription>Add a new item to the institutional asset registry.</DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="flex flex-col gap-3">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="asset_category">Category</Label>
            <Select value={categoryId || undefined} onValueChange={setCategoryId}>
              <SelectTrigger id="asset_category">
                <SelectValue placeholder="Select a category" />
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
            <Label htmlFor="asset_name">Name</Label>
            <Input
              id="asset_name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder='e.g. Router - TP-Link AC1200'
              required
            />
          </div>

          <div className="flex flex-col gap-3 sm:flex-row">
            <div className="flex flex-1 flex-col gap-1.5">
              <Label htmlFor="asset_quantity">Quantity</Label>
              <Input
                id="asset_quantity"
                type="number"
                min={0}
                step="1"
                value={quantity}
                onChange={(e) => setQuantity(e.target.value)}
                required
              />
            </div>
            <div className="flex flex-1 flex-col gap-1.5">
              <Label htmlFor="asset_condition">Condition</Label>
              <Select value={condition} onValueChange={(value) => setCondition(value as AssetCondition)}>
                <SelectTrigger id="asset_condition">
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
            <Label htmlFor="asset_room">Room location (optional)</Label>
            <Select value={roomId || NONE} onValueChange={(value) => setRoomId(value === NONE ? "" : value)}>
              <SelectTrigger id="asset_room">
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
              <Label htmlFor="asset_purchase_date">Purchase date (optional)</Label>
              <Input
                id="asset_purchase_date"
                type="date"
                value={purchaseDate}
                onChange={(e) => setPurchaseDate(e.target.value)}
              />
            </div>
            <div className="flex flex-1 flex-col gap-1.5">
              <Label htmlFor="asset_purchase_value">Purchase value (optional)</Label>
              <Input
                id="asset_purchase_value"
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
            <Button type="button" variant="outline" onClick={() => setOpen(false)} disabled={createMutation.isPending}>
              Cancel
            </Button>
            <Button type="submit" disabled={createMutation.isPending}>
              Register asset
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
