import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { customFetch } from '@workspace/api-client-react';

export type DepartmentScheduledLecture = {
  id: string;
  timetableEntryId: string;
  lectureInstanceId: string | null;
  section: string;
  sectionId: string;
  day: string;
  date: string;
  startTime: string;
  endTime: string;
  time: string;
  subjectId: string | null;
  subjectCode: string | null;
  subjectName: string | null;
  teacherId: string | null;
  teacherName: string | null;
  teacherInitials: string | null;
  room: string;
  batchType: string;
  batch: string;
  lectureType: string;
  status: 'SCHEDULED' | 'COMPLETED' | 'CANCELLED';
  attendanceStatus: 'MARKED' | 'PENDING';
  markedAt: string | null;
  notes: string | null;
};

export type DepartmentScheduleSummary = {
  date: string;
  day: string;
  totalScheduled: number;
  markedCount: number;
  pendingCount: number;
  cancelledCount: number;
  unexpectedHoliday: {
    active: boolean;
    date: string;
    reason: string | null;
    affectedSections: string[];
    cancelledLecturesCount: number;
  } | null;
  lectures: DepartmentScheduledLecture[];
};

export function getDepartmentScheduleQueryKey(date?: string, section?: string) {
  return ['/api/department/schedule/today', date ?? 'today', section ?? 'all'] as const;
}

export async function fetchDepartmentSchedule(
  date?: string,
  section?: string
): Promise<DepartmentScheduleSummary> {
  const params = new URLSearchParams();
  if (date) params.set('date', date);
  if (section && section !== 'ALL') params.set('section', section);

  const qs = params.toString();
  const url = qs ? `/api/department/schedule/today?${qs}` : '/api/department/schedule/today';
  return customFetch<DepartmentScheduleSummary>(url, { method: 'GET' });
}

export function useDepartmentSchedule(options?: {
  date?: string;
  section?: string;
  enabled?: boolean;
}) {
  return useQuery({
    queryKey: getDepartmentScheduleQueryKey(options?.date, options?.section),
    queryFn: () => fetchDepartmentSchedule(options?.date, options?.section),
    enabled: options?.enabled ?? true,
    staleTime: 15_000,
    refetchInterval: 30_000,
  });
}

export type CancelHolidayPayload = {
  date: string;
  section?: string;
  numberOfLectures?: number;
  reason: string;
};

export type CancelHolidayResponse = {
  success: boolean;
  date: string;
  targetSection: string;
  reason: string;
  cancelledCount: number;
  skippedCount: number;
  cancelledInstanceIds: string[];
  skippedReasons: string[];
};

export function useCancelHoliday() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (payload: CancelHolidayPayload) =>
      customFetch<CancelHolidayResponse>('/api/schedule/unexpected-holiday', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/department/schedule/today'] });
      queryClient.invalidateQueries({ queryKey: ['/api/student/schedule/today'] });
      queryClient.invalidateQueries({ queryKey: ['/api/mentor/schedule/today'] });
    },
  });
}

export function useResetHoliday() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (payload: { date: string; section?: string }) =>
      customFetch<{ success: boolean; resetCount: number }>(
        '/api/schedule/unexpected-holiday/reset',
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        }
      ),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/department/schedule/today'] });
      queryClient.invalidateQueries({ queryKey: ['/api/student/schedule/today'] });
      queryClient.invalidateQueries({ queryKey: ['/api/mentor/schedule/today'] });
    },
  });
}
