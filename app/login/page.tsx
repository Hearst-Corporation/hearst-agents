"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { SessionProvider, signIn, useSession } from "next-auth/react";
import { Suspense, useCallback, useEffect, useState } from "react";

// Analytics tracking (client-side call to server)
function trackLogin(provider: string) {
  fetch("/api/analytics", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      type: "login_success",
      userId: `oauth_${provider}_${Date.now()}`, // Temporary ID, replaced server-side
      properties: { provider },
    }),
  }).catch(() => {
    // Silent fail for analytics
  });
}

/* ─── Provider config ─── */

type ProviderId = "google" | "azure-ad";

interface ProviderEntry {
  id: ProviderId;
  label: string;
  icon: React.ReactNode;
}

const PROVIDERS: ProviderEntry[] = [
  {
    id: "google",
    label: "Continuer avec Google",
    icon: (
      <svg viewBox="0 0 24 24" className="h-5 w-5" aria-hidden="true">
        <path
          d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1Z"
          fill="#4285F4"
        />
        <path
          d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23Z"
          fill="#34A853"
        />
        <path
          d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18A10.96 10.96 0 0 0 1 12c0 1.77.42 3.45 1.18 4.93l3.66-2.84Z"
          fill="#FBBC05"
        />
        <path
          d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53Z"
          fill="#EA4335"
        />
      </svg>
    ),
  },
  {
    id: "azure-ad",
    label: "Continuer avec Outlook",
    icon: (
      <svg viewBox="0 0 24 24" className="h-5 w-5" aria-hidden="true">
        <path d="M11.4 24H0V8.8l11.4-2.6V24Z" fill="#0078D4" />
        <path d="M24 5.5V19l-8.8 3.5V1.5L24 5.5Z" fill="#0078D4" />
        <path d="M15.2 1.5v21L11.4 24V6.2l-6-1.4L11.4 0l3.8 1.5Z" fill="#0364B8" />
        <path d="M24 5.5l-8.8-4L11.4 0v6.2L24 5.5Z" fill="#28A8EA" />
        <path d="M11.4 6.2V24L0 21V8.8l11.4-2.6Z" fill="#0078D4" opacity=".5" />
      </svg>
    ),
  },
];

/* ─── Login content ─── */

