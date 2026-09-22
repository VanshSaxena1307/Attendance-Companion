import { useState, useMemo, useEffect } from 'react';
import { Link } from 'wouter';
import {
  AlertTriangle,
  ArrowUpRight,
  BookOpen,
  Building2,
  CalendarCheck,
  CalendarOff,
  CheckCircle2,
  ChevronRight,
  CircleAlert,
  ClipboardCheck,
  Clock3,
  GraduationCap,
  Info,
  ShieldAlert,
  ShieldCheck,
  Sparkles,
  Users,
} from 'lucide-react';
import {
  useGetStudents,
  useGetExemptions,
  type CurrentUser,
  type Student,
  type Exemption,
} from '@workspace/api-client-react';
import {
  useDepartmentSchedule,
  type DepartmentScheduledLecture,
} from '@/hooks/use-department-schedule';
import {
  AppShell,
  PageHeader,
  Button,
  StatusPill,
  LoadingBlock,
  ErrorBlock,
  EmptyBlock,
} from '@/components/app-shell';

const pct = (n: number) => `${n.toFixed(1)}%`;
const safeArray = <T,>(val: T[] | undefined | null): T[] => val || [];

function parseLocalDate(dateStr: string): Date {
  const [y, m, d] = dateStr.split('-').map(Number);
  return new Date(Date.UTC(y, (m || 1) - 1, d || 1, 12, 0, 0));
}

function fmtDateRange(start: string, end: string): string {
  try {
    const s = new Intl.DateTimeFormat('en-IN', { timeZone: 'Asia/Kolkata', day: 'numeric', month: 'short' }).format(parseLocalDate(start));
    if (start === end) return s;
    const e = new Intl.DateTimeFormat('en-IN', { timeZone: 'Asia/Kolkata', day: 'numeric', month: 'short' }).format(parseLocalDate(end));
    return `${s} – ${e}`;
  } catch {
    return `${start} – ${end}`;
  }
}

// ---------------------------------------------------------------------------
// Compact Top Snapshot Metric Card
// ---------------------------------------------------------------------------
interface SnapshotCardProps {
  label: string;
  value: string | number;
  note: string;
  tone?: 'teal' | 'amber' | 'rose' | 'slate';
  icon: React.ComponentType<{ size?: number; className?: string }>;
  href?: string;
  testId?: string;
}

function HodSnapshotCard({ label, value, note, tone = 'teal', icon: Icon, href, testId }: SnapshotCardProps) {
  const cardContent = (
    <div
      data-testid={testId}
      className="group relative overflow-hidden rounded-xl sm:rounded-2xl border border-border/70 bg-card p-2.5 sm:p-5 shadow-[0_4px_18px_hsl(191_35%_17%/.03)] transition-all duration-200 hover:-translate-y-0.5 hover:border-primary/40 hover:shadow-md"
    >
      <div
        className={`pointer-events-none absolute right-0 top-0 h-14 w-14 translate-x-3 -translate-y-3 sm:h-20 sm:w-20 sm:translate-x-6 sm:-translate-y-6 rounded-full transition-transform duration-300 group-hover:scale-110 ${
          tone === 'amber'
            ? 'bg-accent/40'
            : tone === 'rose'
            ? 'bg-[#f7ded6]'
            : tone === 'slate'
            ? 'bg-muted'
            : 'bg-[#d9ede1]'
        }`}
      />
      <div className="relative flex items-center justify-between">
        <span className="text-[10px] sm:text-xs font-bold uppercase tracking-[.15em] text-muted-foreground truncate">
          {label}
        </span>
        <span
          className={`grid h-7 w-7 sm:h-9 sm:w-9 place-items-center rounded-lg sm:rounded-xl ${
            tone === 'amber'
              ? 'bg-accent/30 text-accent-foreground'
              : tone === 'rose'
              ? 'bg-[#f7ded6] text-[#b8533f]'
              : tone === 'slate'
              ? 'bg-muted text-muted-foreground'
              : 'bg-[#dcece2] text-primary'
          }`}
        >
          <Icon size={16} />
        </span>
      </div>
      <div className="relative mt-1.5 sm:mt-2">
        <span className="font-display text-2xl sm:text-4xl text-foreground font-semibold tracking-tight">
          {value}
        </span>
        <p className="mt-0.5 sm:mt-1 text-[11px] sm:text-xs text-muted-foreground truncate">{note}</p>
      </div>
    </div>
  );

  return href ? (
    <Link href={href} className="block outline-hidden focus-visible:ring-2 focus-visible:ring-primary rounded-2xl">
      {cardContent}
    </Link>
  ) : (
    cardContent
  );
}

