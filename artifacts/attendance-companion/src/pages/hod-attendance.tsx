import { useState, useMemo } from 'react';
import { Link } from 'wouter';
import {
  BookOpen,
  Building2,
  CheckCircle2,
  ChevronRight,
  Filter,
  Layers,
  Sparkles,
  TrendingDown,
  TrendingUp,
  Users,
  Calendar,
  AlertCircle,
} from 'lucide-react';
import { type CurrentUser } from '@workspace/api-client-react';
import { AppShell, PageHeader, StatusPill } from '@/components/app-shell';

const pct = (n: number) => `${n.toFixed(1)}%`;

export interface CumulativeSubjectStats {
  id: string;
  code: string;
  name: string;
  type: 'THEORY' | 'LAB';
  teacher: string;
  lecturesConducted: number;
  eligibleOpportunities: number;
  presentCount: number;
  absentCount: number;
  exemptedCount: number;
  percentage: number;
  color: string;
}

export const cse34CumulativeSubjects: CumulativeSubjectStats[] = [
  {
    id: 'maths-34',
    code: '25AS301',
    name: 'Applied Mathematics',
    type: 'THEORY',
    teacher: 'Dr. Mahima Pooniya',
    lecturesConducted: 26,
    eligibleOpportunities: 1742,
    presentCount: 1132,
    absentCount: 540,
    exemptedCount: 70,
    percentage: 65.0,
    color: '#E05D52',
  },
  {
    id: 'os-34',
    code: '25CS302',
    name: 'Operating Systems',
    type: 'THEORY',
    teacher: 'Prof. Bharti Shukla',
    lecturesConducted: 24,
    eligibleOpportunities: 1608,
    presentCount: 1190,
    absentCount: 378,
    exemptedCount: 40,
    percentage: 74.0,
    color: '#D99A45',
  },
  {
    id: 'dbms-34',
    code: '25CS304',
    name: 'Database Management Systems',
    type: 'THEORY',
    teacher: 'Mr. Rajesh Kumar',
    lecturesConducted: 24,
    eligibleOpportunities: 1608,
    presentCount: 1254,
    absentCount: 314,
    exemptedCount: 40,
    percentage: 78.0,
    color: '#5B6EE1',
  },
  {
    id: 'oops-34',
    code: '25CS301',
    name: 'Object Oriented Programming',
    type: 'THEORY',
    teacher: 'Dr. Nidhi Yadav',
    lecturesConducted: 22,
    eligibleOpportunities: 1474,
    presentCount: 1164,
    absentCount: 270,
    exemptedCount: 40,
    percentage: 79.0,
    color: '#4FAF8B',
  },
  {
    id: 'dsa-34',
    code: '25CS303',
    name: 'Advanced Data Structure',
    type: 'THEORY',
    teacher: 'Ms. Malvika Gupta',
    lecturesConducted: 28,
    eligibleOpportunities: 1876,
    presentCount: 1538,
    absentCount: 298,
    exemptedCount: 40,
    percentage: 82.0,
    color: '#2F7665',
  },
  {
    id: 'python-lab-34',
    code: '25CS351',
    name: 'Python Programming Lab',
    type: 'LAB',
    teacher: 'Dr. Ankit Verma',
    lecturesConducted: 14,
    eligibleOpportunities: 938,
    presentCount: 788,
    absentCount: 130,
    exemptedCount: 20,
    percentage: 84.0,
    color: '#6B7280',
  },
  {
    id: 'os-lab-34',
    code: '25CS352',
    name: 'Operating System Lab',
    type: 'LAB',
    teacher: 'Dr. Neha Sharma',
    lecturesConducted: 14,
    eligibleOpportunities: 938,
    presentCount: 806,
    absentCount: 112,
    exemptedCount: 20,
    percentage: 85.9,
    color: '#6B7280',
  },
  {
    id: 'dsa-lab-34',
    code: '25CS353',
    name: 'Data Structure Lab',
    type: 'LAB',
    teacher: 'Ms. Malvika Gupta',
    lecturesConducted: 14,
    eligibleOpportunities: 938,
    presentCount: 816,
    absentCount: 102,
    exemptedCount: 20,
    percentage: 87.0,
    color: '#2F7665',
  },
];

