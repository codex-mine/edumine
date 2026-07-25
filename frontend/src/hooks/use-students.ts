import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { activateStudent, listPendingStudents } from "@/lib/api/students";

export const pendingStudentsQueryKey = ["students", "pending"] as const;

export function usePendingStudentsQuery() {
  return useQuery({
    queryKey: pendingStudentsQueryKey,
    queryFn: listPendingStudents,
  });
}

export function useActivateStudentMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (userId: string) => activateStudent(userId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: pendingStudentsQueryKey });
    },
  });
}
