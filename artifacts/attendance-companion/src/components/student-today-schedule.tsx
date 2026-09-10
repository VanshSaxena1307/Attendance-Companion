import { useState, useMemo } from 'react';
import {
  Calendar,
  ChevronLeft,
  ChevronRight,
  Clock,
  Clock3,
  Check,
  X,
  ShieldCheck,
  CheckCircle2,
  User,
  MapPin,
  Sparkles,
  AlertCircle,
  RefreshCw,
  Layers,
  CalendarDays,
} from 'lucide-react';
import {
  useStudentSchedule,
  type StudentScheduledLecture,
  type ClassState,
  type StudentLectureAttendanceStatus,
} from '@/hooks/use-student-schedule';

function getLocalDateString(d: Date = new Date()): string {
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function formatDateDisplay(dateStr: string): string {
  const [y, m, d] = dateStr.split('-').map(Number);
  const date = new Date(y, m - 1, d);
  return new Intl.DateTimeFormat('en-IN', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  }).format(date);
}

function offsetDate(dateStr: string, offsetDays: number): string {
  const [y, m, d] = dateStr.split('-').map(Number);
  const date = new Date(y, m - 1, d);
  date.setDate(date.getDate() + offsetDays);
  return getLocalDateString(date);
}

function AttendanceBadge({ status }: { status: StudentLectureAttendanceStatus }) {
  switch (status) {
    case 'ATTENDANCE_UPLOADED_PRESENT':
      return (
        <span
          data-testid="badge-attendance-present"
          className="inline-flex items-center gap-1.5 rounded-full bg-[#dcece2] px-3 py-1 text-[11px] font-bold text-[#2e6e55] shadow-xs"
        >
          <Check size={13} strokeWidth={2.6} />
          Present
        </span>
      );
    case 'ATTENDANCE_UPLOADED_ABSENT':
      return (
        <span
          data-testid="badge-attendance-absent"
          className="inline-flex items-center gap-1.5 rounded-full bg-[#f9e2db] px-3 py-1 text-[11px] font-bold text-[#a24d3d] shadow-xs"
        >
          <X size={13} strokeWidth={2.6} />
          Absent
        </span>
      );
    case 'ATTENDANCE_UPLOADED_EXEMPTED':
      return (
        <span
          data-testid="badge-attendance-exempted"
          className="inline-flex items-center gap-1.5 rounded-full bg-[#f8ebc9] px-3 py-1 text-[11px] font-bold text-[#8b671d] shadow-xs"
        >
          <ShieldCheck size={13} strokeWidth={2.6} />
          Exempted
        </span>
      );
    case 'ATTENDANCE_UPLOADED_LATE':
      return (
        <span
          data-testid="badge-attendance-late"
          className="inline-flex items-center gap-1.5 rounded-full bg-[#f8ebc9] px-3 py-1 text-[11px] font-bold text-[#8b671d] shadow-xs"
        >
          <Clock size={13} strokeWidth={2.6} />
          Late
        </span>
      );
    case 'ATTENDANCE_NOT_APPLICABLE':
      return (
        <span
          data-testid="badge-attendance-na"
          className="inline-flex items-center gap-1 rounded-full bg-muted/60 border border-border/50 px-2.5 py-1 text-[11px] font-medium text-muted-foreground"
        >
          N/A
        </span>
      );
    case 'ATTENDANCE_NOT_UPLOADED':
    default:
      return (
        <span
          data-testid="badge-attendance-not-uploaded"
          className="inline-flex items-center gap-1.5 rounded-full bg-muted/70 border border-border/60 px-3 py-1 text-[11px] font-medium text-muted-foreground"
        >
          <Clock3 size={13} />
          Attendance not uploaded
        </span>
      );
  }
}

