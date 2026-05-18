/**
 * Monthly Card — Rendu visuel "Hearst OS Wrapped".
 *
 * Composant React server-rendered consommé par :
 *   - `app/hearst-card/[userId]/[yearMonth]/page.tsx` (rendu HTML in-app)
 *   - `app/public/hearst-card/[token]/page.tsx`      (page publique partage)
 *
 * Format : 1080×1920 (Stories vertical) — adapté Twitter/LinkedIn quand
 * uploadé en média, et lisible sans crop sur mobile. Style "silent
 * luxury" : fond gradient teal sourd → noir, typo éditoriale, sections
 * numérotées, halo accent intentionnel (logo + best moment).
 *
 * Aucune dépendance Tailwind ici — uniquement des inline styles avec
 * tokens `var(--…)` quand on est dans le shell de l'app, et des fallbacks
 * hardcodés pour le screenshot Playwright qui peut tourner hors layout.
 */

import type { MonthlyCardData } from "./monthly-card";

interface MonthlyCardViewProps {
  data: MonthlyCardData;
  /** Mode d'affichage. `screenshot` = pas de wrappers/animations. */
  mode?: "screen" | "screenshot";
}

const CARD_WIDTH = 1080;
const CARD_HEIGHT = 1920;

// Couleurs spécifiques à la Hearst Card — non ajoutées au DS car propres au
// rendu Stories 1080×1920 (fond gradient éditorial, hors palette UI cockpit).
const COLOR_BG_TOP = "#0a1f24";
const COLOR_BG_BOTTOM = "#020608";
const COLOR_TEXT = "#f4f5f3";
const COLOR_TEXT_SOFT = "rgba(244,245,243,0.72)";
const COLOR_TEXT_FAINT = "rgba(244,245,243,0.42)";
const COLOR_ACCENT = "var(--accent-teal)"; // token DS canonique
const COLOR_BORDER = "rgba(244,245,243,0.08)";

function formatNumber(n: number): string {
  return new Intl.NumberFormat("fr-FR").format(n);
}

