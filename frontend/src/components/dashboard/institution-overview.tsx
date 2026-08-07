"use client";

import { AdmissionsOverviewCard } from "@/components/dashboard/overview/admissions-overview-card";
import { AttendanceOverviewCard } from "@/components/dashboard/overview/attendance-overview-card";
import { FeeCollectionCard } from "@/components/dashboard/overview/fee-collection-card";
import { QuickActionsCard } from "@/components/dashboard/overview/quick-actions-card";
import { RecentActivitiesCard } from "@/components/dashboard/overview/recent-activities-card";
import { RecentNotificationsCard } from "@/components/dashboard/overview/recent-notifications-card";
import { StudentsByClassCard } from "@/components/dashboard/overview/students-by-class-card";
import { TopStudentsCard } from "@/components/dashboard/overview/top-students-card";
import { UpcomingEventsCard } from "@/components/dashboard/overview/upcoming-events-card";
import { useSectionPeriod } from "@/components/dashboard/overview/use-section-period";
import { PeriodFilter } from "@/components/dashboard/period-filter";
import type { DashboardPeriod } from "@/lib/dashboard-period";

export interface InstitutionOverviewProps {
  role: "admin" | "principal";
  title: string;
  subtitle: string;
  /** The page-level filter — also drives the caller's own stat-card query. */
  period: DashboardPeriod;
  onPeriodChange: (period: DashboardPeriod) => void;
  /** The stat tile row, owned by the caller since the figures are role-specific. */
  statCards: React.ReactNode;
  /** Role-specific panels appended below the shared sections. */
  children?: React.ReactNode;
}

/** The shared Admin/Principal overview: one page-level period filter at the top,
 * plus a filter on every section that can override it independently. */
export function InstitutionOverview({
  role,
  title,
  subtitle,
  period,
  onPeriodChange,
  statCards,
  children,
}: InstitutionOverviewProps) {
  const [admissionsPeriod, setAdmissionsPeriod] = useSectionPeriod(period);
  const [feePeriod, setFeePeriod] = useSectionPeriod(period);
  const [classesPeriod, setClassesPeriod] = useSectionPeriod(period);
  const [attendancePeriod, setAttendancePeriod] = useSectionPeriod(period);
  const [activitiesPeriod, setActivitiesPeriod] = useSectionPeriod(period);
  const [studentsPeriod, setStudentsPeriod] = useSectionPeriod(period);
  const [eventsPeriod, setEventsPeriod] = useSectionPeriod(period);
  const [notificationsPeriod, setNotificationsPeriod] = useSectionPeriod(period);

  const resultsHref = role === "principal" ? "/principal/results" : "/admin/results";

  return (
    <div className="flex w-full flex-col gap-8">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div className="flex flex-col gap-1">
          <h1 className="text-2xl font-semibold text-foreground">{title}</h1>
          <p className="text-sm text-muted-foreground">{subtitle}</p>
        </div>
        <PeriodFilter value={period} onChange={onPeriodChange} />
      </header>

      {statCards}

      <div className="grid grid-cols-1 gap-8 xl:grid-cols-[minmax(0,3fr)_minmax(0,1fr)]">
        <div className="flex min-w-0 flex-col gap-8">
          <div className="grid grid-cols-1 gap-8 lg:grid-cols-5">
            <div className="lg:col-span-3">
              <AdmissionsOverviewCard period={admissionsPeriod} onPeriodChange={setAdmissionsPeriod} />
            </div>
            <div className="lg:col-span-2">
              <FeeCollectionCard period={feePeriod} onPeriodChange={setFeePeriod} />
            </div>
          </div>

          <div className="grid grid-cols-1 gap-8 lg:grid-cols-5">
            <div className="lg:col-span-2">
              <StudentsByClassCard period={classesPeriod} onPeriodChange={setClassesPeriod} />
            </div>
            <div className="lg:col-span-3">
              <AttendanceOverviewCard period={attendancePeriod} onPeriodChange={setAttendancePeriod} />
            </div>
          </div>

          <div className="grid grid-cols-1 gap-8 lg:grid-cols-5">
            <div className="lg:col-span-2">
              <RecentActivitiesCard period={activitiesPeriod} onPeriodChange={setActivitiesPeriod} />
            </div>
            <div className="lg:col-span-3">
              <TopStudentsCard
                period={studentsPeriod}
                onPeriodChange={setStudentsPeriod}
                resultsHref={resultsHref}
              />
            </div>
          </div>

          {children}
        </div>

        <div className="flex min-w-0 flex-col gap-8">
          <QuickActionsCard role={role} />
          <UpcomingEventsCard
            period={eventsPeriod}
            onPeriodChange={setEventsPeriod}
            eventsHref="/admin/exams"
          />
          <RecentNotificationsCard
            period={notificationsPeriod}
            onPeriodChange={setNotificationsPeriod}
            communicationHref="/admin/communication"
          />
        </div>
      </div>
    </div>
  );
}
