import { formatSlotTime, WEEKDAYS, WEEKDAY_LABELS, type RoutineSlot, type Weekday } from "@/lib/api/routine";
import { cn } from "@/lib/utils";

export interface RoutineGridCellArgs {
  day: Weekday;
  period: number;
  slot: RoutineSlot | undefined;
}

/** Renders a Monday–Sunday × period grid of routine slots. Read-only by
 * default (used by Teacher/Student/Guardian views); the Admin builder
 * supplies `renderCell` to make each cell interactive (add/edit/remove). */
export function RoutineGrid({
  slots,
  showSection = false,
  minPeriods = 6,
  renderCell,
}: {
  slots: RoutineSlot[];
  showSection?: boolean;
  minPeriods?: number;
  renderCell?: (args: RoutineGridCellArgs) => React.ReactNode;
}) {
  const maxPeriod = slots.reduce((max, slot) => Math.max(max, slot.period_number), minPeriods);
  const periods = Array.from({ length: maxPeriod }, (_, index) => index + 1);
  const byKey = new Map(slots.map((slot) => [`${slot.day_of_week}-${slot.period_number}`, slot]));

  return (
    <div className="overflow-x-auto rounded border border-border">
      <table className="w-full border-collapse text-left text-sm">
        <thead>
          <tr className="bg-muted">
            <th className="w-16 border-b border-border px-3 py-2.5 font-medium text-muted-foreground">Period</th>
            {WEEKDAYS.map((day) => (
              <th key={day} className="min-w-40 border-b border-border px-3 py-2.5 font-medium text-muted-foreground">
                {WEEKDAY_LABELS[day]}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-border">
          {periods.map((period) => (
            <tr key={period}>
              <td className="px-3 py-2 align-top font-medium text-muted-foreground">{period}</td>
              {WEEKDAYS.map((day) => {
                const slot = byKey.get(`${day}-${period}`);
                return (
                  <td key={day} className="px-2 py-2 align-top">
                    {renderCell ? (
                      renderCell({ day, period, slot })
                    ) : slot ? (
                      <RoutineSlotCard slot={slot} showSection={showSection} />
                    ) : (
                      <span className="text-xs text-muted-foreground">—</span>
                    )}
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function RoutineSlotCard({
  slot,
  showSection = false,
  className,
}: {
  slot: RoutineSlot;
  showSection?: boolean;
  className?: string;
}) {
  return (
    <div className={cn("flex flex-col gap-0.5 rounded border border-border bg-muted/40 p-2", className)}>
      <span className="font-medium text-foreground">{slot.subject_name}</span>
      {showSection && (
        <span className="text-xs text-muted-foreground">
          {slot.class_name} - {slot.section_name}
        </span>
      )}
      <span className="text-xs text-muted-foreground">{slot.teacher_name}</span>
      <span className="text-xs text-muted-foreground">
        {formatSlotTime(slot)}
        {slot.room_name ? ` · ${slot.room_name}` : ""}
      </span>
    </div>
  );
}
