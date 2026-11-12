'use client';

import { isValidElement, useEffect, useId, useRef, useState, type HTMLAttributes, type ReactElement, type ReactNode } from 'react';

function textContent(node: ReactNode): string {
  if (node === null || node === undefined || typeof node === 'boolean') return '';
  if (typeof node === 'string' || typeof node === 'number') return String(node);
  if (Array.isArray(node)) return node.map(textContent).join(' ');
  if (isValidElement(node)) {
    const props = (node as ReactElement<{ children?: ReactNode }>).props;
    return textContent(props.children);
  }
  return '';
}

function firstEmphasis(node: ReactNode): string {
  if (node === null || node === undefined || typeof node === 'boolean') return '';
  if (Array.isArray(node)) {
    for (const child of node) {
      const value = firstEmphasis(child);
      if (value) return value;
    }
    return '';
  }
  if (isValidElement(node)) {
    const element = node as ReactElement<{ children?: ReactNode; className?: string }>;
    const tag = typeof element.type === 'string' ? element.type : '';
    if (tag === 'strong' || tag === 'b') return textContent(element.props.children).trim();
    return firstEmphasis(element.props.children);
  }
  return '';
}

function conciseSummary(node: ReactNode): string {
  const text = textContent(node).replace(/\s+/g, ' ').trim();
  if (text.length <= 150) return text;
  const sentenceEnd = text.search(/[.!?](?=\s|$)/);
  const sentence = sentenceEnd >= 0 ? text.slice(0, sentenceEnd + 1) : text;
  if (sentence.length <= 150) return sentence;
  const cutoff = sentence.lastIndexOf(' ', 145);
  return sentence.slice(0, cutoff > 70 ? cutoff : 145).trimEnd() + '…';
}

function HelpDialog({ children, title, summary }: { children: ReactNode; title: string; summary: string }) {
  const [open, setOpen] = useState(false);
  const [dialogTitle, setDialogTitle] = useState(title || 'Information complémentaire');
  const titleId = useId();
  const triggerRef = useRef<HTMLButtonElement>(null);
  const closeRef = useRef<HTMLButtonElement>(null);
  const dialogRef = useRef<HTMLElement>(null);

  useEffect(() => {
    if (!open) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setOpen(false);
      if (event.key !== 'Tab') return;
      const focusable = Array.from(dialogRef.current?.querySelectorAll<HTMLElement>(
        'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])',
      ) ?? []).filter(element => !element.closest('[hidden]'));
      if (!focusable.length) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (event.shiftKey && (document.activeElement === first || !dialogRef.current?.contains(document.activeElement))) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && (document.activeElement === last || !dialogRef.current?.contains(document.activeElement))) {
        event.preventDefault();
        first.focus();
      }
    };
    const previousOverflow = document.body.style.overflow;
    const trigger = triggerRef.current;
    closeRef.current?.focus();
    document.body.style.overflow = 'hidden';
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.body.style.overflow = previousOverflow;
      document.removeEventListener('keydown', onKeyDown);
      trigger?.focus();
    };
  }, [open]);

  function showHelp() {
    const parent = triggerRef.current?.closest('section, article, .card, .qs-card, .notice, details');
    const heading = parent?.querySelector('h1, h2, h3, h4')?.textContent?.trim();
    setDialogTitle(heading || title || 'Information complémentaire');
    setOpen(true);
  }

  return (
    <>
      <button
        type="button"
        ref={triggerRef}
        className="app-help-trigger"
        aria-label={`Afficher les détails : ${dialogTitle || summary.slice(0, 70)}`}
        aria-haspopup="dialog"
        aria-expanded={open}
        title={`En savoir plus : ${dialogTitle}`}
        onClick={showHelp}
      >
        ?
      </button>
      <div hidden={!open} className="app-help-backdrop" onMouseDown={(event) => {
          if (event.target === event.currentTarget) setOpen(false);
        }}>
          <section ref={dialogRef} className="app-help-dialog" role="dialog" aria-modal="true" aria-labelledby={titleId}>
            <header className="app-help-dialog-header">
              <h2 id={titleId}>{dialogTitle}</h2>
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
  const completeText = textContent(children).replace(/\s+/g, ' ').trim();
  const summary = conciseSummary(children);

  // Scientific qualifications must remain visible alongside a result, even
  // when they occur after the first sentence of a longer explanation.
  const scientificQualification = /(?<!\p{L})(?:expérimental(?:e|es|s)?|non validé(?:e|es|s)?|non calibré(?:e|es|s)?|indisponible|incertitude|hypothès(?:e|es)|nuages?|limites?|non documenté(?:e|es|s)?)(?!\p{L})/iu.test(completeText);

  if (critical || scientificQualification || completeText.length <= 150) {
    return <p {...props}>{children}</p>;
  }

  const title = firstEmphasis(children) || 'Information complémentaire';
  return (
    <div className="app-help-summary">
      <HelpDialog title={title} summary={summary}>{children}</HelpDialog>
      <p {...props} className={[`app-help-summary-text`, props.className].filter(Boolean).join(' ')}>{summary}</p>
    </div>
  );
}
