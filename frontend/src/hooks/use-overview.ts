"use client";

import { useQuery } from "@tanstack/react-query";

import {
  getAdmissionsOverview,
  getAttendanceOverview,
  getFeeCollectionOverview,
  getRecentActivities,
  getRecentNotifications,
  getStudentsByClassOverview,
  getTopPerformingStudents,
  getUpcomingEvents,
} from "@/lib/api/overview";
import { isCompletePeriod, periodCacheKey, type DashboardPeriod } from "@/lib/dashboard-period";

/** Section queries are keyed by their own period, so two cards showing
 * different ranges stay cached side by side instead of evicting each other. */
function sectionKey(section: string, period: DashboardPeriod) {
  return ["dashboard", "overview", section, periodCacheKey(period)] as const;
}

export function useAdmissionsOverviewQuery(period: DashboardPeriod) {
  return useQuery({
    queryKey: sectionKey("admissions", period),
    queryFn: () => getAdmissionsOverview(period),
    enabled: isCompletePeriod(period),
  });
}

export function useFeeCollectionOverviewQuery(period: DashboardPeriod) {
  return useQuery({
    queryKey: sectionKey("fee-collection", period),
    queryFn: () => getFeeCollectionOverview(period),
    enabled: isCompletePeriod(period),
  });
}

export function useAttendanceOverviewQuery(period: DashboardPeriod) {
  return useQuery({
    queryKey: sectionKey("attendance", period),
    queryFn: () => getAttendanceOverview(period),
    enabled: isCompletePeriod(period),
  });
}

export function useStudentsByClassQuery(period: DashboardPeriod) {
  return useQuery({
    queryKey: sectionKey("students-by-class", period),
    queryFn: () => getStudentsByClassOverview(period),
    enabled: isCompletePeriod(period),
  });
}

export function useUpcomingEventsQuery(period: DashboardPeriod) {
  return useQuery({
    queryKey: sectionKey("upcoming-events", period),
    queryFn: () => getUpcomingEvents(period),
    enabled: isCompletePeriod(period),
  });
}

export function useRecentActivitiesQuery(period: DashboardPeriod) {
  return useQuery({
    queryKey: sectionKey("recent-activities", period),
    queryFn: () => getRecentActivities(period),
    enabled: isCompletePeriod(period),
  });
}

export function useTopStudentsQuery(period: DashboardPeriod) {
  return useQuery({
    queryKey: sectionKey("top-students", period),
    queryFn: () => getTopPerformingStudents(period),
    enabled: isCompletePeriod(period),
  });
}

export function useRecentNotificationsQuery(period: DashboardPeriod) {
  return useQuery({
    queryKey: sectionKey("notifications", period),
    queryFn: () => getRecentNotifications(period),
    enabled: isCompletePeriod(period),
  });
}