export const cse35CumulativeSubjects: CumulativeSubjectStats[] = [
  {
    id: 'maths-35',
    code: '25AS301',
    name: 'Applied Mathematics',
    type: 'THEORY',
    teacher: 'Dr. Mahima Pooniya',
    lecturesConducted: 26,
    eligibleOpportunities: 1742,
    presentCount: 1236,
    absentCount: 446,
    exemptedCount: 60,
    percentage: 71.0,
    color: '#D99A45',
  },
  {
    id: 'os-35',
    code: '25CS302',
    name: 'Operating Systems',
    type: 'THEORY',
    teacher: 'Prof. Bharti Shukla',
    lecturesConducted: 24,
    eligibleOpportunities: 1608,
    presentCount: 1238,
    absentCount: 330,
    exemptedCount: 40,
    percentage: 77.0,
    color: '#5B6EE1',
  },
  {
    id: 'dbms-35',
    code: '25CS304',
    name: 'Database Management Systems',
    type: 'THEORY',
    teacher: 'Mr. Rajesh Kumar',
    lecturesConducted: 24,
    eligibleOpportunities: 1608,
    presentCount: 1302,
    absentCount: 266,
    exemptedCount: 40,
    percentage: 81.0,
    color: '#4FAF8B',
  },
  {
    id: 'oops-35',
    code: '25CS301',
    name: 'Object Oriented Programming',
    type: 'THEORY',
    teacher: 'Dr. Nidhi Yadav',
    lecturesConducted: 22,
    eligibleOpportunities: 1474,
    presentCount: 1223,
    absentCount: 211,
    exemptedCount: 40,
    percentage: 83.0,
    color: '#4FAF8B',
  },
  {
    id: 'python-lab-35',
    code: '25CS351',
    name: 'Python Programming Lab',
    type: 'LAB',
    teacher: 'Dr. Ankit Verma',
    lecturesConducted: 14,
    eligibleOpportunities: 938,
    presentCount: 806,
    absentCount: 112,
    exemptedCount: 20,
    percentage: 85.9,
    color: '#6B7280',
  },
  {
    id: 'dsa-35',
    code: '25CS303',
    name: 'Advanced Data Structure',
    type: 'THEORY',
    teacher: 'Ms. Malvika Gupta',
    lecturesConducted: 28,
    eligibleOpportunities: 1876,
    presentCount: 1613,
    absentCount: 223,
    exemptedCount: 40,
    percentage: 86.0,
    color: '#2F7665',
  },
  {
    id: 'os-lab-35',
    code: '25CS352',
    name: 'Operating System Lab',
    type: 'LAB',
    teacher: 'Dr. Neha Sharma',
    lecturesConducted: 14,
    eligibleOpportunities: 938,
    presentCount: 825,
    absentCount: 93,
    exemptedCount: 20,
    percentage: 88.0,
    color: '#6B7280',
  },
  {
    id: 'dsa-lab-35',
    code: '25CS353',
    name: 'Data Structure Lab',
    type: 'LAB',
    teacher: 'Ms. Malvika Gupta',
    lecturesConducted: 14,
    eligibleOpportunities: 938,
    presentCount: 835,
    absentCount: 83,
    exemptedCount: 20,
    percentage: 89.0,
    color: '#2F7665',
  },
];

