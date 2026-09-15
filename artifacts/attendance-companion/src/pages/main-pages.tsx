import { useEffect, useMemo, useState } from 'react';
import { Link, useParams } from 'wouter';
import { useQueryClient } from '@tanstack/react-query';
import { AlertCircle, ArrowDownRight, ArrowUpRight, Calendar, Check, ChevronDown, ChevronRight, ChevronUp, CircleAlert, ClipboardCheck, Clock3, FilePlus2, FileWarning, Info, Layers, Lock, MapPin, Plus, RefreshCw, Search, Send, ShieldCheck, SlidersHorizontal, Sparkles, Target, TrendingUp, Users, X } from 'lucide-react';
import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { AppShell, Button, EmptyBlock, ErrorBlock, LoadingBlock, PageHeader, StatusPill } from '@/components/app-shell';
import { StudentTodaySchedule } from '@/components/student-today-schedule';
import { MentorTodaySchedule } from '@/components/mentor-today-schedule';
import { getMentorScheduleQueryKey, type MentorScheduledLecture } from '@/hooks/use-mentor-schedule';
import { getGetAttendanceIssuesQueryKey, getGetDashboardSummaryQueryKey, getGetExemptionsQueryKey, getGetNotificationsQueryKey, getGetSettingsQueryKey, getGetStudentQueryKey, getGetTeacherAttendanceQueryKey, getGetTeacherSectionStudentsQueryKey, useApproveExemption, useCreateAttendanceIssue, useCreateExemption, useGetAttendanceHistory, useGetAttendanceIssues, useGetAttendanceTrend, useGetDashboardSummary, useGetExemptions, useGetNotifications, useGetSettings, useGetStudent, useGetStudents, useGetTeacherAssignments, useGetTeacherAttendance, useGetTeacherSectionStudents, useMarkAllNotificationsRead, useMarkNotificationRead, useRejectAttendanceIssue, useRejectExemption, useResolveAttendanceIssue, useSubmitTeacherAttendance, useUpdateSettings, useGetSubjectAttendance } from '@workspace/api-client-react';
import { AttendanceIssueInputIssueType, ExemptionInputCategory, GetAttendanceHistoryStatus, GetAttendanceIssuesStatus, GetExemptionsStatus, GetStudentsRisk, type AttendanceIssue, type CurrentUser, type Exemption, type Settings, type Student, type SubjectAttendance } from '@workspace/api-client-react';

