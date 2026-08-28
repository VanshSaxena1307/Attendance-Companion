import { Link } from 'wouter';
import { ArrowLeft, Compass } from 'lucide-react';

export default function NotFound() {
  return <main className="flex min-h-[100dvh] items-center justify-center bg-background px-5"><div className="max-w-md text-center"><span className="mx-auto grid h-14 w-14 place-items-center rounded-2xl bg-secondary text-primary"><Compass size={26}/></span><p className="mt-8 text-[11px] font-bold uppercase tracking-[.2em] text-primary">A small detour</p><h1 className="mt-3 font-display text-5xl">That page is not here.</h1><p className="mt-4 text-sm leading-6 text-muted-foreground">The link may have moved, but your attendance workspace is still exactly where you left it.</p><Link href="/" data-testid="link-not-found-home" className="mt-7 inline-flex items-center gap-2 rounded-xl bg-primary px-4 py-2.5 text-[13px] font-semibold text-primary-foreground hover:brightness-110"><ArrowLeft size={15}/> Back to overview</Link></div></main>;
}
