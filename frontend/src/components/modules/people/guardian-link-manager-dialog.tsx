"use client";

import { useState } from "react";
import { Star, Trash2, UserPlus } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/shared/confirm-dialog";
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
import { EmptyState } from "@/components/shared/empty-state";
import { LoadingState } from "@/components/shared/loading-state";
import { loginErrorMessage } from "@/hooks/use-auth";
import { useGuardiansQuery } from "@/hooks/use-guardians";
import {
  useLinkGuardianMutation,
  useStudentQuery,
  useUnlinkGuardianMutation,
  useUpdateGuardianLinkMutation,
} from "@/hooks/use-students";

export function GuardianLinkManagerDialog({ trigger, studentId }: { trigger: React.ReactNode; studentId: string }) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [selectedGuardianId, setSelectedGuardianId] = useState<string | null>(null);
  const [relation, setRelation] = useState("");
  const [isPrimary, setIsPrimary] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const studentQuery = useStudentQuery(open ? studentId : null);
  const guardianSearchQuery = useGuardiansQuery({ page: 1, limit: 10, search: search || undefined });
  const linkMutation = useLinkGuardianMutation();
  const updateLinkMutation = useUpdateGuardianLinkMutation();
  const unlinkMutation = useUnlinkGuardianMutation();

  const linkedIds = new Set((studentQuery.data?.guardians ?? []).map((g) => g.guardian_id));
  const candidates = (guardianSearchQuery.data?.items ?? []).filter((g) => !linkedIds.has(g.id));

  async function handleLink() {
    if (!selectedGuardianId || !relation) return;
    setError(null);
    try {
      await linkMutation.mutateAsync({ studentId, guardianId: selectedGuardianId, relation, isPrimary });
      setSelectedGuardianId(null);
      setRelation("");
      setIsPrimary(false);
      setSearch("");
    } catch (mutationError) {
      setError(loginErrorMessage(mutationError));
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Manage guardians</DialogTitle>
          <DialogDescription>Link or unlink guardians for this student. Exactly one guardian is primary.</DialogDescription>
        </DialogHeader>

        {studentQuery.isLoading ? (
          <LoadingState label="Loading guardians..." />
        ) : (
          <div className="flex flex-col gap-4">
            <div className="flex flex-col gap-2">
              {(studentQuery.data?.guardians ?? []).length === 0 ? (
                <EmptyState message="No guardians linked yet." />
              ) : (
                (studentQuery.data?.guardians ?? []).map((guardian) => (
                  <div
                    key={guardian.guardian_id}
                    className="flex items-center justify-between rounded border border-border px-3 py-2"
                  >
                    <div className="flex flex-col">
                      <span className="flex items-center gap-2 text-sm font-medium text-foreground">
                        {guardian.full_name}
                        {guardian.is_primary && <Badge variant="default">Primary</Badge>}
                      </span>
                      <span className="text-xs text-muted-foreground">
                        {guardian.relation} &middot; {guardian.phone}
                      </span>
                    </div>
                    <div className="flex gap-1">
                      {!guardian.is_primary && (
                        <Button
                          variant="ghost"
                          size="icon-sm"
                          aria-label="Make primary"
                          disabled={updateLinkMutation.isPending}
                          onClick={() =>
                            updateLinkMutation.mutate({
                              studentId,
                              guardianId: guardian.guardian_id,
                              isPrimary: true,
                            })
                          }
                        >
                          <Star className="size-4" aria-hidden="true" />
                        </Button>
                      )}
                      <ConfirmDialog
                        trigger={
                          <Button variant="destructive" size="icon-sm" aria-label="Unlink guardian">
                            <Trash2 className="size-6" aria-hidden="true" />
                          </Button>
                        }
                        title="Unlink this guardian?"
                        description="This removes the guardian-student link. It can be re-linked later."
                        confirmLabel="Unlink"
                        isPending={unlinkMutation.isPending}
                        onConfirm={() => unlinkMutation.mutate({ studentId, guardianId: guardian.guardian_id })}
                      />
                    </div>
                  </div>
                ))
              )}
            </div>

            <div className="flex flex-col gap-2 border-t border-border pt-3">
              <Label htmlFor="guardian_search">Link a guardian</Label>
              <Input
                id="guardian_search"
                placeholder="Search guardians by name, email, or phone"
                value={search}
                onChange={(e) => {
                  setSearch(e.target.value);
                  setSelectedGuardianId(null);
                }}
              />
              {search && (
                <div className="flex max-h-32 flex-col gap-1 overflow-y-auto rounded border border-border p-1">
                  {candidates.length === 0 ? (
                    <p className="px-2 py-1 text-xs text-muted-foreground">No matching guardians.</p>
                  ) : (
                    candidates.map((candidate) => (
                      <button
                        type="button"
                        key={candidate.id}
                        onClick={() => setSelectedGuardianId(candidate.id)}
                        className={`flex items-center justify-between rounded px-2 py-1.5 text-left text-sm ${
                          selectedGuardianId === candidate.id ? "bg-primary/10 text-primary" : "hover:bg-muted"
                        }`}
                      >
                        <span>{candidate.full_name}</span>
                        <span className="text-xs text-muted-foreground">{candidate.phone}</span>
                      </button>
                    ))
                  )}
                </div>
              )}

              {selectedGuardianId && (
                <div className="flex flex-col gap-4 rounded border border-border p-2 mt-10">
                  <div className="flex flex-col gap-1.5">
                    <Label htmlFor="relation">Relation</Label>
                    <Input
                      id="relation"
                      value={relation}
                      onChange={(e) => setRelation(e.target.value)}
                      placeholder="father, mother, legal_guardian..."
                    />
                  </div>
                  <label className="flex items-center gap-2 text-sm">
                    <input type="checkbox" checked={isPrimary} onChange={(e) => setIsPrimary(e.target.checked)} />
                    Set as primary contact
                  </label>
                  <Button
                    type="button" 
                    disabled={!relation || linkMutation.isPending}
                    onClick={handleLink}
                    className="w-fit"
                  >
                    <UserPlus className="size-6" aria-hidden="true" />
                    Link guardian
                  </Button>
                </div>
              )}
            </div>

            {error && <p className="text-sm text-destructive">{error}</p>}
          </div>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>
            Close
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
