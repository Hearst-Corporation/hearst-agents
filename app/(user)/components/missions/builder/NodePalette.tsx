"use client";
// lint-visual-disable-file — couleurs hex = identités visuelles de marques tierces (Gmail, Slack, Calendar, Google) non tokenisables

import type React from "react";
import type { WorkflowNodeKind } from "@/lib/workflows/types";
import { BRAND_COLORS } from "@/lib/connectors/composio/brand-colors";

export interface PaletteEntry {
  kind: WorkflowNodeKind;
  label: string;
  defaultConfig?: Record<string, unknown>;
}

interface NodePaletteProps {
  onAdd: (entry: PaletteEntry) => void;
}

// ── SVG icons ──────────────────────────────────────────────────

function IconManual() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M18 11V6a2 2 0 0 0-2-2v0a2 2 0 0 0-2 2v0" />
      <path d="M14 10V4a2 2 0 0 0-2-2v0a2 2 0 0 0-2 2v2" />
      <path d="M10 10.5V6a2 2 0 0 0-2-2v0a2 2 0 0 0-2 2v8" />
      <path d="M18 8a2 2 0 1 1 4 0v6a8 8 0 0 1-8 8h-2c-2.8 0-4.5-.86-5.99-2.34l-3.6-3.6a2 2 0 0 1 2.83-2.82L7 15" />
    </svg>
  );
}

function IconCron() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="10" />
      <polyline points="12 6 12 12 16 14" />
    </svg>
  );
}

function IconWebhook() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71" />
      <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71" />
    </svg>
  );
}

function IconCondition() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="22 12 18 12 15 21 9 3 6 12 2 12" />
    </svg>
  );
}

function IconTransform() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="16 3 21 3 21 8" />
      <line x1="4" y1="20" x2="21" y2="3" />
      <polyline points="21 16 21 21 16 21" />
      <line x1="15" y1="15" x2="21" y2="21" />
    </svg>
  );
}

function IconApproval() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
      <circle cx="12" cy="7" r="4" />
    </svg>
  );
}

function IconOutput() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
      <polyline points="14 2 14 8 20 8" />
      <line x1="16" y1="13" x2="8" y2="13" />
      <line x1="16" y1="17" x2="8" y2="17" />
      <polyline points="10 9 9 9 8 9" />
    </svg>
  );
}

// Brand logos (simplified SVG, monochrome — colorized via fill)

function LogoGmail() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
      <path d="M24 5.457v13.909c0 .904-.732 1.636-1.636 1.636h-3.819V11.73L12 16.64l-6.545-4.91v9.273H1.636A1.636 1.636 0 0 1 0 19.366V5.457c0-2.023 2.309-3.178 3.927-1.964L5.455 4.64 12 9.548l6.545-4.91 1.528-1.145C21.69 2.28 24 3.434 24 5.457z" />
    </svg>
  );
}

function LogoSlack() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
      <path d="M5.042 15.165a2.528 2.528 0 0 1-2.52 2.523A2.528 2.528 0 0 1 0 15.165a2.527 2.527 0 0 1 2.522-2.52h2.52v2.52zM6.313 15.165a2.527 2.527 0 0 1 2.521-2.52 2.527 2.527 0 0 1 2.521 2.52v6.313A2.528 2.528 0 0 1 8.834 24a2.528 2.528 0 0 1-2.521-2.522v-6.313zM8.834 5.042a2.528 2.528 0 0 1-2.521-2.52A2.528 2.528 0 0 1 8.834 0a2.528 2.528 0 0 1 2.521 2.522v2.52H8.834zM8.834 6.313a2.528 2.528 0 0 1 2.521 2.521 2.528 2.528 0 0 1-2.521 2.521H2.522A2.528 2.528 0 0 1 0 8.834a2.528 2.528 0 0 1 2.522-2.521h6.312zM18.956 8.834a2.528 2.528 0 0 1 2.522-2.521A2.528 2.528 0 0 1 24 8.834a2.528 2.528 0 0 1-2.522 2.521h-2.522V8.834zM17.688 8.834a2.528 2.528 0 0 1-2.523 2.521 2.527 2.527 0 0 1-2.52-2.521V2.522A2.527 2.527 0 0 1 15.165 0a2.528 2.528 0 0 1 2.523 2.522v6.312zM15.165 18.956a2.528 2.528 0 0 1 2.523 2.522A2.528 2.528 0 0 1 15.165 24a2.527 2.527 0 0 1-2.52-2.522v-2.522h2.52zM15.165 17.688a2.527 2.527 0 0 1-2.52-2.523 2.526 2.526 0 0 1 2.52-2.52h6.313A2.527 2.527 0 0 1 24 15.165a2.528 2.528 0 0 1-2.522 2.523h-6.313z" />
    </svg>
  );
}

