'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useState, type CSSProperties, type JSX, type ReactNode } from 'react';
import { MessageSquare } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { useSidebar } from '@/components/ui/sidebar';
import { PUBLIC_RELEASE_NOTES, SITE_BUILD_LABEL, SITE_VERSION } from '@/lib/site-version';
import { cn } from '@/lib/utils';

export function SiteVersionTrigger({
  className,
  children,
}: {
  className?: string;
  children?: ReactNode;
}): JSX.Element {
  const [open, setOpen] = useState(false);
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <button type="button" className={className}>
          {children ?? `v${SITE_VERSION}`}
        </button>
      </DialogTrigger>
      <DialogContent className="max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>近期更新</DialogTitle>
          <DialogDescription>
            以下只列出面向同学的更新要点。当前版本 v{SITE_VERSION}
            {SITE_BUILD_LABEL ? ` · ${SITE_BUILD_LABEL}` : ''}。
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          {PUBLIC_RELEASE_NOTES.map((note) => (
            <section key={note.version}>
              <h3 className="text-sm font-semibold">v{note.version}</h3>
              <p className="mt-1 text-xs text-muted-foreground">{note.date}</p>
              <ul className="mt-2 list-disc space-y-1 pl-5 text-sm">
                {note.highlights.map((item) => (
                  <li key={item}>{item}</li>
                ))}
              </ul>
            </section>
          ))}
        </div>
      </DialogContent>
    </Dialog>
  );
}

function VersionFooterBar({ className, style }: { className?: string; style?: CSSProperties }): JSX.Element {
  return (
    <footer className={cn('z-30 border-t border-white/[0.06] bg-background/95 px-4 py-1 backdrop-blur', className)} style={style}>
      <div className="flex min-h-11 items-center justify-center gap-2">
        <SiteVersionTrigger className="min-h-11 rounded-md px-3 text-xs font-medium text-muted-foreground hover:text-foreground" />
        {SITE_BUILD_LABEL ? (
          <span className="text-[10px] text-muted-foreground">{SITE_BUILD_LABEL}</span>
        ) : null}
      </div>
    </footer>
  );
}

export function SiteVersionFooter(): JSX.Element {
  return <VersionFooterBar className="fixed inset-x-0 bottom-0" />;
}

/** Stays on the content column. The desktop sidebar keeps its own account menu. */
export function AppSiteVersionFooter(): JSX.Element {
  const { isMobile, state } = useSidebar();
  const reserveSidebar = !isMobile && state === 'expanded';
  return (
    <VersionFooterBar
      className="fixed bottom-0 right-0"
      style={{ left: reserveSidebar ? 'var(--sidebar-width)' : 0 }}
    />
  );
}

export function StudentFeedbackLauncher(): JSX.Element | null {
  const pathname = usePathname();
  if (pathname === '/feedback') return null;
  const fromQuery = pathname ? `?from=${encodeURIComponent(pathname)}` : '';
  return (
    <Link
      href={`/feedback${fromQuery}`}
      className={cn(
        'fixed bottom-20 right-4 z-40 inline-flex min-h-11 items-center gap-2 rounded-full border border-cyan-300/30 bg-[#07141a]/95 px-4 text-sm font-medium text-cyan-50 shadow-lg',
        'hover:border-cyan-200/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-200',
      )}
    >
      <MessageSquare className="h-4 w-4" aria-hidden="true" />
      提交反馈
    </Link>
  );
}
