import type { ReactNode } from "react";

export function Eyebrow({ children }: { children: ReactNode }) {
  return <div className="ct-eyebrow">{children}</div>;
}

export function Title({ children }: { children: ReactNode }) {
  return <h1 className="ct-title">{children}</h1>;
}

export function Sub({ children }: { children: ReactNode }) {
  return <p className="ct-sub">{children}</p>;
}

export function KpiGrid({ children }: { children: ReactNode }) {
  return <div className="ct-kpi-grid">{children}</div>;
}

export function KpiCard({
  label,
  value,
  accent = false,
}: {
  label: string;
  value: ReactNode;
  accent?: boolean;
}) {
  return (
    <div className={`ct-kpi-card${accent ? " accent" : ""}`}>
      <div className="ct-kpi-label">{label}</div>
      <div className="ct-kpi-value">{value}</div>
    </div>
  );
}

export function Card({
  title,
  children,
}: {
  title: string;
  children: ReactNode;
}) {
  return (
    <div className="ct-card">
      <div className="ct-card-title">{title}</div>
      <div className="ct-card-body">{children}</div>
    </div>
  );
}
