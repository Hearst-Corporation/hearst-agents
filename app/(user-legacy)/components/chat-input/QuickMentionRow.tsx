"use client";

import { useRouter } from "next/navigation";
import type { ServiceDefinition } from "@/lib/integrations/types";

const QUICK_MENTION_VISIBLE_COUNT = 12;

interface QuickMentionRowProps {
  connectedServices: ServiceDefinition[];
  onMention: (service: ServiceDefinition) => void;
}

/**
 * Rangée de logos d'apps connectées sous le composer.
 * Click logo → insertion `@<service.id>` dans le textarea via `onMention`.
 * Bouton "+" → redirige vers `/apps` pour connecter une nouvelle app.
 */
export function QuickMentionRow({ connectedServices, onMention }: QuickMentionRowProps) {
  const router = useRouter();
  if (connectedServices.length === 0) return null;

  return (
    <div
      className="mt-3 flex items-center justify-center"
      style={{ gap: "var(--space-2)", minHeight: "var(--space-5)" }}
      aria-label="Mention rapide d'une app connectée"
    >
      <div
        className="flex items-center overflow-x-auto scrollbar-hide"
        style={{ gap: "var(--space-2)" }}
      >
        {connectedServices.slice(0, QUICK_MENTION_VISIBLE_COUNT).map((service) => (
          <button
            key={service.id}
            type="button"
            onClick={() => onMention(service)}
            title={`Mentionner @${service.id}`}
            aria-label={`Mentionner ${service.name}`}
            className="inline-flex items-center justify-center shrink-0 transition-opacity hover:opacity-100"
            style={{
              width: "var(--space-5)",
              height: "var(--space-5)",
              opacity: 0.7,
            }}
          >
            {service.icon ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={service.icon} alt="" width={16} height={16} aria-hidden />
            ) : (
              <span className="t-9 font-mono text-text-faint">{service.id.slice(0, 2)}</span>
            )}
          </button>
        ))}
        {connectedServices.length > QUICK_MENTION_VISIBLE_COUNT && (
          <span
            className="t-9 font-mono shrink-0"
            style={{ color: "var(--text-faint)" }}
            aria-hidden
          >
            +{connectedServices.length - QUICK_MENTION_VISIBLE_COUNT}
          </span>
        )}
      </div>
      <button
        type="button"
        onClick={() => router.push("/apps")}
        title="Connecter une nouvelle app"
        aria-label="Connecter une nouvelle app"
        className="inline-flex items-center justify-center shrink-0 transition-colors text-text-faint hover:text-(--accent-teal)"
        style={{
          width: "var(--space-5)",
          height: "var(--space-5)",
          marginLeft: "var(--space-2)",
        }}
      >
        <svg
          width="14"
          height="14"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.5"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden
        >
          <path d="M12 5v14M5 12h14" />
        </svg>
      </button>
    </div>
  );
}
