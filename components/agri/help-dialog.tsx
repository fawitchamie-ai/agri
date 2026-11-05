'use client';

import { isValidElement, useEffect, useId, useRef, useState, type HTMLAttributes, type ReactElement, type ReactNode } from 'react';

function textContent(node: ReactNode): string {\n  if (node === null || node === undefined || typeof node === 'boolean') return '';\n  if (typeof node === 'string' || typeof node === 'number') return String(node);\n  if (Array.isArray(node)) return node.map(textContent).join(' ');\n  if (isValidElement(node)) return textContent((node as ReactElement<{ children?: ReactNode }>).props.children);\n  return '';\n}\n\nfunction countText(node: ReactNode): number {
  if (node === null || node === undefined || typeof node === 'boolean') return 0;
  if (typeof node === 'string' || typeof node === 'number') return String(node).length;
  if (Array.isArray(node)) return node.reduce((total, child) => total + countText(child), 0);
  if (isValidElement(node)) {
    const props = (node as ReactElement<{ children?: ReactNode }>).props;
    return countText(props.children);
  }
  return 0;
}

export function HelpDialog({ children, title = 'Information détaillée' }: { children: ReactNode; title?: string }) {
  const [open, setOpen] = useState(false);
  const titleId = useId();
  const triggerRef = useRef<HTMLButtonElement>(null);
  const closeRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!open) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setOpen(false);
    };
    const previousOverflow = document.body.style.overflow;
    closeRef.current?.focus();
    document.body.style.overflow = 'hidden';
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.body.style.overflow = previousOverflow;
      document.removeEventListener('keydown', onKeyDown);
      triggerRef.current?.focus();
    };
  }, [open]);

  return (
    <>
      <button
        type="button"
        ref={triggerRef}
        className="app-help-trigger"
        aria-label="Afficher l’explication"
        aria-haspopup="dialog"
        aria-expanded={open}
        title="Afficher l’explication"
        onClick={() => setOpen(true)}
      >
        ?
      </button>
      <div hidden={!open} className="app-help-backdrop" onMouseDown={(event) => {
          if (event.target === event.currentTarget) setOpen(false);
        }}>
          <section className="app-help-dialog" role="dialog" aria-modal="true" aria-labelledby={titleId}>
            <header className="app-help-dialog-header">
              <h2 id={titleId}>{title}</h2>
              <button type="button" ref={closeRef} className="app-help-close" aria-label="Fermer" onClick={() => setOpen(false)}>×</button>
            </header>
            <div className="app-help-dialog-content">{children}</div>
          </section>
      </div>
    </>
  );
}

export function HelpParagraph({ children, ...props }: HTMLAttributes<HTMLParagraphElement>) {
  const critical = props.role === 'alert' || props.role === 'status' || props.className?.split(/\s+/).includes('mp-help') ||
    /(?:^|\s)warning-banner(?:\s|$)/.test(props.className ?? '') || /(?:^|\s)notice\s+warning(?:\s|$)/.test(props.className ?? '');

  if (critical || countText(children) < 150) {
    return <p {...props}>{children}</p>;
  }

  const summary = textContent(children).split(/(?<=[.!?])\s+/)[0]?.trim() ?? '';
  const concise = summary.length > 115 ? summary.slice(0, 112).trimEnd() + '…' : summary;
  return <p className="app-help-summary"><HelpDialog>{children}</HelpDialog><span>{concise || 'Afficher les détails'}</span></p>;
}
