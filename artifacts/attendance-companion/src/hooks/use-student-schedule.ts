import { useQuery } from '@tanstack/react-query';
import { customFetch } from '@workspace/api-client-react';

export type ClassState = 'UPCOMING' | 'IN_PROGRESS' | 'COMPLETED';

export type StudentLectureAttendanceStatus =
  | 'ATTENDANCE_UPLOADED_PRESENT'
  | 'ATTENDANCE_UPLOADED_ABSENT'
  | 'ATTENDANCE_UPLOADED_EXEMPTED'
  | 'ATTENDANCE_UPLOADED_LATE'
  | 'ATTENDANCE_NOT_UPLOADED'
  | 'ATTENDANCE_NOT_APPLICABLE';

export type StudentScheduleContext = {
  id: string;
  name: string;
  rollNo: string;
  admissionNo: string;
  sectionId: string;
  sectionCode: string;
  labBatch: string | null;
  pythonBatch: string | null;
  cloudBatch: string | null;
};

export type StudentScheduledLecture = {
  timetableEntryId: string;
  section: string;
  day: string;
  startTime: string;
  endTime: string;
  subjectId: string | null;
  subjectCode: string | null;
  subjectName: string | null;
  teacherId: string | null;
  teacherName: string | null;
  teacherInitials: string | null;
  batchType: string;
  batch: string;
  room: string;
  lectureType: string;
  classState: ClassState;
  attendanceStatus: StudentLectureAttendanceStatus;
};

export type StudentScheduleResponse = {
  date: string;
  day: string;
  student: StudentScheduleContext;
  lectures: StudentScheduledLecture[];
};

export function getStudentScheduleQueryKey(date?: string) {
  return ['/api/student/schedule/today', date ?? 'today'] as const;
}

export async function fetchStudentSchedule(date?: string): Promise<StudentScheduleResponse> {
  const url = date
    ? `/api/student/schedule/today?date=${encodeURIComponent(date)}`
    : '/api/student/schedule/today';
  return customFetch<StudentScheduleResponse>(url, { method: 'GET' });
}

export function useStudentSchedule(date?: string) {
  return useQuery({
    queryKey: getStudentScheduleQueryKey(date),
    queryFn: () => fetchStudentSchedule(date),
    staleTime: 30_000,
  });
}
