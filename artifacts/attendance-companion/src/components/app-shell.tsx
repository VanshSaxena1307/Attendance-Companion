import { Bell, BookOpen, ClipboardCheck, FileWarning, Gauge, Lightbulb, LogOut, Menu, Settings2, Users, X } from 'lucide-react';
import { useState } from 'react';
import { Link, useLocation } from 'wouter';
import type { CurrentUser } from '@workspace/api-client-react';

const nav = [
  { href: '/', label: 'Overview', icon: Gauge, roles: ['STUDENT','MENTOR','HOD','ADMIN'] },
  { href: '/attendance', label: 'Attendance', icon: BookOpen, roles: ['STUDENT','MENTOR','HOD','ADMIN'] },
  { href: '/requests', label: 'Exemptions', icon: ClipboardCheck, roles: ['STUDENT','MENTOR','HOD','ADMIN'] },
  { href: '/issues', label: 'Issues', icon: FileWarning, roles: ['STUDENT','MENTOR','HOD','ADMIN'] },
  { href: '/insights', label: 'Insights', icon: Lightbulb, roles: ['STUDENT','MENTOR','HOD','ADMIN'] },
  { href: '/notifications', label: 'Inbox', icon: Bell, roles: ['STUDENT','MENTOR','HOD','ADMIN'] },
  { href: '/people', label: 'Students', icon: Users, roles: ['MENTOR','HOD','ADMIN'] },
];

