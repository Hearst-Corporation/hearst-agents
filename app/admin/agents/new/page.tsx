"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { ConfirmModal } from "@/app/(user)/components/ConfirmModal";

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
  const [saving, setSaving] = useState(false);
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

  // Form "dirty" si l'utilisateur a touché un champ texte ou modifié la
  // température depuis la valeur par défaut. Sert à protéger contre les
  // pertes de brouillon au clic Annuler.
  const isDirty =
    form.name.trim() !== "" ||
    form.system_prompt.trim() !== "" ||
    form.temperature !== DEFAULT_TEMPERATURE;

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

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError(null);

    const res = await fetch("/api/agents", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(form),
    });
    const json = await res.json();

    if (!json.ok) {
      setError(json.error ?? "Erreur inconnue");
      setSaving(false);
      return;
    }
    router.push(`/admin/agents/${json.agent.id}`);
  };

  return (
    <div className="px-(--space-8) py-(--space-10) h-full overflow-y-auto">
      <h1 className="mb-(--space-8) t-24 font-light text-text">Nouvel agent</h1>

      {error && (
        <div className="mb-(--space-4) rounded-(--radius-md) bg-(--danger)/10 border border-(--danger)/25 p-(--space-4) t-13 text-(--danger)">
          {error}
        </div>
      )}

      <form onSubmit={submit} className="max-w-xl space-y-(--space-5)">
        {/* Name */}
        <label className="block">
          <span className="mb-(--space-1) block t-9 font-mono uppercase tracking-(--tracking-stretch) text-text-faint">
            Nom
          </span>
          <input
            required
            value={form.name}
            onChange={(e) => set("name", e.target.value)}
            className="w-full rounded-(--radius-md) border border-(--border-input) bg-(--bg-soft) px-(--space-3) py-(--space-2) t-13 text-text focus:border-(--accent-teal) focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-[var(--accent-teal-border-hover)] transition-colors"
          />
        </label>

        {/* Description */}
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

        {/* Provider + Model */}
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

        {/* System Prompt */}
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

        {/* Temperature + Max tokens */}
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

        <div className="flex items-center gap-(--space-3)">
          <button
            type="submit"
            disabled={saving}
            className="t-12 font-medium px-(--space-6) py-(--space-2) rounded-(--radius-sm) border border-(--accent-teal)/50 bg-(--accent-teal)/10 text-(--accent-teal) hover:bg-(--accent-teal)/15 transition-colors disabled:opacity-50"
          >
            {saving ? "Création..." : "Créer l'agent"}
          </button>
          <button
            type="button"
            onClick={handleCancelClick}
            disabled={saving}
            className="t-12 font-light px-(--space-4) py-(--space-2) rounded-(--radius-sm) border border-(--border-default) text-text-muted hover:text-text transition-colors disabled:opacity-50"
            data-testid="agent-new-cancel"
          >
            Annuler
          </button>
        </div>
      </form>

      <ConfirmModal
        open={confirmCancelOpen}
        title="Quitter sans enregistrer ?"
        description="Le brouillon de l'agent sera perdu."
        confirmLabel="Quitter"
        cancelLabel="Continuer l'édition"
        variant="danger"
        onConfirm={confirmCancel}
        onCancel={() => setConfirmCancelOpen(false)}
      />
    </div>
  );
}
