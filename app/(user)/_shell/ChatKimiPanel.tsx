"use client";

/**
 * ChatKimiPanel — Kimi K2.6 intégré dans le RightRail visionOS.
 *
 * Wrapper applicatif autour de <ChatKimi> du package @hearst/cockpit-shell.
 * Aucun token .ct-* — stylé exclusivement avec les tokens visionOS du projet
 * (--text-*, --surface-*, --line-*, --space-*, Tailwind utilitaires).
 *
 * La route handler /api/cockpit-chat et lib/llm/kimiCockpit.ts restent
 * inchangés. ChatKimi pointe sur cet endpoint par défaut via useCockpit()
 * qui retourne chatConfig.apiEndpoint ?? "/api/cockpit-chat".
 *
 * Note : useCockpit() renvoie le contexte CockpitShell si le provider est
 * présent, sinon le contexte par défaut (apiEndpoint = "/api/cockpit-chat",
 * persistence = undefined). Les deux cas sont fonctionnels.
 */

import { ChatKimi } from "@hearst/cockpit-shell";

export function ChatKimiPanel() {
  return (
    <div className="vision-kimi-panel flex flex-1 flex-col overflow-hidden">
      <ChatKimiPanelStyles />
      <ChatKimi productName="Hearst OS" productColor="var(--accent-teal)" />
    </div>
  );
}

/**
 * Styles scoped pour le panel Kimi — surcharge les classes .ct-chat-* du package
 * avec les tokens visionOS du projet, sans polluer le reste de l'app.
 *
 * Stratégie : les classes .ct-chat-* sont injectées par le package dans
 * tokens.css. On les re-définit ici sous le scope .vision-kimi-panel pour
 * les rendre compatibles avec le look visionOS (fond transparent, texte blanc,
 * bordures --line-strong, etc.).
 */
