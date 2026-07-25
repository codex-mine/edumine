import { apiClient } from "@/lib/api/client";

export type EnrollmentStatus = "active" | "promoted" | "transferred" | "graduated" | "dropped";

export interface AcademicYear {
  id: string;
  name: string;
  start_date: string;
  end_date: string;
  is_active: boolean;
  cloned_from_year_id: string | null;
  created_at: string;
}

export interface CreateAcademicYearPayload {
  name: string;
  start_date: string;
  end_date: string;
  clone_from_year_id?: string | null;
}

export interface ClassItem {
  id: string;
  name: string;
  numeric_order: number;
  created_at: string;
}

export interface CreateClassPayload {
  name: string;
  numeric_order: number;
}

export interface UpdateClassPayload {
  name?: string;
  numeric_order?: number;
}

export interface Room {
  id: string;
  name: string;
  capacity: number | null;
  created_at: string;
}

export interface CreateRoomPayload {
  name: string;
  capacity?: number | null;
}

export interface UpdateRoomPayload {
  name?: string;
  capacity?: number | null;
}

export interface Subject {
  id: string;
  name: string;
  code: string;
  created_at: string;
}

export interface CreateSubjectPayload {
  name: string;
  code: string;
}

export interface UpdateSubjectPayload {
  name?: string;
  code?: string;
}

export interface Section {
  id: string;
  academic_year_id: string;
  class_id: string;
  class_name: string;
  room_id: string | null;
  room_name: string | null;
  name: string;
  capacity: number | null;
  enrolled_count: number;
  class_teacher_id: string | null;
  class_teacher_name: string | null;
  created_at: string;
}

export interface CreateSectionPayload {
  academic_year_id?: string | null;
  class_id: string;
  room_id?: string | null;
  name: string;
  capacity?: number | null;
  class_teacher_id?: string | null;
}

export interface UpdateSectionPayload {
  room_id?: string | null;
  name?: string;
  capacity?: number | null;
  class_teacher_id?: string | null;
  clear_room?: boolean;
  clear_class_teacher?: boolean;
}

export interface ClassSubject {
  id: string;
  academic_year_id: string;
  class_id: string;
  class_name: string;
  subject_id: string;
  subject_name: string;
  subject_code: string;
  teacher_id: string | null;
  teacher_name: string | null;
  full_marks: number;
  created_at: string;
}

export interface CreateClassSubjectPayload {
  academic_year_id?: string | null;
  class_id: string;
  subject_id: string;
  teacher_id?: string | null;
  full_marks?: number;
}

export interface UpdateClassSubjectPayload {
  teacher_id?: string | null;
  full_marks?: number;
  clear_teacher?: boolean;
}

export interface Enrollment {
  id: string;
  student_id: string;
  student_name: string;
  admission_number: string;
  academic_year_id: string;
  academic_year_name: string;
  section_id: string;
  section_name: string;
  class_id: string;
  class_name: string;
  roll_number: string;
  status: EnrollmentStatus;
  created_at: string;
}

export interface EnrollStudentPayload {
  student_id: string;
  academic_year_id?: string | null;
  section_id: string;
  roll_number?: string | null;
}

export interface UpdateEnrollmentPayload {
  section_id?: string;
  roll_number?: string;
  status?: EnrollmentStatus;
}

export interface PromotionItem {
  student_id: string;
  outcome: EnrollmentStatus;
  target_section_id?: string | null;
  roll_number?: string | null;
}

export interface PromoteStudentsPayload {
  target_academic_year_id: string;
  source_academic_year_id?: string | null;
  items: PromotionItem[];
}

export interface PromotionOutcome {
  student_id: string;
  outcome: EnrollmentStatus;
  new_enrollment_id: string | null;
}

export function formatSectionOccupancy(section: Section): string {
  return `${section.enrolled_count}/${section.capacity ?? "∞"}`;
}

export function isSectionFull(section: Section): boolean {
  return section.capacity != null && section.enrolled_count >= section.capacity;
}

// --- Academic Years ---------------------------------------------------

export async function listAcademicYears(): Promise<AcademicYear[]> {
  const { data } = await apiClient.get<AcademicYear[]>("/academic/years");
  return data;
}

export async function getActiveAcademicYear(): Promise<AcademicYear> {
  const { data } = await apiClient.get<AcademicYear>("/academic/years/active");
  return data;
}

export async function createAcademicYear(payload: CreateAcademicYearPayload): Promise<AcademicYear> {
  const { data } = await apiClient.post<AcademicYear>("/academic/years", payload);
  return data;
}

export async function activateAcademicYear(yearId: string): Promise<AcademicYear> {
  const { data } = await apiClient.post<AcademicYear>(`/academic/years/${yearId}/activate`);
  return data;
}

// --- Classes -------------------------------------------------------------