export function MonthlyCardView({ data, mode = "screen" }: MonthlyCardViewProps) {
  const { window: w, missionsRun, reportsGenerated, anomaliesCount, kpis, bestMoment } = data;

  const containerStyle: React.CSSProperties = {
    width: `${CARD_WIDTH}px`,
    height: `${CARD_HEIGHT}px`,
    background: `linear-gradient(180deg, ${COLOR_BG_TOP} 0%, ${COLOR_BG_BOTTOM} 100%)`,
    color: COLOR_TEXT,
    fontFamily: "'Satoshi Variable', -apple-system, BlinkMacSystemFont, 'Inter', sans-serif",
    display: "flex",
    flexDirection: "column",
    padding: "96px 80px",
    boxSizing: "border-box",
    position: "relative",
    overflow: "hidden",
  };

  const haloStyle: React.CSSProperties = {
    position: "absolute",
    top: "-200px",
    right: "-200px",
    width: "640px",
    height: "640px",
    borderRadius: "50%",
    background: `radial-gradient(circle, ${COLOR_ACCENT}33 0%, transparent 70%)`,
    pointerEvents: "none",
  };

  const wrapper = (children: React.ReactNode) =>
    mode === "screenshot" ? (
      <div style={containerStyle}>{children}</div>
    ) : (
      <div
        style={{
          minHeight: "100vh",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: COLOR_BG_BOTTOM,
          padding: "32px 0",
        }}
      >
        <div style={{ ...containerStyle, transform: "scale(0.45)", transformOrigin: "top center" }}>
          {children}
        </div>
      </div>
    );

  return wrapper(
    <>
      <div style={haloStyle} aria-hidden />

      {/* Header — Logo Hearst */}
      <header
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          marginBottom: "120px",
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: "16px",
          }}
        >
          <div
            style={{
              width: "48px",
              height: "48px",
              borderRadius: "12px",
              background: COLOR_ACCENT,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: "28px",
              fontWeight: 600,
              color: "#0a1f24",
              letterSpacing: "-0.04em",
            }}
          >
            H
          </div>
          <span
            style={{
              fontSize: "24px",
              fontWeight: 400,
              letterSpacing: "0.02em",
            }}
          >
            Hearst OS
          </span>
        </div>
        <span
          style={{
            fontSize: "18px",
            color: COLOR_TEXT_FAINT,
            letterSpacing: "0.08em",
            textTransform: "uppercase",
            fontWeight: 300,
          }}
        >
          Wrapped
        </span>
      </header>

      {/* Title block */}
      <section style={{ marginBottom: "100px" }}>
        <p
          style={{
            fontSize: "22px",
            color: COLOR_TEXT_SOFT,
            margin: 0,
            marginBottom: "24px",
            fontWeight: 300,
            letterSpacing: "0.01em",
          }}
        >
          Votre mois avec l&apos;OS
        </p>
        <h1
          style={{
            fontSize: "120px",
            fontWeight: 300,
            letterSpacing: "-0.04em",
            lineHeight: 0.95,
            margin: 0,
            color: COLOR_TEXT,
          }}
        >
          {w.label}
        </h1>
      </section>

      {/* KPIs — 3 colonnes */}
      <section
        style={{
          display: "grid",
          gridTemplateColumns: "1fr 1fr 1fr",
          gap: "32px",
          marginBottom: "96px",
        }}
      >
        {kpis.map((kpi, idx) => (
          <div
            key={kpi.label}
            style={{
              display: "flex",
              flexDirection: "column",
              gap: "12px",
              borderLeft: idx === 0 ? "none" : `1px solid ${COLOR_BORDER}`,
              paddingLeft: idx === 0 ? 0 : "24px",
            }}
          >
            <span
              style={{
                fontSize: "14px",
                color: COLOR_TEXT_FAINT,
                letterSpacing: "0.12em",
                textTransform: "uppercase",
                fontWeight: 400,
              }}
            >
              {kpi.label}
            </span>
            <span
              style={{
                fontSize: "72px",
                fontWeight: 300,
                letterSpacing: "-0.03em",
                lineHeight: 1,
                color: COLOR_TEXT,
              }}
            >
              {kpi.value}
            </span>
            {kpi.delta ? (
              <span
                style={{
                  fontSize: "16px",
                  color: COLOR_TEXT_SOFT,
                  fontWeight: 400,
                }}
              >
                {kpi.delta}
              </span>
            ) : null}
          </div>
        ))}
      </section>

      {/* Sections numérotées : missions / rapports / anomalies */}
      <section
        style={{
          display: "flex",
          flexDirection: "column",
          gap: "48px",
          marginBottom: "96px",
        }}
      >
        <NumberedRow number="01" label="Missions exécutées" value={formatNumber(missionsRun)} />
        <NumberedRow number="02" label="Rapports générés" value={formatNumber(reportsGenerated)} />
        <NumberedRow
          number="03"
          label="Signaux à inspecter"
          value={formatNumber(anomaliesCount)}
          accent={anomaliesCount > 0}
        />
      </section>

      {/* Best moment */}
      {bestMoment ? (
        <section
          style={{
            marginBottom: "auto",
            padding: "32px 36px",
            background: "rgba(95,182,168,0.08)",
            borderLeft: `3px solid ${COLOR_ACCENT}`,
            borderRadius: "4px",
          }}
        >
          <span
            style={{
              fontSize: "14px",
              color: COLOR_ACCENT,
              letterSpacing: "0.12em",
              textTransform: "uppercase",
              fontWeight: 500,
              display: "block",
              marginBottom: "12px",
            }}
          >
            Moment fort
          </span>
          <p
            style={{
              fontSize: "32px",
              fontWeight: 400,
              color: COLOR_TEXT,
              margin: 0,
              marginBottom: "8px",
              letterSpacing: "-0.01em",
              lineHeight: 1.2,
            }}
          >
            {bestMoment.title}
          </p>
          <p
            style={{
              fontSize: "18px",
              color: COLOR_TEXT_SOFT,
              margin: 0,
              fontWeight: 300,
            }}
          >
            {bestMoment.reason}
          </p>
        </section>
      ) : (
        <div style={{ marginBottom: "auto" }} />
      )}

      {/* Footer */}
      <footer
        style={{
          marginTop: "80px",
          paddingTop: "32px",
          borderTop: `1px solid ${COLOR_BORDER}`,
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
        }}
      >
        <span
          style={{
            fontSize: "16px",
            color: COLOR_TEXT_SOFT,
            fontWeight: 300,
          }}
        >
          Pilotez vos opérations avec l&apos;IA
        </span>
        <span
          style={{
            fontSize: "16px",
            color: COLOR_TEXT,
            fontWeight: 500,
            letterSpacing: "0.02em",
          }}
        >
          hearstcorporation.io
        </span>
      </footer>
    </>,
  );
}

interface NumberedRowProps {
  number: string;
  label: string;
  value: string;
  accent?: boolean;
}

function NumberedRow({ number, label, value, accent = false }: NumberedRowProps) {
  return (
    <div
      style={{
        display: "flex",
        alignItems: "baseline",
        justifyContent: "space-between",
        gap: "32px",
      }}
    >
      <div style={{ display: "flex", alignItems: "baseline", gap: "32px" }}>
        <span
          style={{
            fontSize: "20px",
            color: COLOR_TEXT_FAINT,
            letterSpacing: "0.12em",
            fontWeight: 400,
            fontVariantNumeric: "tabular-nums",
          }}
        >
          {number}
        </span>
        <span
          style={{
            fontSize: "30px",
            color: COLOR_TEXT,
            fontWeight: 400,
            letterSpacing: "-0.01em",
          }}
        >
          {label}
        </span>
      </div>
      <span
        style={{
          fontSize: "60px",
          fontWeight: 300,
          letterSpacing: "-0.03em",
          color: accent ? COLOR_ACCENT : COLOR_TEXT,
          fontVariantNumeric: "tabular-nums",
          lineHeight: 1,
        }}
      >
        {value}
      </span>
    </div>
  );
}
