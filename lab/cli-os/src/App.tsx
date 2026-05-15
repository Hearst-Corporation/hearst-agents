import { Link, Route, Routes, useLocation } from "react-router-dom";
import { SCENES } from "./scenes/registry";

export default function App() {
  return (
    <>
      <Routes>
        <Route path="/" element={<Index />} />
        {SCENES.map((s) => (
          <Route key={s.path} path={s.path} element={<s.Component />} />
        ))}
        <Route path="*" element={<NotFound />} />
      </Routes>
    </>
  );
}

function Index() {
  return (
    <main className="min-h-screen flex flex-col items-center justify-center px-8">
      <div className="w-full max-w-xl">
        <p className="text-xs uppercase tracking-widest text-[var(--color-fg-dim)] mb-6">
          Hearst Lab
        </p>
        <h1 className="text-3xl font-light tracking-tight mb-2">CLI OS — sandbox de navigation</h1>
        <p className="text-sm text-[var(--color-fg-dim)] mb-12">
          Re-skin total. Navigation cœur respectée. Aucun héritage du DS Hearst.
        </p>

        {SCENES.length === 0 ? (
          <p className="text-sm text-[var(--color-fg-dim)] italic">
            Aucune scène encore. Le scaffold est prêt — on attaque dès que la cartographie est
            rendue.
          </p>
        ) : (
          <ul className="flex flex-col gap-2">
            {SCENES.map((s) => (
              <li key={s.path}>
                <Link
                  to={s.path}
                  className="flex items-baseline justify-between py-3 border-b border-[var(--color-line)] hover:text-[var(--color-ink)] text-[var(--color-fg-dim)] transition-colors"
                >
                  <span>{s.label}</span>
                  <span className="text-xs">{s.path}</span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </div>
    </main>
  );
}

function NotFound() {
  const { pathname } = useLocation();
  return (
    <main className="min-h-screen flex items-center justify-center">
      <div className="text-center">
        <p className="text-sm text-[var(--color-fg-dim)] mb-2">{pathname}</p>
        <Link to="/" className="text-sm underline">
          retour
        </Link>
      </div>
    </main>
  );
}
