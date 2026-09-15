import { useState, useMemo } from 'react';
import { Link, useParams } from 'wouter';
import {
  ArrowLeft,
  BookOpen,
  Building2,
  CalendarCheck,
  CheckCircle2,
  ChevronRight,
  Clock3,
  GraduationCap,
  Layers,
  Sparkles,
  TrendingDown,
  TrendingUp,
  Users,
  CalendarOff,
} from 'lucide-react';
import { type CurrentUser } from '@workspace/api-client-react';
import {
  AppShell,
  PageHeader,
  StatusPill,
  LoadingBlock,
  EmptyBlock,
  ErrorBlock,
} from '@/components/app-shell';
import {
  useDepartmentSchedule,
  type DepartmentScheduledLecture,
} from '@/hooks/use-department-schedule';
import {
  cse34CumulativeSubjects,
  cse35CumulativeSubjects,
  type CumulativeSubjectStats,
} from './hod-attendance';

const safeArray = <T,>(val: T[] | undefined | null): T[] => val || [];

export function HodSectionPage({ user }: { user: CurrentUser }) {
  const params = useParams<{ sectionId: string }>();
  const rawId = (params.sectionId || 'cse-34').toUpperCase().replace('-', '');
  const activeSection: 'CSE34' | 'CSE35' = rawId === 'CSE35' ? 'CSE35' : 'CSE34';

  const sectionLabel = activeSection === 'CSE34' ? 'CSE-34' : 'CSE-35';
  const subjects: CumulativeSubjectStats[] =
    activeSection === 'CSE34' ? cse34CumulativeSubjects : cse35CumulativeSubjects;

  // Real Database Schedule for this Section
  const scheduleQuery = useDepartmentSchedule({ section: activeSection });
  const schedule = safeArray(scheduleQuery.data?.lectures);

  // Aggregate Metrics
  const totalEligible = subjects.reduce((a: number, s: CumulativeSubjectStats) => a + s.eligibleOpportunities, 0);
  const totalPresent = subjects.reduce((a: number, s: CumulativeSubjectStats) => a + s.presentCount, 0);
  const sectionPct = totalEligible > 0 ? (totalPresent / totalEligible) * 100 : 0;
  const markedLectures = scheduleQuery.data?.markedCount ?? schedule.filter((s) => s.status === 'COMPLETED' || s.attendanceStatus === 'MARKED').length;

  return (
    <AppShell user={user}>
      {/* -------------------------------------------------------------------- */}
      {/* 1. Breadcrumb & Section Navigation */}
      {/* -------------------------------------------------------------------- */}
      <div className="mb-3 flex items-center justify-between gap-2">
        <Link
          href="/"
          data-testid="link-back-overview"
          className="inline-flex items-center gap-1.5 text-xs font-semibold text-muted-foreground hover:text-foreground transition-colors"
        >
          <ArrowLeft size={14} /> Back to Overview
        </Link>
        <div className="flex items-center gap-1.5 rounded-xl border border-border/80 bg-card p-1 shadow-2xs">
          <Link
            href="/sections/cse-34"
            data-testid="tab-section-cse34"
            className={`rounded-lg px-3 py-1 text-xs font-semibold transition-all ${
              activeSection === 'CSE34'
                ? 'bg-primary text-primary-foreground shadow-2xs'
                : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            CSE-34
          </Link>
          <Link
            href="/sections/cse-35"
            data-testid="tab-section-cse35"
            className={`rounded-lg px-3 py-1 text-xs font-semibold transition-all ${
              activeSection === 'CSE35'
                ? 'bg-primary text-primary-foreground shadow-2xs'
                : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            CSE-35
          </Link>
        </div>
      </div>

      {/* -------------------------------------------------------------------- */}
      {/* 2. Page Header */}
      {/* -------------------------------------------------------------------- */}
      <PageHeader
        eyebrow="Department Section Oversight"
        title={`Section ${sectionLabel}`}
        description={`Detailed faculty marking activity, timetable progression, and cumulative subject attendance health for Semester III ${sectionLabel}.`}
        action={
          <div className="flex items-center gap-2">
            <span className="inline-flex items-center gap-2 rounded-xl border border-border/80 bg-card px-3.5 py-2 text-xs font-semibold text-muted-foreground shadow-2xs">
              <Building2 size={14} className="text-primary" />
              Department of Computer Science
            </span>
          </div>
        }
      />

      {/* -------------------------------------------------------------------- */}
      {/* 3. Section Overview Cards */}
      {/* -------------------------------------------------------------------- */}
      <div className="grid grid-cols-2 gap-2.5 sm:gap-4 xl:grid-cols-4 animate-rise-in delay-1">
        {/* Metric 1: Cumulative Attendance */}
        <div className="rounded-xl sm:rounded-2xl border border-border/70 bg-card p-3 sm:p-5 shadow-2xs">
          <p className="text-[10px] sm:text-[11px] font-bold uppercase tracking-wider text-muted-foreground truncate">
            Cumulative Attendance
          </p>
          <p className="mt-2 font-mono text-2xl sm:text-3xl font-bold tracking-tight text-foreground">
            {sectionPct.toFixed(1)}%
          </p>
          <p className="mt-1 text-[10px] sm:text-xs text-muted-foreground truncate">
            Target 75.0% · {sectionPct >= 75 ? 'Healthy' : 'Needs attention'}
          </p>
        </div>

        {/* Metric 2: Enrolled Students */}
        <div className="rounded-xl sm:rounded-2xl border border-border/70 bg-card p-3 sm:p-5 shadow-2xs">
          <p className="text-[10px] sm:text-[11px] font-bold uppercase tracking-wider text-muted-foreground truncate">
            Enrolled Students
          </p>
          <p className="mt-2 font-mono text-2xl sm:text-3xl font-bold tracking-tight text-foreground">
            67
          </p>
          <p className="mt-1 text-[10px] sm:text-xs text-muted-foreground truncate">
            All registered for Sem III
          </p>
        </div>

        {/* Metric 3: Today's Marking Compliance */}
        <div className="rounded-xl sm:rounded-2xl border border-border/70 bg-card p-3 sm:p-5 shadow-2xs">
          <p className="text-[10px] sm:text-[11px] font-bold uppercase tracking-wider text-muted-foreground truncate">
            Today's Marking
          </p>
          <p className="mt-2 font-mono text-2xl sm:text-3xl font-bold tracking-tight text-foreground">
            {markedLectures} / {schedule.length}
          </p>
          <p className="mt-1 text-[10px] sm:text-xs text-muted-foreground truncate">
            {schedule.length - markedLectures} pending submission
          </p>
        </div>

        {/* Metric 4: Academic Mentor */}
        <div className="rounded-xl sm:rounded-2xl border border-border/70 bg-card p-3 sm:p-5 shadow-2xs">
          <p className="text-[10px] sm:text-[11px] font-bold uppercase tracking-wider text-muted-foreground truncate">
            Faculty Mentor
          </p>
          <p className="mt-2 font-medium text-sm sm:text-base text-foreground truncate">
            {activeSection === 'CSE34' ? 'Dr. Neha Sharma' : 'Prof. Bharti Shukla'}
          </p>
          <p className="mt-1 text-[10px] sm:text-xs text-muted-foreground truncate">
            Section Coordinator
          </p>
        </div>
      </div>

      {/* -------------------------------------------------------------------- */}
      {/* 4. Main Two-Column Layout */}
      {/* -------------------------------------------------------------------- */}
      <div className="mt-4 sm:mt-6 grid gap-4 sm:gap-6 xl:grid-cols-[1.2fr_.8fr]">
        {/* Left Column: Today's Section Faculty Activity */}
        <section
          data-testid="section-faculty-activity"
          className="rounded-xl sm:rounded-2xl border border-border/70 bg-card p-4 sm:p-6 shadow-2xs"
        >
          <div className="mb-4 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <div>
              <p className="text-[10px] sm:text-[11px] font-bold uppercase tracking-[.15em] text-primary">
                Lecture Timetable & Compliance
              </p>
              <h2 className="mt-0.5 font-display text-xl sm:text-2xl text-foreground">
                Today's Faculty Activity
              </h2>
              <p className="mt-1 text-xs text-muted-foreground">
                Scheduled lecture slots for Section {sectionLabel} and real-time attendance lock status.
              </p>
            </div>
            <span className="text-[11px] font-semibold text-primary self-start sm:self-center">
              {markedLectures} of {schedule.length} Completed
            </span>
          </div>

          {scheduleQuery.isLoading ? (
            <LoadingBlock rows={4} />
          ) : scheduleQuery.isError ? (
            <ErrorBlock retry={() => scheduleQuery.refetch()} />
          ) : schedule.length === 0 ? (
            <EmptyBlock
              title="No lectures scheduled"
              detail={`There are no active timetable lectures scheduled for Section ${sectionLabel} today.`}
            />
          ) : (
            <div className="divide-y divide-border/60">
              {schedule.map((slot) => (
                <div
                  key={slot.id}
                  data-testid={`row-slot-${slot.id}`}
                  className="py-3.5 first:pt-1 last:pb-1 flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 rounded-lg px-2 hover:bg-muted/30 transition-colors"
                >
                  <div className="flex items-start sm:items-center gap-3 min-w-0">
                    <span className="font-mono text-xs font-bold text-muted-foreground w-28 shrink-0">
                      {slot.time}
                    </span>
                    <div className="min-w-0">
                      <p className="text-xs sm:text-sm font-semibold text-foreground truncate">
                        {slot.subjectName || 'Lecture'}{' '}
                        {slot.subjectCode && (
                          <span className="font-mono text-xs font-normal text-muted-foreground">
                            ({slot.subjectCode})
                          </span>
                        )}
                      </p>
                      <p className="text-[11px] text-muted-foreground truncate">
                        {slot.teacherName || 'Faculty'} · Room {slot.room} ·{' '}
                        <span className="font-semibold uppercase tracking-wider">{slot.lectureType || 'THEORY'}</span>
                      </p>
                    </div>
                  </div>

                  <div className="shrink-0 self-start sm:self-center pl-28 sm:pl-0">
                    {slot.status === 'CANCELLED' ? (
                      <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-500/15 border border-amber-500/30 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider text-amber-800 dark:text-amber-200">
                        <CalendarOff size={12} /> Cancelled
                      </span>
                    ) : slot.status === 'COMPLETED' || slot.attendanceStatus === 'MARKED' ? (
                      <span className="inline-flex items-center gap-1.5 rounded-full bg-[#dcece2] px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider text-[#2e6e55]">
                        <CheckCircle2 size={12} /> Marked {slot.markedAt && `(${slot.markedAt})`}
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-500/15 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider text-amber-800 dark:text-amber-200">
                        <Clock3 size={12} /> Marking Pending
                      </span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>

        {/* Right Column: Cumulative Subject Attendance for this Section */}
        <section
          data-testid="section-subject-attendance"
          className="rounded-xl sm:rounded-2xl border border-border/70 bg-card p-4 sm:p-6 shadow-2xs"
        >
          <div className="mb-4 flex items-center justify-between">
            <div>
              <p className="text-[10px] sm:text-[11px] font-bold uppercase tracking-[.15em] text-primary">
                Cumulative Subject Health
              </p>
              <h2 className="mt-0.5 font-display text-xl sm:text-2xl text-foreground">
                Subject Attendance
              </h2>
            </div>
            <Link
              href="/attendance"
              data-testid="link-full-attendance"
              className="inline-flex items-center gap-1 text-xs font-semibold text-primary hover:underline"
            >
              Full analysis <ChevronRight size={13} />
            </Link>
          </div>
          <p className="text-xs text-muted-foreground -mt-2 mb-4">
            Cumulative present / eligible opportunities across all lectures conducted.
          </p>

          <div className="space-y-3">
            {subjects.map((sub: CumulativeSubjectStats) => {
              const status =
                sub.percentage >= 75 ? 'SAFE' : sub.percentage >= 70 ? 'WARNING' : 'CRITICAL';
              return (
                <div
                  key={sub.id}
                  data-testid={`card-sub-${sub.code}`}
                  className="rounded-xl border border-border/70 bg-card p-3 sm:p-3.5 transition-all hover:border-primary/40 hover:shadow-xs"
                >
                  <div className="flex items-center justify-between gap-2">
                    <div className="min-w-0">
                      <p className="text-xs sm:text-sm font-semibold text-foreground truncate">
                        {sub.name}
                      </p>
                      <p className="text-[10px] font-mono text-muted-foreground">
                        {sub.code} · {sub.teacher}
                      </p>
                    </div>
                    <div className="text-right shrink-0">
                      <span className="font-mono text-sm sm:text-base font-bold text-foreground">
                        {sub.percentage.toFixed(1)}%
                      </span>
                      <div className="mt-0.5">
                        <StatusPill status={status} />
                      </div>
                    </div>
                  </div>

                  {/* Progress bar */}
                  <div className="mt-2.5 h-1.5 w-full overflow-hidden rounded-full bg-muted">
                    <div
                      className="h-full rounded-full transition-all duration-500"
                      style={{
                        width: `${Math.min(sub.percentage, 100)}%`,
                        backgroundColor:
                          sub.percentage >= 75
                            ? '#2F7665'
                            : sub.percentage >= 70
                            ? '#D99A45'
                            : '#E05D52',
                      }}
                    />
                  </div>

                  <div className="mt-2 flex items-center justify-between text-[10px] text-muted-foreground font-mono">
                    <span>{sub.lecturesConducted} Lectures</span>
                    <span>
                      {sub.presentCount}/{sub.eligibleOpportunities} Present ({sub.absentCount} Abs)
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        </section>
      </div>
    </AppShell>
  );
}
