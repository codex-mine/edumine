import { apiClient } from "@/lib/api/client";

// --- Principal -----------------------------------------------------------------------

export interface FeeTrendPoint {
  [key: string]: string | number;
  label: string;
  collections: number;
  expenses: number;
}

export interface RecentInvoiceRow {
  [key: string]: React.ReactNode;
  student: string;
  amount: string;
  status: string;
  due: string;
}

export interface PrincipalDashboard {
  stats: {
    total_income_month: number;
    total_students: number;
    total_staff: number;
    dues_outstanding: number;
  };
  fee_trend: FeeTrendPoint[];
  recent_invoices: RecentInvoiceRow[];
  financial_narrative: string | null;
  financial_narrative_error: string | null;
}

export async function getPrincipalDashboard(): Promise<PrincipalDashboard> {
  const { data } = await apiClient.get<PrincipalDashboard>("/dashboard/principal");
  return data;
}

// --- Admin -----------------------------------------------------------------------------

export interface AdminAttendanceRow {
  [key: string]: React.ReactNode;
  name: string;
  role: string;
  status: string;
}

export interface AdminDashboard {
  stats: {
    new_admissions_month: number;
    todays_attendance_percent: number | null;
    pending_approvals: number;
    todays_collections: number;
  };
  attendance_week: { label: string; value: number }[];
  todays_attendance_rows: AdminAttendanceRow[];
}

export async function getAdminDashboard(): Promise<AdminDashboard> {
  const { data } = await apiClient.get<AdminDashboard>("/dashboard/admin");
  return data;
}

// --- Teacher ---------------------------------------------------------------------------

export interface TeacherDashboard {
  stats: {
    todays_classes: number;
    attendance_marked: number;
    pending_marks_entry: number;
    monthly_attendance_percent: number | null;
  };
  todays_schedule: { id: string; label: string; secondary: string }[];
  exam_status_rows: { exam: string; class: string; status: string }[];
}

export async function getTeacherDashboard(): Promise<TeacherDashboard> {
  const { data } = await apiClient.get<TeacherDashboard>("/dashboard/teacher");
  return data;
}

// --- Accountant / Receptionist (billing operations) -------------------------------------

export interface BillingOpsDashboard {
  stats: {
    todays_collections: number;
    dues_outstanding: number;
    pending_invoices: number;
  };
  recent_payments: { id: string; label: string; secondary: string; trailing: string }[];
  outstanding_dues_rows: OutstandingDueRow[];
}

export interface OutstandingDueRow {
  [key: string]: React.ReactNode;
  student: string;
  amount: string;
  due: string;
}

export async function getAccountantDashboard(): Promise<BillingOpsDashboard> {
  const { data } = await apiClient.get<BillingOpsDashboard>("/dashboard/accountant");
  return data;
}

export async function getReceptionistDashboard(): Promise<BillingOpsDashboard> {
  const { data } = await apiClient.get<BillingOpsDashboard>("/dashboard/receptionist");
  return data;
}

// --- Staff -----------------------------------------------------------------------------

export interface StaffDashboard {
  stats: {
    today_status: string;
    monthly_attendance_percent: number | null;
    unread_announcements: number;
  };
  recent_activity: { id: string; label: string; secondary: string }[];
}

export async function getStaffDashboard(): Promise<StaffDashboard> {
  const { data } = await apiClient.get<StaffDashboard>("/dashboard/staff");
  return data;
}

// --- Student / Guardian ------------------------------------------------------------------

export interface LatestResultSummary {
  exam_name: string;
  percentage: number;
}

export interface UpcomingExamSummary {
  name: string;
  start_date: string;
}

export interface StudentStats {
  attendance_percent_month: number | null;
  current_due: number;
  latest_result: LatestResultSummary | null;
  upcoming_exam: UpcomingExamSummary | null;
}

export interface StudentDashboard {
  stats: StudentStats;
  attendance_trend: { label: string; value: number }[];
}

export async function getStudentDashboard(): Promise<StudentDashboard> {
  const { data } = await apiClient.get<StudentDashboard>("/dashboard/student");
  return data;
}

export interface GuardianChildDashboard extends StudentDashboard {
  student_id: string;
  full_name: string;
}

export interface GuardianDashboard {
  children: GuardianChildDashboard[];
}

export async function getGuardianDashboard(): Promise<GuardianDashboard> {
  const { data } = await apiClient.get<GuardianDashboard>("/dashboard/guardian");
  return data;
}

// --- 4.5 Attendance Pattern Insight (Admin/Teacher, on-demand) ----------------------------

export interface AttendanceInsightPayload {
  scope: "student" | "class";
  student_id?: string;
  section_id?: string;
  date_from: string;
  date_to: string;
}

export interface AttendanceInsightResult {
  observations: string[];
}

export async function generateAttendanceInsight(payload: AttendanceInsightPayload): Promise<AttendanceInsightResult> {
  const { data } = await apiClient.post<AttendanceInsightResult>("/dashboard/attendance-insight", payload);
  return data;
}

// --- 4.7 At-Risk Student Recommendation (Admin/Teacher, on-demand) ------------------------

export interface AtRiskStudentsPayload {
  section_id: string;
  attendance_threshold_percent?: number;
  attendance_date_from?: string;
  attendance_date_to?: string;
  marks_threshold_percent?: number;
  exam_id?: string;
}

export interface FlaggedStudent {
  student_id: string;
  reason: string;
}

export interface AtRiskStudentEntry {
  student_id: string;
  name: string;
  attendance_percent?: number;
  average_marks_percent?: number;
}

export interface AtRiskStudentsResult {
  flagged_students: FlaggedStudent[];
  students: AtRiskStudentEntry[];
}

export async function generateAtRiskStudents(payload: AtRiskStudentsPayload): Promise<AtRiskStudentsResult> {
  const { data } = await apiClient.post<AtRiskStudentsResult>("/dashboard/at-risk-students", payload);
  return data;
}

// --- 4.4 Guardian Support Assistant (+ §8 conversation memory) ---------------------------

export interface GuardianConversationTurn {
  question: string;
  answer: string;
}

export interface GuardianAssistantPayload {
  student_id: string;
  question: string;
  conversation: GuardianConversationTurn[];
}

export interface GuardianAssistantResult {
  category: string;
  answer: string;
}

export async function askGuardianAssistant(payload: GuardianAssistantPayload): Promise<GuardianAssistantResult> {
  const { data } = await apiClient.post<GuardianAssistantResult>("/dashboard/guardian-assistant", payload);
  return data;
}
