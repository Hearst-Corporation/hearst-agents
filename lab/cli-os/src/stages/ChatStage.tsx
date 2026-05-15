const TEAL = "#4A8B86";

const TOOLS = [
  {
    mono: "GM",
    monoBg: "rgba(255,255,255,0.08)",
    monoColor: "white",
    name: "gmail.search_threads",
    sub: "from:marie.dupont@atlante.vc · 30 derniers jours",
  },
  {
    mono: "KG",
    monoBg: "rgba(94,229,195,0.15)",
    monoColor: TEAL,
    name: "kg.lookup_entity",
    sub: "Marie Dupont · contexte relationnel · 14 nœuds liés",
  },
  {
    mono: "MR",
    monoBg: "rgba(255,255,255,0.06)",
    monoColor: "white",
    name: "memory.retrieve",
    sub: "historique interactions · cluster atlante-q3",
  },
];

export function ChatStage() {
  return (
    <div className="flex flex-col gap-16">
      {/* Question bulle */}
      <div
        className="rounded-2xl px-5 py-4 text-sm font-light leading-relaxed"
        style={{
          background: "rgba(255,255,255,0.025)",
          border: "1px solid rgba(255,255,255,0.08)",
          color: "rgba(255,255,255,0.55)",
        }}
      >
        Tu — « Qu&apos;est-ce que Marie Dupont attendait dans son dernier email ? »
      </div>

      {/* Réponse agent */}
      <div
        className="text-base font-light leading-relaxed"
        style={{ color: "rgba(255,255,255,0.85)" }}
      >
        Marie Dupont attendait une réponse sur le term sheet Atlante VC. Elle a envoyé 3 relances en
        8 jours. Son dernier email (il y a 11h) demande explicitement une position avant vendredi
        17h. J&apos;ai préparé un draft de réponse dans ton ton — confirmant l&apos;intérêt sans
        engager les conditions.
      </div>

      {/* Tool cards */}
      <div className="flex flex-col gap-2">
        {TOOLS.map((t) => (
          <div
            key={t.name}
            className="flex items-center gap-4 rounded-xl px-4 py-3"
            style={{
              background: "rgba(255,255,255,0.03)",
              border: "1px solid rgba(255,255,255,0.07)",
            }}
          >
            {/* Monogram */}
            <div
              className="w-8 h-8 rounded-lg flex items-center justify-center font-mono text-[11px] font-semibold shrink-0"
              style={{ background: t.monoBg, color: t.monoColor }}
            >
              {t.mono}
            </div>

            {/* Body */}
            <div className="flex-1 min-w-0">
              <div className="font-mono text-[11px]" style={{ color: "rgba(255,255,255,0.75)" }}>
                {t.name}
              </div>
              <div className="text-xs mt-0.5 truncate" style={{ color: "rgba(255,255,255,0.35)" }}>
                {t.sub}
              </div>
            </div>

            {/* Status */}
            <div className="font-mono text-[10px] shrink-0" style={{ color: TEAL }}>
              ✓ done
            </div>
          </div>
        ))}
      </div>

      {/* Follow-up résumé */}
      <div
        className="text-sm font-light leading-relaxed"
        style={{ color: "rgba(255,255,255,0.65)" }}
      >
        <strong style={{ color: "white" }}>En résumé :</strong> Marie veut une position claire sur
        l&apos;entrée au capital avant vendredi 17h. Je peux envoyer le draft — tu valides la
        tonalité ou tu ajustes les conditions ?
      </div>
    </div>
  );
}
