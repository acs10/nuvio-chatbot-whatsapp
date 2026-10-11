"use client";

import Link from "next/link";
import { useEffect, type InputHTMLAttributes, type ReactNode, type SelectHTMLAttributes, type TextareaHTMLAttributes } from "react";
import { Icon, type IconName } from "./Icon";

/** Logo do design ("Nuvio"), como link para o início. */
export function Logo({ light = false, href = "/" }: { light?: boolean; href?: string }) {
  return (
    <Link className={`brand ${light ? "brand--light" : ""}`} href={href} aria-label="Nuvio — início">
      <span className="brand-mark">
        <span />
        <span />
      </span>
      <span>Nuvio</span>
    </Link>
  );
}

type FieldProps = { label: string; hint?: string; error?: string; full?: boolean; optional?: boolean };

export function Field({ label, hint, error, full, optional, className = "", ...rest }: FieldProps & InputHTMLAttributes<HTMLInputElement>) {
  return (
    <label className={`field ${full ? "field--full" : ""} ${error ? "field--error" : ""} ${className}`}>
      <span>
        {label} {optional && <em>opcional</em>}
      </span>
      <input aria-invalid={!!error} {...rest} />
      {error ? <small className="field-error">{error}</small> : hint ? <small className="field-hint">{hint}</small> : null}
    </label>
  );
}

export function SelectField({ label, hint, error, full, children, className = "", ...rest }: FieldProps & SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <label className={`field ${full ? "field--full" : ""} ${className}`}>
      <span>{label}</span>
      <select {...rest}>{children}</select>
      {error ? <small className="field-error">{error}</small> : hint ? <small className="field-hint">{hint}</small> : null}
    </label>
  );
}

export function TextArea({ label, hint, error, full, optional, className = "", ...rest }: FieldProps & TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return (
    <label className={`field ${full ? "field--full" : ""} ${error ? "field--error" : ""} ${className}`}>
      <span>
        {label} {optional && <em>opcional</em>}
      </span>
      <textarea aria-invalid={!!error} {...rest} />
      {error ? <small className="field-error">{error}</small> : hint ? <small className="field-hint">{hint}</small> : null}
    </label>
  );
}

/** Interruptor liga/desliga acessível. */
export function Toggle({ checked, onChange, label }: { checked: boolean; onChange: (v: boolean) => void; label: string }) {
  return (
    <button type="button" role="switch" aria-checked={checked} aria-label={label} className={`toggle ${checked ? "toggle--on" : ""}`} onClick={() => onChange(!checked)}>
      <i />
    </button>
  );
}

export function Modal({ title, description, onClose, children, footer, wide }: { title: string; description?: string; onClose: () => void; children: ReactNode; footer?: ReactNode; wide?: boolean }) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
  }, [onClose]);
  return (
    <div className="modal-backdrop" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className={`modal ${wide ? "modal--wide" : ""}`} role="dialog" aria-modal="true" aria-label={title}>
        <header className="modal-head">
          <div>
            <h2>{title}</h2>
            {description && <p>{description}</p>}
          </div>
          <button className="icon-button" type="button" onClick={onClose} aria-label="Fechar">
            <Icon name="x" size={18} />
          </button>
        </header>
        <div className="modal-body">{children}</div>
        {footer && <footer className="modal-foot">{footer}</footer>}
      </div>
    </div>
  );
}

export function StatusPill({ tone, children }: { tone: "success" | "active" | "neutral" | "warning" | "danger"; children: ReactNode }) {
  return (
    <span className={`table-status table-status--${tone}`}>
      <i />
      {children}
    </span>
  );
}

export function EmptyState({ icon, title, text, action }: { icon: IconName; title: string; text: string; action?: ReactNode }) {
  return (
    <div className="empty-state">
      <span className="resource-icon">
        <Icon name={icon} />
      </span>
      <h3>{title}</h3>
      <p>{text}</p>
      {action}
    </div>
  );
}

/** Cabeçalho das páginas do painel (do design), com ações à direita. */
export function DashboardHeader({ title, description, actions }: { title: string; description: string; actions?: ReactNode }) {
  return (
    <header className="dashboard-header">
      <div>
        <h1>{title}</h1>
        <p>{description}</p>
      </div>
      <div className="dashboard-head-actions">{actions}</div>
    </header>
  );
}
