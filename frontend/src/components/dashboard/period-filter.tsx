"use client";

import { useState } from "react";
import { Calendar, Check, ChevronDown } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  PERIOD_PRESETS,
  periodLabel,
  type DashboardPeriod,
  type PeriodKey,
} from "@/lib/dashboard-period";
import { cn } from "@/lib/utils";

export interface PeriodFilterProps {
  value: DashboardPeriod;
  onChange: (period: DashboardPeriod) => void;
  /** Compact trigger for section headers; the page-level filter uses the default. */
  size?: "sm" | "default";
  className?: string;
}

/** The date-range dropdown used both for the whole dashboard and per section.
 *
 * Built on Popover rather than DropdownMenu because the custom range holds two
 * date inputs — a menu would swallow their keystrokes as typeahead. */
export function PeriodFilter({ value, onChange, size = "default", className }: PeriodFilterProps) {
  const [open, setOpen] = useState(false);
  const [from, setFrom] = useState(value.from ?? "");
  const [to, setTo] = useState(value.to ?? "");

  const handleOpenChange = (next: boolean) => {
    // Reopening starts from whatever range is currently applied.
    if (next) {
      setFrom(value.from ?? "");
      setTo(value.to ?? "");
    }
    setOpen(next);
  };

  const selectPreset = (key: PeriodKey) => {
    onChange({ key });
    setOpen(false);
  };

  const applyCustom = () => {
    if (!from || !to) return;
    // Tolerate a back-to-front range instead of rejecting it.
    const [start, end] = from <= to ? [from, to] : [to, from];
    onChange({ key: "custom", from: start, to: end });
    setOpen(false);
  };

  return (
    <Popover open={open} onOpenChange={handleOpenChange}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          className={cn(
            "gap-2 font-medium text-muted-foreground",
            size === "sm" ? "h-14 px-4 text-xs" : "h-16 px-6 text-sm",
            className
          )}
        >
          <span className="max-w-56 truncate text-foreground">{periodLabel(value)}</span>
          <ChevronDown className="size-4 opacity-60" aria-hidden="true" />
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-auto min-w-72 p-3">
        <div className="flex flex-col gap-1">
          {PERIOD_PRESETS.map((preset) => {
            const active = value.key === preset.key;
            return (
              <button
                key={preset.key}
                type="button"
                onClick={() => selectPreset(preset.key)}
                className={cn(
                  "flex items-center justify-between gap-8 rounded px-3 py-2 text-left text-sm transition-colors",
                  active ? "bg-primary/10 font-medium text-primary" : "hover:bg-muted"
                )}
              >
                {preset.label}
                {active && <Check className="size-4" aria-hidden="true" />}
              </button>
            );
          })}
        </div>

        <div className="mt-3 border-t border-border pt-3">
          <div className="flex items-center gap-2 px-1 pb-2 text-xs font-medium text-muted-foreground">
            <Calendar className="size-4" aria-hidden="true" />
            Date range
          </div>
          <div className="flex items-end gap-2">
            <label className="flex flex-1 flex-col gap-1 text-xs text-muted-foreground">
              From
              <Input
                type="date"
                value={from}
                max={to || undefined}
                onChange={(event) => setFrom(event.target.value)}
                className="h-16 text-sm"
              />
            </label>
            <label className="flex flex-1 flex-col gap-1 text-xs text-muted-foreground">
              To
              <Input
                type="date"
                value={to}
                min={from || undefined}
                onChange={(event) => setTo(event.target.value)}
                className="h-16 text-sm"
              />
            </label>
          </div>
          <Button
            type="button"
            className="mt-3 h-16 w-full"
            disabled={!from || !to}
            onClick={applyCustom}
          >
            Apply range
          </Button>
        </div>
      </PopoverContent>
    </Popover>
  );
}