function LogoCalendar() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
      <line x1="16" y1="2" x2="16" y2="6" />
      <line x1="8" y1="2" x2="8" y2="6" />
      <line x1="3" y1="10" x2="21" y2="10" />
      <text x="12" y="19" textAnchor="middle" fontSize="7" fontWeight="600" fill="currentColor" stroke="none">GCal</text>
    </svg>
  );
}

function LogoDrive() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
      <path d="M4.433 22.396L1.987 18.028 8.381 7.019l2.449 4.372L4.433 22.396zm5.586-8.697l2.442 4.36H1.985l2.445-4.36h5.589zm.87-1.551L7.513 5.776h9.892l-6.516 6.372z" />
    </svg>
  );
}

function LogoSearch() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="11" cy="11" r="8" />
      <line x1="21" y1="21" x2="16.65" y2="16.65" />
    </svg>
  );
}

// ── Palette data ───────────────────────────────────────────────

const TRIGGERS: PaletteEntry[] = [
  { kind: "trigger", label: "Manuel",   defaultConfig: { mode: "manual" } },
  { kind: "trigger", label: "Planifié", defaultConfig: { mode: "cron", cron: "0 9 * * *" } },
  { kind: "trigger", label: "Signal",   defaultConfig: { mode: "webhook" } },
];

const TRIGGER_ICONS = [IconManual, IconCron, IconWebhook];

interface AppAction {
  entry: PaletteEntry;
  Logo: () => React.ReactElement;
  color: string;
}

const APP_ACTIONS: AppAction[] = [
  {
    entry: { kind: "tool_call", label: "Gmail",    defaultConfig: { tool: "gmail_send", args: { to: "", content: "" } } },
    Logo: LogoGmail,
    color: BRAND_COLORS.gmail,
  },
  {
    entry: { kind: "tool_call", label: "Slack",    defaultConfig: { tool: "slack_send_message", args: { channel: "", content: "" } } },
    Logo: LogoSlack,
    color: BRAND_COLORS.slack,
  },
  {
    entry: { kind: "tool_call", label: "Agenda",   defaultConfig: { tool: "calendar_create_event", args: { title: "", start: "", end: "" } } },
    Logo: LogoCalendar,
    color: BRAND_COLORS.googleCalendar,
  },
  {
    entry: { kind: "tool_call", label: "Drive",    defaultConfig: { tool: "drive_create_doc", args: { title: "", content: "" } } },
    Logo: LogoDrive,
    color: BRAND_COLORS.googleDrive,
  },
  {
    entry: { kind: "tool_call", label: "Recherche", defaultConfig: { tool: "search_web", args: { query: "" } } },
    Logo: LogoSearch,
    color: BRAND_COLORS.searchWeb,
  },
];

const UTILITY_ENTRIES: (PaletteEntry & { Icon: () => React.ReactElement })[] = [
  { kind: "condition", label: "Condition",  Icon: IconCondition,  defaultConfig: { expression: "" } },
  { kind: "transform", label: "Transform",  Icon: IconTransform,  defaultConfig: { expression: "" } },
  { kind: "approval",  label: "Validation", Icon: IconApproval,   defaultConfig: { preview: "Confirmer cette action ?" } },
  { kind: "output",    label: "Asset",      Icon: IconOutput,     defaultConfig: { payload: {} } },
];

// ── Component ──────────────────────────────────────────────────