function ClassStateBadge({ state, isPreview }: { state: ClassState; isPreview: boolean }) {
  if (isPreview) {
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-secondary/80 border border-border/60 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
        <Clock size={11} />
        Scheduled
      </span>
    );
  }

  switch (state) {
    case 'IN_PROGRESS':
      return (
        <span
          data-testid="badge-state-in-progress"
          className="inline-flex items-center gap-1.5 rounded-full bg-emerald-500/15 border border-emerald-500/30 px-2.5 py-0.5 text-[11px] font-bold uppercase tracking-wider text-emerald-700 dark:text-emerald-400"
        >
          <span className="relative flex h-2 w-2">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
            <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
          </span>
          In Progress
        </span>
      );
    case 'COMPLETED':
      return (
        <span
          data-testid="badge-state-completed"
          className="inline-flex items-center gap-1 rounded-full bg-muted/60 border border-border/40 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-muted-foreground"
        >
          <CheckCircle2 size={11} />
          Completed
        </span>
      );
    case 'UPCOMING':
    default:
      return (
        <span
          data-testid="badge-state-upcoming"
          className="inline-flex items-center gap-1 rounded-full bg-secondary border border-border/60 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-foreground/80"
        >
          <Clock size={11} />
          Upcoming
        </span>
      );
  }
}

function LectureCard({
  lecture,
  isPreview,
}: {
  lecture: StudentScheduledLecture;
  isPreview: boolean;
}) {
  const isLive = !isPreview && lecture.classState === 'IN_PROGRESS';
  const isDone = !isPreview && lecture.classState === 'COMPLETED';

  // Format batch display
  const hasSpecificBatch = lecture.batchType !== 'ALL';
  const batchLabel =
    lecture.batchType === 'LAB'
      ? `Lab ${lecture.batch}`
      : lecture.batchType === 'PYTHON'
      ? `Python ${lecture.batch}`
      : lecture.batchType === 'CLOUD'
      ? `Cloud ${lecture.batch}`
      : lecture.batch;

  return (
    <article
      data-testid={`lecture-card-${lecture.timetableEntryId}`}
      className={`group relative rounded-2xl border transition-all duration-200 ${
        isLive
          ? 'border-primary ring-2 ring-primary/30 bg-primary/[0.03] shadow-md'
          : isDone
          ? 'border-border/50 bg-card/60 opacity-85 hover:opacity-100 hover:border-border'
          : 'border-border/80 bg-card hover:border-primary/40 hover:shadow-xs'
      } p-4 sm:p-5`}
    >
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        {/* Left column: Timing & Live/State badge */}
        <div className="flex items-center justify-between gap-3 md:w-44 md:shrink-0 md:flex-col md:items-start md:justify-center">
          <div className="flex items-center gap-2">
            <span
              className={`font-mono text-base font-bold tracking-tight ${
                isLive ? 'text-primary' : 'text-foreground'
              }`}
            >
              {lecture.startTime} – {lecture.endTime}
            </span>
          </div>
          <div>
            <ClassStateBadge state={lecture.classState} isPreview={isPreview} />
          </div>
        </div>

        {/* Middle column: Subject details, room, instructor, and batch */}
        <div className="min-w-0 flex-1 space-y-1.5 border-t border-border/50 pt-2.5 md:border-t-0 md:border-l md:border-border/60 md:pl-5 md:pt-0">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="font-semibold text-foreground text-[15px] sm:text-base tracking-tight leading-snug">
              {lecture.subjectName || 'Scheduled Class'}
            </h3>
            {lecture.subjectCode && (
              <span className="font-mono text-xs font-semibold text-primary/80 bg-primary/10 rounded-md px-1.5 py-0.5">
                {lecture.subjectCode}
              </span>
            )}
            {lecture.lectureType && (
              <span
                className={`rounded-md px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wider ${
                  lecture.lectureType === 'LAB'
                    ? 'bg-purple-100 text-purple-800 dark:bg-purple-950/50 dark:text-purple-300'
                    : lecture.lectureType === 'THEORY'
                    ? 'bg-blue-100 text-blue-800 dark:bg-blue-950/50 dark:text-blue-300'
                    : 'bg-muted text-muted-foreground'
                }`}
              >
                {lecture.lectureType === 'LAB'
                  ? 'Lab'
                  : lecture.lectureType === 'THEORY'
                  ? 'Theory'
                  : 'Activity'}
              </span>
            )}
            {hasSpecificBatch && (
              <span className="inline-flex items-center gap-1 rounded-md bg-amber-100 dark:bg-amber-950/50 px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wider text-amber-800 dark:text-amber-300">
                <Layers size={11} />
                {batchLabel}
              </span>
            )}
          </div>

          <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
            {lecture.room && (
              <span className="inline-flex items-center gap-1 font-medium">
                <MapPin size={13} className="text-muted-foreground/70 shrink-0" />
                Room {lecture.room}
              </span>
            )}
            {(lecture.teacherName || lecture.teacherInitials) && (
              <span className="inline-flex items-center gap-1">
                <User size={13} className="text-muted-foreground/70 shrink-0" />
                {lecture.teacherName || `Prof. (${lecture.teacherInitials})`}
              </span>
            )}
            <span className="text-[11px] text-muted-foreground/60">
              Sec {lecture.section}
            </span>
          </div>
        </div>

        {/* Right column: Attendance badge */}
        <div className="flex items-center justify-between border-t border-border/50 pt-2.5 md:shrink-0 md:border-t-0 md:pl-4 md:pt-0">
          <span className="text-xs text-muted-foreground font-medium md:hidden">
            Attendance
          </span>
          <AttendanceBadge status={lecture.attendanceStatus} />
        </div>
      </div>
    </article>
  );
}

