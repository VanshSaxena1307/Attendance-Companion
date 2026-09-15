import { ArrowUpRight } from 'lucide-react';

export function CreatorCredit({ className = '' }: { className?: string }) {
  const creators = [
    {
      name: "Vansh Saxena",
      url: "https://www.linkedin.com/in/vansh-saxena-180402365/",
    },
    {
      name: "Varun Chaubey",
      url: "https://www.linkedin.com/in/varuncahubey04/",
    },
  ];

  return (
    <footer
      data-testid="footer-creator-credit"
      className={`mt-8 sm:mt-12 border-t border-border/60 pt-4 pb-2 text-center select-none ${className}`}
    >
      <p className="text-[11px] sm:text-xs text-muted-foreground font-medium flex items-center justify-center flex-wrap gap-x-2 gap-y-1">
        <span>Created by</span>
        {creators.map((c, idx) => (
          <span key={c.name} className="inline-flex items-center gap-1">
            <span className="font-semibold text-foreground/90">{c.name}</span>
            <a
              href={c.url}
              target="_blank"
              rel="noopener noreferrer"
              data-testid={`link-creator-linkedin-${idx}`}
              className="inline-flex items-center gap-0.5 font-semibold text-primary hover:underline transition-colors focus:outline-hidden focus:ring-1 focus:ring-primary rounded text-[11px]"
            >
              LinkedIn <ArrowUpRight size={10} className="shrink-0" />
            </a>
            {idx < creators.length - 1 && <span className="text-muted-foreground/60 ml-1">·</span>}
          </span>
        ))}
      </p>
    </footer>
  );
}
