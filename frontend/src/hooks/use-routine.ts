import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import {
  createRoutineSlot,
  deleteRoutineSlot,
  getMyGuardianRoutine,
  getMyStudentRoutine,
  getMyTeacherRoutine,
  getSectionRoutine,
  listRoutineSlots,
  updateRoutineSlot,
  type CreateRoutineSlotPayload,
  type UpdateRoutineSlotPayload,
  type Weekday,
} from "@/lib/api/routine";

export const routineSlotsQueryKey = (params: {
  academic_year_id?: string;
  section_id?: string;
  teacher_id?: string;
  day_of_week?: Weekday;
}) => ["routine", "slots", params] as const;

export const sectionRoutineQueryKey = (sectionId: string) => ["routine", "section", sectionId] as const;
export const myTeacherRoutineQueryKey = ["routine", "me", "teacher"] as const;
export const myStudentRoutineQueryKey = ["routine", "me", "student"] as const;
export const myGuardianRoutineQueryKey = ["routine", "me", "guardian"] as const;

function invalidateRoutineQueries(queryClient: ReturnType<typeof useQueryClient>) {
  queryClient.invalidateQueries({ queryKey: ["routine"] });
}

export function useRoutineSlotsQuery(params: {
  academic_year_id?: string;
  section_id?: string;
  teacher_id?: string;
  day_of_week?: Weekday;
}) {
  return useQuery({ queryKey: routineSlotsQueryKey(params), queryFn: () => listRoutineSlots(params) });
}

export function useSectionRoutineQuery(sectionId: string) {
  return useQuery({
    queryKey: sectionRoutineQueryKey(sectionId || "none"),
    queryFn: () => getSectionRoutine(sectionId),
    enabled: Boolean(sectionId),
  });
}

export function useMyTeacherRoutineQuery() {
  return useQuery({ queryKey: myTeacherRoutineQueryKey, queryFn: getMyTeacherRoutine, retry: false });
}

export function useMyStudentRoutineQuery() {
  return useQuery({ queryKey: myStudentRoutineQueryKey, queryFn: getMyStudentRoutine, retry: false });
}

export function useMyGuardianRoutineQuery() {
  return useQuery({ queryKey: myGuardianRoutineQueryKey, queryFn: getMyGuardianRoutine, retry: false });
}

export function useCreateRoutineSlotMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (payload: CreateRoutineSlotPayload) => createRoutineSlot(payload),
    onSuccess: () => invalidateRoutineQueries(queryClient),
  });
}

export function useUpdateRoutineSlotMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ slotId, payload }: { slotId: string; payload: UpdateRoutineSlotPayload }) =>
      updateRoutineSlot(slotId, payload),
    onSuccess: () => invalidateRoutineQueries(queryClient),
  });
}

export function useDeleteRoutineSlotMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (slotId: string) => deleteRoutineSlot(slotId),
    onSuccess: () => invalidateRoutineQueries(queryClient),
  });
}