export function NodePalette({ onAdd }: NodePaletteProps) {
  return (
    <div className="flex flex-col" style={{ gap: "var(--space-6)" }}>

      {/* Déclencheurs */}
      <div className="flex flex-col" style={{ gap: "var(--space-2)" }}>
        <span className="t-9 font-medium text-text-faint uppercase tracking-wider">
          Déclencheurs
        </span>
        <div className="flex flex-col" style={{ gap: "var(--space-1)" }}>
          {TRIGGERS.map((entry, i) => {
            const Icon = TRIGGER_ICONS[i];
            return (
              <button
                key={entry.label}
                type="button"
                onClick={() => onAdd(entry)}
                className="flex items-center gap-3 w-full text-left rounded-md transition-[background-color,border-color,color] group"
                style={{
                  padding: "var(--space-2) var(--space-3)",
                  border: "1px solid var(--border-soft)",
                  background: "var(--bg-elev)",
                  transitionDuration: "var(--duration-base)",
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.borderColor = "var(--accent-teal-border)";
                  e.currentTarget.style.background = "var(--accent-teal-surface)";
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.borderColor = "var(--border-soft)";
                  e.currentTarget.style.background = "var(--bg-elev)";
                }}
              >
                <span className="text-text-muted group-hover:text-(--accent-teal) transition-colors" style={{ transitionDuration: "var(--duration-base)" }}>
                  <Icon />
                </span>
                <span className="t-11 font-medium text-text-soft group-hover:text-(--accent-teal) transition-colors flex-1" style={{ transitionDuration: "var(--duration-base)" }}>
                  {entry.label}
                </span>
                <span className="t-9 font-mono text-text-faint opacity-0 group-hover:opacity-100 transition-opacity" style={{ transitionDuration: "var(--duration-base)" }}>
                  +
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Actions — apps */}
      <div className="flex flex-col" style={{ gap: "var(--space-2)" }}>
        <span className="t-9 font-medium text-text-faint uppercase tracking-wider">
          Actions
        </span>
        <div
          className="grid gap-2"
          style={{ gridTemplateColumns: "1fr 1fr" }}
        >
          {APP_ACTIONS.map(({ entry, Logo, color }) => (
            <button
              key={entry.label}
              type="button"
              onClick={() => onAdd(entry)}
              className="flex flex-col items-center justify-center rounded-md border transition-[background-color,border-color,color] group"
              style={{
                padding: "var(--space-3) var(--space-2)",
                gap: "var(--space-2)",
                border: "1px solid var(--border-soft)",
                background: "var(--bg-elev)",
                transitionDuration: "var(--duration-base)",
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.borderColor = color + "66";
                e.currentTarget.style.background = color + "11";
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.borderColor = "var(--border-soft)";
                e.currentTarget.style.background = "var(--bg-elev)";
              }}
            >
              <span style={{ color }}>
                <Logo />
              </span>
              <span className="t-9 font-medium text-text-muted">
                {entry.label}
              </span>
            </button>
          ))}
        </div>
      </div>

      {/* Logique + Validation + Sortie */}
      <div className="flex flex-col" style={{ gap: "var(--space-2)" }}>
        <span className="t-9 font-medium text-text-faint uppercase tracking-wider">
          Logique & sorties
        </span>
        <div className="grid gap-1" style={{ gridTemplateColumns: "1fr 1fr" }}>
          {UTILITY_ENTRIES.map(({ Icon, label, ...entry }) => (
            <button
              key={label}
              type="button"
              onClick={() => onAdd({ label, ...entry })}
              className="flex items-center gap-2 rounded-md border transition-[background-color,border-color,color] group"
              style={{
                padding: "var(--space-2) var(--space-3)",
                border: "1px solid var(--border-soft)",
                background: "transparent",
                transitionDuration: "var(--duration-base)",
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.borderColor = "var(--border-default)";
                e.currentTarget.style.background = "var(--bg-elev)";
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.borderColor = "var(--border-soft)";
                e.currentTarget.style.background = "transparent";
              }}
            >
              <span className="text-text-faint group-hover:text-text-muted transition-colors" style={{ transitionDuration: "var(--duration-base)" }}>
                <Icon />
              </span>
              <span className="t-9 font-medium text-text-faint group-hover:text-text-soft transition-colors" style={{ transitionDuration: "var(--duration-base)" }}>
                {label}
              </span>
            </button>
          ))}
        </div>
      </div>

    </div>
  );
}