function ChatKimiPanelStyles() {
  return (
    <style>{`
      /* ── Conteneur racine ─────────────────────────────────────── */
      .vision-kimi-panel .ct-chat-root {
        display: flex;
        flex-direction: column;
        height: 100%;
        overflow: hidden;
        background: transparent;
        font-family: inherit;
      }

      /* ── Barre d'action (bouton Nouveau) ─────────────────────── */
      .vision-kimi-panel .ct-chat-actionbar {
        display: flex;
        align-items: center;
        justify-content: flex-end;
        padding: var(--space-2) var(--space-3);
        border-bottom: 1px solid var(--line-strong);
        flex-shrink: 0;
      }

      .vision-kimi-panel .ct-chat-newbtn {
        font-size: 11px;
        font-weight: 500;
        letter-spacing: 0.08em;
        color: var(--text-faint);
        background: transparent;
        border: 1px solid var(--line-strong);
        border-radius: 6px;
        padding: 4px 10px;
        cursor: pointer;
        transition: color 0.2s ease, border-color 0.2s ease;
      }

      .vision-kimi-panel .ct-chat-newbtn:hover {
        color: var(--text-muted);
        border-color: rgba(255, 255, 255, 0.15);
      }

      /* ── Liste des messages ────────────────────────────────────── */
      .vision-kimi-panel .ct-chat-list {
        flex: 1;
        overflow-y: auto;
        padding: var(--space-3) var(--space-3);
        display: flex;
        flex-direction: column;
        gap: var(--space-2);
        scrollbar-width: thin;
        scrollbar-color: var(--line-strong) transparent;
      }

      .vision-kimi-panel .ct-chat-list::-webkit-scrollbar {
        width: 4px;
      }

      .vision-kimi-panel .ct-chat-list::-webkit-scrollbar-track {
        background: transparent;
      }

      .vision-kimi-panel .ct-chat-list::-webkit-scrollbar-thumb {
        background: var(--line-strong);
        border-radius: 2px;
      }

      /* ── Placeholder vide ─────────────────────────────────────── */
      .vision-kimi-panel .ct-placeholder {
        font-size: 12px;
        line-height: 1.6;
        color: var(--text-ghost);
        padding: var(--space-3);
        text-align: center;
        margin-top: var(--space-6);
      }

      /* ── Bulles de messages ────────────────────────────────────── */
      .vision-kimi-panel .ct-chat-msg {
        display: flex;
        flex-direction: column;
        max-width: 100%;
      }

      .vision-kimi-panel .ct-chat-msg.user {
        align-items: flex-end;
      }

      .vision-kimi-panel .ct-chat-msg.user > p,
      .vision-kimi-panel .ct-chat-msg.user > div {
        background: var(--surface-2);
        border: 1px solid var(--line-strong);
        border-radius: 10px 10px 2px 10px;
        padding: var(--space-2) var(--space-3);
        font-size: 13px;
        color: var(--text-soft);
        line-height: 1.5;
        max-width: 90%;
      }

      .vision-kimi-panel .ct-chat-msg.assistant {
        align-items: flex-start;
      }

      .vision-kimi-panel .ct-chat-msg.assistant > div {
        background: transparent;
        border: 1px solid var(--line);
        border-radius: 2px 10px 10px 10px;
        padding: var(--space-2) var(--space-3);
        font-size: 13px;
        color: var(--text-muted);
        line-height: 1.6;
        max-width: 100%;
        position: relative;
      }

      /* Markdown dans les réponses assistant */
      .vision-kimi-panel .ct-chat-msg.assistant pre {
        margin: var(--space-2) 0;
        border-radius: 6px;
        overflow-x: auto;
      }

      .vision-kimi-panel .ct-chat-msg.assistant code {
        font-size: 11px;
      }

      .vision-kimi-panel .ct-chat-msg.assistant ul {
        padding-left: var(--space-4);
      }

      .vision-kimi-panel .ct-chat-msg.assistant strong {
        color: var(--text-soft);
        font-weight: 600;
      }

      /* ── Typing indicator ─────────────────────────────────────── */
      .vision-kimi-panel .ct-chat-typing {
        display: flex;
        gap: 4px;
        align-items: center;
        padding: var(--space-2) var(--space-3);
      }

      .vision-kimi-panel .ct-chat-typing span {
        display: inline-block;
        width: 5px;
        height: 5px;
        border-radius: 50%;
        background: var(--accent-teal);
        opacity: 0.6;
        animation: vision-kimi-pulse 1.2s ease-in-out infinite;
      }

      .vision-kimi-panel .ct-chat-typing span:nth-child(2) {
        animation-delay: 0.2s;
      }

      .vision-kimi-panel .ct-chat-typing span:nth-child(3) {
        animation-delay: 0.4s;
      }

      @keyframes vision-kimi-pulse {
        0%, 60%, 100% { opacity: 0.2; transform: scale(0.8); }
        30% { opacity: 0.8; transform: scale(1); }
      }

      /* ── Curseur de streaming ─────────────────────────────────── */
      .vision-kimi-panel .ct-chat-cursor {
        display: inline-block;
        width: 2px;
        height: 14px;
        border-radius: 1px;
        margin-left: 2px;
        vertical-align: middle;
        animation: vision-kimi-blink 1s step-end infinite;
      }

      @keyframes vision-kimi-blink {
        0%, 100% { opacity: 1; }
        50% { opacity: 0; }
      }

      /* ── Erreur + retry ───────────────────────────────────────── */
      .vision-kimi-panel .ct-chat-error {
        display: flex;
        flex-direction: column;
        gap: var(--space-1);
        padding: var(--space-2) var(--space-3);
        border: 1px solid rgba(255, 51, 51, 0.2);
        border-radius: 8px;
        background: rgba(255, 51, 51, 0.05);
      }

      .vision-kimi-panel .ct-chat-error > p {
        font-size: 12px;
        color: rgba(255, 100, 100, 0.9);
      }

      .vision-kimi-panel .ct-chat-retry {
        font-size: 11px;
        color: var(--text-faint);
        background: transparent;
        border: none;
        cursor: pointer;
        text-align: left;
        padding: 0;
        transition: color 0.15s;
      }

      .vision-kimi-panel .ct-chat-retry:hover {
        color: var(--text-muted);
      }

      /* ── Formulaire d'envoi ────────────────────────────────────── */
      .vision-kimi-panel .ct-chat-form {
        display: flex;
        align-items: flex-end;
        gap: var(--space-2);
        padding: var(--space-2) var(--space-3) var(--space-3);
        border-top: 1px solid var(--line-strong);
        flex-shrink: 0;
      }

      .vision-kimi-panel .ct-chat-input {
        flex: 1;
        background: var(--surface-1);
        border: 1px solid var(--line-strong);
        border-radius: 8px;
        padding: var(--space-2) var(--space-3);
        font-size: 13px;
        color: var(--text-soft);
        resize: none;
        line-height: 1.5;
        font-family: inherit;
        transition: border-color 0.2s ease, box-shadow 0.2s ease;
        outline: none;
      }

      .vision-kimi-panel .ct-chat-input::placeholder {
        color: var(--text-ghost);
      }

      .vision-kimi-panel .ct-chat-input:focus {
        border-color: rgba(74, 139, 134, 0.4);
        box-shadow: var(--shadow-input-focus);
      }

      .vision-kimi-panel .ct-chat-input:disabled {
        opacity: 0.5;
        cursor: not-allowed;
      }

      .vision-kimi-panel .ct-chat-send {
        flex-shrink: 0;
        width: 32px;
        height: 32px;
        border-radius: 8px;
        border: 1px solid var(--line-strong);
        background: transparent;
        color: var(--text-faint);
        font-size: 16px;
        cursor: pointer;
        display: flex;
        align-items: center;
        justify-content: center;
        transition: background 0.2s ease, color 0.2s ease, border-color 0.2s ease;
      }

      .vision-kimi-panel .ct-chat-send:not(:disabled):hover {
        border-color: rgba(74, 139, 134, 0.5);
        color: white;
      }

      .vision-kimi-panel .ct-chat-send:disabled {
        opacity: 0.35;
        cursor: not-allowed;
      }
    `}</style>
  );
}
