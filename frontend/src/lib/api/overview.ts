import { apiClient } from "@/lib/api/client";
import { periodParams, type DashboardPeriod } from "@/lib/dashboard-period";

/** Every overview section is its own endpoint so a single card can be
 * refiltered without refetching the whole dashboard. */

export interface PeriodInfo {
  key: string;
  label: string;
  date_from: string;
  date_to: string;
}

export interface AdmissionsPoint {
  label: string;
  /** null for buckets that haven't happened yet — plotted as a gap. */
  current: number | null;
  previous: number;
}

export interface AdmissionsOverview {
  period: PeriodInfo;
  comparison_label: string;
  points: AdmissionsPoint[];
  total: number;
  previous_total: number;
  change_percent: number | null;
}

export interface FeeSegment {
  key: "collected" | "pending" | "overdue";
  label: string;
  amount: number;
  percent: number;
}

export interface FeeCollectionOverview {
  period: PeriodInfo;
  comparison_label: string;
  total: number;
  collected: number;
  change_percent: number | null;
  segments: FeeSegment[];
}

export interface AttendancePoint {
  label: string;
  /** null when nothing was marked that day — plotted as a gap, not 0%. */
  value: number | null;
  present: number;
  marked: number;
}

export interface AttendanceOverview {
  period: PeriodInfo;
  comparison_label: string;
  points: AttendancePoint[];
  average_percent: number | null;
  change_percent: number | null;
}

export interface ClassSegment {
  label: string;
  value: number;
  percent: number;
}

export interface StudentsByClassOverview {
  period: PeriodInfo;
  academic_year: string | null;
  total: number;
  segments: ClassSegment[];
}

export interface OverviewEvent {
  id: string;
  title: string;
  date: string;
  end_date: string;
  timing: string;
  category: string;
  status: string;
}

export interface UpcomingEventsOverview {
  period: PeriodInfo;
  events: OverviewEvent[];
}

export interface OverviewActivity {
  id: string;
  activity: string;
  entity_type: string;
  action: string;
  actor: string;
  at: string;
}

export interface RecentActivitiesOverview {
  period: PeriodInfo;
  activities: OverviewActivity[];
}

export interface TopStudent {
  rank: number;
  student_id: string;
  name: string;
  class_label: string | null;
  percentage: number;
  gpa: number;
}

export interface TopStudentsOverview {
  period: PeriodInfo;
  students: TopStudent[];
}

export interface OverviewNotification {
  id: string;
  title: string;
  audience: string;
  at: string | null;
}

export interface NotificationsOverview {
  period: PeriodInfo;
  notifications: OverviewNotification[];
}

async function getSection<T>(path: string, period: DashboardPeriod): Promise<T> {
  const { data } = await apiClient.get<T>(`/dashboard/overview/${path}`, { params: periodParams(period) });
  return data;
}

export function getAdmissionsOverview(period: DashboardPeriod) {
  return getSection<AdmissionsOverview>("admissions", period);
}

export function getFeeCollectionOverview(period: DashboardPeriod) {
  return getSection<FeeCollectionOverview>("fee-collection", period);
}

export function getAttendanceOverview(period: DashboardPeriod) {
  return getSection<AttendanceOverview>("attendance", period);
}

export function getStudentsByClassOverview(period: DashboardPeriod) {
  return getSection<StudentsByClassOverview>("students-by-class", period);
}

export function getUpcomingEvents(period: DashboardPeriod) {
  return getSection<UpcomingEventsOverview>("upcoming-events", period);
}

export function getRecentActivities(period: DashboardPeriod) {
  return getSection<RecentActivitiesOverview>("recent-activities", period);
}

export function getTopPerformingStudents(period: DashboardPeriod) {
  return getSection<TopStudentsOverview>("top-students", period);
}

export function getRecentNotifications(period: DashboardPeriod) {
  return getSection<NotificationsOverview>("notifications", period);
}