export function HodAttendance({ user }: { user: CurrentUser }) {
  const [selectedSection, setSelectedSection] = useState<'CSE34' | 'CSE35'>('CSE34');
  const [filterType, setFilterType] = useState<'ALL' | 'THEORY' | 'LAB'>('ALL');

  const currentSubjects = selectedSection === 'CSE34' ? cse34CumulativeSubjects : cse35CumulativeSubjects;

  const filteredSubjects = useMemo(() => {
    let list = currentSubjects;
    if (filterType !== 'ALL') {
      list = list.filter((s) => s.type === filterType);
    }
    return list;
  }, [currentSubjects, filterType]);

  // Cumulative section metrics
  const totalEligible = currentSubjects.reduce((acc, s) => acc + s.eligibleOpportunities, 0);
  const totalPresent = currentSubjects.reduce((acc, s) => acc + s.presentCount, 0);
  const totalLectures = currentSubjects.reduce((acc, s) => acc + s.lecturesConducted, 0);
  const sectionPercentage = (totalPresent / totalEligible) * 100;

  const safeCount = currentSubjects.filter((s) => s.percentage >= 75).length;
  const warningCount = currentSubjects.filter((s) => s.percentage >= 70 && s.percentage < 75).length;
  const criticalCount = currentSubjects.filter((s) => s.percentage < 70).length;

  return (
    <AppShell user={user}>
      {/* -------------------------------------------------------------------- */}
      {/* 1. Header: Department Attendance Overview */}
      {/* -------------------------------------------------------------------- */}
      <PageHeader
        eyebrow="Department Attendance · Computer Science & Engineering"
        title="Cumulative Subject Attendance"
        description="Departmental attendance health aggregated across cumulative student-lecture attendance opportunities."
        action={
          <div className="flex items-center gap-1.5 rounded-xl border border-border/80 bg-card p-1 shadow-2xs">
            <button
              onClick={() => setSelectedSection('CSE34')}
              data-testid="button-select-cse34"
              className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition-all ${
                selectedSection === 'CSE34'
                  ? 'bg-primary text-primary-foreground shadow-2xs'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              Section CSE-34
            </button>
            <button
              onClick={() => setSelectedSection('CSE35')}
              data-testid="button-select-cse35"
              className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition-all ${
                selectedSection === 'CSE35'
                  ? 'bg-primary text-primary-foreground shadow-2xs'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              Section CSE-35
            </button>
          </div>
        }
      />

      {/* -------------------------------------------------------------------- */}
      {/* 2. Section Attendance Summary Bar */}
      {/* -------------------------------------------------------------------- */}
      <div className="grid grid-cols-2 gap-2.5 sm:gap-4 xl:grid-cols-4 animate-rise-in delay-1">
        {/* Metric 1: Cumulative Section Attendance */}
        <div className="rounded-xl sm:rounded-2xl border border-border/70 bg-card p-3.5 sm:p-5 shadow-2xs">
          <p className="text-[10px] sm:text-[11px] font-bold uppercase tracking-[.14em] text-muted-foreground">
            Cumulative Section Average
          </p>
          <p className="mt-2 font-mono text-2xl sm:text-3xl font-bold tracking-tight text-foreground">
            {pct(sectionPercentage)}
          </p>
          <p className="mt-1 text-[11px] sm:text-xs text-muted-foreground">
            {selectedSection === 'CSE34' ? 'CSE-34' : 'CSE-35'} · Target 75.0%
          </p>
        </div>

        {/* Metric 2: Attendance Opportunities */}
        <div className="rounded-xl sm:rounded-2xl border border-border/70 bg-card p-3.5 sm:p-5 shadow-2xs">
          <p className="text-[10px] sm:text-[11px] font-bold uppercase tracking-[.14em] text-muted-foreground">
            Attendance Opportunities
          </p>
          <p className="mt-2 font-mono text-2xl sm:text-3xl font-bold tracking-tight text-foreground">
            {totalEligible.toLocaleString()}
          </p>
          <p className="mt-1 text-[11px] sm:text-xs text-muted-foreground">
            {totalPresent.toLocaleString()} Present recorded
          </p>
        </div>

        {/* Metric 3: Total Lectures Conducted */}
        <div className="rounded-xl sm:rounded-2xl border border-border/70 bg-card p-3.5 sm:p-5 shadow-2xs">
          <p className="text-[10px] sm:text-[11px] font-bold uppercase tracking-[.14em] text-muted-foreground">
            Lectures Conducted
          </p>
          <p className="mt-2 font-mono text-2xl sm:text-3xl font-bold tracking-tight text-foreground">
            {totalLectures}
          </p>
          <p className="mt-1 text-[11px] sm:text-xs text-muted-foreground">
            Across 8 curriculum subjects
          </p>
        </div>

        {/* Metric 4: Subject Health Breakdown */}
        <div className="rounded-xl sm:rounded-2xl border border-border/70 bg-card p-3.5 sm:p-5 shadow-2xs">
          <p className="text-[10px] sm:text-[11px] font-bold uppercase tracking-[.14em] text-muted-foreground">
            Subject Risk Profile
          </p>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="font-mono text-2xl sm:text-3xl font-bold text-foreground">{safeCount}</span>
            <span className="text-xs text-muted-foreground">Safe</span>
            {warningCount > 0 && (
              <>
                <span className="font-mono text-lg font-bold text-amber-600">· {warningCount}</span>
                <span className="text-xs text-muted-foreground">Watch</span>
              </>
            )}
            {criticalCount > 0 && (
              <>
                <span className="font-mono text-lg font-bold text-destructive">· {criticalCount}</span>
                <span className="text-xs text-muted-foreground">Crit</span>
              </>
            )}
          </div>
          <p className="mt-1 text-[11px] sm:text-xs text-muted-foreground">
            {criticalCount > 0 ? 'Action needed on low attendance' : 'Health within acceptable limits'}
          </p>
        </div>
      </div>

      {/* -------------------------------------------------------------------- */}
      {/* 3. Section Switcher & Subject Type Filter */}
      {/* -------------------------------------------------------------------- */}
      <div className="mt-6 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <h2 className="font-display text-xl sm:text-2xl text-foreground">
            {selectedSection === 'CSE34' ? 'Section CSE-34' : 'Section CSE-35'} Subject Breakdown
          </h2>
          <span className="rounded-md border border-border bg-muted/60 px-2 py-0.5 text-xs font-mono font-semibold text-muted-foreground">
            67 Students
          </span>
        </div>

        {/* Filter Type Pills */}
        <div className="flex items-center gap-1.5 self-start sm:self-center">
          {(['ALL', 'THEORY', 'LAB'] as const).map((t) => (
            <button
              key={t}
              onClick={() => setFilterType(t)}
              data-testid={`button-filter-type-${t.toLowerCase()}`}
              className={`rounded-full px-3 py-1 text-xs font-semibold transition-colors ${
                filterType === t
                  ? 'bg-primary text-primary-foreground'
                  : 'border border-border bg-card text-muted-foreground hover:bg-muted'
              }`}
            >
              {t === 'ALL' ? 'All Subjects' : t === 'THEORY' ? 'Theory' : 'Labs'}
            </button>
          ))}
        </div>
      </div>

      {/* -------------------------------------------------------------------- */}
      {/* 4. Cumulative Subject Attendance Table / Cards */}
      {/* -------------------------------------------------------------------- */}
      <div className="mt-4 space-y-3">
        {filteredSubjects.map((sub) => {
          const status =
            sub.percentage >= 75 ? 'SAFE' : sub.percentage >= 70 ? 'WARNING' : 'CRITICAL';

          return (
            <div
              key={sub.id}
              data-testid={`card-subject-attendance-${sub.code}`}
              className="rounded-xl sm:rounded-2xl border border-border/70 bg-card p-4 sm:p-5 shadow-2xs transition-all hover:border-primary/40 hover:shadow-xs"
            >
              <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
                {/* Left: Subject Info */}
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-mono text-xs font-bold text-primary">{sub.code}</span>
                    <span className="rounded bg-muted px-1.5 py-0.5 text-[10px] font-bold uppercase text-muted-foreground">
                      {sub.type}
                    </span>
                    <StatusPill status={status} />
                  </div>
                  <h3 className="mt-1 text-sm sm:text-base font-semibold text-foreground">
                    {sub.name}
                  </h3>
                  <p className="mt-0.5 text-xs text-muted-foreground">
                    Faculty: <span className="font-medium text-foreground">{sub.teacher}</span> ·{' '}
                    {sub.lecturesConducted} Lectures Conducted
                  </p>
                </div>

                {/* Right: Cumulative Opportunities & Percentage */}
                <div className="flex flex-wrap items-center justify-between lg:justify-end gap-5 shrink-0 border-t border-border/50 pt-3 lg:border-t-0 lg:pt-0">
                  {/* Detailed Count Badges */}
                  <div className="grid grid-cols-3 gap-3 text-center sm:text-right">
                    <div>
                      <span className="font-mono text-xs sm:text-sm font-semibold text-foreground">
                        {sub.eligibleOpportunities.toLocaleString()}
                      </span>
                      <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Eligible</p>
                    </div>
                    <div>
                      <span className="font-mono text-xs sm:text-sm font-semibold text-[#2e6e55]">
                        {sub.presentCount.toLocaleString()}
                      </span>
                      <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Present</p>
                    </div>
                    <div>
                      <span className="font-mono text-xs sm:text-sm font-semibold text-destructive">
                        {sub.absentCount.toLocaleString()}
                      </span>
                      <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Absent</p>
                    </div>
                  </div>

                  {/* Percentage with Visual Target Bar */}
                  <div className="min-w-[140px] text-right">
                    <div className="flex items-baseline justify-end gap-1.5">
                      <span className="font-mono text-xl sm:text-2xl font-bold text-foreground">
                        {pct(sub.percentage)}
                      </span>
                    </div>

                    {/* Progress Bar with 75% target tick */}
                    <div className="relative mt-1.5 h-2 w-full overflow-hidden rounded-full bg-muted">
                      <div
                        className="absolute inset-y-0 left-0 rounded-full transition-all duration-500"
                        style={{
                          width: `${Math.min(sub.percentage, 100)}%`,
                          background:
                            sub.percentage >= 75
                              ? '#2F7665'
                              : sub.percentage >= 70
                              ? '#D99A45'
                              : '#E05D52',
                        }}
                      />
                      <div
                        className="absolute inset-y-[-2px] w-0.5 bg-foreground/50 z-10"
                        style={{ left: '75%' }}
                        title="Institutional Target: 75%"
                      />
                    </div>
                    <span className="text-[10px] text-muted-foreground font-mono">
                      {sub.percentage >= 75
                        ? `+${(sub.percentage - 75).toFixed(1)}% above line`
                        : `${(75 - sub.percentage).toFixed(1)}% below line`}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Footer Navigation Link */}
      <div className="mt-6 text-center">
        <Link
          href={`/sections/${selectedSection.toLowerCase()}`}
          data-testid="link-view-section-faculty-activity"
          className="inline-flex items-center gap-1.5 text-xs font-semibold text-primary hover:underline"
        >
          View Section {selectedSection === 'CSE34' ? 'CSE-34' : 'CSE-35'} Faculty Activity & Timetable{' '}
          <ChevronRight size={14} />
        </Link>
      </div>
    </AppShell>
  );
}