function LoginContent() {
  const { status } = useSession();
  const router = useRouter();
  const searchParams = useSearchParams();

  const [loadingProvider, setLoadingProvider] = useState<ProviderId | null>(null);

  const error = searchParams.get("error");
  // Sécurité : on n'accepte que des callbackUrl relatifs same-origin.
  // Un absolu (`https://evil.com`) ou un schéma exotique (`javascript:`,
  // `//evil.com`) tomberait en open-redirect post-login. On fallback "/"
  // si la valeur n'est pas un chemin interne strict.
  const rawCallback = searchParams.get("callbackUrl");
  const callbackUrl =
    rawCallback?.startsWith("/") && !rawCallback.startsWith("//") ? rawCallback : "/";

  useEffect(() => {
    if (status === "authenticated") {
      router.replace(callbackUrl);
    }
  }, [status, router, callbackUrl]);

  const handleSignIn = useCallback(
    (providerId: ProviderId) => {
      setLoadingProvider(providerId);
      trackLogin(providerId);
      signIn(providerId, { callbackUrl });
    },
    [callbackUrl],
  );

  if (status === "loading" || status === "authenticated") {
    return (
      <div className="flex h-screen w-full items-center justify-center bg-black text-white">
        <div className="flex flex-col items-center gap-3">
          <div className="h-5 w-5 animate-spin rounded-full border-2 border-(--line-strong) border-t-(--text-faint)" />
          <p className="t-13 text-(--text-soft)">
            {status === "authenticated" ? "Redirection\u2026" : "Chargement\u2026"}
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-screen w-full items-center justify-center overflow-hidden bg-black px-6 py-8 text-white sm:px-8 md:px-10 md:py-16">
      {/* glow removed — invariant: no blur, no shadow */}

      <div className="relative w-full max-w-[var(--width-login-card)]">
        {/* Login card */}
        <div className="rounded-2xl border border-(--border-shell) bg-(--surface-1) px-6 py-8 sm:px-7 sm:py-9 md:px-8 md:py-10">
          {/* Brand */}
          <div className="flex flex-col items-center">
            <span className="t-13 font-medium text-(--text-soft)">Hearst OS</span>

            {/* Secure access label */}
            <span className="mt-3 t-11 font-medium uppercase tracking-body text-(--text-ghost)">
              Accès sécurisé
            </span>

            {/* Title */}
            <h1 className="mt-4 text-center t-26 font-semibold leading-[1.15] tracking-tight text-text sm:t-30 md:t-34">
              Accédez à votre espace de travail
            </h1>

            {/* Description */}
            <p
              className="mt-4 text-center t-15 text-(--text-soft) sm:text-base"
              style={{ lineHeight: "var(--leading-snug-body)" }}
            >
              Connectez-vous via votre fournisseur d&apos;identité professionnel.
            </p>
          </div>

          {/* Providers */}
          <div className="mt-8 flex flex-col gap-3">
            {PROVIDERS.map((provider) => {
              const isLoading = loadingProvider === provider.id;
              const isDisabled = loadingProvider !== null;

              return (
                <button
                  key={provider.id}
                  onClick={() => handleSignIn(provider.id)}
                  disabled={isDisabled}
                  aria-label={provider.label}
                  className="group relative flex h-12 w-full items-center justify-center gap-3 rounded-md border border-(--border-shell) bg-(--surface-1) t-14 font-medium text-text-soft transition-[color,background-color,border-color,transform,opacity] duration-200 hover:border-(--accent-teal-border) hover:bg-(--surface-card) hover:text-text focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-(--accent-teal-border) focus-visible:ring-offset-2 focus-visible:ring-offset-bg active:scale-[0.985] disabled:pointer-events-none disabled:opacity-50"
                >
                  {isLoading ? (
                    <div className="h-5 w-5 animate-spin rounded-full border-2 border-(--line-strong) border-t-(--text-faint)" />
                  ) : (
                    provider.icon
                  )}
                  <span>{isLoading ? "Redirection\u2026" : provider.label}</span>
                </button>
              );
            })}
          </div>

          {/* Error */}
          {error && (
            <div className="mt-5 flex flex-col items-center gap-3 rounded-lg border border-red-500/10 bg-red-500/4 px-4 py-3 text-center t-13 leading-normal text-red-400/70">
              <span>
                {error === "OAuthCallback"
                  ? "L'authentification a été annulée ou a échoué. Veuillez réessayer."
                  : "Nous n'avons pas pu vous connecter. Veuillez réessayer ou utiliser l'autre fournisseur."}
              </span>
              <button
                type="button"
                onClick={() => handleSignIn("google")}
                disabled={loadingProvider !== null}
                className="t-13 font-light text-(--text-soft) underline underline-offset-2 hover:text-text transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Réessayer la connexion
              </button>
            </div>
          )}

          {/* Micro-copy */}
          <p
            className="mt-6 text-center t-11 text-(--text-faint)"
            style={{ lineHeight: "var(--leading-relaxed)" }}
          >
            En continuant, vous vous authentifiez via votre fournisseur d&apos;entreprise.
          </p>
        </div>

        {/* Footer */}
        <div className="mt-6 flex items-center justify-center gap-4 t-11 text-(--text-ghost)">
          <a
            href="https://hearstcorporation.io/privacy"
            target="_blank"
            rel="noopener noreferrer"
            className="hover:text-(--text-muted) transition-colors"
          >
            Confidentialité
          </a>
          <span className="text-(--text-ghost)">&middot;</span>
          <a
            href="https://hearstcorporation.io/terms"
            target="_blank"
            rel="noopener noreferrer"
            className="hover:text-(--text-muted) transition-colors"
          >
            Conditions
          </a>
          <span className="text-(--text-ghost)">&middot;</span>
          <a
            href="https://hearstcorporation.io/contact"
            target="_blank"
            rel="noopener noreferrer"
            className="hover:text-(--text-muted) transition-colors"
          >
            Aide
          </a>
        </div>
      </div>
    </div>
  );
}

/* ─── Page wrapper (SessionProvider for this standalone route) ─── */

export default function LoginPage() {
  return (
    <SessionProvider>
      <Suspense
        fallback={
          <div className="flex h-screen w-full items-center justify-center overflow-hidden bg-black">
            <div className="h-5 w-5 animate-spin rounded-full border-2 border-(--line-strong) border-t-(--text-faint)" />
          </div>
        }
      >
        <LoginContent />
      </Suspense>
    </SessionProvider>
  );
}
