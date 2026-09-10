import { useState, useMemo } from 'react';
import {
  Calendar,
  ChevronLeft,
  ChevronRight,
  Clock,
  Clock3,
  Check,
  CheckCircle2,
  Lock,
  MapPin,
  Sparkles,
  AlertCircle,
  RefreshCw,
  Layers,
  CalendarDays,
  ClipboardCheck,
  Users,
} from 'lucide-react';
import {
  useMentorSchedule,
  type MentorScheduledLecture,
  type ClassState,
  type MentorLectureAttendanceStatus,
} from '@/hooks/use-mentor-schedule';

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

function AttendanceStatusBadge({
  status,
  markedCount,
  totalCount,
}: {
  status: MentorLectureAttendanceStatus;
  markedCount: number;
  totalCount: number;
}) {
  switch (status) {
    case 'ATTENDANCE_MARKED':
      return (
        <span
          data-testid="badge-attendance-marked"
          className="inline-flex items-center gap-1.5 rounded-full bg-[#dcece2] px-3 py-1 text-[11px] font-bold text-[#2e6e55] shadow-xs"
        >
          <Check size={13} strokeWidth={2.6} />
          {markedCount} / {totalCount} marked
        </span>
      );
    case 'ATTENDANCE_NOT_MARKED':
      return (
        <span
          data-testid="badge-attendance-not-marked"
          className="inline-flex items-center gap-1.5 rounded-full bg-amber-500/15 border border-amber-500/30 px-3 py-1 text-[11px] font-bold text-amber-800 dark:text-amber-400 shadow-xs"
        >
          <Clock3 size={13} />
          {totalCount} enrolled · Not marked
        </span>
      );
    case 'ATTENDANCE_NOT_APPLICABLE':
    default:
      return (
        <span
          data-testid="badge-attendance-na"
          className="inline-flex items-center gap-1 rounded-full bg-muted/60 border border-border/50 px-2.5 py-1 text-[11px] font-medium text-muted-foreground"
        >
          N/A
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

export function MentorLectureCard({
  lecture,
  isPreview,
  isSelected,
  onSelect,
}: {
  lecture: MentorScheduledLecture;
  isPreview: boolean;
  isSelected: boolean;
  onSelect: (lecture: MentorScheduledLecture) => void;
}) {
  const isLive = !isPreview && lecture.classState === 'IN_PROGRESS';
  const isDone = !isPreview && lecture.classState === 'COMPLETED';
  const isLocked = !isPreview && lecture.classState === 'UPCOMING';

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
      data-testid={`mentor-lecture-card-${lecture.timetableEntryId}`}
      className={`group relative rounded-2xl border transition-all duration-200 p-4 sm:p-5 ${
        isSelected
          ? 'border-primary ring-2 ring-primary/40 bg-primary/[0.04] shadow-md'
          : isLive
          ? 'border-primary/80 bg-primary/[0.02] shadow-sm'
          : isDone
          ? 'border-border/60 bg-card hover:border-primary/30'
          : 'border-border/80 bg-card hover:border-primary/40'
      }`}
    >
      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        {/* Left column: Time and state */}
        <div className="flex items-center justify-between gap-3 lg:w-48 lg:shrink-0 lg:flex-col lg:items-start lg:justify-center">
          <div className="flex items-center gap-2">
            <span
              className={`font-mono text-base sm:text-lg font-bold tracking-tight ${
                isLive ? 'text-primary' : 'text-foreground'
              }`}
            >
              {lecture.startTime} – {lecture.endTime}
            </span>
          </div>
          <div className="flex items-center gap-2">
            <ClassStateBadge state={lecture.classState} isPreview={isPreview} />
            {isSelected && (
              <span className="inline-flex items-center gap-1 rounded-full bg-primary/10 border border-primary/30 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-primary">
                Active Roster
              </span>
            )}
          </div>
        </div>

        {/* Middle column: Section, Subject, Room, Batch */}
        <div className="min-w-0 flex-1 space-y-1.5 border-t border-border/50 pt-3 lg:border-t-0 lg:border-l lg:border-border/60 lg:pl-5 lg:pt-0">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="font-semibold text-foreground text-[15px] sm:text-base tracking-tight leading-snug">
              {lecture.subjectName || 'Scheduled Class'}
            </h3>
            {lecture.subjectCode && (
              <span className="font-mono text-xs font-medium px-2 py-0.5 rounded-md bg-secondary text-secondary-foreground border border-border/60">
                {lecture.subjectCode}
              </span>
            )}
            <span className="text-xs font-semibold px-2 py-0.5 rounded-md bg-accent/25 text-accent-foreground border border-accent/40">
              Section {lecture.section}
            </span>
            <span className="text-[11px] font-medium px-1.5 py-0.5 rounded-md bg-muted text-muted-foreground border border-border/40 uppercase">
              {lecture.lectureType}
            </span>
          </div>

          <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground pt-0.5">
            <span className="inline-flex items-center gap-1">
              <MapPin size={13} className="shrink-0 text-primary/70" />
              Room {lecture.room}
            </span>

            {hasSpecificBatch && (
              <span className="inline-flex items-center gap-1 font-medium text-foreground/80">
                <Layers size={13} className="shrink-0 text-primary/70" />
                {batchLabel}
              </span>
            )}

            <span className="inline-flex items-center gap-1">
              <Users size={13} className="shrink-0 text-muted-foreground/70" />
              {lecture.enrolledStudentsCount} students enrolled
            </span>
          </div>
        </div>

        {/* Right column: Status badge & Action button */}
        <div className="flex flex-col sm:flex-row lg:flex-col items-stretch sm:items-center lg:items-end justify-between gap-3 border-t border-border/50 pt-3 lg:border-t-0 lg:border-l lg:border-border/60 lg:pl-5 lg:pt-0 lg:w-56 lg:shrink-0">
          <AttendanceStatusBadge
            status={lecture.attendanceStatus}
            markedCount={lecture.markedStudentsCount}
            totalCount={lecture.enrolledStudentsCount}
          />

          <div className="w-full sm:w-auto">
            {lecture.attendanceStatus === 'ATTENDANCE_NOT_APPLICABLE' ? (
              <span className="text-xs text-muted-foreground italic">No attendance required</span>
            ) : isLocked ? (
              <button
                type="button"
                onClick={() => onSelect(lecture)}
                data-testid={`button-lecture-locked-${lecture.timetableEntryId}`}
                className={`w-full sm:w-auto inline-flex items-center justify-center gap-1.5 rounded-xl border px-3.5 py-2 text-xs font-semibold transition-all ${
                  isSelected
                    ? 'border-amber-500/60 bg-amber-500/15 text-amber-900 dark:text-amber-200'
                    : 'border-border/70 bg-muted/50 text-muted-foreground hover:bg-muted hover:text-foreground'
                }`}
                title="Lecture has not started — click to view enrolled roster in read-only mode"
              >
                <Lock size={13} />
                {isSelected ? 'Viewing Roster (Locked)' : 'Lecture has not started'}
              </button>
            ) : lecture.attendanceStatus === 'ATTENDANCE_MARKED' ? (
              <button
                type="button"
                onClick={() => onSelect(lecture)}
                data-testid={`button-lecture-edit-${lecture.timetableEntryId}`}
                className={`w-full sm:w-auto inline-flex items-center justify-center gap-1.5 rounded-xl px-3.5 py-2 text-xs font-semibold transition-all ${
                  isSelected
                    ? 'bg-primary text-primary-foreground shadow-sm hover:brightness-110'
                    : 'border border-primary/40 bg-card text-primary hover:bg-secondary'
                }`}
              >
                <ClipboardCheck size={14} />
                {isSelected ? 'Editing Attendance' : 'View / Edit Attendance'}
              </button>
            ) : (
              <button
                type="button"
                onClick={() => onSelect(lecture)}
                data-testid={`button-lecture-mark-${lecture.timetableEntryId}`}
                className="w-full sm:w-auto inline-flex items-center justify-center gap-1.5 rounded-xl bg-primary px-3.5 py-2 text-xs font-semibold text-primary-foreground shadow-sm hover:brightness-110 active:scale-[0.98] transition-all"
              >
                <Check size={14} />
                Mark Attendance
              </button>
            )}
          </div>
        </div>
      </div>
    </article>
  );
}

export function MentorTodaySchedule({
  selectedDate,
  onDateChange,
  selectedLectureId,
  onSelectLecture,
}: {
  selectedDate: string;
  onDateChange: (date: string) => void;
  selectedLectureId: string | null;
  onSelectLecture: (lecture: MentorScheduledLecture) => void;
}) {
  const todayStr = useMemo(() => getLocalDateString(), []);
  const isViewingToday = selectedDate === todayStr;
  const isPreview = selectedDate > todayStr;

  const { data, isLoading, isError, refetch } = useMentorSchedule(selectedDate);
  const lectures = useMemo(() => data?.lectures ?? [], [data?.lectures]);

  const handlePrevDay = () => onDateChange(offsetDate(selectedDate, -1));
  const handleNextDay = () => onDateChange(offsetDate(selectedDate, 1));
  const handleToday = () => onDateChange(todayStr);

  return (
    <section className="rounded-2xl border border-border/70 bg-card p-4 sm:p-6 shadow-[0_5px_18px_hsl(191_35%_17%/.03)]">
      {/* Header & Date Navigation Bar */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between border-b border-border/60 pb-5">
        <div>
          <div className="flex items-center gap-2">
            <span className="text-[11px] font-bold uppercase tracking-[.15em] text-primary">
              Scheduled Lectures
            </span>
            {isViewingToday ? (
              <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/10 px-2 py-0.5 text-[10px] font-semibold text-emerald-700 dark:text-emerald-400">
                Today
              </span>
            ) : isPreview ? (
              <span className="inline-flex items-center gap-1 rounded-full bg-accent/20 px-2 py-0.5 text-[10px] font-semibold text-accent-foreground">
                Upcoming
              </span>
            ) : (
              <span className="inline-flex items-center gap-1 rounded-full bg-muted px-2 py-0.5 text-[10px] font-semibold text-muted-foreground">
                Past Date
              </span>
            )}
          </div>
          <h2 className="mt-1 font-display text-2xl tracking-tight">Today’s Teaching Schedule</h2>
          <p className="mt-0.5 text-xs text-muted-foreground">
            Select a scheduled lecture to view its student roster and record attendance.
          </p>
        </div>

        {/* Date Navigator Controls */}
        <div className="flex items-center gap-1.5 self-start sm:self-auto bg-muted/40 border border-border/60 rounded-2xl p-1">
          <button
            type="button"
            onClick={handlePrevDay}
            data-testid="button-mentor-schedule-prev-day"
            className="grid h-8 w-8 place-items-center rounded-xl text-muted-foreground hover:bg-background hover:text-foreground transition-colors"
            title="Previous day"
          >
            <ChevronLeft size={16} />
          </button>

          <button
            type="button"
            onClick={handleToday}
            data-testid="button-mentor-schedule-today"
            className={`px-3 py-1 text-xs font-semibold rounded-xl transition-colors ${
              isViewingToday
                ? 'bg-background text-foreground shadow-xs'
                : 'text-muted-foreground hover:bg-background hover:text-foreground'
            }`}
          >
            Today
          </button>

          <span
            data-testid="text-mentor-schedule-date"
            className="flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium text-foreground"
          >
            <Calendar size={13} className="text-primary" />
            {formatDateDisplay(selectedDate)}
          </span>

          <button
            type="button"
            onClick={handleNextDay}
            data-testid="button-mentor-schedule-next-day"
            className="grid h-8 w-8 place-items-center rounded-xl text-muted-foreground hover:bg-background hover:text-foreground transition-colors"
            title="Next day"
          >
            <ChevronRight size={16} />
          </button>
        </div>
      </div>

      {/* Schedule Body */}
      <div className="mt-5">
        {isLoading ? (
          <div className="space-y-3 animate-pulse">
            <div className="h-24 rounded-2xl bg-muted/70" />
            <div className="h-24 rounded-2xl bg-muted/70" />
            <div className="h-24 rounded-2xl bg-muted/70" />
          </div>
        ) : isError ? (
          <div
            data-testid="block-mentor-schedule-error"
            className="rounded-2xl border border-destructive/30 bg-destructive/5 p-6 text-center"
          >
            <AlertCircle size={28} className="mx-auto text-destructive" />
            <h3 className="mt-2 text-sm font-bold text-destructive">Failed to load schedule</h3>
            <p className="mt-1 text-xs text-muted-foreground">
              We encountered an issue retrieving your timetable assignments for this date.
            </p>
            <button
              type="button"
              onClick={() => refetch()}
              className="mt-4 inline-flex items-center gap-1.5 rounded-xl border border-border bg-card px-3.5 py-2 text-xs font-semibold hover:bg-secondary transition-colors"
            >
              <RefreshCw size={13} />
              Retry
            </button>
          </div>
        ) : lectures.length === 0 ? (
          <div
            data-testid="block-mentor-schedule-empty"
            className="rounded-2xl border border-dashed border-border/80 bg-muted/20 p-8 text-center"
          >
            <CalendarDays size={32} className="mx-auto text-muted-foreground/60" />
            <h3 className="mt-3 font-display text-lg">No classes scheduled on this day</h3>
            <p className="mt-1 max-w-sm mx-auto text-xs text-muted-foreground leading-relaxed">
              You do not have any teaching slots scheduled in the active timetable for{' '}
              {formatDateDisplay(selectedDate)}. Check other days using the date navigation above.
            </p>
            {!isViewingToday && (
              <button
                type="button"
                onClick={handleToday}
                className="mt-4 inline-flex items-center gap-1.5 text-xs font-bold text-primary hover:underline"
              >
                Return to today’s schedule
              </button>
            )}
          </div>
        ) : (
          <div className="space-y-3">
            {lectures.map((lecture) => (
              <MentorLectureCard
                key={lecture.timetableEntryId}
                lecture={lecture}
                isPreview={isPreview}
                isSelected={selectedLectureId === lecture.timetableEntryId}
                onSelect={onSelectLecture}
              />
            ))}
          </div>
        )}
      </div>
    </section>
  );
}
