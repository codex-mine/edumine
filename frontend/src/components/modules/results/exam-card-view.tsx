import { Badge } from "@/components/ui/badge";
import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import type { ExamCard } from "@/lib/api/results";

export function ExamCardView({ card }: { card: ExamCard }) {
  return (
    <Card>
      <CardHeader>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <CardTitle>{card.exam_name}</CardTitle>
          {card.overall_grade && <Badge variant="info">{card.overall_grade}</Badge>}
        </div>
        <CardDescription>
          {card.student_name} ({card.admission_number}){card.class_name ? ` · ${card.class_name}` : ""}
          {card.term ? ` · ${card.term}` : ""}
        </CardDescription>
      </CardHeader>
      <div className="flex flex-col gap-3 px-4 pb-4">
        <div className="overflow-x-auto rounded border border-border">
          <table className="w-full text-left text-sm">
            <thead className="bg-muted">
              <tr>
                <th className="px-3 py-2 font-medium text-muted-foreground">Subject</th>
                <th className="px-3 py-2 font-medium text-muted-foreground">Marks</th>
                <th className="px-3 py-2 font-medium text-muted-foreground">Grade</th>
                <th className="px-3 py-2 font-medium text-muted-foreground">Result</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {card.subjects.map((subject) => (
                <tr key={subject.subject_name}>
                  <td className="px-3 py-2 font-medium text-foreground">{subject.subject_name}</td>
                  <td className="px-3 py-2">
                    {subject.is_absent ? (
                      <span className="text-muted-foreground">Absent</span>
                    ) : (
                      `${subject.marks_obtained} / ${subject.full_marks}`
                    )}
                  </td>
                  <td className="px-3 py-2">{subject.grade ?? "—"}</td>
                  <td className="px-3 py-2">
                    {subject.is_absent ? (
                      <Badge variant="muted">Absent</Badge>
                    ) : subject.passed ? (
                      <Badge variant="success">Pass</Badge>
                    ) : (
                      <Badge variant="destructive">Fail</Badge>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="flex flex-wrap gap-4 rounded border border-border p-3 text-sm">
          <span>
            Total: <span className="font-medium text-foreground">{card.total_obtained} / {card.total_full_marks}</span>
          </span>
          <span>
            Percentage: <span className="font-medium text-foreground">{card.percentage}%</span>
          </span>
          {card.overall_grade && (
            <span>
              Overall grade: <span className="font-medium text-foreground">{card.overall_grade}</span>
            </span>
          )}
        </div>
      </div>
    </Card>
  );
}