// ---------------------------------------------------------------------------
// HOD Overview Page Component
// ---------------------------------------------------------------------------
export function HodDashboard({ user }: { user: CurrentUser }) {
  const [sectionFilter, setSectionFilter] = useState<'ALL' | 'CSE34' | 'CSE35'>('ALL');

  // 1. Fetch Department Students (Real 134 students from PostgreSQL)
  const studentsQuery = useGetStudents();
  const allStudents = safeArray(studentsQuery.data);

  // 2. Fetch Pending Exemptions (HOD Decision Queue)
  const exemptionsQuery = useGetExemptions({ status: 'PENDING', page: 1, pageSize: 10 });
  const pendingExemptions = safeArray(exemptionsQuery.data?.items);

  // 3. Fetch Real Today's Department Schedule & Faculty Activity from PostgreSQL
  const departmentScheduleQuery = useDepartmentSchedule();
  const departmentSchedule = departmentScheduleQuery.data;

  const realLectures = safeArray(departmentSchedule?.lectures);
  const totalScheduledLectures = departmentSchedule?.totalScheduled ?? 0;
  const markedLecturesCount = departmentSchedule?.markedCount ?? 0;
  const pendingLecturesCount = departmentSchedule?.pendingCount ?? 0;
  const hasActiveHoliday = Boolean(departmentSchedule?.unexpectedHoliday?.active);

  // Compute Department Metrics
  const totalStudents = allStudents.length || 134;
  const criticalStudents = allStudents.filter((s) => s.status === 'CRITICAL');
  const warningStudents = allStudents.filter((s) => s.status === 'WARNING');
  const atRiskStudents = allStudents.filter((s) => s.status === 'CRITICAL' || s.status === 'WARNING');

  // Filter At-Risk Students by Section tab
  const displayedAtRisk = useMemo(() => {
    let list = atRiskStudents;
    if (sectionFilter === 'CSE34') {
      list = list.filter((s) => s.section?.replace('-', '').toUpperCase() === 'CSE34');
    } else if (sectionFilter === 'CSE35') {
      list = list.filter((s) => s.section?.replace('-', '').toUpperCase() === 'CSE35');
    }
    // Sort lowest attendance first
    return [...list].sort((a, b) => a.percentage - b.percentage);
  }, [atRiskStudents, sectionFilter]);

  return (
    <AppShell user={user}>
      {/* -------------------------------------------------------------------- */}
      {/* 1. Header: Department Identity & Scope */}
      {/* -------------------------------------------------------------------- */}
      <PageHeader
        eyebrow="Head of Department · Computer Science & Engineering"
        title="Department Overview"
        description="Real-time oversight of student attendance risk, pending absence exemptions, and faculty lecture marking activity."
        action={
          <div className="flex items-center gap-2">
            <span className="inline-flex items-center gap-2 rounded-xl border border-border/80 bg-card px-3.5 py-2 text-xs font-semibold text-muted-foreground shadow-2xs">
              <span className="h-2 w-2 rounded-full bg-primary animate-pulse" />
              Academic Session 2026–27 · Sem III
            </span>
          </div>
        }
      />

      {/* -------------------------------------------------------------------- */}
      {/* 2. Top Department Snapshot (4 Information-Dense Cards) */}
      {/* -------------------------------------------------------------------- */}
      <div className="grid grid-cols-2 gap-2.5 sm:gap-4 xl:grid-cols-4 animate-rise-in delay-1">
        {/* Card 1: Total Students */}
        <HodSnapshotCard
          label="Total Students"
          value={totalStudents}
          note="CSE-34 (67) · CSE-35 (67)"
          tone="teal"
          icon={GraduationCap}
          href="/people"
          testId="card-hod-total-students"
        />

        {/* Card 2: Students At Risk */}
        <HodSnapshotCard
          label="Students At Risk"
          value={atRiskStudents.length}
          note={`${criticalStudents.length} Critical (<70%) · ${warningStudents.length} Warning`}
          tone={criticalStudents.length > 0 ? 'rose' : 'amber'}
          icon={AlertTriangle}
          href="/people"
          testId="card-hod-at-risk-students"
        />

        {/* Card 3: Pending Exemptions (Actionable HOD Queue) */}
        <HodSnapshotCard
          label="Pending Exemptions"
          value={pendingExemptions.length}
          note={`${pendingExemptions.length} awaiting HOD decision`}
          tone="amber"
          icon={ClipboardCheck}
          href="/requests"
          testId="card-hod-pending-exemptions"
        />

        {/* Card 4: Today's Faculty Lecture Marking Compliance */}
        <HodSnapshotCard
          label="Today's Lecture Marking"
          value={`${markedLecturesCount} / ${totalScheduledLectures}`}
          note={`${markedLecturesCount} marked · ${pendingLecturesCount} pending`}
          tone="teal"
          icon={Clock3}
          href="/sections/cse-35"
          testId="card-hod-faculty-activity"
        />
      </div>

      {/* -------------------------------------------------------------------- */}
      {/* 3. Unexpected Holiday Notice Card (Model B - Read-Only Oversight) */}
      {/* -------------------------------------------------------------------- */}
      <div className="mt-4 sm:mt-6 animate-rise-in delay-2">
        {hasActiveHoliday ? (
          // STATE B — UNEXPECTED HOLIDAY ACTIVE (Admin-published holiday impact, view-only for HOD)
          <div
            data-testid="card-holiday-active"
            className="rounded-xl sm:rounded-2xl border-2 border-amber-400/80 bg-amber-500/10 p-4 sm:p-5 text-amber-950 dark:text-amber-100 shadow-2xs"
          >
            <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3">
              <div className="flex items-start gap-3">
                <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-amber-500/25 text-amber-900 dark:text-amber-200">
                  <CalendarOff size={20} />
                </span>
                <div className="space-y-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="rounded-md bg-amber-500/30 px-2 py-0.5 text-[10px] font-black uppercase tracking-widest text-amber-950 dark:text-amber-100">
                      Unexpected Holiday
                    </span>
                    <span className="font-mono text-xs font-bold text-amber-900 dark:text-amber-200">
                      {departmentSchedule?.unexpectedHoliday?.date || 'Today'}
                    </span>
                    <span className="rounded-full bg-amber-200 dark:bg-amber-900/60 px-2 py-0.5 text-[10px] font-bold uppercase text-amber-800 dark:text-amber-200">
                      Timetable Overridden
                    </span>
                  </div>
                  <p className="text-xs sm:text-sm font-semibold text-foreground">
                    {departmentSchedule?.unexpectedHoliday?.reason || 'Campus closed due to Administrative Order'}
                  </p>
                  <p className="text-xs text-amber-900/90 dark:text-amber-200/90">
                    <strong>Affected:</strong> {departmentSchedule?.unexpectedHoliday?.affectedSections?.join(' · ') || 'All Department Sections'}
                  </p>
                  <p className="text-xs text-amber-900/80 dark:text-amber-200/80">
                    Attendance marking suspended for affected lectures ({departmentSchedule?.unexpectedHoliday?.cancelledLecturesCount ?? totalScheduledLectures} sessions cancelled).
                  </p>
                </div>
              </div>

              <div className="flex flex-col sm:items-end gap-2 shrink-0 self-end sm:self-start pt-1 sm:pt-0">
                <Link
                  href="/settings"
                  data-testid="link-view-academic-calendar"
                  className="inline-flex items-center gap-1 rounded-lg bg-amber-600 dark:bg-amber-500 px-3 py-1.5 text-xs font-bold text-white hover:brightness-110 shadow-2xs"
                >
                  View Academic Calendar →
                </Link>
                <span className="text-[11px] font-medium text-amber-900/70 dark:text-amber-300/70">
                  Published by Academic Office (Admin)
                </span>
              </div>
            </div>
          </div>
        ) : (
          // STATE A — NORMAL SCHEDULE (Read-only oversight)
          <div
            data-testid="card-holiday-normal"
            className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 rounded-xl sm:rounded-2xl border border-border/70 bg-card p-4 sm:p-5 shadow-2xs"
          >
            <div className="flex items-start sm:items-center gap-3">
              <span className="grid h-9 w-9 sm:h-10 sm:w-10 shrink-0 place-items-center rounded-xl bg-[#dcece2] text-primary">
                <CalendarCheck size={18} />
              </span>
              <div>
                <div className="flex items-center gap-2 flex-wrap">
                  <h3 className="text-xs sm:text-sm font-semibold text-foreground">
                    Academic Schedule Running Normally
                  </h3>
                  <span className="rounded-full bg-[#dcece2] px-2 py-0.5 text-[10px] font-bold text-[#2e6e55] uppercase tracking-wider">
                    Normal
                  </span>
                </div>
                <p className="mt-0.5 text-xs text-muted-foreground">
                  No unexpected holidays scheduled. All lectures across CSE-34 and CSE-35 proceeding as planned.
                </p>
              </div>
            </div>
            <div className="flex items-center gap-3 self-end sm:self-center shrink-0">
              <span className="text-[11px] text-muted-foreground/70 hidden md:inline">
                Managed by Academic Office (Admin)
              </span>
              <Link
                href="/settings"
                className="text-xs font-semibold text-primary hover:underline"
              >
                Academic Calendar →
              </Link>
            </div>
          </div>
        )}
      </div>

      {/* -------------------------------------------------------------------- */}
      {/* 4. Main Two-Column Layout */}
      {/* -------------------------------------------------------------------- */}
      <div className="mt-4 sm:mt-6 grid gap-4 sm:gap-6 xl:grid-cols-[1.35fr_.65fr]">
        {/* Left Column: At-Risk Students & Today's Faculty Lecture Activity */}
        <div className="space-y-4 sm:space-y-6">
          {/* Section A: Students Needing Attention */}
          <section
            data-testid="section-hod-at-risk"
            className="rounded-xl sm:rounded-2xl border border-border/70 bg-card p-4 sm:p-6 shadow-2xs"
          >
            <div className="mb-4 sm:mb-5 flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
              <div>
                <p className="text-[10px] sm:text-[11px] font-bold uppercase tracking-[.15em] text-primary">
                  Attendance Oversight
                </p>
                <h2 className="mt-0.5 font-display text-xl sm:text-2xl text-foreground">
                  Students Needing Attention
                </h2>
                <p className="mt-1 text-xs text-muted-foreground">
                  Showing {displayedAtRisk.length} students falling below the 75% attendance line.
                </p>
              </div>

              {/* Section Filter Pills */}
              <div className="flex items-center gap-1.5 self-start sm:self-center overflow-x-auto pb-1 sm:pb-0">
                {(['ALL', 'CSE34', 'CSE35'] as const).map((code) => (
                  <button
                    key={code}
                    onClick={() => setSectionFilter(code)}
                    data-testid={`button-filter-section-${code.toLowerCase()}`}
                    className={`rounded-full px-3 py-1 text-xs font-semibold transition-colors ${
                      sectionFilter === code
                        ? 'bg-primary text-primary-foreground'
                        : 'border border-border bg-card text-muted-foreground hover:bg-muted'
                    }`}
                  >
                    {code === 'ALL' ? 'All Sections' : code === 'CSE34' ? 'CSE-34' : 'CSE-35'}
                  </button>
                ))}
              </div>
            </div>

            {/* Students List */}
            {studentsQuery.isLoading ? (
              <LoadingBlock rows={4} />
            ) : studentsQuery.isError ? (
              <ErrorBlock retry={() => studentsQuery.refetch()} />
            ) : displayedAtRisk.length === 0 ? (
              <EmptyBlock
                title="No students need attention"
                detail="All students in this section are currently maintaining attendance at or above the 75% target."
              />
            ) : (
              <div className="divide-y divide-border/60">
                {displayedAtRisk.slice(0, 6).map((student: Student) => (
                  <div
                    key={student.id}
                    data-testid={`row-at-risk-${student.id}`}
                    className="py-3 sm:py-3.5 first:pt-1 last:pb-1 flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 transition-colors hover:bg-muted/30 rounded-lg px-2"
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-secondary text-xs font-bold text-foreground">
                        {student.name
                          .split(' ')
                          .map((p) => p[0])
                          .join('')
                          .slice(0, 2)}
                      </span>
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <p className="text-xs sm:text-sm font-semibold text-foreground truncate">
                            {student.name}
                          </p>
                          <span className="rounded-md border border-border/80 bg-muted/60 px-1.5 py-0.5 font-mono text-[10px] text-muted-foreground font-semibold">
                            {student.section}
                          </span>
                        </div>
                        <p className="font-mono text-[11px] text-muted-foreground">{student.rollNo}</p>
                      </div>
                    </div>

                    <div className="flex items-center justify-between sm:justify-end gap-3 sm:gap-4 shrink-0 pl-12 sm:pl-0">
                      <div className="text-left sm:text-right">
                        <span className="font-mono text-sm sm:text-base font-bold text-foreground">
                          {pct(student.percentage)}
                        </span>
                        <p className="text-[10px] text-muted-foreground">Overall</p>
                      </div>

                      <StatusPill status={student.status} />

                      <Link
                        href={`/profile/${student.id}`}
                        data-testid={`link-profile-${student.id}`}
                        className="inline-flex items-center gap-1 rounded-lg border border-border bg-card px-2.5 py-1 text-xs font-semibold text-primary hover:border-primary/50 hover:bg-secondary"
                      >
                        Profile <ChevronRight size={13} />
                      </Link>
                    </div>
                  </div>
                ))}

                {displayedAtRisk.length > 6 && (
                  <div className="pt-3 text-center">
                    <Link
                      href="/people"
                      data-testid="link-view-all-at-risk"
                      className="inline-flex items-center gap-1 text-xs font-semibold text-primary hover:underline"
                    >
                      View all {displayedAtRisk.length} at-risk students in directory <ArrowUpRight size={14} />
                    </Link>
                  </div>
                )}
              </div>
            )}
          </section>

          {/* Section B: Today's Faculty Lecture Marking Activity */}
          <section
            data-testid="section-hod-faculty-activity"
            className="rounded-xl sm:rounded-2xl border border-border/70 bg-card p-4 sm:p-6 shadow-2xs"
          >
            <div className="mb-3.5 sm:mb-4 flex flex-col sm:flex-row sm:items-center justify-between gap-1.5">
              <div>
                <p className="text-[10px] sm:text-[11px] font-bold uppercase tracking-[.15em] text-primary">
                  Faculty Compliance
                </p>
                <h2 className="mt-0.5 font-display text-xl sm:text-2xl text-foreground">
                  Today's Lecture Marking Activity
                </h2>
                <p className="mt-1 text-xs text-muted-foreground">
                  Attendance marking status across scheduled department lecture slots today.
                </p>
              </div>
              <span className="text-[11px] font-medium text-muted-foreground self-start sm:self-center">
                {markedLecturesCount} of {totalScheduledLectures} Marked
              </span>
            </div>

            {departmentScheduleQuery.isLoading ? (
              <LoadingBlock rows={4} />
            ) : departmentScheduleQuery.isError ? (
              <ErrorBlock retry={() => departmentScheduleQuery.refetch()} />
            ) : realLectures.length === 0 ? (
              <EmptyBlock
                title="No lectures scheduled"
                detail="There are no active timetable lectures scheduled for the department today."
              />
            ) : (
              <div className="divide-y divide-border/60">
                {realLectures.map((act) => (
                  <Link
                    key={act.id}
                    href={`/sections/${act.section.toLowerCase()}`}
                    data-testid={`row-activity-${act.id}`}
                    className="group py-3 first:pt-1 last:pb-1 flex flex-col sm:flex-row sm:items-center justify-between gap-2 transition-colors hover:bg-muted/40 rounded-lg px-2"
                  >
                    <div className="flex items-start sm:items-center gap-2.5 sm:gap-3 min-w-0">
                      <span className="mt-0.5 sm:mt-0 font-mono text-xs font-semibold text-muted-foreground w-28 shrink-0">
                        {act.time}
                      </span>
                      <span className="rounded-md border border-primary/30 bg-primary/10 px-1.5 py-0.5 font-mono text-[10px] font-bold text-primary shrink-0">
                        {act.section}
                      </span>
                      <div className="min-w-0">
                        <p className="text-xs sm:text-sm font-semibold text-foreground truncate group-hover:text-primary transition-colors">
                          {act.subjectName || 'Lecture'}{' '}
                          {act.subjectCode && (
                            <span className="font-mono text-xs font-normal text-muted-foreground">
                              ({act.subjectCode})
                            </span>
                          )}
                        </p>
                        <p className="text-[11px] text-muted-foreground truncate">
                          {act.teacherName || 'Faculty'} · Room {act.room}
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 shrink-0 self-start sm:self-center pl-26 sm:pl-0">
                      {act.status === 'CANCELLED' ? (
                        <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-500/15 border border-amber-500/30 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider text-amber-800 dark:text-amber-200">
                          <CalendarOff size={12} /> Cancelled
                        </span>
                      ) : act.status === 'COMPLETED' || act.attendanceStatus === 'MARKED' ? (
                        <span className="inline-flex items-center gap-1.5 rounded-full bg-[#dcece2] px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider text-[#2e6e55]">
                          <CheckCircle2 size={12} /> Marked {act.markedAt && `(${act.markedAt})`}
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-500/15 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider text-amber-800 dark:text-amber-200">
                          <Clock3 size={12} /> Marking Pending
                        </span>
                      )}
                      <ChevronRight size={14} className="text-muted-foreground/40 group-hover:text-primary group-hover:translate-x-0.5 transition-all hidden sm:inline" />
                    </div>
                  </Link>
                ))}
              </div>
            )}

            <div className="mt-4 pt-3 border-t border-border/60 flex items-center justify-between text-xs text-muted-foreground">
              <span>Section schedules and logs:</span>
              <div className="flex items-center gap-2">
                <Link href="/sections/cse-34" className="font-semibold text-primary hover:underline">
                  CSE-34
                </Link>
                <span>·</span>
                <Link href="/sections/cse-35" className="font-semibold text-primary hover:underline">
                  CSE-35
                </Link>
              </div>
            </div>
          </section>
        </div>

        {/* Right Column: Pending Exemption Requests & Academic Scope */}
        <div className="space-y-4 sm:space-y-6">
          {/* Section C: Pending Exemptions (HOD Direct Review) */}
          <section
            data-testid="section-hod-exemptions"
            className="rounded-xl sm:rounded-2xl border border-border/70 bg-card p-4 sm:p-6 shadow-2xs"
          >
            <div className="mb-3.5 sm:mb-4 flex items-center justify-between">
              <div>
                <p className="text-[10px] sm:text-[11px] font-bold uppercase tracking-[.15em] text-primary">
                  HOD Decisions
                </p>
                <h2 className="mt-0.5 font-display text-xl sm:text-2xl text-foreground">
                  Pending Exemptions
                </h2>
              </div>
              <Link
                href="/requests"
                data-testid="link-view-all-exemptions"
                className="text-xs font-semibold text-primary hover:underline"
              >
                View all
              </Link>
            </div>
            <p className="text-xs text-muted-foreground -mt-2 mb-4">
              Student absence exemptions requiring Head of Department approval.
            </p>

            {exemptionsQuery.isLoading ? (
              <LoadingBlock rows={3} />
            ) : pendingExemptions.length === 0 ? (
              <div className="rounded-xl border border-dashed border-border bg-muted/20 p-5 text-center">
                <CheckCircle2 size={24} className="mx-auto text-primary" />
                <p className="mt-2 text-xs font-semibold text-foreground">No Pending Exemptions</p>
                <p className="mt-1 text-[11px] text-muted-foreground">
                  All absence exemption requests have been reviewed.
                </p>
              </div>
            ) : (
              <div className="space-y-3">
                {pendingExemptions.map((ex: Exemption) => (
                  <div
                    key={ex.id}
                    data-testid={`card-pending-exemption-${ex.id}`}
                    className="rounded-xl border border-border/70 bg-card p-3.5 sm:p-4 transition-all hover:border-primary/40 hover:shadow-xs"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <span className="text-xs font-bold text-foreground">{ex.studentName}</span>
                          <span className="rounded bg-muted px-1.5 py-0.5 text-[10px] font-mono font-semibold text-muted-foreground">
                            CSE-35
                          </span>
                        </div>
                        <span className="mt-1 inline-block text-[10px] font-bold uppercase tracking-[.12em] text-primary">
                          {ex.category.replaceAll('_', ' ')}
                        </span>
                      </div>
                      <span className="rounded-full bg-amber-500/15 px-2 py-0.5 text-[10px] font-bold uppercase text-amber-800 dark:text-amber-200">
                        Pending
                      </span>
                    </div>

                    <p className="mt-2 text-xs text-muted-foreground line-clamp-2">{ex.reason}</p>

                    <div className="mt-3 flex items-center justify-between gap-2 border-t border-border/50 pt-2.5">
                      <span className="text-[11px] text-muted-foreground font-medium">
                        {fmtDateRange(ex.startDate, ex.endDate)}
                      </span>
                      <Link
                        href="/requests"
                        data-testid={`button-review-exemption-${ex.id}`}
                        className="inline-flex items-center gap-1 rounded-lg bg-primary px-3 py-1.5 text-xs font-semibold text-primary-foreground hover:brightness-110 shadow-2xs"
                      >
                        Review <ChevronRight size={13} />
                      </Link>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </section>

          {/* Section D: Department Sections Overview Card */}
          <section
            data-testid="section-hod-scope"
            className="rounded-xl sm:rounded-2xl border border-border/70 bg-card p-4 sm:p-6 shadow-2xs"
          >
            <div className="mb-3.5 sm:mb-4 flex items-center justify-between">
              <div>
                <p className="text-[10px] sm:text-[11px] font-bold uppercase tracking-[.15em] text-primary">
                  Academic Scope
                </p>
                <h2 className="mt-0.5 font-display text-xl sm:text-2xl text-foreground">
                  Department Sections
                </h2>
              </div>
              <Building2 size={18} className="text-muted-foreground" />
            </div>

            <div className="space-y-3">
              {/* CSE-34 */}
              <Link
                href="/sections/cse-34"
                data-testid="link-section-cse-34"
                className="group rounded-xl border border-border/70 bg-muted/20 p-3 sm:p-3.5 flex items-center justify-between transition-all hover:border-primary/50 hover:bg-muted/40"
              >
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-xs sm:text-sm text-foreground group-hover:text-primary transition-colors">
                      Section CSE-34
                    </span>
                    <span className="rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-bold text-primary">
                      Semester III
                    </span>
                  </div>
                  <p className="mt-1 text-xs text-muted-foreground">
                    67 Enrolled Students · 8 Subjects · 16 Weekly Lectures
                  </p>
                </div>
                <ChevronRight size={16} className="text-muted-foreground/60 transition-transform group-hover:translate-x-1 group-hover:text-primary" />
              </Link>

              {/* CSE-35 */}
              <Link
                href="/sections/cse-35"
                data-testid="link-section-cse-35"
                className="group rounded-xl border border-border/70 bg-muted/20 p-3 sm:p-3.5 flex items-center justify-between transition-all hover:border-primary/50 hover:bg-muted/40"
              >
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-xs sm:text-sm text-foreground group-hover:text-primary transition-colors">
                      Section CSE-35
                    </span>
                    <span className="rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-bold text-primary">
                      Semester III
                    </span>
                  </div>
                  <p className="mt-1 text-xs text-muted-foreground">
                    67 Enrolled Students · 8 Subjects · 16 Weekly Lectures
                  </p>
                </div>
                <ChevronRight size={16} className="text-muted-foreground/60 transition-transform group-hover:translate-x-1 group-hover:text-primary" />
              </Link>
            </div>

            <div className="mt-4 pt-3 border-t border-border/60 text-xs text-muted-foreground leading-relaxed">
              Full section-level faculty logs and cumulative subject attendance available in dedicated sections.
            </div>
          </section>
        </div>
      </div>
    </AppShell>
  );
}
