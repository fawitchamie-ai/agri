'use client';

import { isValidElement, useEffect, useId, useState, type HTMLAttributes, type ReactElement, type ReactNode } from 'react';

function countText(node: ReactNode): number {
  if (node === null || node === undefined || typeof node === 'boolean') return 0;
  if (typeof node === 'string' || typeof node === 'number') return String(node).length;
  if (Array.isArray(node)) return node.reduce((total, child) => total + countText(child), 0);
  if (isValidElement(node)) {
    const props = (node as ReactElement<{ children?: ReactNode }>).props;
    return countText(props.children);
  }
  return 0;
}

function HelpDialog({ children }: { children: ReactNode }) {
  const [open, setOpen] = useState(false);
  const titleId = useId();

  useEffect(() => {
    if (!open) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setOpen(false);
    };
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.body.style.overflow = previousOverflow;
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [open]);

  return (
    <>
      <button
        type="button"
        className="app-help-trigger"
        aria-label="Afficher l’explication"
        aria-haspopup="dialog"
        aria-expanded={open}
        title="Afficher l’explication"
        onClick={() => setOpen(true)}
      >
        ?
      </button>
      {open && (
        <div className="app-help-backdrop" onMouseDown={(event) => {
          if (event.target === event.currentTarget) setOpen(false);
        }}>
          <section className="app-help-dialog" role="dialog" aria-modal="true" aria-labelledby={titleId}>
            <header className="app-help-dialog-header">
              <h2 id={titleId}>Information détaillée</h2>
              <button type="button" className="app-help-close" aria-label="Fermer" onClick={() => setOpen(false)}>×</button>
            </header>
            <div className="app-help-dialog-content">{children}</div>
          </section>
        </div>
      )}
    </>
  );
}

export function HelpParagraph({ children, ...props }: HTMLAttributes<HTMLParagraphElement>) {
  const critical = props.role === 'alert' || props.role === 'status' ||
    /(?:^|\\s)(?:notice-warning|notice--warning|warning-banner)(?:\\s|$)/.test(props.className ?? '');

  if (critical || countText(children) < 150) {
    return <p {...props}>{children}</p>;
  }

  return <HelpDialog>{children}</HelpDialog>;
}
