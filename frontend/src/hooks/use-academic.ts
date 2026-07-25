import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import {
  activateAcademicYear,
  createAcademicYear,
  createClass,
  createClassSubject,
  createRoom,
  createSection,
  createSubject,
  deleteClass,
  deleteClassSubject,
  deleteRoom,
  deleteSection,
  deleteSubject,
  enrollStudent,
  getActiveAcademicYear,
  listAcademicYears,
  listClasses,
  listClassSubjects,
  listEnrollments,
  listRooms,
  listSections,
  listSubjects,
  promoteStudents,
  updateClass,
  updateClassSubject,
  updateEnrollment,
  updateRoom,
  updateSection,
  updateSubject,
  type CreateAcademicYearPayload,
  type CreateClassPayload,
  type CreateClassSubjectPayload,
  type CreateRoomPayload,
  type CreateSectionPayload,
  type CreateSubjectPayload,
  type EnrollStudentPayload,
  type PromoteStudentsPayload,
  type UpdateClassPayload,
  type UpdateClassSubjectPayload,
  type UpdateEnrollmentPayload,
  type UpdateRoomPayload,
  type UpdateSectionPayload,
  type UpdateSubjectPayload,
} from "@/lib/api/academic";

// --- Academic Years ---------------------------------------------------

export const academicYearsQueryKey = ["academic", "years"] as const;
export const activeAcademicYearQueryKey = ["academic", "years", "active"] as const;

export function useAcademicYearsQuery() {
  return useQuery({ queryKey: academicYearsQueryKey, queryFn: listAcademicYears });
}

export function useActiveAcademicYearQuery() {
  return useQuery({ queryKey: activeAcademicYearQueryKey, queryFn: getActiveAcademicYear, retry: false });
}

export function useCreateAcademicYearMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (payload: CreateAcademicYearPayload) => createAcademicYear(payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: academicYearsQueryKey });
      queryClient.invalidateQueries({ queryKey: ["academic", "sections"] });
      queryClient.invalidateQueries({ queryKey: ["academic", "class-subjects"] });
    },
  });
}

export function useActivateAcademicYearMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (yearId: string) => activateAcademicYear(yearId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: academicYearsQueryKey });
      queryClient.invalidateQueries({ queryKey: activeAcademicYearQueryKey });
    },
  });
}

// --- Classes ------------------------------------------------------------

export const classesQueryKey = (search?: string) => ["academic", "classes", search ?? ""] as const;

export function useClassesQuery(search?: string) {
  return useQuery({ queryKey: classesQueryKey(search), queryFn: () => listClasses(search) });
}

export function useCreateClassMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (payload: CreateClassPayload) => createClass(payload),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["academic", "classes"] }),
  });
}

export function useUpdateClassMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ classId, payload }: { classId: string; payload: UpdateClassPayload }) =>
      updateClass(classId, payload),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["academic", "classes"] }),
  });
}

export function useDeleteClassMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (classId: string) => deleteClass(classId),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["academic", "classes"] }),
  });
}

// --- Rooms -----------------------------------------------------------------

export const roomsQueryKey = (search?: string) => ["academic", "rooms", search ?? ""] as const;

export function useRoomsQuery(search?: string) {
  return useQuery({ queryKey: roomsQueryKey(search), queryFn: () => listRooms(search) });
}

export function useCreateRoomMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (payload: CreateRoomPayload) => createRoom(payload),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["academic", "rooms"] }),
  });
}

export function useUpdateRoomMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ roomId, payload }: { roomId: string; payload: UpdateRoomPayload }) => updateRoom(roomId, payload),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["academic", "rooms"] }),
  });
}

export function useDeleteRoomMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (roomId: string) => deleteRoom(roomId),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["academic", "rooms"] }),
  });
}

// --- Subjects ----------------------------------------------------------

export const subjectsQueryKey = (search?: string) => ["academic", "subjects", search ?? ""] as const;

export function useSubjectsQuery(search?: string) {
  return useQuery({ queryKey: subjectsQueryKey(search), queryFn: () => listSubjects(search) });
}

export function useCreateSubjectMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (payload: CreateSubjectPayload) => createSubject(payload),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["academic", "subjects"] }),
  });
}

export function useUpdateSubjectMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ subjectId, payload }: { subjectId: string; payload: UpdateSubjectPayload }) =>
      updateSubject(subjectId, payload),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["academic", "subjects"] }),
  });
}

export function useDeleteSubjectMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (subjectId: string) => deleteSubject(subjectId),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["academic", "subjects"] }),
  });
}

// --- Sections ------------------------------------------------------------

export const sectionsQueryKey = (params: { academic_year_id?: string; class_id?: string }) =>
  ["academic", "sections", params] as const;

export function useSectionsQuery(params: { academic_year_id?: string; class_id?: string }) {
  return useQuery({ queryKey: sectionsQueryKey(params), queryFn: () => listSections(params) });
}

export function useCreateSectionMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (payload: CreateSectionPayload) => createSection(payload),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["academic", "sections"] }),
  });
}

export function useUpdateSectionMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ sectionId, payload }: { sectionId: string; payload: UpdateSectionPayload }) =>
      updateSection(sectionId, payload),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["academic", "sections"] }),
  });
}

export function useDeleteSectionMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (sectionId: string) => deleteSection(sectionId),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["academic", "sections"] }),
  });
}

// --- Class-Subject-Teacher assignment --------------------------------------

export const classSubjectsQueryKey = (params: { academic_year_id?: string; class_id?: string }) =>
  ["academic", "class-subjects", params] as const;

export function useClassSubjectsQuery(params: { academic_year_id?: string; class_id?: string }) {
  return useQuery({ queryKey: classSubjectsQueryKey(params), queryFn: () => listClassSubjects(params) });
}

export function useCreateClassSubjectMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (payload: CreateClassSubjectPayload) => createClassSubject(payload),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["academic", "class-subjects"] }),
  });
}

export function useUpdateClassSubjectMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ classSubjectId, payload }: { classSubjectId: string; payload: UpdateClassSubjectPayload }) =>
      updateClassSubject(classSubjectId, payload),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["academic", "class-subjects"] }),
  });
}

export function useDeleteClassSubjectMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (classSubjectId: string) => deleteClassSubject(classSubjectId),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["academic", "class-subjects"] }),
  });
}

// --- Enrollment / Promotion ------------------------------------------------

export const enrollmentsQueryKey = (params: {
  academic_year_id?: string;
  section_id?: string;
  student_id?: string;
}) => ["academic", "enrollments", params] as const;

export function useEnrollmentsQuery(params: { academic_year_id?: string; section_id?: string; student_id?: string }) {
  return useQuery({ queryKey: enrollmentsQueryKey(params), queryFn: () => listEnrollments(params) });
}

export function useEnrollStudentMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (payload: EnrollStudentPayload) => enrollStudent(payload),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["academic", "enrollments"] }),
  });
}

export function useUpdateEnrollmentMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ enrollmentId, payload }: { enrollmentId: string; payload: UpdateEnrollmentPayload }) =>
      updateEnrollment(enrollmentId, payload),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["academic", "enrollments"] }),
  });
}

export function usePromoteStudentsMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (payload: PromoteStudentsPayload) => promoteStudents(payload),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["academic", "enrollments"] }),
  });
}
