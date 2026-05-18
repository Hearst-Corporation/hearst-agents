"use client";

import { useRouter } from "next/navigation";
import { useRef, useState } from "react";
import { ConfirmModal } from "@/app/(user)/components/ConfirmModal";
import { FieldError, ValidatedForm } from "@/app/(user)/components/ui/ValidatedForm";
import { toast } from "@/app/hooks/use-toast";
import { createAgentSchema } from "@/lib/domain/schemas";

const providers = [
  { value: "openai", label: "OpenAI" },
  { value: "anthropic", label: "Anthropic" },
];

const defaultModels: Record<string, string[]> = {
  openai: ["gpt-4o", "gpt-4o-mini", "gpt-4-turbo", "o3-mini"],
  anthropic: ["claude-sonnet-4-6", "claude-3-5-haiku-20241022", "claude-opus-4-20250514"],
};

const DEFAULT_TEMPERATURE = 0.7;

export default function NewAgentPage() {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [confirmCancelOpen, setConfirmCancelOpen] = useState(false);

  const [form, setForm] = useState({
    name: "",
    description: "",
    model_provider: "openai",
    model_name: "gpt-4o",
    system_prompt: "",
    temperature: DEFAULT_TEMPERATURE,
    max_tokens: 4096,
  });

  const initialFormRef = useRef(form);
  const isDirty = JSON.stringify(form) !== JSON.stringify(initialFormRef.current);

  const handleCancelClick = (e: React.MouseEvent) => {
    e.preventDefault();
    if (isDirty) {
      setConfirmCancelOpen(true);
    } else {
      router.push("/admin/agents");
    }
  };

  const confirmCancel = () => {
    setConfirmCancelOpen(false);
    router.push("/admin/agents");
  };

  const set = (key: string, value: string | number) =>
    setForm((prev) => ({ ...prev, [key]: value }));

  const submitAgent = async (data: {
    name: string;
    model_name: string;
    model_provider: string;
    system_prompt: string;
    temperature: number;
    max_tokens: number;
    description?: string;
    [k: string]: unknown;
  }) => {
    setError(null);
    try {
      const res = await fetch("/api/agents", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      const json = await res.json();

      if (!json.ok) {
        const msg = json.error ?? "Erreur inconnue";
        setError(msg);
        toast.error("Échec création agent", msg);
        return;
      }
      router.push(`/admin/agents/${json.agent.id}`);
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Erreur réseau";
      setError(msg);
      toast.error("Échec création agent", msg);
    }
  };

  return (
    <div className="px-(--space-8) py-(--space-10) h-full overflow-y-auto">
      <h1 className="mb-(--space-8) t-24 font-light text-text">Nouvel agent</h1>

      {error && (
        <div className="mb-(--space-4) rounded-(--radius-md) bg-(--danger)/10 border border-(--danger)/25 p-(--space-4) t-13 text-(--danger)">
          {error}
        </div>
      )}

      <ValidatedForm schema={createAgentSchema} onValid={submitAgent}>
        {({ errors, submitting: validating, handleSubmit }) => (
          <form
            onSubmit={(e) => {
              e.preventDefault();
              void handleSubmit(form);
            }}
            className="max-w-xl space-y-(--space-5)"
          >
            <label className="block">
              <span className="mb-(--space-1) block t-9 font-mono uppercase tracking-(--tracking-stretch) text-text-faint">
                Nom
              </span>
              <input
                value={form.name}
                onChange={(e) => set("name", e.target.value)}
                className="w-full rounded-(--radius-md) border border-(--border-input) bg-(--bg-soft) px-(--space-3) py-(--space-2) t-13 text-text focus:border-(--accent-teal) focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-[var(--accent-teal-border-hover)] transition-colors"
              />
              <FieldError name="name" errors={errors} />
            </label>

            <label className="block">
              <span className="mb-(--space-1) block t-9 font-mono uppercase tracking-(--tracking-stretch) text-text-faint">
                Description
              </span>
              <input
                value={form.description}
                onChange={(e) => set("description", e.target.value)}
                className="w-full rounded-(--radius-md) border border-(--border-input) bg-(--bg-soft) px-(--space-3) py-(--space-2) t-13 text-text focus:border-(--accent-teal) focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-[var(--accent-teal-border-hover)] transition-colors"
              />
            </label>

            <div className="grid grid-cols-2 gap-(--space-4)">
              <label className="block">
                <span className="mb-(--space-1) block t-9 font-mono uppercase tracking-(--tracking-stretch) text-text-faint">
                  Provider
                </span>
                <select
                  value={form.model_provider}
                  onChange={(e) => {
                    const prov = e.target.value;
                    set("model_provider", prov);
                    set("model_name", defaultModels[prov]?.[0] ?? "");
                  }}
                  className="w-full rounded-(--radius-md) border border-(--border-input) bg-(--bg-soft) px-(--space-3) py-(--space-2) t-13 text-text focus:border-(--accent-teal) focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-[var(--accent-teal-border-hover)] transition-colors"
                >
                  {providers.map((p) => (
                    <option key={p.value} value={p.value}>
                      {p.label}
                    </option>
                  ))}
                </select>
              </label>

              <label className="block">
                <span className="mb-(--space-1) block t-9 font-mono uppercase tracking-(--tracking-stretch) text-text-faint">
                  Modèle
                </span>
                <select
                  value={form.model_name}
                  onChange={(e) => set("model_name", e.target.value)}
                  className="w-full rounded-(--radius-md) border border-(--border-input) bg-(--bg-soft) px-(--space-3) py-(--space-2) t-13 text-text focus:border-(--accent-teal) focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-[var(--accent-teal-border-hover)] transition-colors"
                >
                  {(defaultModels[form.model_provider] ?? []).map((m) => (
                    <option key={m} value={m}>
                      {m}
                    </option>
                  ))}
                </select>
              </label>
            </div>

            <label className="block">
              <span className="mb-(--space-1) block t-9 font-mono uppercase tracking-(--tracking-stretch) text-text-faint">
                System Prompt
              </span>
              <textarea
                rows={6}
                value={form.system_prompt}
                onChange={(e) => set("system_prompt", e.target.value)}
                className="w-full rounded-(--radius-md) border border-(--border-input) bg-(--bg-soft) px-(--space-3) py-(--space-2) font-mono t-13 text-text focus:border-(--accent-teal) focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-[var(--accent-teal-border-hover)] transition-colors"
                placeholder="Tu es un assistant expert en..."
              />
            </label>

            <div className="grid grid-cols-2 gap-(--space-4)">
              <label className="block">
                <span className="mb-(--space-1) block t-9 font-mono uppercase tracking-(--tracking-stretch) text-text-faint">
                  Température ({form.temperature})
                </span>
                <input
                  type="range"
                  min={0}
                  max={2}
                  step={0.1}
                  value={form.temperature}
                  onChange={(e) => set("temperature", parseFloat(e.target.value))}
                  className="w-full accent-(--accent-teal)"
                />
              </label>

              <label className="block">
                <span className="mb-(--space-1) block t-9 font-mono uppercase tracking-(--tracking-stretch) text-text-faint">
                  Max tokens
                </span>
                <input
                  type="number"
                  min={256}
                  max={128000}
                  value={form.max_tokens}
                  onChange={(e) => set("max_tokens", parseInt(e.target.value, 10))}
                  className="w-full rounded-(--radius-md) border border-(--border-input) bg-(--bg-soft) px-(--space-3) py-(--space-2) t-13 text-text focus:border-(--accent-teal) focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-[var(--accent-teal-border-hover)] transition-colors"
                />
              </label>
            </div>

            <div className="flex items-center justify-between gap-(--space-3) pt-(--space-2)">
              <button
                type="button"
                onClick={handleCancelClick}
                disabled={validating}
                className="t-12 font-medium px-(--space-6) py-(--space-2) rounded-(--radius-sm) border border-(--border-shell) text-text-muted hover:text-text hover:bg-(--surface-1) transition-colors disabled:opacity-50"
                data-testid="agent-new-cancel"
              >
                Annuler
              </button>
              <button
                type="submit"
                disabled={validating}
                className="t-12 font-medium px-(--space-6) py-(--space-2) rounded-(--radius-sm) border border-(--accent-teal)/50 bg-(--accent-teal)/10 text-(--accent-teal) hover:bg-(--accent-teal)/15 transition-colors disabled:opacity-50"
              >
                {validating ? "Création..." : "Créer l'agent"}
              </button>
            </div>
          </form>
        )}
      </ValidatedForm>

      <ConfirmModal
        open={confirmCancelOpen}
        title="Quitter sans enregistrer ?"
        description="Le brouillon de l'agent sera perdu."
        confirmLabel="Abandonner"
        cancelLabel="Rester"
        variant="danger"
        onConfirm={confirmCancel}
        onCancel={() => setConfirmCancelOpen(false)}
      />
    </div>
  );
}