export function AppShell({ user, children }: { user: CurrentUser; children: React.ReactNode }) {
  const [location, setLocation] = useLocation();
  const [open, setOpen] = useState(false);
  const visible = nav.filter((item) => item.roles.includes(user.role));
  const active = (href: string) => href === '/' ? location === '/' : location.startsWith(href);
  const signOut = () => { localStorage.removeItem('attendance-role'); setLocation('/login'); };
  return <div className="noise min-h-[100dvh] bg-background">
    <aside className={`fixed inset-y-0 left-0 z-40 flex w-[248px] flex-col bg-sidebar px-4 py-5 text-sidebar-foreground transition-transform duration-300 lg:translate-x-0 ${open ? 'translate-x-0' : '-translate-x-full'}`}>
      <div className="mb-9 flex items-center justify-between px-2">
        <Link href="/" data-testid="link-brand" className="flex items-center gap-3">
          <span className="grid h-9 w-9 place-items-center rounded-xl bg-sidebar-primary text-sidebar-primary-foreground"><BookOpen size={18}/></span>
          <span><strong className="font-display text-[21px] font-semibold tracking-tight">attendance</strong><span className="block -mt-1 text-[11px] uppercase tracking-[.2em] text-sidebar-foreground/55">companion</span></span>
        </Link>
        <button onClick={() => setOpen(false)} aria-label="Close menu" data-testid="button-close-menu" className="rounded-lg p-1 text-sidebar-foreground/60 hover:bg-sidebar-accent lg:hidden"><X size={18}/></button>
      </div>
      <p className="mb-2 px-3 text-[10px] font-semibold uppercase tracking-[.18em] text-sidebar-foreground/40">Workspace</p>
      <nav className="space-y-1">
        {visible.map(({ href, label, icon: Icon }) => <Link key={href} href={href} onClick={() => setOpen(false)} data-testid={`link-nav-${label.toLowerCase()}`} className={`group flex items-center gap-3 rounded-xl px-3 py-2.5 text-[13px] font-medium transition-colors ${active(href) ? 'bg-sidebar-accent text-sidebar-primary' : 'text-sidebar-foreground/65 hover:bg-sidebar-accent/70 hover:text-sidebar-foreground'}`}><Icon size={17} strokeWidth={active(href) ? 2.4 : 1.8}/><span>{label}</span>{label === 'Inbox' && <span className="ml-auto h-1.5 w-1.5 rounded-full bg-sidebar-primary" />}</Link>)}
      </nav>
      <div className="mt-auto">
        <Link href="/settings" data-testid="link-nav-settings" className={`mb-3 flex items-center gap-3 rounded-xl px-3 py-2.5 text-[13px] text-sidebar-foreground/65 hover:bg-sidebar-accent hover:text-sidebar-foreground ${active('/settings') ? 'bg-sidebar-accent text-sidebar-primary' : ''}`}><Settings2 size={17}/><span>Settings</span></Link>
        <div className="border-t border-sidebar-border pt-4">
          <div className="flex items-center gap-3 px-2">
            <span data-testid="avatar-current-user" className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-[#d9e4d0] text-[12px] font-bold text-sidebar">{user.initials}</span>
            <div className="min-w-0 flex-1"><p data-testid="text-current-user" className="truncate text-[13px] font-semibold">{user.name}</p><p className="truncate text-[11px] text-sidebar-foreground/50">{user.role.toLowerCase()} · {user.department || 'Campus'}</p></div>
            <button onClick={signOut} data-testid="button-sign-out" aria-label="Sign out" className="rounded-lg p-2 text-sidebar-foreground/45 hover:bg-sidebar-accent hover:text-sidebar-foreground"><LogOut size={15}/></button>
          </div>
        </div>
      </div>
    </aside>
    {open && <button onClick={() => setOpen(false)} aria-label="Close navigation overlay" data-testid="button-overlay-menu" className="fixed inset-0 z-30 bg-sidebar/30 lg:hidden"/>}
    <main className="min-h-[100dvh] lg:pl-[248px]">
      <header className="sticky top-0 z-20 flex h-[68px] items-center justify-between border-b border-border/70 bg-background/90 px-5 backdrop-blur-xl sm:px-8">
        <button onClick={() => setOpen(true)} aria-label="Open menu" data-testid="button-open-menu" className="rounded-xl p-2 text-foreground/70 hover:bg-muted lg:hidden"><Menu size={20}/></button>
        <div className="hidden text-[11px] font-medium uppercase tracking-[.18em] text-muted-foreground sm:block">{user.role === 'STUDENT' ? 'Personal attendance workspace' : 'Student attention workspace'}</div>
        <div className="ml-auto flex items-center gap-3">
          <Link href="/notifications" data-testid="link-header-notifications" className="relative rounded-xl p-2 text-muted-foreground hover:bg-muted hover:text-foreground"><Bell size={19}/><span className="absolute right-1.5 top-1.5 h-1.5 w-1.5 rounded-full bg-destructive"/></Link>
          <Link href="/profile/me" data-testid="link-header-profile" className="grid h-9 w-9 place-items-center rounded-full bg-secondary text-[11px] font-bold text-foreground ring-2 ring-background hover:ring-accent">{user.initials}</Link>
        </div>
      </header>
      <div className="px-5 pb-24 pt-7 sm:px-8 lg:px-10 lg:pb-10">{children}</div>
    </main>
    <nav className="fixed bottom-0 left-0 right-0 z-30 flex h-[68px] items-center justify-around border-t border-border bg-card/95 px-2 backdrop-blur-xl lg:hidden">
      {visible.slice(0, 5).map(({ href, label, icon: Icon }) => <Link key={href} href={href} data-testid={`link-mobile-${label.toLowerCase()}`} className={`flex min-w-[54px] flex-col items-center gap-1 rounded-xl py-2 text-[10px] font-medium ${active(href) ? 'text-primary' : 'text-muted-foreground'}`}><Icon size={18}/><span>{label === 'Overview' ? 'Home' : label}</span></Link>)}
    </nav>
  </div>;
}

export function PageHeader({ eyebrow, title, description, action }: { eyebrow?: string; title: string; description?: string; action?: React.ReactNode }) {
  return <div className="mb-7 flex flex-col justify-between gap-4 md:flex-row md:items-end"><div className="animate-rise-in"><p className="mb-2 text-[11px] font-bold uppercase tracking-[.2em] text-primary">{eyebrow || 'Attendance Companion'}</p><h1 className="font-display text-4xl leading-[1.05] tracking-[-.025em] text-foreground sm:text-[46px]">{title}</h1>{description && <p className="mt-3 max-w-2xl text-sm leading-6 text-muted-foreground">{description}</p>}</div>{action && <div className="animate-rise-in delay-1 shrink-0">{action}</div>}</div>;
}

export function Button({ children, onClick, variant = 'primary', type = 'button', disabled = false, className = '', testId }: { children: React.ReactNode; onClick?: () => void; variant?: 'primary'|'secondary'|'ghost'|'danger'; type?: 'button'|'submit'; disabled?: boolean; className?: string; testId?: string }) {
  const styles = { primary: 'bg-primary text-primary-foreground hover:brightness-110 shadow-sm', secondary: 'bg-secondary text-secondary-foreground hover:bg-accent/70', ghost: 'text-muted-foreground hover:bg-muted hover:text-foreground', danger: 'bg-destructive/10 text-destructive hover:bg-destructive/20' };
  return <button type={type} onClick={onClick} disabled={disabled} data-testid={testId} className={`inline-flex items-center justify-center gap-2 rounded-xl px-4 py-2.5 text-[13px] font-semibold transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 ${styles[variant]} ${className}`}>{children}</button>;
}

export function StatusPill({ status }: { status: string }) {
  const key = status.toUpperCase();
  const style = key.includes('CRITICAL') || key === 'REJECTED' || key === 'OPEN' ? 'bg-[#f9e2db] text-[#a24d3d]' : key.includes('WARNING') || key === 'PENDING' || key === 'UNDER_REVIEW' ? 'bg-[#f8ebc9] text-[#8b671d]' : 'bg-[#dcece2] text-[#2e6e55]';
  const label = status.replaceAll('_',' ').toLowerCase().replace(/^\w/, (c) => c.toUpperCase());
  return <span data-testid={`status-${status.toLowerCase()}`} className={`inline-flex rounded-full px-2.5 py-1 text-[10px] font-bold uppercase tracking-[.08em] ${style}`}>{label}</span>;
}

export function LoadingBlock({ rows = 4 }: { rows?: number }) { return <div className="space-y-3 animate-pulse">{Array.from({length: rows}).map((_,i)=><div key={i} className="h-14 rounded-2xl bg-muted/70"/> )}</div>; }
export function ErrorBlock({ retry }: { retry: () => void }) { return <div className="rounded-2xl border border-destructive/20 bg-destructive/5 p-7 text-center"><p className="font-display text-xl">We could not load this view.</p><p className="mt-1 text-sm text-muted-foreground">Your data is safe. Try refreshing the connection.</p><Button onClick={retry} variant="secondary" className="mt-4" testId="button-retry">Try again</Button></div>; }
export function EmptyBlock({ title, detail, action }: { title: string; detail: string; action?: React.ReactNode }) { return <div className="rounded-2xl border border-dashed border-border bg-card/60 px-6 py-12 text-center"><div className="mx-auto mb-3 h-2 w-10 rounded-full bg-accent"/><p className="font-display text-xl">{title}</p><p className="mx-auto mt-1 max-w-sm text-sm leading-6 text-muted-foreground">{detail}</p>{action && <div className="mt-5">{action}</div>}</div>; }
