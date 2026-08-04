"use client";

import { CircleAlert, KeyRound } from "lucide-react";
import Link from "next/link";

import { EmptyState } from "@/components/shared/empty-state";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useEligibilityQueries } from "@/hooks/use-omr";
import type { ExamSubjectOption } from "@/components/modules/omr/batch-list";

/** Lists the exam subjects whose OMR answer keys this user can manage, with the
 * reason attached when a subject cannot be scanned at all. */
export function AnswerKeySubjectPicker({
  examSubjects,
  basePath,
}: {
  examSubjects: ExamSubjectOption[];
  basePath: string;
}) {
  const eligibility = useEligibilityQueries(examSubjects.map((subject) => subject.id));

  return (
    <div className="flex w-full flex-col gap-5">
      <div className="flex flex-col gap-1">
        <h1 className="text-2xl font-semibold text-foreground">OMR answer keys</h1>
        <p className="text-sm text-muted-foreground">
          Define the correct answers for each set code before scanning that subject&apos;s sheets.
        </p>
      </div>

      {examSubjects.length === 0 ? (
        <EmptyState message="No exam subjects available." />
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {examSubjects.map((subject, index) => {
            const query = eligibility[index];
            const eligible = query?.data?.eligible ?? false;
            const setCodes = query?.data?.answer_key_set_codes ?? [];

            return (
              <Card key={subject.id}>
                <CardHeader>
                  <div className="flex items-start justify-between gap-2">
                    <CardTitle>{subject.label}</CardTitle>
                    {query?.isPending ? (
                      <Badge variant="default">Checking…</Badge>
                    ) : eligible ? (
                      <Badge variant={setCodes.length ? "success" : "warning"}>
                        {setCodes.length ? `${setCodes.length} key(s)` : "No keys"}
                      </Badge>
                    ) : (
                      <Badge variant="warning">
                        <CircleAlert className="size-3" aria-hidden="true" />
                        Not scannable
                      </Badge>
                    )}
                  </div>
                  <CardDescription>{subject.description}</CardDescription>
                  {!query?.isPending && !eligible && query?.data?.reason && (
                    <p className="text-sm text-muted-foreground">{query.data.reason}</p>
                  )}
                  {setCodes.length > 0 && (
                    <p className="text-sm text-muted-foreground">Sets: {setCodes.join(", ")}</p>
                  )}
                </CardHeader>
                <div className="px-4 pb-4">
                  {/* `disabled` on an asChild anchor renders an invalid attribute
                      and still navigates, so an ineligible subject gets a real
                      disabled button instead of a link. */}
                  {eligible ? (
                    <Button asChild size="sm">
                      <Link href={`${basePath}/${subject.id}`}>
                        <KeyRound className="size-4" aria-hidden="true" />
                        {setCodes.length ? "Edit keys" : "Define keys"}
                      </Link>
                    </Button>
                  ) : (
                    <Button size="sm" disabled>
                      <KeyRound className="size-4" aria-hidden="true" />
                      Define keys
                    </Button>
                  )}
                </div>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
