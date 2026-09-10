import { useQuery } from '@tanstack/react-query';
import { customFetch } from '@workspace/api-client-react';

export type ClassState = 'UPCOMING' | 'IN_PROGRESS' | 'COMPLETED';

export type MentorLectureAttendanceStatus =
  | 'ATTENDANCE_MARKED'
  | 'ATTENDANCE_NOT_MARKED'
  | 'ATTENDANCE_NOT_APPLICABLE';

export type MentorScheduleContext = {
  id: string;
  teacherCode: string;
  name: string;
  email: string | null;
  initials: string;
};

export type MentorScheduledLecture = {
  timetableEntryId: string;
  section: string;
  sectionId: string;
  day: string;
  startTime: string;
  endTime: string;
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
  attendanceStatus: MentorLectureAttendanceStatus;
  classState: ClassState;
  enrolledStudentsCount: number;
  markedStudentsCount: number;
};

export type MentorScheduleResponse = {
  date: string;
  day: string;
  mentor: MentorScheduleContext;
  lectures: MentorScheduledLecture[];
};

export function getMentorScheduleQueryKey(date?: string) {
  return ['/api/mentor/schedule/today', date ?? 'today'] as const;
}

export async function fetchMentorSchedule(date?: string): Promise<MentorScheduleResponse> {
  const url = date
    ? `/api/mentor/schedule/today?date=${encodeURIComponent(date)}`
    : '/api/mentor/schedule/today';
  return customFetch<MentorScheduleResponse>(url, { method: 'GET' });
}

export function useMentorSchedule(date?: string) {
  return useQuery({
    queryKey: getMentorScheduleQueryKey(date),
    queryFn: () => fetchMentorSchedule(date),
    staleTime: 30_000,
  });
}
