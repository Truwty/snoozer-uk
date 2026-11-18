import type { ButtonHTMLAttributes, InputHTMLAttributes, ReactNode, Ref, SelectHTMLAttributes } from "react";

export function Button({ variant = "secondary", className = "", ...props }: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: "primary" | "secondary" | "danger" }) {
  return <button className={`button ${variant === "secondary" ? "" : variant} ${className}`} {...props} />;
}
export function Field({ label, children }: { label: string; children: ReactNode }) {
  return <label className="field">{label}{children}</label>;
}
export function Select({ label, children, ...props }: SelectHTMLAttributes<HTMLSelectElement> & { label: string }) {
  return <Field label={label}><select className="select" {...props}>{children}</select></Field>;
}
export function FileDrop({ label, hint, hintId, ref, ...props }: InputHTMLAttributes<HTMLInputElement> & { label: string; hint: string; hintId?: string; ref?: Ref<HTMLInputElement> }) {
  return <label className="file-drop">{label}<input type="file" ref={ref} aria-label={label} {...props} /><small id={hintId}>{hint}</small></label>;
}
export function Disclosure({ title, children }: { title: string; children: ReactNode }) {
  return <details className="disclosure"><summary>{title}</summary><div className="stack">{children}</div></details>;
}
export function StatCard({ label, value, description }: { label: string; value: ReactNode; description?: string }) {
  return <div className="stat-card"><p className="muted">{label}</p><strong>{value}</strong>{description && <small>{description}</small>}</div>;
}
export function TableScroll({ label, children }: { label: string; children: ReactNode }) {
  return <div className="analytics-context-wrap" role="region" aria-label={label} tabIndex={0}>{children}</div>;
}
export function EmptyState({ title, description, children }: { title: string; description: string; children: ReactNode }) {
  return <section className="empty-state stack"><h2>{title}</h2><p className="muted">{description}</p><div>{children}</div></section>;
}
export function Card({ children }: { children: ReactNode }) {
  return <section className="panel stack">{children}</section>;
}
export function PageHeader({ title, description, children }: { title: string; description?: string; children?: ReactNode }) {
  return <header className="page-header stack"><h1>{title}</h1>{description && <p className="muted">{description}</p>}{children}</header>;
}
export function Toast({ message, kind }: { message: string; kind: string }) {
  return <p className={`message toast ${kind}`} role={kind === "error" ? "alert" : "status"}>{message}</p>;
}
export function ProgressBar({ label, value, max, description }: { label: string; value: number; max: number; description: string }) {
  return <div className="usage-progress"><progress aria-label={label} aria-valuetext={description} value={Math.min(value, Math.max(1, max))} max={Math.max(1, max)} /><span>{description}</span></div>;
}
