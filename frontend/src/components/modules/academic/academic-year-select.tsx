"use client";

import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useAcademicYearsQuery } from "@/hooks/use-academic";

export function AcademicYearSelect({
  value,
  onChange,
  label = "Academic year",
  id = "academic_year_select",
}: {
  value: string;
  onChange: (yearId: string) => void;
  label?: string;
  id?: string;
}) {
  const yearsQuery = useAcademicYearsQuery();
  const years = yearsQuery.data ?? [];

  return (
    <div className="flex flex-col gap-1.5">
      <Label htmlFor={id}>{label}</Label>
      <Select value={value || undefined} onValueChange={onChange}>
        <SelectTrigger id={id} className="w-full sm:w-[16rem]">
          <SelectValue placeholder="Select an academic year" />
        </SelectTrigger>
        <SelectContent>
          {years.map((year) => (
            <SelectItem key={year.id} value={year.id}>
              {year.name}
              {year.is_active ? " (active)" : ""}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}