const fmtDate = (value: string) => new Intl.DateTimeFormat('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }).format(new Date(value));
const shortDate = (value: string) => new Intl.DateTimeFormat('en-IN', { day: 'numeric', month: 'short' }).format(new Date(value));
const pct = (n: number) => `${n.toFixed(1)}%`;
const safeArray = <T,>(value: T[] | undefined | null) => value || [];

function MetricCard({ label, value, note, tone = 'teal', icon: Icon }: { label:string; value:string|number; note:string; tone?:string; icon: typeof Target }) {
  return <div className="group relative overflow-hidden rounded-xl sm:rounded-2xl border border-card-border bg-card p-3 sm:p-5 shadow-[0_5px_18px_hsl(191_35%_17%/.04)] transition-transform hover:-translate-y-0.5"><div className={`absolute right-0 top-0 h-14 w-14 translate-x-4 -translate-y-4 sm:h-20 sm:w-20 sm:translate-x-7 sm:-translate-y-7 rounded-full ${tone === 'amber' ? 'bg-accent/40' : tone === 'rose' ? 'bg-[#f4d8cf]' : 'bg-[#d9e9df]'}`}/><div className="relative flex items-start justify-between"><p className="text-[10px] sm:text-[11px] font-bold uppercase tracking-[.12em] sm:tracking-[.15em] text-muted-foreground">{label}</p><Icon size={16} className="text-primary/70 sm:w-[18px] sm:h-[18px] shrink-0 ml-1"/></div><p data-testid={`metric-${label.toLowerCase().replaceAll(' ','-')}`} className="relative mt-2 sm:mt-5 font-mono text-2xl sm:text-3xl tracking-tight leading-none">{value}</p><p className="relative mt-1 text-[11px] sm:text-xs text-muted-foreground truncate sm:whitespace-normal">{note}</p></div>;
}

function ProgressBar({ value, target, color }: { value:number; target:number; color?:string }) { return <div className="relative h-2 w-full overflow-hidden rounded-full bg-muted"><div className="absolute inset-y-0 left-0 rounded-full transition-all duration-700" style={{width:`${Math.min(value,100)}%`, background: color || 'hsl(var(--primary))'}}/><div className="absolute inset-y-[-2px] w-px bg-foreground/40" style={{left:`${target}%`}}/></div>; }

function SubjectRow({ subject, compact=false }: { subject: SubjectAttendance; compact?: boolean }) {
  return (
    <Link
      href="/attendance"
      data-testid={`link-subject-${subject.id}`}
      className="group block rounded-xl sm:rounded-2xl border border-border/70 bg-card p-3 sm:p-4 transition-all hover:-translate-y-0.5 hover:border-primary/30 hover:shadow-md"
    >
      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-2.5 sm:gap-3">
        <div className="flex min-w-0 items-start gap-2.5 sm:gap-3">
          <span
            className="mt-0.5 grid h-8 w-8 sm:h-9 sm:w-9 shrink-0 place-items-center rounded-lg sm:rounded-xl text-[10px] font-bold"
            style={{ background: `${subject.color}22`, color: subject.color }}
          >
            {subject.code.slice(0, 2)}
          </span>
          <div className="min-w-0 flex-1">
            <p className="text-xs sm:text-sm font-semibold text-foreground break-words sm:truncate">{subject.name}</p>
            <p className="mt-0.5 text-[11px] sm:text-xs text-muted-foreground break-words sm:truncate">
              {subject.code} · {subject.teacher}
            </p>
          </div>
        </div>
        <div className="flex items-center justify-between sm:flex-col sm:items-end sm:justify-start shrink-0 pt-1.5 sm:pt-0 border-t border-border/40 sm:border-t-0">
          <div className="order-2 sm:order-1 sm:text-right">
            <p className="font-mono text-base sm:text-xl font-bold leading-none sm:leading-normal">
              {pct(subject.percentage)}
            </p>
          </div>
          <div className="order-1 sm:order-2 sm:mt-1">
            <StatusPill status={subject.status} />
          </div>
        </div>
      </div>
      <div className="mt-2.5 sm:mt-4 flex items-center gap-2.5 sm:gap-3">
        <div className="flex-1 min-w-0">
          <ProgressBar value={subject.percentage} target={subject.target} color={subject.color} />
        </div>
        <span className="shrink-0 font-mono text-[11px] sm:text-[10px] font-medium text-muted-foreground">
          {subject.present}/{subject.total}
        </span>
      </div>
      {!compact && (
        <p className="mt-1.5 sm:mt-2 text-[10px] sm:text-[11px] text-muted-foreground">
          {subject.percentage >= subject.target
            ? `${(subject.percentage - subject.target).toFixed(1)} points above target`
            : `${(subject.target - subject.percentage).toFixed(1)} points to target`}
        </p>
      )}
    </Link>
  );
}

function Dashboard({ user }: { user: CurrentUser }) {
  const query = useGetDashboardSummary();
  const data = query.data;
  if (query.isLoading) return <AppShell user={user}><PageHeader title="Good to see you." description="Pulling together your attendance picture."/><LoadingBlock rows={5}/></AppShell>;
  if (query.isError || !data) return <AppShell user={user}><ErrorBlock retry={() => query.refetch()}/></AppShell>;
  return <AppShell user={user}><PageHeader eyebrow={`${new Intl.DateTimeFormat('en-IN',{weekday:'long',day:'numeric',month:'long'}).format(new Date())}`} title={user.role === 'STUDENT' ? `Good morning, ${user.name.split(' ')[0]}.` : 'Good morning.'} description={user.role === 'STUDENT' ? 'Here is the clearest view of where your attendance stands.' : 'A quick read on the students who need your attention.'} action={<Link href="/attendance" data-testid="link-view-attendance" className="inline-flex items-center gap-1.5 sm:gap-2 rounded-xl border border-border bg-card px-3.5 sm:px-4 py-2 sm:py-2.5 text-xs sm:text-[13px] font-semibold hover:border-primary/40 hover:bg-secondary">View full attendance <ChevronRight size={15}/></Link>}/><div className="grid grid-cols-2 gap-2.5 sm:gap-4 xl:grid-cols-4 animate-rise-in delay-1"><MetricCard label="Overall attendance" value={pct(data.overall.percentage)} note={`${data.overall.present} of ${data.overall.total} classes present`} icon={Target}/><MetricCard label="Safe subjects" value={`${data.subjects.filter(s=>s.status==='SAFE').length}/${data.subjects.length}`} note="At or above your target" icon={ShieldCheck}/><MetricCard label="Need attention" value={data.subjects.filter(s=>s.status!=='SAFE').length} note="Subjects below target" tone="amber" icon={CircleAlert}/><MetricCard label="Open actions" value={data.pendingRequests + data.openIssues} note={`${data.pendingRequests} requests · ${data.openIssues} issues`} tone="rose" icon={FilePlus2}/></div>{user.role === 'STUDENT' && <StudentTodaySchedule />}<div className="mt-4 sm:mt-6 grid gap-4 sm:gap-6 xl:grid-cols-[1.35fr_.65fr]"><section className="rounded-xl sm:rounded-2xl border border-border/70 bg-card p-4 sm:p-6"><div className="mb-3.5 sm:mb-5 flex items-end justify-between"><div><p className="text-[10px] sm:text-[11px] font-bold uppercase tracking-[.15em] text-primary">Subject pulse</p><h2 className="mt-0.5 sm:mt-1 font-display text-xl sm:text-2xl">Your classes, at a glance</h2></div><Link href="/attendance" data-testid="link-subject-pulse" className="text-xs font-semibold text-primary hover:underline">See all</Link></div><div className="grid gap-2.5 sm:gap-3 sm:grid-cols-2">{data.subjects.slice(0,4).map((s)=><SubjectRow key={s.id} subject={s} compact/>)}</div></section><section className="relative overflow-hidden rounded-xl sm:rounded-2xl bg-primary p-4 sm:p-6 text-primary-foreground"><div className="absolute -right-12 -top-12 h-32 w-32 sm:h-40 sm:w-40 rounded-full border-[16px] sm:border-[20px] border-accent/20"/><Sparkles size={18} className="text-accent sm:w-5 sm:h-5"/><p className="mt-2 sm:mt-5 text-[10px] sm:text-[11px] font-bold uppercase tracking-[.15em] text-primary-foreground/60">A useful read</p><h2 data-testid="text-dashboard-insight" className="mt-1.5 sm:mt-2 font-display text-lg sm:text-[27px] leading-snug sm:leading-tight">{data.insight.headline}</h2><p className="mt-2 sm:mt-3 text-xs sm:text-sm leading-relaxed sm:leading-6 text-primary-foreground/75">{data.insight.detail}</p><div className="mt-3.5 sm:mt-7 grid grid-cols-2 gap-2.5 sm:gap-3 border-t border-primary-foreground/15 pt-3 sm:pt-4"><div><p className="font-mono text-xl sm:text-2xl text-accent">{data.insight.classesToTarget}</p><p className="text-[10px] sm:text-[11px] text-primary-foreground/60">classes to target</p></div><div><p className="font-mono text-xl sm:text-2xl">{data.insight.canMiss}</p><p className="text-[10px] sm:text-[11px] text-primary-foreground/60">classes you can miss</p></div></div><Link href="/insights" data-testid="link-read-insights" className="mt-3.5 sm:mt-6 inline-flex items-center gap-1.5 sm:gap-2 text-xs font-bold text-accent hover:underline">Read the full insight <ArrowUpRight size={14}/></Link></section></div><div className="mt-4 sm:mt-6 grid gap-4 sm:gap-6 xl:grid-cols-[.9fr_1.1fr]"><section className="rounded-xl sm:rounded-2xl border border-border/70 bg-card p-4 sm:p-6"><div className="mb-3.5 sm:mb-5 flex items-center justify-between"><div><p className="text-[10px] sm:text-[11px] font-bold uppercase tracking-[.15em] text-primary">Next steps</p><h2 className="mt-0.5 sm:mt-1 font-display text-xl sm:text-2xl">Keep things moving</h2></div><Clock3 size={18} className="text-muted-foreground sm:w-[19px] sm:h-[19px]"/></div><div className="space-y-1">{data.pendingRequests > 0 && <Link href="/requests" data-testid="link-pending-requests" className="flex items-center gap-2.5 sm:gap-3 rounded-xl p-2.5 sm:p-3 hover:bg-muted"><span className="grid h-8 w-8 place-items-center rounded-lg bg-accent/40 shrink-0"><ClipboardCheck size={15}/></span><span className="flex-1 min-w-0 text-xs sm:text-sm font-medium">Review your exemption requests<p className="text-[11px] sm:text-xs text-muted-foreground font-normal truncate">{data.pendingRequests} awaiting a decision</p></span><ChevronRight size={16} className="text-muted-foreground shrink-0"/></Link>}{data.openIssues > 0 && <Link href="/issues" data-testid="link-open-issues" className="flex items-center gap-2.5 sm:gap-3 rounded-xl p-2.5 sm:p-3 hover:bg-muted"><span className="grid h-8 w-8 place-items-center rounded-lg bg-[#f4d8cf] shrink-0"><FileWarningIcon/></span><span className="flex-1 min-w-0 text-xs sm:text-sm font-medium">Check attendance issues<p className="text-[11px] sm:text-xs text-muted-foreground font-normal truncate">{data.openIssues} need a follow-up</p></span><ChevronRight size={16} className="text-muted-foreground shrink-0"/></Link>}<Link href="/insights" data-testid="link-weekly-insights" className="flex items-center gap-2.5 sm:gap-3 rounded-xl p-2.5 sm:p-3 hover:bg-muted"><span className="grid h-8 w-8 place-items-center rounded-lg bg-[#d9e9df] shrink-0"><TrendingUp size={15}/></span><span className="flex-1 min-w-0 text-xs sm:text-sm font-medium">See your attendance trend<p className="text-[11px] sm:text-xs text-muted-foreground font-normal truncate">Find the classes shaping your average</p></span><ChevronRight size={16} className="text-muted-foreground shrink-0"/></Link></div></section><section className="rounded-xl sm:rounded-2xl border border-border/70 bg-card p-4 sm:p-6"><div className="mb-3.5 sm:mb-4 flex items-center justify-between"><div><p className="text-[10px] sm:text-[11px] font-bold uppercase tracking-[.15em] text-primary">Recent activity</p><h2 className="mt-0.5 sm:mt-1 font-display text-xl sm:text-2xl">The paper trail</h2></div><Link href="/notifications" data-testid="link-all-activity" className="text-xs font-semibold text-primary hover:underline">All activity</Link></div><div className="space-y-0">{safeArray(data.recentActivity).slice(0,4).map((a,i)=><div key={a.id} data-testid={`activity-${a.id}`} className="flex gap-2.5 sm:gap-3 border-b border-border/60 py-2.5 sm:py-3 last:border-0"><span className={`mt-1.5 h-2 w-2 shrink-0 rounded-full ${a.type==='ISSUE'?'bg-destructive':a.type==='WARNING'?'bg-accent':'bg-primary'}`}/><div className="min-w-0 flex-1"><p className="text-xs sm:text-sm font-medium leading-snug">{a.title}</p><p className="mt-0.5 truncate text-[11px] sm:text-xs text-muted-foreground">{a.description}</p></div><span className="shrink-0 text-[10px] text-muted-foreground">{a.time}</span></div>)}</div></section></div></AppShell>;
}
function FileWarningIcon(){return <FileWarning size={15}/>}

function Attendance({ user }: { user: CurrentUser }) {
  const [subject, setSubject] = useState(''); const [status, setStatus] = useState('');
  const subjectQuery = useGetSubjectAttendance(); const subjects = safeArray(subjectQuery.data);
  const params = useMemo(() => ({ subject: subject || undefined, status: status ? status as GetAttendanceHistoryStatus : undefined, page: 1, pageSize: 50 }), [subject,status]);
  const history = useGetAttendanceHistory(params); const records = history.data?.items || [];
  return <AppShell user={user}><PageHeader eyebrow="Attendance" title="Know where you stand." description="A transparent view of every subject and every marked class. Your target is the line, not a judgment." action={<Link href="/issues" data-testid="link-report-from-attendance" className="inline-flex items-center gap-1.5 sm:gap-2 rounded-xl bg-primary px-3.5 sm:px-4 py-2 sm:py-2.5 text-xs sm:text-[13px] font-semibold text-primary-foreground hover:brightness-110"><FilePlus2 size={15}/> Report a discrepancy</Link>}/><div className="mb-4 sm:mb-6 flex gap-1.5 sm:gap-2 overflow-x-auto pb-1 scrollbar-none">{['All subjects', ...subjects.map(s=>s.code)].map((item,i)=><button key={item} onClick={()=>setSubject(i===0?'':subjects[i-1]?.id || '')} data-testid={`button-filter-subject-${i}`} className={`whitespace-nowrap rounded-full border px-3 sm:px-3.5 py-1.5 sm:py-2 text-[11px] sm:text-xs font-semibold transition-colors ${(!subject&&i===0)||(subject&&item===subjects.find(s=>s.id===subject)?.code) ? 'border-primary bg-primary text-primary-foreground' : 'border-border bg-card text-muted-foreground hover:bg-muted'}`}>{item}</button>)}</div><div className="grid gap-3 sm:gap-4 md:grid-cols-2">{subjectQuery.isLoading ? <LoadingBlock rows={4}/> : subjects.map(s=><SubjectRow key={s.id} subject={s}/>)}</div><section className="mt-5 sm:mt-7 rounded-xl sm:rounded-2xl border border-border/70 bg-card p-4 sm:p-6"><div className="mb-4 sm:mb-5 flex flex-col gap-3 sm:gap-4 md:flex-row md:items-end md:justify-between"><div><p className="text-[10px] sm:text-[11px] font-bold uppercase tracking-[.15em] text-primary">Date-wise history</p><h2 className="mt-0.5 sm:mt-1 font-display text-xl sm:text-2xl">What was marked</h2></div><div className="flex flex-wrap items-center gap-2"><select value={status} onChange={e=>setStatus(e.target.value)} data-testid="select-history-status" className="rounded-xl border border-input bg-background px-3 py-1.5 sm:py-2 text-xs outline-none focus:ring-2 focus:ring-ring"><option value="">Every status</option><option value="PRESENT">Present</option><option value="ABSENT">Absent</option><option value="LATE">Late</option><option value="EXEMPTED">Exempted</option></select><Button variant="ghost" onClick={()=>{setSubject('');setStatus('')}} testId="button-clear-filters" className="px-2.5 py-1.5 text-xs"><X size={14}/> Clear</Button></div></div>{history.isLoading ? <LoadingBlock rows={5}/> : history.isError ? <ErrorBlock retry={()=>history.refetch()}/> : records.length === 0 ? <EmptyBlock title="No classes match that filter" detail="Try widening the filters to see more of your attendance history."/> : <>
    {/* Mobile History View (<sm) */}
    <div className="sm:hidden divide-y divide-border/60">
      {records.map((r, i) => (
        <div key={`${r.date}-${r.subjectId}-${i}`} data-testid={`row-attendance-${i}`} className="py-3 first:pt-0 last:pb-0">
          <div className="flex items-center justify-between gap-2">
            <span className="font-mono text-xs font-semibold text-muted-foreground">{fmtDate(r.date)}</span>
            <StatusPill status={r.status} />
          </div>
          <div className="mt-1.5 min-w-0">
            <p className="text-xs font-semibold text-foreground leading-snug">{r.subjectName}</p>
            <p className="mt-0.5 font-mono text-[11px] text-muted-foreground">{r.subjectCode}</p>
          </div>
          {r.detail && <p className="mt-1 text-xs text-muted-foreground/90 leading-relaxed">{r.detail}</p>}
        </div>
      ))}
    </div>

    {/* Desktop History Table (sm+) */}
    <div className="hidden sm:block overflow-x-auto">
      <table className="w-full min-w-[630px] text-left">
        <thead>
          <tr className="border-b border-border text-[10px] font-bold uppercase tracking-[.15em] text-muted-foreground">
            <th className="pb-3">Date</th><th className="pb-3">Subject</th><th className="pb-3">Mark</th><th className="pb-3">Details</th>
          </tr>
        </thead>
        <tbody>
          {records.map((r, i) => (
            <tr key={`${r.date}-${r.subjectId}-${i}`} data-testid={`row-attendance-desktop-${i}`} className="border-b border-border/60 last:border-0">
              <td className="py-3 sm:py-3.5 font-mono text-xs whitespace-nowrap">{fmtDate(r.date)}</td>
              <td className="py-3 sm:py-3.5 pr-2"><p className="text-xs sm:text-sm font-semibold">{r.subjectName}</p><p className="text-[11px] text-muted-foreground">{r.subjectCode}</p></td>
              <td className="py-3 sm:py-3.5 whitespace-nowrap"><StatusPill status={r.status}/></td>
              <td className="py-3 sm:py-3.5 text-xs text-muted-foreground">{r.detail}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  </>}</section></AppShell>;
}

export function TeacherAttendance({ user }: { user: CurrentUser }) {
  const queryClient = useQueryClient();
  const assignmentsQuery = useGetTeacherAssignments();
  const assignments = safeArray(assignmentsQuery.data);

  // Selected schedule date (defaults to today)
  const [date, setDate] = useState(() => new Date().toISOString().slice(0, 10));

  // Selected scheduled lecture from timetable
  const [selectedLecture, setSelectedLecture] = useState<MentorScheduledLecture | null>(null);

  // Manual fallback controls
  const [showManualFallback, setShowManualFallback] = useState(false);
  const [manualAssignmentKey, setManualAssignmentKey] = useState('');

  const [marks, setMarks] = useState<Record<string, 'PRESENT' | 'ABSENT'>>({});
  const [message, setMessage] = useState('');

  // Fallback assignment when manually chosen
  const manualSelected = assignments.find(item => `${item.subjectId}:${item.sectionId}` === manualAssignmentKey) ?? assignments[0];

  const activeSubjectId = selectedLecture ? (selectedLecture.subjectId ?? '') : (manualSelected?.subjectId ?? '');
  const activeSectionId = selectedLecture ? selectedLecture.sectionId : (manualSelected?.sectionId ?? '');
  const activeTimetableEntryId = selectedLecture ? selectedLecture.timetableEntryId : undefined;
  const activeLectureInstanceId = selectedLecture?.lectureInstanceId ?? undefined;

  const rosterParams: any = { subjectId: activeSubjectId };
  if (activeTimetableEntryId) {
    rosterParams.timetableEntryId = activeTimetableEntryId;
  }

  const attendanceParams: any = {
    subjectId: activeSubjectId,
    sectionId: activeSectionId,
    date,
  };
  if (activeTimetableEntryId) {
    attendanceParams.timetableEntryId = activeTimetableEntryId;
  }
  if (activeLectureInstanceId) {
    attendanceParams.lectureInstanceId = activeLectureInstanceId;
  }
  const isEnabled = Boolean(activeSubjectId && activeSectionId);

  const roster = useGetTeacherSectionStudents(
    activeSectionId,
    rosterParams,
    { query: { enabled: isEnabled, queryKey: ['/api/teacher/sections', activeSectionId, 'students', rosterParams] } }
  );

  const existing = useGetTeacherAttendance(
    attendanceParams,
    {
      query: {
        enabled: isEnabled,
        queryKey: [
          '/api/teacher/attendance',
          {
            subjectId: activeSubjectId,
            sectionId: activeSectionId,
            date,
            timetableEntryId: activeTimetableEntryId,
            lectureInstanceId: activeLectureInstanceId,
          }
        ]
      }
    }
  );

  const save = useSubmitTeacherAttendance();

  useEffect(() => {
    if (!roster.data || roster.isError || !existing.data || existing.isError) {
      setMarks({});
      return;
    }
    const recorded = new Map((existing.data ?? []).map(item => [item.studentId, item.status]));
    setMarks(Object.fromEntries(roster.data.map(student => [student.id, recorded.get(student.id) ?? 'PRESENT'])));
  }, [roster.data, roster.isError, existing.data, existing.isError]);

  const handleDateChange = (newDate: string) => {
    setDate(newDate);
    setMessage('');
    setSelectedLecture(null);
    setMarks({});
  };

  const handleSelectLecture = (lecture: MentorScheduledLecture) => {
    setSelectedLecture(lecture);
    setShowManualFallback(false);
    setMessage('');
    setMarks({});
  };

  const isLectureCancelled = Boolean(selectedLecture && selectedLecture.status === 'CANCELLED');
  const isLectureLocked = selectedLecture ? selectedLecture.classState === 'UPCOMING' : false;
  const isAttendanceSubmitted = Boolean(
    (selectedLecture && selectedLecture.attendanceStatus === 'ATTENDANCE_MARKED') ||
    (existing.data && existing.data.length > 0)
  );
  const isAttendanceBlocked = isLectureCancelled || isLectureLocked || isAttendanceSubmitted || roster.isLoading || existing.isLoading || roster.isError || existing.isError;

  const students = safeArray(roster.data);
  const present = roster.data && !roster.isError && existing.data && !existing.isError
    ? students.filter(student => (marks[student.id] ?? 'PRESENT') === 'PRESENT').length
    : 0;

  const toggle = (studentId: string) => {
    if (isAttendanceBlocked) return;
    setMarks(current => ({
      ...current,
      [studentId]: current[studentId] === 'ABSENT' ? 'PRESENT' : 'ABSENT'
    }));
  };

  const markAllPresent = () => {
    if (isAttendanceBlocked || !students.length) return;
    setMarks(Object.fromEntries(students.map(student => [student.id, 'PRESENT'])) as Record<string, 'PRESENT' | 'ABSENT'>);
  };

  const submit = () => {
    if (!activeSubjectId || !activeSectionId || !roster.data?.length || isAttendanceBlocked) return;
    setMessage('');

    const payload: any = {
      subjectId: activeSubjectId,
      sectionId: activeSectionId,
      date,
      attendance: roster.data.map(student => ({
        studentId: student.id,
        status: marks[student.id] ?? 'PRESENT'
      })),
    };

    if (activeTimetableEntryId) {
      payload.timetableEntryId = activeTimetableEntryId;
    }
    if (activeLectureInstanceId) {
      payload.lectureInstanceId = activeLectureInstanceId;
    }

    save.mutate({ data: payload }, {
      onSuccess: () => {
        setMessage('Attendance saved. Student records now reflect these marks.');
        if (selectedLecture) {
          setSelectedLecture(prev => prev ? { ...prev, attendanceStatus: 'ATTENDANCE_MARKED' } : null);
        }
        queryClient.invalidateQueries({ queryKey: getMentorScheduleQueryKey(date) });
        queryClient.invalidateQueries({ queryKey: getMentorScheduleQueryKey() });
        queryClient.invalidateQueries({ queryKey: ['/api/student/schedule/today'] });
        queryClient.invalidateQueries({ queryKey: ['/api/teacher/attendance'] });
        queryClient.invalidateQueries({ queryKey: ['/api/teacher/sections', activeSectionId, 'students'] });
      },
      onError: (err: any) => {
        setMessage(err?.message || 'We could not save attendance. Please check the selection and try again.');
      },
    });
  };

  return (
    <AppShell user={user}>
      <PageHeader
        eyebrow="Teaching workspace"
        title="Today’s Schedule & Attendance"
        description="Select any scheduled lecture from your timetable to review batch enrollments and record attendance."
        action={
          <Button
            onClick={markAllPresent}
            disabled={!students.length || isAttendanceBlocked}
            testId="button-mark-all-present"
          >
            <Check size={16} /> Mark all present
          </Button>
        }
      />

      {/* 1. Timetable-driven Mentor Schedule */}
      <MentorTodaySchedule
        selectedDate={date}
        onDateChange={handleDateChange}
        selectedLectureId={selectedLecture?.timetableEntryId ?? null}
        onSelectLecture={handleSelectLecture}
      />

      {/* 2. Manual Assignment Fallback (Preserves legacy capability with verified authorization) */}
      <div className="mt-5">
        <button
          type="button"
          onClick={() => setShowManualFallback(prev => !prev)}
          data-testid="button-toggle-manual-fallback"
          className="flex items-center gap-2 text-xs font-semibold text-muted-foreground hover:text-foreground transition-colors"
        >
          {showManualFallback ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
          <span>Manual Class Selector (Fallback)</span>
        </button>

        {showManualFallback && (
          <section className="mt-3 rounded-2xl border border-border/70 bg-card p-4 sm:p-6 animate-rise-in">
            <div className="grid gap-4 md:grid-cols-2">
              <Field label="Assigned class">
                <select
                  value={manualAssignmentKey || (manualSelected ? `${manualSelected.subjectId}:${manualSelected.sectionId}` : '')}
                  onChange={event => {
                    setManualAssignmentKey(event.target.value);
                    setSelectedLecture(null);
                    setMarks({});
                    setMessage('');
                  }}
                  data-testid="select-teacher-assignment"
                  className={inputClass}
                >
                  {assignments.map(item => (
                    <option key={`${item.subjectId}:${item.sectionId}`} value={`${item.subjectId}:${item.sectionId}`}>
                      {item.subjectCode} · {item.subjectName} — {item.sectionCode}
                    </option>
                  ))}
                </select>
              </Field>
              <Field label="Attendance date">
                <input
                  type="date"
                  value={date}
                  onChange={event => {
                    handleDateChange(event.target.value);
                  }}
                  data-testid="input-teacher-attendance-date"
                  className={inputClass}
                />
              </Field>
            </div>
          </section>
        )}
      </div>

      {/* 3. Selected Lecture / Roster Section */}
      <section className="mt-5 rounded-2xl border border-border/70 bg-card p-4 sm:p-6 shadow-[0_5px_18px_hsl(191_35%_17%/.03)]">
        {selectedLecture ? (
          <div>
            {/* Lecture Details Bar */}
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between rounded-xl bg-secondary/50 border border-border/60 p-4">
              <div className="space-y-1">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-semibold text-foreground text-sm sm:text-base">
                    {selectedLecture.subjectName}
                  </span>
                  <span className="font-mono text-xs font-medium px-2 py-0.5 rounded-md bg-background border border-border/70">
                    {selectedLecture.subjectCode}
                  </span>
                  <span className="text-xs font-semibold px-2 py-0.5 rounded-md bg-accent/25 text-accent-foreground border border-accent/40">
                    Section {selectedLecture.section}
                  </span>
                  {selectedLecture.batchType !== 'ALL' && (
                    <span className="text-xs font-semibold px-2 py-0.5 rounded-md bg-primary/10 text-primary border border-primary/30">
                      Batch {selectedLecture.batch}
                    </span>
                  )}
                </div>
                <p className="text-xs text-muted-foreground flex flex-wrap items-center gap-3 pt-0.5">
                  <span>Room {selectedLecture.room}</span>
                  <span>·</span>
                  <span>{selectedLecture.startTime} – {selectedLecture.endTime}</span>
                  <span>·</span>
                  <span className="uppercase">{selectedLecture.lectureType}</span>
                </p>
              </div>

              <div className="flex items-center gap-3 self-start sm:self-center">
                {roster.isLoading || existing.isLoading ? (
                  <span className="font-mono text-xs sm:text-sm text-muted-foreground px-3 py-1 rounded-xl bg-background border border-border/70">
                    {roster.isLoading ? 'Loading roster…' : 'Loading attendance…'}
                  </span>
                ) : roster.isError ? (
                  <span className="font-mono text-xs sm:text-sm text-destructive font-semibold px-3 py-1 rounded-xl bg-destructive/10 border border-destructive/30">
                    Roster unavailable
                  </span>
                ) : existing.isError ? (
                  <span
                    data-testid="badge-existing-attendance-error"
                    className="font-mono text-xs sm:text-sm text-destructive font-semibold px-3 py-1 rounded-xl bg-destructive/10 border border-destructive/30"
                  >
                    Attendance unavailable
                  </span>
                ) : (
                  <span className="font-mono text-xs sm:text-sm font-semibold px-3 py-1 rounded-xl bg-background border border-border/70">
                    {present}/{students.length} present
                  </span>
                )}
              </div>
            </div>

            {/* Unexpected Holiday / Cancelled Banner */}
            {isLectureCancelled && (
              <div
                data-testid="banner-lecture-cancelled"
                className="mt-4 flex items-start gap-3 rounded-xl border border-amber-500/40 bg-amber-500/15 p-4 text-amber-950 dark:text-amber-100"
              >
                <AlertCircle size={18} className="shrink-0 mt-0.5 text-amber-600 dark:text-amber-400" />
                <div className="text-xs space-y-1">
                  <p className="font-bold uppercase tracking-wide">Lecture Cancelled (Unexpected Holiday)</p>
                  <p className="opacity-90">
                    {selectedLecture.notes || 'This lecture has been cancelled by an administrative order. Attendance marking is disabled.'}
                  </p>
                </div>
              </div>
            )}

            {/* Start Time Restriction Banner */}
            {isLectureLocked && !isLectureCancelled && (
              <div
                data-testid="banner-lecture-not-started"
                className="mt-4 flex items-start gap-3 rounded-xl border border-amber-500/30 bg-amber-500/10 p-4 text-amber-900 dark:text-amber-300"
              >
                <Clock3 size={18} className="shrink-0 mt-0.5" />
                <div className="text-xs space-y-1">
                  <p className="font-bold">Lecture has not started</p>
                  <p className="opacity-90">
                    Attendance controls are disabled until the scheduled lecture start time ({selectedLecture.startTime}). Once the start time is reached, marking will become available.
                  </p>
                </div>
              </div>
            )}

            {/* Attendance Locked Banner */}
            {isAttendanceSubmitted && (
              <div
                data-testid="banner-attendance-locked"
                className="mt-4 flex items-start gap-3 rounded-xl border border-primary/30 bg-primary/10 p-4 text-primary"
              >
                <Lock size={18} className="shrink-0 mt-0.5" />
                <div className="text-xs space-y-1">
                  <p className="font-bold flex items-center gap-1.5">
                    Attendance Locked 🔒
                  </p>
                  <p className="opacity-90">
                    Attendance for this lecture has already been submitted and cannot be changed.
                    {existing.data?.[0]?.markedAt && (
                      <span className="block mt-0.5 text-[11px] opacity-75">
                        Submitted at {new Date(existing.data[0].markedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </span>
                    )}
                  </p>
                </div>
              </div>
            )}

            {/* Roster Header */}
            <div className="mt-6 mb-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
              <div>
                <p className="text-[11px] font-bold uppercase tracking-[.15em] text-primary">Class Roster</p>
                <h2 className="mt-1 font-display text-xl sm:text-2xl">
                  {isAttendanceSubmitted
                    ? 'Enrolled Students (Attendance Locked 🔒)'
                    : isLectureLocked
                    ? 'Enrolled Students (Read Only)'
                    : 'Tap a student to toggle attendance'}
                </h2>
              </div>
              <Button
                onClick={markAllPresent}
                disabled={!students.length || isAttendanceBlocked}
                testId="button-roster-mark-all-present"
              >
                <Check size={16} /> Mark all present
              </Button>
            </div>

            {/* Student List */}
            {roster.isLoading || existing.isLoading ? (
              <LoadingBlock rows={6} />
            ) : roster.isError ? (
              <ErrorBlock retry={() => roster.refetch()} />
            ) : existing.isError ? (
              <div
                data-testid="block-existing-attendance-error"
                className="rounded-2xl border border-destructive/30 bg-destructive/5 p-8 text-center"
              >
                <AlertCircle size={32} className="mx-auto text-destructive" />
                <h3 className="mt-3 font-display text-lg text-destructive">Existing attendance could not be loaded.</h3>
                <p className="mt-1 max-w-md mx-auto text-xs text-muted-foreground leading-relaxed">
                  We could not verify recorded attendance for this lecture. To prevent overwriting existing data with default marks, attendance controls have been locked.
                </p>
                <Button
                  onClick={() => existing.refetch()}
                  variant="secondary"
                  className="mt-4"
                  testId="button-retry-existing-attendance"
                >
                  <RefreshCw size={13} className="mr-1.5" /> Retry
                </Button>
              </div>
            ) : students.length === 0 ? (
              <EmptyBlock
                title="No students enrolled in this batch"
                detail="There are no students assigned to this section and batch combination in the database."
              />
            ) : (
              <div className="grid gap-2 sm:gap-2.5">
                {students.map((student) => {
                  const status = marks[student.id] ?? 'PRESENT';
                  const isPresent = status === 'PRESENT';
                  return (
                    <div
                      key={student.id}
                      data-testid={`row-student-${student.id}`}
                      className={`flex flex-col sm:flex-row sm:items-center justify-between gap-3 rounded-xl border p-3 sm:p-4 transition-colors ${
                        isPresent
                          ? 'border-primary/25 bg-secondary/35 hover:border-primary/50'
                          : 'border-destructive/30 bg-destructive/5 hover:border-destructive/50'
                      }`}
                    >
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-mono text-xs font-bold px-2 py-0.5 rounded-md bg-background border border-border/70 text-foreground">
                            {student.rollNo}
                          </span>
                          <strong className="text-sm font-semibold text-foreground truncate">
                            {student.name}
                          </strong>
                        </div>
                        <span className="mt-1 block text-xs text-muted-foreground font-mono">
                          {student.admissionNo}
                        </span>
                      </div>

                      <div className="flex items-center gap-2 self-end sm:self-center shrink-0">
                        <StatusPill status={status} />
                        <button
                          type="button"
                          disabled={isAttendanceBlocked}
                          onClick={() => toggle(student.id)}
                          data-testid={`button-attendance-${student.id}`}
                          className={`inline-flex items-center justify-center gap-1.5 rounded-xl px-3.5 py-2 text-xs font-semibold transition-all ${
                            isAttendanceBlocked
                              ? 'opacity-50 cursor-not-allowed bg-muted text-muted-foreground'
                              : isPresent
                              ? 'border border-destructive/30 text-destructive hover:bg-destructive/10'
                              : 'bg-primary text-primary-foreground hover:brightness-110 shadow-xs'
                          }`}
                        >
                          {isAttendanceSubmitted ? <Lock size={12} /> : isPresent ? <X size={13} /> : <Check size={13} />}
                          {isAttendanceSubmitted ? (isPresent ? 'Present (Locked)' : 'Absent (Locked)') : isPresent ? 'Mark Absent' : 'Mark Present'}
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        ) : manualSelected ? (
          <div>
            <div className="mb-4">
              <p className="text-[11px] font-bold uppercase tracking-[.15em] text-primary">Manual Class Roster</p>
              <h2 className="mt-1 font-display text-xl sm:text-2xl">
                {manualSelected.subjectName} · {manualSelected.sectionCode}
              </h2>
            </div>
            {roster.isLoading || existing.isLoading ? (
              <LoadingBlock rows={6} />
            ) : roster.isError ? (
              <ErrorBlock retry={() => roster.refetch()} />
            ) : existing.isError ? (
              <div
                data-testid="block-existing-attendance-error-manual"
                className="rounded-2xl border border-destructive/30 bg-destructive/5 p-8 text-center"
              >
                <AlertCircle size={32} className="mx-auto text-destructive" />
                <h3 className="mt-3 font-display text-lg text-destructive">Existing attendance could not be loaded.</h3>
                <p className="mt-1 max-w-md mx-auto text-xs text-muted-foreground leading-relaxed">
                  We could not verify recorded attendance for this class. To prevent overwriting existing data with default marks, attendance controls have been locked.
                </p>
                <Button
                  onClick={() => existing.refetch()}
                  variant="secondary"
                  className="mt-4"
                  testId="button-retry-existing-attendance-manual"
                >
                  <RefreshCw size={13} className="mr-1.5" /> Retry
                </Button>
              </div>
            ) : students.length === 0 ? (
              <EmptyBlock title="No students found" detail="No students found for this section." />
            ) : (
              <div className="grid gap-2 sm:gap-2.5">
                {students.map((student) => {
                  const status = marks[student.id] ?? 'PRESENT';
                  const isPresent = status === 'PRESENT';
                  return (
                    <div
                      key={student.id}
                      data-testid={`row-student-${student.id}`}
                      className={`flex flex-col sm:flex-row sm:items-center justify-between gap-3 rounded-xl border p-3 sm:p-4 transition-colors ${
                        isPresent
                          ? 'border-primary/25 bg-secondary/35 hover:border-primary/50'
                          : 'border-destructive/30 bg-destructive/5 hover:border-destructive/50'
                      }`}
                    >
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-mono text-xs font-bold px-2 py-0.5 rounded-md bg-background border border-border/70 text-foreground">
                            {student.rollNo}
                          </span>
                          <strong className="text-sm font-semibold text-foreground truncate">
                            {student.name}
                          </strong>
                        </div>
                        <span className="mt-1 block text-xs text-muted-foreground font-mono">
                          {student.admissionNo}
                        </span>
                      </div>

                      <div className="flex items-center gap-2 self-end sm:self-center shrink-0">
                        <StatusPill status={status} />
                        <button
                          type="button"
                          disabled={isAttendanceBlocked}
                          onClick={() => toggle(student.id)}
                          data-testid={`button-attendance-${student.id}`}
                          className={`inline-flex items-center justify-center gap-1.5 rounded-xl px-3.5 py-2 text-xs font-semibold transition-all ${
                            isAttendanceBlocked
                              ? 'opacity-50 cursor-not-allowed bg-muted text-muted-foreground'
                              : isPresent
                              ? 'border border-destructive/30 text-destructive hover:bg-destructive/10'
                              : 'bg-primary text-primary-foreground hover:brightness-110 shadow-xs'
                          }`}
                        >
                          {isAttendanceSubmitted ? <Lock size={12} /> : isPresent ? <X size={13} /> : <Check size={13} />}
                          {isAttendanceSubmitted ? (isPresent ? 'Present (Locked)' : 'Absent (Locked)') : isPresent ? 'Mark Absent' : 'Mark Present'}
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        ) : (
          <div
            data-testid="block-mentor-no-lecture-selected"
            className="rounded-2xl border border-dashed border-border/80 bg-muted/20 p-8 text-center"
          >
            <Calendar size={32} className="mx-auto text-muted-foreground/60" />
            <h3 className="mt-3 font-display text-lg">No Lecture Selected</h3>
            <p className="mt-1 max-w-sm mx-auto text-xs text-muted-foreground leading-relaxed">
              Select a scheduled lecture from the timetable above using{' '}
              <strong className="text-foreground">[ Mark Attendance ]</strong> or{' '}
              <strong className="text-foreground">[ View / Edit Attendance ]</strong> to load the student roster.
            </p>
          </div>
        )}
      </section>

      {/* 4. Sticky Save Bar */}
      {(selectedLecture || manualSelected) && (
        <div className="sticky bottom-16 sm:bottom-3 z-20 mt-4 sm:mt-5 flex flex-col gap-2.5 sm:gap-3 rounded-xl sm:rounded-2xl border border-border bg-card/95 p-3.5 sm:p-4 shadow-lg backdrop-blur sm:flex-row sm:items-center sm:justify-between">
          <p
            aria-live="polite"
            className={`text-xs ${
              isAttendanceSubmitted
                ? 'text-foreground font-semibold flex items-center gap-1.5'
                : message.startsWith('Attendance saved')
                ? 'text-primary font-medium'
                : message || existing.isError
                ? 'text-destructive font-medium'
                : 'text-muted-foreground'
            }`}
          >
            {isAttendanceSubmitted ? (
              <>
                <Lock size={14} className="shrink-0 text-primary" />
                <span>Attendance Locked 🔒 — Attendance for this lecture has already been submitted and cannot be changed.</span>
              </>
            ) : (
              message ||
              (existing.isError
                ? 'Existing attendance could not be loaded.'
                : isLectureLocked
                ? 'Marking locked until lecture starts'
                : existing.isLoading
                ? 'Loading existing attendance records…'
                : 'Ready to save class attendance')
            )}
          </p>
          <Button
            onClick={submit}
            disabled={!students.length || save.isPending || isAttendanceBlocked}
            testId="button-save-teacher-attendance"
            className="w-full sm:w-auto"
          >
            {isAttendanceSubmitted
              ? 'Attendance Locked 🔒'
              : save.isPending
              ? 'Saving class…'
              : 'Save attendance'}
          </Button>
        </div>
      )}
    </AppShell>
  );
}

function Modal({ title, close, children }: { title:string; close:()=>void; children:React.ReactNode }) { return <div className="fixed inset-0 z-50 flex items-end justify-center bg-sidebar/40 p-0 backdrop-blur-sm sm:items-center sm:p-5"><div className="max-h-[92dvh] w-full max-w-lg overflow-auto rounded-t-2xl sm:rounded-3xl border border-border bg-card p-4 sm:p-6 shadow-2xl"><div className="mb-4 sm:mb-5 flex items-center justify-between"><h2 className="font-display text-xl sm:text-2xl">{title}</h2><button onClick={close} data-testid="button-close-modal" className="rounded-full p-1.5 sm:p-2 text-muted-foreground hover:bg-muted"><X size={18}/></button></div>{children}</div></div>; }
function Field({ label, children, hint }: { label:string; children:React.ReactNode; hint?:string }) { return <label className="block"><span className="mb-1.5 block text-xs font-bold uppercase tracking-[.1em] text-muted-foreground">{label}</span>{children}{hint&&<span className="mt-1 block text-[11px] text-muted-foreground">{hint}</span>}</label>; }
const inputClass = "w-full rounded-xl border border-input bg-background px-3.5 py-2.5 text-sm outline-none transition-colors focus:border-primary focus:ring-2 focus:ring-ring/20";

function Requests({ user }: { user: CurrentUser }) {
  const [modal,setModal]=useState(false); const [filter,setFilter]=useState(''); const client=useQueryClient();
  const query=useGetExemptions({status:filter?filter as GetExemptionsStatus:undefined,page:1,pageSize:50}); const create=useCreateExemption(); const approve=useApproveExemption(); const reject=useRejectExemption(); const items=query.data?.items||[];
  const submit=(e:React.FormEvent<HTMLFormElement>)=>{e.preventDefault();const f=new FormData(e.currentTarget);create.mutate({data:{category:f.get('category') as ExemptionInputCategory,reason:String(f.get('reason')),startDate:String(f.get('startDate')),endDate:String(f.get('endDate')),proofName:String(f.get('proofName')||'')||null}},{onSuccess:()=>{setModal(false);client.invalidateQueries({queryKey:getGetExemptionsQueryKey()});client.invalidateQueries({queryKey:getGetDashboardSummaryQueryKey()})}})};
  const review=(id:string, ok:boolean)=>{(ok?approve:reject).mutate({id,data:{remarks:ok?'Approved after review':'Please provide clearer supporting information.'}},{onSuccess:()=>client.invalidateQueries({queryKey:getGetExemptionsQueryKey()})})};
  return <AppShell user={user}><PageHeader eyebrow="Requests" title="Exemptions, with a paper trail." description="If a college-approved absence should not count against you, start here. Keep supporting details clear and specific." action={user.role==='STUDENT'?<Button onClick={()=>setModal(true)} testId="button-submit-exemption" className="w-full sm:w-auto"><Plus size={16}/> Submit request</Button>:undefined}/><div className="mb-4 sm:mb-5 flex items-center gap-1.5 sm:gap-2 overflow-x-auto pb-1 scrollbar-none">{['','PENDING','APPROVED','REJECTED'].map(s=><button key={s||'all'} onClick={()=>setFilter(s)} data-testid={`button-filter-request-${s||'all'}`} className={`whitespace-nowrap rounded-full px-3 sm:px-3.5 py-1.5 sm:py-2 text-[11px] sm:text-xs font-semibold ${filter===s?'bg-primary text-primary-foreground':'border border-border bg-card text-muted-foreground hover:bg-muted'}`}>{s||'All requests'}</button>)}</div>{query.isLoading?<LoadingBlock rows={4}/>:query.isError?<ErrorBlock retry={()=>query.refetch()}/>:items.length===0?<EmptyBlock title="No exemption requests yet" detail="Approved college work, medical leave, or competition travel can be documented here." action={user.role==='STUDENT'?<Button onClick={()=>setModal(true)} testId="button-empty-submit"><Plus size={15}/> Start a request</Button>:undefined}/>:<div className="space-y-2.5 sm:space-y-3">{items.map((x:Exemption)=><div key={x.id} data-testid={`card-exemption-${x.id}`} className="rounded-xl sm:rounded-2xl border border-border/70 bg-card p-4 sm:p-5 transition-shadow hover:shadow-sm"><div className="flex flex-col justify-between gap-2.5 sm:gap-3 sm:flex-row sm:items-start"><div><div className="flex flex-wrap items-center gap-2"><span className="text-[10px] font-bold uppercase tracking-[.14em] text-primary">{x.category.replaceAll('_',' ')}</span><StatusPill status={x.status}/>{user.role!=='STUDENT'&&<span className="text-xs text-muted-foreground">by {x.studentName}</span>}</div><h3 className="mt-1.5 sm:mt-2 text-xs sm:text-sm font-semibold">{x.reason}</h3><p className="mt-1 text-[11px] sm:text-xs text-muted-foreground">{fmtDate(x.startDate)} — {fmtDate(x.endDate)} {x.proofName&&` · ${x.proofName}`}</p></div><span className="text-[10px] sm:text-[11px] text-muted-foreground">Submitted {shortDate(x.submittedAt)}</span></div>{x.reviewerRemarks&&<p className="mt-3 sm:mt-4 rounded-xl bg-muted px-3 py-2 text-xs text-muted-foreground"><span className="font-semibold text-foreground">Reviewer note: </span>{x.reviewerRemarks}</p>}{user.role!=='STUDENT'&&x.status==='PENDING'&&<div className="mt-3 sm:mt-4 flex flex-wrap gap-2 border-t border-border/60 pt-3"><Button onClick={()=>review(x.id,true)} disabled={approve.isPending} testId={`button-approve-${x.id}`} className="px-3 py-1.5 text-xs"><Check size={14}/> Approve</Button><Button onClick={()=>review(x.id,false)} variant="danger" disabled={reject.isPending} testId={`button-reject-${x.id}`} className="px-3 py-1.5 text-xs"><X size={14}/> Decline</Button></div>}</div>)}</div>}{modal&&<Modal title="Submit an exemption" close={()=>setModal(false)}><form onSubmit={submit} className="space-y-3.5 sm:space-y-4"><Field label="Reason category"><select name="category" required data-testid="select-exemption-category" className={inputClass}><option value="MEDICAL">Medical</option><option value="COLLEGE_EVENT">College event</option><option value="OFFICIAL_WORK">Official work</option><option value="SPORTS">Sports</option><option value="COMPETITION">Competition</option><option value="PERSONAL">Personal</option><option value="OTHER">Other</option></select></Field><Field label="What happened?" hint="A short, factual explanation helps reviewers decide quickly."><textarea name="reason" required minLength={1} rows={3} data-testid="textarea-exemption-reason" className={inputClass} placeholder="Tell us what the absence was for…"/></Field><div className="grid gap-3 sm:grid-cols-2"><Field label="From"><input name="startDate" required type="date" data-testid="input-exemption-start" className={inputClass}/></Field><Field label="To"><input name="endDate" required type="date" data-testid="input-exemption-end" className={inputClass}/></Field></div><Field label="Proof filename" hint="Optional. Add the name of the document you will share with your reviewer."><input name="proofName" data-testid="input-exemption-proof" className={inputClass} placeholder="e.g. medical-note.pdf"/></Field><Button type="submit" disabled={create.isPending} className="w-full" testId="button-submit-exemption-form"><Send size={15}/>{create.isPending?'Sending…':'Send for review'}</Button></form></Modal>}</AppShell>;
}

function Issues({ user }: { user: CurrentUser }) {
 const [modal,setModal]=useState(false); const client=useQueryClient(); const subjectQuery=useGetSubjectAttendance(); const subjects=safeArray(subjectQuery.data); const query=useGetAttendanceIssues(); const create=useCreateAttendanceIssue(); const resolve=useResolveAttendanceIssue(); const reject=useRejectAttendanceIssue(); const items=safeArray(query.data);
 const submit=(e:React.FormEvent<HTMLFormElement>)=>{e.preventDefault();const f=new FormData(e.currentTarget);const selected=subjects.find(s=>s.id===String(f.get('subjectId')));create.mutate({data:{subjectId:String(f.get('subjectId')),subjectName:selected?.name||'',date:String(f.get('date')),issueType:f.get('issueType') as AttendanceIssueInputIssueType,description:String(f.get('description')),evidenceName:String(f.get('evidenceName')||'')||null}},{onSuccess:()=>{setModal(false);client.invalidateQueries({queryKey:getGetAttendanceIssuesQueryKey()})}})};
 return <AppShell user={user}><PageHeader eyebrow="Discrepancies" title="Something look off?" description="Attendance records are data, not destiny. Tell us what needs checking and we will keep the review visible." action={user.role==='STUDENT'?<Button onClick={()=>setModal(true)} testId="button-report-issue" className="w-full sm:w-auto"><Plus size={16}/> Report an issue</Button>:undefined}/>{query.isLoading?<LoadingBlock rows={4}/>:query.isError?<ErrorBlock retry={()=>query.refetch()}/>:items.length===0?<EmptyBlock title="No attendance issues" detail="If a class was marked incorrectly or an approved exemption is missing, you can report it here." action={user.role==='STUDENT'?<Button onClick={()=>setModal(true)} testId="button-empty-report"><Plus size={15}/> Report a discrepancy</Button>:undefined}/>:<div className="space-y-2.5 sm:space-y-3">{items.map((x:AttendanceIssue)=><div key={x.id} data-testid={`card-issue-${x.id}`} className="rounded-xl sm:rounded-2xl border border-border/70 bg-card p-4 sm:p-5"><div className="flex flex-col justify-between gap-2.5 sm:gap-3 sm:flex-row"><div><div className="flex flex-wrap items-center gap-2"><span className="text-[10px] font-bold uppercase tracking-[.12em] text-primary">{x.issueType.replaceAll('_',' ')}</span><StatusPill status={x.status}/>{user.role!=='STUDENT'&&<span className="text-xs text-muted-foreground">{x.studentName}</span>}</div><h3 className="mt-1.5 sm:mt-2 text-xs sm:text-sm font-semibold">{x.subjectName} <span className="font-normal text-muted-foreground">· {fmtDate(x.date)}</span></h3><p className="mt-1 max-w-2xl text-xs sm:text-sm leading-relaxed sm:leading-6 text-muted-foreground">{x.description}</p></div><span className="text-[10px] sm:text-[11px] text-muted-foreground">Submitted {shortDate(x.createdAt)}</span></div>{x.evidenceName&&<p className="mt-2 sm:mt-3 text-xs text-primary">Evidence: {x.evidenceName}</p>}{x.reviewerRemarks&&<p className="mt-3 sm:mt-4 rounded-xl bg-muted px-3 py-2 text-xs text-muted-foreground"><span className="font-semibold text-foreground">Reviewer note: </span>{x.reviewerRemarks}</p>}{user.role!=='STUDENT'&&['OPEN','UNDER_REVIEW'].includes(x.status)&&<div className="mt-3 sm:mt-4 flex flex-wrap gap-2 border-t border-border/60 pt-3"><Button onClick={()=>resolve.mutate({id:x.id,data:{remarks:'Attendance record reviewed and corrected.',updateAttendance:true}},{onSuccess:()=>client.invalidateQueries({queryKey:getGetAttendanceIssuesQueryKey()})})} disabled={resolve.isPending} testId={`button-resolve-issue-${x.id}`} className="px-3 py-1.5 text-xs"><Check size={14}/> Resolve & update</Button><Button onClick={()=>reject.mutate({id:x.id,data:{remarks:'The attendance record matches the source register.'}},{onSuccess:()=>client.invalidateQueries({queryKey:getGetAttendanceIssuesQueryKey()})})} variant="danger" disabled={reject.isPending} testId={`button-reject-issue-${x.id}`} className="px-3 py-1.5 text-xs"><X size={14}/> Reject</Button></div>}</div>)}</div>}
   {modal&&<Modal title="Report an attendance issue" close={()=>setModal(false)}><form onSubmit={submit} className="space-y-3.5 sm:space-y-4"><Field label="Subject"><select name="subjectId" required data-testid="select-issue-subject" className={inputClass}>{subjects.map(s=><option key={s.id} value={s.id}>{s.code} · {s.name}</option>)}</select></Field><div className="grid gap-3 sm:grid-cols-2"><Field label="Class date"><input name="date" required type="date" data-testid="input-issue-date" className={inputClass}/></Field><Field label="Issue type"><select name="issueType" required data-testid="select-issue-type" className={inputClass}><option value="INCORRECTLY_MARKED_ABSENT">Marked absent incorrectly</option><option value="INCORRECTLY_MARKED_PRESENT">Marked present incorrectly</option><option value="EXEMPTION_NOT_REFLECTED">Exemption not reflected</option><option value="WRONG_ATTENDANCE_DATA">Wrong attendance data</option><option value="OTHER">Other</option></select></Field></div><Field label="What should we check?"><textarea name="description" required rows={4} data-testid="textarea-issue-description" className={inputClass} placeholder="Explain what happened and what the record should say…"/></Field><Field label="Evidence filename"><input name="evidenceName" data-testid="input-issue-evidence" className={inputClass} placeholder="Optional document or screenshot name"/></Field><Button type="submit" disabled={create.isPending} className="w-full" testId="button-submit-issue-form"><Send size={15}/>{create.isPending?'Sending…':'Send report'}</Button></form></Modal>}
 </AppShell>;
}

function Insights({ user }: { user: CurrentUser }) {
 const trend=useGetAttendanceTrend(); const summary=useGetDashboardSummary(); const points=safeArray(trend.data); const subjects=safeArray(summary.data?.subjects); const best=[...subjects].sort((a,b)=>b.percentage-a.percentage)[0]; const risk=[...subjects].sort((a,b)=>a.percentage-b.percentage)[0];
 return <AppShell user={user}><PageHeader eyebrow="Insights" title="Make the next class count." description="A steady, deterministic read of your trend and the small choices that protect your target."/><div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 sm:gap-4"><MetricCard label="Current average" value={summary.data?pct(summary.data.overall.percentage):'—'} note={summary.data?`Target is ${summary.data.overall.target}%`:'Loading your average'} icon={Target}/><MetricCard label="Strongest subject" value={best?.code||'—'} note={best?`${pct(best.percentage)} · ${best.name}`:'No data yet'} icon={ArrowUpRight}/><MetricCard label="Watch closely" value={risk?.code||'—'} note={risk?`${pct(risk.percentage)} · ${risk.name}`:'No data yet'} tone="amber" icon={ArrowDownRight}/></div><div className="mt-4 sm:mt-6 grid gap-4 sm:gap-6 xl:grid-cols-[1.4fr_.6fr]"><section className="rounded-xl sm:rounded-2xl border border-border/70 bg-card p-4 sm:p-6"><div className="mb-4 sm:mb-5 flex items-center justify-between"><div><p className="text-[10px] sm:text-[11px] font-bold uppercase tracking-[.15em] text-primary">Trend</p><h2 className="mt-0.5 sm:mt-1 font-display text-xl sm:text-2xl">Your attendance over time</h2></div><span className="rounded-full bg-secondary px-2.5 sm:px-3 py-1 sm:py-1.5 text-[10px] sm:text-[11px] font-semibold text-secondary-foreground">Target line included</span></div>{trend.isLoading?<div className="h-[220px] sm:h-[280px] animate-pulse rounded-xl bg-muted"/>:points.length===0?<EmptyBlock title="Your trend is taking shape" detail="More marked classes will unlock a clearer pattern."/>:<div className="h-[220px] sm:h-[280px] w-full"><ResponsiveContainer width="100%" height="100%"><AreaChart data={points}><defs><linearGradient id="trendFill" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#2f7665" stopOpacity=".26"/><stop offset="100%" stopColor="#2f7665" stopOpacity=".01"/></linearGradient></defs><CartesianGrid strokeDasharray="3 5" vertical={false} stroke="hsl(var(--border))"/><XAxis dataKey="label" tick={{fontSize:10,fill:'hsl(var(--muted-foreground))'}} axisLine={false} tickLine={false}/><YAxis domain={[50,100]} tick={{fontSize:10,fill:'hsl(var(--muted-foreground))'}} axisLine={false} tickLine={false} unit="%"/><Tooltip contentStyle={{borderRadius:12,border:'1px solid hsl(var(--border))',background:'hsl(var(--card))',fontSize:12}}/><Area type="monotone" dataKey="percentage" stroke="#2f7665" strokeWidth={3} fill="url(#trendFill)" dot={{fill:'#f4f3ed',stroke:'#2f7665',strokeWidth:2,r:3}}/></AreaChart></ResponsiveContainer></div>}</section><section className="rounded-xl sm:rounded-2xl bg-[#e9e7dc] p-4 sm:p-6"><div className="grid h-8 w-8 sm:h-9 sm:w-9 place-items-center rounded-lg sm:rounded-xl bg-accent"><LightbulbIcon/></div><p className="mt-3 sm:mt-6 text-[10px] sm:text-[11px] font-bold uppercase tracking-[.15em] text-primary">The honest version</p><h2 className="mt-1.5 sm:mt-2 font-display text-xl sm:text-[28px] leading-snug sm:leading-tight">{summary.data?.insight.headline||'Small consistency beats last-minute catching up.'}</h2><p className="mt-2 sm:mt-3 text-xs sm:text-sm leading-relaxed sm:leading-6 text-muted-foreground">{summary.data?.insight.detail||'Keep showing up to the classes furthest from target. The maths rewards consistency.'}</p><Link href="/attendance" data-testid="link-insight-attendance" className="mt-4 sm:mt-6 inline-flex items-center gap-1.5 sm:gap-2 text-xs font-bold text-primary hover:underline">Check subject detail <ChevronRight size={14}/></Link></section></div><section className="mt-4 sm:mt-6 rounded-xl sm:rounded-2xl border border-border/70 bg-card p-4 sm:p-6"><div className="mb-4 sm:mb-5"><p className="text-[10px] sm:text-[11px] font-bold uppercase tracking-[.15em] text-primary">Subject context</p><h2 className="mt-0.5 sm:mt-1 font-display text-xl sm:text-2xl">Where your average is made</h2></div><div className="grid gap-2.5 sm:gap-3 md:grid-cols-2">{subjects.map(s=><SubjectRow key={s.id} subject={s}/>)}</div></section></AppShell>;
}
function LightbulbIcon(){return <Sparkles size={17}/>}

function Notifications({ user }: { user: CurrentUser }) {
 const client=useQueryClient(); const query=useGetNotifications(); const read=useMarkNotificationRead(); const all=useMarkAllNotificationsRead(); const items=safeArray(query.data); const unread=items.filter(n=>!n.read).length;
 const mark=(id:string)=>read.mutate({id},{onSuccess:()=>client.invalidateQueries({queryKey:getGetNotificationsQueryKey()})});
 return <AppShell user={user}><PageHeader eyebrow="Inbox" title="Keep the signal." description="Updates about your attendance, requests, and records — in one quiet place." action={unread>0?<Button onClick={()=>all.mutate(undefined,{onSuccess:()=>client.invalidateQueries({queryKey:getGetNotificationsQueryKey()})})} variant="secondary" disabled={all.isPending} testId="button-mark-all-read"><Check size={15}/> Mark all read</Button>:undefined}/>{query.isLoading?<LoadingBlock rows={5}/>:query.isError?<ErrorBlock retry={()=>query.refetch()}/>:items.length===0?<EmptyBlock title="Your inbox is clear" detail="When something changes, we will leave a note here."/>:<div className="mx-auto max-w-3xl space-y-2">{items.map((n,i)=><button key={n.id} onClick={()=>!n.read&&mark(n.id)} data-testid={`notification-${n.id}`} className={`flex w-full items-start gap-4 rounded-2xl border p-5 text-left transition-colors hover:border-primary/30 ${n.read?'border-border/60 bg-card':'border-primary/20 bg-secondary/35'}`}><span className={`mt-1 grid h-8 w-8 shrink-0 place-items-center rounded-xl ${n.type==='WARNING'||n.type==='ISSUE'?'bg-[#f4d8cf] text-destructive':'bg-[#d9e9df] text-primary'}`}>{n.type==='ISSUE'?<FileWarning size={15}/>:n.type==='WARNING'?<CircleAlert size={15}/>:<Info size={15}/>}</span><span className="min-w-0 flex-1"><span className="flex flex-col justify-between gap-1 sm:flex-row"><strong className="text-sm">{n.title}</strong><time className="text-[11px] text-muted-foreground">{shortDate(n.createdAt)}</time></span><span className="mt-1 block text-sm leading-6 text-muted-foreground">{n.message}</span></span>{!n.read&&<span className="mt-2 h-2 w-2 shrink-0 rounded-full bg-primary"/>}</button>)}</div>}</AppShell>;
}

function SettingsPage({ user }: { user: CurrentUser }) {
  const client = useQueryClient();
  const query = useGetSettings();
  const update = useUpdateSettings();
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [targetSlider, setTargetSlider] = useState<number | null>(null);

  const settings = query.data;
  const targetAttendance = targetSlider ?? (settings?.targetAttendance ?? 75);
  const notificationsEnabled = settings?.notificationsEnabled ?? true;

  const save = (patch: Partial<Settings>) => {
    if (update.isPending || !settings) return;
    setErrorMessage(null);

    const next: Settings = {
      theme: patch.theme ?? settings.theme,
      targetAttendance: patch.targetAttendance ?? settings.targetAttendance,
      notificationsEnabled: patch.notificationsEnabled !== undefined ? patch.notificationsEnabled : settings.notificationsEnabled,
    };

    update.mutate(
      { data: next },
      {
        onSuccess: () => {
          setErrorMessage(null);
          client.invalidateQueries({ queryKey: getGetSettingsQueryKey() });
        },
        onError: (err: any) => {
          const msg = err?.message || 'Failed to update setting. Please try again.';
          setErrorMessage(msg);
        },
      }
    );
  };

  useEffect(() => {
    const theme = settings?.theme;
    if (!theme) return;
    const dark = theme === 'DARK' || (theme === 'SYSTEM' && window.matchMedia('(prefers-color-scheme: dark)').matches);
    document.documentElement.classList.toggle('dark', dark);
  }, [settings?.theme]);

  if (query.isLoading && !settings) return <AppShell user={user}><PageHeader title="Settings" /><LoadingBlock rows={4} /></AppShell>;
  if (query.isError && !settings) return <AppShell user={user}><ErrorBlock retry={() => query.refetch()} /></AppShell>;

  return (
    <AppShell user={user}>
      <PageHeader
        eyebrow="Preferences"
        title="Make it yours."
        description="Choose the amount of guidance that feels useful. Your attendance target is personal, not a campus-wide default."
      />
      <div className="mx-auto max-w-3xl space-y-4">
        {errorMessage && (
          <div
            role="alert"
            data-testid="settings-error-alert"
            className="flex items-center justify-between gap-2 rounded-xl border border-destructive/30 bg-destructive/10 px-4 py-3 text-xs font-semibold text-destructive animate-fade-in"
          >
            <span>{errorMessage}</span>
            <button
              type="button"
              onClick={() => setErrorMessage(null)}
              className="shrink-0 p-1 hover:opacity-75"
              aria-label="Dismiss error"
            >
              <X size={14} />
            </button>
          </div>
        )}

        <section className="rounded-2xl border border-border/70 bg-card p-6">
          <div className="flex items-start gap-4">
            <span className="grid h-10 w-10 place-items-center rounded-xl bg-secondary">
              <Target size={18} />
            </span>
            <div>
              <h2 className="font-display text-2xl">Attendance target</h2>
              <p className="mt-1 text-sm text-muted-foreground">The line used across your dashboard and insights.</p>
            </div>
          </div>
          <div className="mt-7 flex items-end gap-4">
            <input
              type="range"
              min="1"
              max="100"
              value={targetAttendance}
              disabled={update.isPending}
              onChange={e => setTargetSlider(Number(e.target.value))}
              onMouseUp={e => {
                const val = Number((e.target as HTMLInputElement).value);
                setTargetSlider(null);
                save({ targetAttendance: val });
              }}
              onTouchEnd={e => {
                const val = Number((e.target as HTMLInputElement).value);
                setTargetSlider(null);
                save({ targetAttendance: val });
              }}
              data-testid="input-attendance-target"
              className="h-2 flex-1 accent-primary"
            />
            <span className="w-20 font-mono text-2xl">{targetAttendance}%</span>
          </div>
          <div className="mt-2 flex justify-between text-[11px] text-muted-foreground">
            <span>1%</span>
            <span>Recommended: 75%</span>
            <span>100%</span>
          </div>
        </section>

        <section className="rounded-2xl border border-border/70 bg-card p-6">
          <div className="flex items-start gap-4">
            <span className="grid h-10 w-10 place-items-center rounded-xl bg-[#d9e9df]">
              <SlidersHorizontal size={18} />
            </span>
            <div>
              <h2 className="font-display text-2xl">Appearance</h2>
              <p className="mt-1 text-sm text-muted-foreground">A softer workspace for long study days.</p>
            </div>
          </div>
          <div className="mt-6 grid grid-cols-3 gap-2">
            {(['LIGHT', 'SYSTEM', 'DARK'] as const).map(theme => (
              <button
                key={theme}
                disabled={update.isPending}
                onClick={() => save({ theme })}
                data-testid={`button-theme-${theme.toLowerCase()}`}
                className={`rounded-xl border px-3 py-3 text-xs font-semibold transition-colors ${
                  settings?.theme === theme
                    ? 'border-primary bg-secondary text-primary'
                    : 'border-border text-muted-foreground hover:bg-muted'
                }`}
              >
                {theme[0] + theme.slice(1).toLowerCase()}
              </button>
            ))}
          </div>
        </section>

        <section className="rounded-2xl border border-border/70 bg-card p-6">
          <div className="flex items-center justify-between gap-4">
            <div className="min-w-0 flex-1">
              <h2 className="font-display text-2xl">Notifications</h2>
              <p className="mt-1 text-sm text-muted-foreground">Useful updates, never noise.</p>
            </div>
            <div className="flex items-center justify-center min-h-[44px] min-w-[44px] shrink-0">
              <button
                role="switch"
                type="button"
                aria-checked={notificationsEnabled}
                aria-label="Toggle notifications"
                disabled={update.isPending}
                onClick={() => save({ notificationsEnabled: !notificationsEnabled })}
                data-testid="switch-notifications"
                className={`relative h-7 w-12 rounded-full transition-all focus:outline-hidden focus:ring-2 focus:ring-primary/20 ${
                  update.isPending ? 'opacity-60 cursor-not-allowed' : 'cursor-pointer hover:brightness-105'
                } ${notificationsEnabled ? 'bg-primary' : 'bg-muted'}`}
              >
                <span
                  className={`absolute top-1 h-5 w-5 rounded-full bg-card shadow-sm transition-transform ${
                    notificationsEnabled ? 'translate-x-6' : 'translate-x-1'
                  }`}
                />
              </button>
            </div>
          </div>
          <p className="mt-5 text-xs text-muted-foreground">
            {notificationsEnabled
              ? 'You will see decisions, attendance changes, and review notes in your inbox.'
              : 'Notifications are paused. You can still check your inbox anytime.'}
          </p>
        </section>
      </div>
    </AppShell>
  );
}

function People({ user }: { user: CurrentUser }) {
 const [search,setSearch]=useState(''); const [risk,setRisk]=useState(''); const query=useGetStudents({search:search||undefined,risk:risk?risk as GetStudentsRisk:undefined}); const items=safeArray(query.data);
 return <AppShell user={user}><PageHeader eyebrow="Student view" title="People who need a hand." description="A focused view for mentors and academic leads. Start with context, then choose the next useful conversation."/><div className="mb-5 flex flex-col gap-3 sm:flex-row"><div className="relative flex-1"><Search size={16} className="absolute left-3 top-3 text-muted-foreground"/><input value={search} onChange={e=>setSearch(e.target.value)} data-testid="input-student-search" className={`${inputClass} pl-9`} placeholder="Search by name or roll number"/></div><select value={risk} onChange={e=>setRisk(e.target.value)} data-testid="select-student-risk" className={`${inputClass} sm:w-44`}><option value="">All risk levels</option><option value="CRITICAL">Critical</option><option value="WARNING">Warning</option><option value="SAFE">Safe</option></select></div>{query.isLoading?<LoadingBlock rows={5}/>:query.isError?<ErrorBlock retry={()=>query.refetch()}/>:items.length===0?<EmptyBlock title="No students match" detail="Try a different name, roll number, or risk level."/>:<div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">{items.map((s:Student)=><Link href={`/profile/${s.id}`} key={s.id} data-testid={`card-student-${s.id}`} className="rounded-2xl border border-border/70 bg-card p-5 transition-all hover:-translate-y-0.5 hover:border-primary/30 hover:shadow-md"><div className="flex items-start justify-between gap-3"><span className="grid h-10 w-10 place-items-center rounded-full bg-secondary font-display text-lg">{s.name.split(' ').map(n=>n[0]).join('').slice(0,2)}</span><StatusPill status={s.status}/></div><h2 className="mt-4 text-base font-semibold">{s.name}</h2><p className="mt-1 text-xs text-muted-foreground">{s.rollNo} · {s.branch} · {s.section}</p><div className="mt-5 flex items-end justify-between"><span className="font-mono text-2xl">{pct(s.percentage)}</span><span className="text-right text-[11px] text-muted-foreground">{s.pendingRequests} requests<br/>{s.openIssues} open issues</span></div><div className="mt-3"><ProgressBar value={s.percentage} target={75}/></div></Link>)}</div>}</AppShell>;
}

function Profile({ user }: { user: CurrentUser }) {
 const { id } = useParams<{ id: string }>(); const query=useGetStudent(id||'', {query:{enabled:!!id,queryKey:getGetStudentQueryKey(id||'')}}); const student=query.data;
 if(query.isLoading)return <AppShell user={user}><LoadingBlock rows={6}/></AppShell>; if(query.isError||!student)return <AppShell user={user}><ErrorBlock retry={()=>query.refetch()}/></AppShell>;
 return <AppShell user={user}><Link href="/people" data-testid="link-back-people" className="mb-6 inline-flex items-center gap-2 text-xs font-semibold text-muted-foreground hover:text-primary">← Back to students</Link><PageHeader eyebrow="Student profile" title={student.name} description={`${student.rollNo} · ${student.branch} · Section ${student.section}`} action={<StatusPill status={student.status}/>}/><div className="grid gap-4 sm:grid-cols-3"><MetricCard label="Attendance" value={pct(student.percentage)} note="Across all subjects" icon={Target}/><MetricCard label="Requests" value={student.pendingRequests} note="Waiting for review" tone="amber" icon={ClipboardCheck}/><MetricCard label="Issues" value={student.openIssues} note="Open discrepancies" tone="rose" icon={FileWarning}/></div><section className="mt-6 rounded-2xl border border-border/70 bg-card p-5 sm:p-6"><div className="mb-5 flex items-center justify-between"><div><p className="text-[11px] font-bold uppercase tracking-[.15em] text-primary">Subject picture</p><h2 className="mt-1 font-display text-2xl">Where support could help</h2></div><Link href="/requests" data-testid="link-profile-requests" className="text-xs font-semibold text-primary">Review requests</Link></div><div className="grid gap-3 md:grid-cols-2">{safeArray(student.subjects).map(s=><SubjectRow subject={s} key={s.id}/>)}</div></section></AppShell>;
}

export { Dashboard, Attendance, Requests, Issues, Insights, Notifications, SettingsPage, People, Profile };
