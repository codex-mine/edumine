"use client";

import { useState } from "react";

import type { DashboardPeriod } from "@/lib/dashboard-period";

/** A section's own period filter, seeded from (and re-synced to) the page-level one.
 *
 * Changing the dashboard filter resets every section to it; changing a single
 * section's filter only affects that card until the page filter moves again.
 * The sync happens during render rather than in an effect so the card never
 * paints one frame of stale data. */
export function useSectionPeriod(globalPeriod: DashboardPeriod) {
  const [period, setPeriod] = useState<DashboardPeriod>(globalPeriod);
  const [lastGlobal, setLastGlobal] = useState<DashboardPeriod>(globalPeriod);

  if (lastGlobal !== globalPeriod) {
    setLastGlobal(globalPeriod);
    setPeriod(globalPeriod);
  }

  return [period, setPeriod] as const;
}