export function StudentTodaySchedule() {
  const todayStr = useMemo(() => getLocalDateString(), []);
  const [selectedDate, setSelectedDate] = useState<string>(todayStr);

  const isToday = selectedDate === todayStr;

  const { data, isLoading, isError, error, refetch } = useStudentSchedule(
    isToday ? undefined : selectedDate
  );

  const dateTitle = useMemo(() => formatDateDisplay(selectedDate), [selectedDate]);

  return (
    <section
      data-testid="student-today-schedule-section"
      className="mt-6 rounded-2xl border border-border/70 bg-card p-4 sm:p-6 shadow-sm transition-all"
    >
      {/* Header with Title and Date Controls */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between border-b border-border/60 pb-5">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <p className="text-[11px] font-bold uppercase tracking-[.18em] text-primary">
              {isToday ? "Today's Schedule" : 'Schedule Preview'}
            </p>
            {isToday ? (
              <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/10 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-emerald-600 dark:text-emerald-400">
                <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
                Live
              </span>
            ) : (
              <span className="inline-flex items-center gap-1 rounded-full bg-accent/30 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-accent-foreground">
                Preview
              </span>
            )}
          </div>
          <h2 className="mt-1 font-display text-2xl sm:text-3xl text-foreground tracking-tight">
            {isToday ? "Today's Lectures" : data?.day ? `${data.day}'s Lectures` : 'Scheduled Lectures'}
          </h2>
          <p className="mt-0.5 text-xs sm:text-sm text-muted-foreground">
            {dateTitle}
            {data?.student && (
              <span className="ml-2 font-medium text-foreground/75">
                · {data.student.sectionCode}
                {data.student.labBatch && ` · Lab ${data.student.labBatch}`}
                {data.student.pythonBatch && ` · Python ${data.student.pythonBatch}`}
                {data.student.cloudBatch && ` · Cloud ${data.student.cloudBatch}`}
              </span>
            )}
          </p>
        </div>

        {/* Date Navigation Toolbar */}
        <div className="flex flex-wrap items-center gap-2 shrink-0">
          <div className="flex items-center rounded-xl border border-border bg-background/80 p-1 shadow-2xs">
            <button
              type="button"
              onClick={() => setSelectedDate((prev) => offsetDate(prev, -1))}
              data-testid="button-schedule-prev-day"
              aria-label="Previous day"
              className="flex h-9 w-9 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
            >
              <ChevronLeft size={18} />
            </button>
            <button
              type="button"
              onClick={() => setSelectedDate(todayStr)}
              data-testid="button-schedule-today"
              className={`px-3 py-1 text-xs font-semibold rounded-lg transition-colors focus:outline-none focus:ring-2 focus:ring-ring ${
                isToday
                  ? 'bg-primary text-primary-foreground shadow-2xs'
                  : 'text-muted-foreground hover:bg-muted hover:text-foreground'
              }`}
            >
              Today
            </button>
            <button
              type="button"
              onClick={() => setSelectedDate((prev) => offsetDate(prev, 1))}
              data-testid="button-schedule-next-day"
              aria-label="Next day"
              className="flex h-9 w-9 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
            >
              <ChevronRight size={18} />
            </button>
          </div>

          {!isToday && (
            <button
              type="button"
              onClick={() => setSelectedDate(todayStr)}
              data-testid="button-back-to-today"
              className="inline-flex items-center gap-1.5 rounded-xl border border-primary/40 bg-primary/10 px-3 py-2 text-xs font-semibold text-primary hover:bg-primary/20 transition-colors focus:outline-none focus:ring-2 focus:ring-ring min-h-[38px]"
            >
              <Calendar size={13} />
              Return to Today
            </button>
          )}
        </div>
      </div>

      {/* Preview Mode Notice Banner */}
      {!isToday && (
        <div
          data-testid="banner-preview-mode"
          className="mt-4 flex items-center justify-between gap-3 rounded-xl border border-accent/40 bg-accent/15 px-4 py-2.5 text-xs text-foreground/90"
        >
          <div className="flex items-center gap-2">
            <CalendarDays size={16} className="text-accent-foreground shrink-0" />
            <span>
              You are previewing the timetable for <strong>{dateTitle}</strong>. Class states and live tracking reflect the selected date.
            </span>
          </div>
          <button
            type="button"
            onClick={() => setSelectedDate(todayStr)}
            className="font-bold text-primary hover:underline shrink-0 text-xs ml-auto"
          >
            Today
          </button>
        </div>
      )}

      {/* Content Area */}
      <div className="mt-5 space-y-3">
        {isLoading ? (
          <div className="space-y-3 animate-pulse" data-testid="schedule-loading">
            <div className="h-20 rounded-2xl bg-muted/70" />
            <div className="h-20 rounded-2xl bg-muted/70" />
            <div className="h-20 rounded-2xl bg-muted/70" />
          </div>
        ) : isError ? (
          <div
            data-testid="schedule-error"
            className="rounded-2xl border border-destructive/20 bg-destructive/5 p-6 text-center"
          >
            <AlertCircle size={24} className="mx-auto text-destructive mb-2" />
            <p className="font-display text-lg text-foreground">Could not load schedule</p>
            <p className="mt-1 text-xs text-muted-foreground">
              {error instanceof Error ? error.message : 'An error occurred while fetching your timetable.'}
            </p>
            <button
              type="button"
              onClick={() => refetch()}
              className="mt-4 inline-flex items-center gap-2 rounded-xl bg-secondary px-4 py-2 text-xs font-semibold hover:bg-accent/70 transition-colors"
            >
              <RefreshCw size={14} />
              Try again
            </button>
          </div>
        ) : !data?.lectures || data.lectures.length === 0 ? (
          <div
            data-testid="schedule-empty"
            className="rounded-2xl border border-dashed border-border/80 bg-card/50 p-8 text-center"
          >
            <div className="mx-auto mb-3 grid h-10 w-10 place-items-center rounded-full bg-accent/20 text-primary">
              <Sparkles size={20} />
            </div>
            <h3 className="font-display text-lg text-foreground">No classes scheduled</h3>
            <p className="mx-auto mt-1 max-w-sm text-xs sm:text-sm text-muted-foreground leading-relaxed">
              There are no lectures on your timetable for {dateTitle}. Enjoy your day or use this time to catch up on coursework.
            </p>
            {!isToday && (
              <button
                type="button"
                onClick={() => setSelectedDate(todayStr)}
                className="mt-4 inline-flex items-center gap-2 rounded-xl bg-primary px-4 py-2 text-xs font-semibold text-primary-foreground hover:brightness-110 transition-all shadow-xs"
              >
                Back to Today's Schedule
              </button>
            )}
          </div>
        ) : (
          <div className="space-y-3" data-testid="schedule-lectures-list">
            {data.lectures.map((lecture) => (
              <LectureCard
                key={lecture.timetableEntryId}
                lecture={lecture}
                isPreview={!isToday}
              />
            ))}
          </div>
        )}
      </div>
    </section>
  );
}
