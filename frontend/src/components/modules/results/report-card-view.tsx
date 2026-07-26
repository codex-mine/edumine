import { Badge } from "@/components/ui/badge";
import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { EmptyState } from "@/components/shared/empty-state";
import type { ReportCard } from "@/lib/api/results";

export function ReportCardView({ report }: { report: ReportCard }) {
  return (
    <Card>
      <CardHeader>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <CardTitle>Year-end report card — {report.academic_year_name}</CardTitle>
          {report.overall_grade && <Badge variant="info">{report.overall_grade}</Badge>}
        </div>
        <CardDescription>
          {report.student_name} ({report.admission_number})
        </CardDescription>
      </CardHeader>
      <div className="flex flex-col gap-4 px-4 pb-4">
        {report.exams.length === 0 ? (
          <EmptyState message="No published exams for this academic year yet." />
        ) : (
          report.exams.map((exam) => (
            <div key={exam.exam_id} className="rounded border border-border">
              <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border bg-muted px-3 py-2">
                <span className="font-medium text-foreground">
                  {exam.exam_name}
                  {exam.term ? ` · ${exam.term}` : ""}
                </span>
                <span className="text-sm text-muted-foreground">
                  {exam.total_obtained} / {exam.total_full_marks} ({exam.percentage}%)
                </span>
              </div>
              <table className="w-full text-left text-sm">
                <thead>
                  <tr>
                    <th className="px-3 py-2 font-medium text-muted-foreground">Subject</th>
                    <th className="px-3 py-2 font-medium text-muted-foreground">Marks</th>
                    <th className="px-3 py-2 font-medium text-muted-foreground">Grade</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {exam.subjects.map((subject) => (
                    <tr key={subject.subject_name}>
                      <td className="px-3 py-2">{subject.subject_name}</td>
                      <td className="px-3 py-2">
                        {subject.is_absent ? (
                          <span className="text-muted-foreground">Absent</span>
                        ) : (
                          `${subject.marks_obtained} / ${subject.full_marks}`
                        )}
                      </td>
                      <td className="px-3 py-2">{subject.grade ?? "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ))
        )}

        {report.exams.length > 0 && (
          <div className="flex flex-wrap gap-4 rounded border border-border p-3 text-sm">
            <span>
              Overall total:{" "}
              <span className="font-medium text-foreground">
                {report.overall_total_obtained} / {report.overall_total_full_marks}
              </span>
            </span>
            <span>
              Overall percentage: <span className="font-medium text-foreground">{report.overall_percentage}%</span>
            </span>
            {report.overall_grade && (
              <span>
                Overall grade: <span className="font-medium text-foreground">{report.overall_grade}</span>
              </span>
            )}
          </div>
        )}
      </div>
    </Card>
  );
}