export async function listClasses(search?: string): Promise<ClassItem[]> {
  const { data } = await apiClient.get<ClassItem[]>("/academic/classes", { params: { search } });
  return data;
}

export async function createClass(payload: CreateClassPayload): Promise<ClassItem> {
  const { data } = await apiClient.post<ClassItem>("/academic/classes", payload);
  return data;
}

export async function updateClass(classId: string, payload: UpdateClassPayload): Promise<ClassItem> {
  const { data } = await apiClient.patch<ClassItem>(`/academic/classes/${classId}`, payload);
  return data;
}

export async function deleteClass(classId: string): Promise<void> {
  await apiClient.delete(`/academic/classes/${classId}`);
}

// --- Rooms -----------------------------------------------------------------

export async function listRooms(search?: string): Promise<Room[]> {
  const { data } = await apiClient.get<Room[]>("/academic/rooms", { params: { search } });
  return data;
}

export async function createRoom(payload: CreateRoomPayload): Promise<Room> {
  const { data } = await apiClient.post<Room>("/academic/rooms", payload);
  return data;
}

export async function updateRoom(roomId: string, payload: UpdateRoomPayload): Promise<Room> {
  const { data } = await apiClient.patch<Room>(`/academic/rooms/${roomId}`, payload);
  return data;
}

export async function deleteRoom(roomId: string): Promise<void> {
  await apiClient.delete(`/academic/rooms/${roomId}`);
}

// --- Subjects ----------------------------------------------------------

export async function listSubjects(search?: string): Promise<Subject[]> {
  const { data } = await apiClient.get<Subject[]>("/academic/subjects", { params: { search } });
  return data;
}

export async function createSubject(payload: CreateSubjectPayload): Promise<Subject> {
  const { data } = await apiClient.post<Subject>("/academic/subjects", payload);
  return data;
}

export async function updateSubject(subjectId: string, payload: UpdateSubjectPayload): Promise<Subject> {
  const { data } = await apiClient.patch<Subject>(`/academic/subjects/${subjectId}`, payload);
  return data;
}

export async function deleteSubject(subjectId: string): Promise<void> {
  await apiClient.delete(`/academic/subjects/${subjectId}`);
}

// --- Sections ------------------------------------------------------------

export async function listSections(params: { academic_year_id?: string; class_id?: string }): Promise<Section[]> {
  const { data } = await apiClient.get<Section[]>("/academic/sections", { params });
  return data;
}

export async function createSection(payload: CreateSectionPayload): Promise<Section> {
  const { data } = await apiClient.post<Section>("/academic/sections", payload);
  return data;
}

export async function updateSection(sectionId: string, payload: UpdateSectionPayload): Promise<Section> {
  const { data } = await apiClient.patch<Section>(`/academic/sections/${sectionId}`, payload);
  return data;
}

export async function deleteSection(sectionId: string): Promise<void> {
  await apiClient.delete(`/academic/sections/${sectionId}`);
}

// --- Class-Subject-Teacher assignment --------------------------------------

export async function listClassSubjects(params: {
  academic_year_id?: string;
  class_id?: string;
}): Promise<ClassSubject[]> {
  const { data } = await apiClient.get<ClassSubject[]>("/academic/class-subjects", { params });
  return data;
}

export async function createClassSubject(payload: CreateClassSubjectPayload): Promise<ClassSubject> {
  const { data } = await apiClient.post<ClassSubject>("/academic/class-subjects", payload);
  return data;
}

export async function updateClassSubject(
  classSubjectId: string,
  payload: UpdateClassSubjectPayload
): Promise<ClassSubject> {
  const { data } = await apiClient.patch<ClassSubject>(`/academic/class-subjects/${classSubjectId}`, payload);
  return data;
}

export async function deleteClassSubject(classSubjectId: string): Promise<void> {
  await apiClient.delete(`/academic/class-subjects/${classSubjectId}`);
}

// --- Enrollment / Promotion ------------------------------------------------

export async function listEnrollments(params: {
  academic_year_id?: string;
  section_id?: string;
  student_id?: string;
}): Promise<Enrollment[]> {
  const { data } = await apiClient.get<Enrollment[]>("/academic/enrollments", { params });
  return data;
}

export async function enrollStudent(payload: EnrollStudentPayload): Promise<Enrollment> {
  const { data } = await apiClient.post<Enrollment>("/academic/enrollments", payload);
  return data;
}

export async function updateEnrollment(enrollmentId: string, payload: UpdateEnrollmentPayload): Promise<Enrollment> {
  const { data } = await apiClient.patch<Enrollment>(`/academic/enrollments/${enrollmentId}`, payload);
  return data;
}

export async function promoteStudents(payload: PromoteStudentsPayload): Promise<PromotionOutcome[]> {
  const { data } = await apiClient.post<{ results: PromotionOutcome[] }>("/academic/enrollments/promote", payload);
  return data.results;
}
