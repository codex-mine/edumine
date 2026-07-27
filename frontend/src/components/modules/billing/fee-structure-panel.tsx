"use client";

import { useState } from "react";
import { Save, Trash2 } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { EmptyState } from "@/components/shared/empty-state";
import { ErrorState } from "@/components/shared/error-state";
import { LoadingState } from "@/components/shared/loading-state";
import { AcademicYearSelect } from "@/components/modules/academic/academic-year-select";
import { loginErrorMessage } from "@/hooks/use-auth";
import { useClassesQuery } from "@/hooks/use-academic";
import {
  useDeleteFeeStructureItemMutation,
  useFeeStructuresQuery,
  useFeeTypesQuery,
  useSetFeeStructureMutation,
} from "@/hooks/use-billing";

export function FeeStructurePanel({ defaultAcademicYearId }: { defaultAcademicYearId?: string }) {
  const [yearOverride, setYearOverride] = useState("");
  const academicYearId = yearOverride || defaultAcademicYearId || "";
  const [classId, setClassId] = useState("");
  const [amounts, setAmounts] = useState<Record<string, string>>({});
  const [loadedKey, setLoadedKey] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const classesQuery = useClassesQuery();
  const feeTypesQuery = useFeeTypesQuery();
  const structuresQuery = useFeeStructuresQuery(academicYearId, classId || undefined);
  const setMutation = useSetFeeStructureMutation();
  const deleteMutation = useDeleteFeeStructureItemMutation();

  const structures = structuresQuery.data ?? [];
  const feeTypes = feeTypesQuery.data ?? [];

  // Seed editable amounts from the loaded structure exactly once per
  // year/class combination — set during render so a background refetch
  // never clobbers in-progress edits (same pattern as the marks-entry roster).
  const currentKey = `${academicYearId}:${classId}`;
  if (structuresQuery.data && loadedKey !== currentKey) {
    setLoadedKey(currentKey);
    const next: Record<string, string> = {};
    for (const structure of structuresQuery.data) {
      next[structure.fee_type_id] = String(structure.amount);
    }
    setAmounts(next);
  }

  async function handleSave() {
    setError(null);
    setSuccess(null);
    if (!academicYearId || !classId) {
      setError("Select an academic year and a class first");
      return;
    }
    const items = Object.entries(amounts)
      .filter(([, value]) => value.trim() !== "" && Number(value) >= 0)
      .map(([fee_type_id, value]) => ({ fee_type_id, amount: Number(value) }));
    if (items.length === 0) {
      setError("Enter at least one fee amount");
      return;
    }
    try {
      await setMutation.mutateAsync({ academic_year_id: academicYearId, class_id: classId, items });
      setSuccess("Fee structure saved");
    } catch (mutationError) {
      setError(loginErrorMessage(mutationError));
    }
  }

  async function handleRemove(structureId: string) {
    setError(null);
    try {
      await deleteMutation.mutateAsync(structureId);
    } catch (mutationError) {
      setError(loginErrorMessage(mutationError));
    }
  }

  const structureByFeeType = new Map(structures.map((s) => [s.fee_type_id, s]));

  return (
    <Card>
      <CardHeader>
        <CardTitle>Class fee structure</CardTitle>
        <CardDescription>
          Set the standard fee amount per class, per academic year — applied automatically when invoices are
          generated.
        </CardDescription>
      </CardHeader>

      <div className="flex flex-col gap-4 px-4 pb-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
          <AcademicYearSelect value={academicYearId} onChange={setYearOverride} />
          <div className="flex flex-col gap-1.5">
            <label className="text-sm font-medium text-foreground" htmlFor="fs_class">
              Class
            </label>
            <Select value={classId || undefined} onValueChange={setClassId}>
              <SelectTrigger id="fs_class" className="w-full sm:w-[16rem]">
                <SelectValue placeholder="Select a class" />
              </SelectTrigger>
              <SelectContent>
                {(classesQuery.data ?? []).map((cls) => (
                  <SelectItem key={cls.id} value={cls.id}>
                    {cls.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        {!academicYearId || !classId ? (
          <EmptyState message="Select an academic year and a class to configure its fee structure." />
        ) : feeTypesQuery.isLoading || structuresQuery.isLoading ? (
          <LoadingState label="Loading fee structure..." />
        ) : feeTypesQuery.isError ? (
          <ErrorState message={loginErrorMessage(feeTypesQuery.error)} onRetry={() => feeTypesQuery.refetch()} />
        ) : feeTypes.length === 0 ? (
          <EmptyState message="No fee types defined yet — add one above first." />
        ) : (
          <div className="overflow-x-auto rounded border border-border">
            <table className="w-full text-left text-sm">
              <thead className="bg-muted">
                <tr>
                  <th className="px-3 py-2 font-medium text-muted-foreground">Fee type</th>
                  <th className="px-3 py-2 font-medium text-muted-foreground">Amount</th>
                  <th className="px-3 py-2 font-medium text-muted-foreground" />
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {feeTypes.map((feeType) => {
                  const structure = structureByFeeType.get(feeType.id);
                  return (
                    <tr key={feeType.id}>
                      <td className="px-3 py-2 font-medium text-foreground">
                        {feeType.name}
                        {feeType.is_recurring && (
                          <Badge variant="info" className="ml-2">
                            Recurring
                          </Badge>
                        )}
                      </td>
                      <td className="px-3 py-2">
                        <Input
                          type="number"
                          min={0}
                          step="0.01"
                          className="w-32"
                          value={amounts[feeType.id] ?? ""}
                          onChange={(e) => setAmounts((prev) => ({ ...prev, [feeType.id]: e.target.value }))}
                        />
                      </td>
                      <td className="px-3 py-2">
                        {structure && (
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            disabled={deleteMutation.isPending}
                            onClick={() => handleRemove(structure.id)}
                          >
                            <Trash2 className="size-4" aria-hidden="true" />
                          </Button>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {error && <p className="text-sm text-destructive">{error}</p>}
        {success && <p className="text-sm text-success">{success}</p>}

        <div>
          <Button
            type="button"
            onClick={handleSave}
            disabled={setMutation.isPending || !academicYearId || !classId}
          >
            <Save className="size-4" aria-hidden="true" />
            Save fee structure
          </Button>
        </div>
      </div>
    </Card>
  );
}
