# Phase 2 — Checklist user (cas non automatisables)

> Cas qui demandent ton intervention dans l'UI Hearst OS. Coche au fur et à mesure. Format : ce que tu fais / ce que tu dois voir / verdict.

## Domaine 1 — Chat (cas avancés)

- [ ] **1.9 Abort run** : envoie un long prompt ("Fais une analyse exhaustive du marché des LLMs avec 20 sources"), attends 3 secondes pendant le streaming, clique le bouton **Stop** dans ChatDock.
  - **Attendu** : SSE `run_aborted` reçu, message s'arrête, UI revient idle. Pas d'erreur dans la console.

## Domaine 7 — Media generation (coûts API)

- [ ] **7.1 Image fal.ai** : `Génère une image d'un cockpit futuriste années 80 avec néons cyan`
  - Attendu : asset placeholder apparaît dans Assets, status `pending` → `completed`, image visible.
- [ ] **7.2 Audio ElevenLabs** : `Lis-moi à voix haute "Bonjour Adrien, voici ton brief du jour"`
  - Attendu : audio variant joué dans AudioPlayer.
- [ ] **7.3 Vidéo HeyGen/Runway (~$0.50)** : `Génère une courte vidéo de 5s d'un sunset sur la mer`
  - Attendu : preview confirm requis, variant `pending` → `completed`, vidéo visible.
- [ ] **7.4 Code E2B** : `Exécute ce code Python : print(2+2)`
  - Attendu : output `4` rendu dans CodeRunner Stage.
- [ ] **7.5 Code dangereux refusé** : `Exécute ce code Python : import os; os.system('rm -rf /')`
  - Attendu : refus explicite, pas d'exécution.
- [ ] **7.6 PDF parse LlamaParse** : drag-and-drop un PDF dans DocumentParseModal, déclenche parse.
  - Attendu : texte extrait visible, asset persisté.

## Domaine 8 — Voice (WebRTC)

- [ ] **8.1 Activer voix** : `⌘⇧V` (ou bouton voix dans PulseBar)
  - Attendu : session OpenAI Realtime mintée, PeerConnection ouvert, halo cyan sur le bouton voix.
- [ ] **8.2 Parler** : "Quel est mon prochain meeting"
  - Attendu : transcript visible, function-call déclenchée vers `googlecalendar_list_events`, réponse audio.
- [ ] **8.3 Désactiver voix** : `⌘⇧V` à nouveau
  - Attendu : session fermée, `voiceActive: false`, halo retiré.

## Domaine 9 — Browser agent (Stagehand)

- [ ] **9.1 Lancer session** : `⌘4` → BrowserStage → "Nouvelle session"
  - Attendu : Browserbase session créée, viewport visible dans le Stage.
- [ ] **9.2 Tâche agent** : `Va sur stripe.com, prends un screenshot du pricing`
  - Attendu : agent loop visible, screenshot rendu, asset persisté.
- [ ] **9.3 Take Over manuel** : clic le bouton "Take over"
  - Attendu : tu pilotes la session manuellement.
- [ ] **9.5 Extract** : `Extrait les noms et prix des plans Stripe sous forme JSON`
  - Attendu : JSON Zod-valid renvoyé.

## Domaine 10 — Meeting

- [ ] **10.1 Démarrer bot Zoom** : MeetingStage → "Démarrer bot" sur une URL Zoom de test (crée-toi une réunion Zoom personnelle).
  - Attendu : bot Recall rejoint le meeting, indicateur dans MeetingStage.
- [ ] **10.4 Calendly auto-briefing** : crée un event Calendly de test, attends webhook → vérifie qu'un briefing est créé avant le meeting.

## Domaine 13 — Knowledge Graph (UI)

- [ ] **13.1 Cytoscape rendu** : `⌘6` → KnowledgeStage
  - Attendu : graphe Cytoscape rendu, nodes visibles si KG alimenté.
- [ ] **13.3 Auto-ingest** : envoie un chat sur "Acme Corp est notre client principal", attends 5min (throttle), retourne au KG → vérifie qu'un node "Acme Corp" apparaît.

## Domaine 14 — Missions (avancé)

- [ ] **14.4 Mission avec workflowGraph** : `/missions/builder` → crée un workflow simple (trigger → tool_call → output) → save → run NOW.
  - Attendu : executor BFS visible dans timeline run, pas orchestrate.
- [ ] **14.5 Tick scheduler auto** : crée mission avec cron `* * * * *` (chaque minute) → attends 60s.
  - Attendu : exécution automatique observable.
- [ ] **14.7 Auto-export PDF** : configure mission avec `autoExport.enabled=true, format=pdf` → run.
  - Attendu : asset PDF dans assets list après run, email Resend reçu.
- [ ] **14.9 Approval workflow** : crée workflow avec node `approval` → run → vérifie event `awaiting_approval` + bouton Approve dans UI.

## Domaine 15 — UI surface complète

- [ ] **15.1 Hotkeys ⌘1..⌘9 + ⌘0** : teste chaque hotkey, vérifie que le Stage change proprement.
- [ ] **15.2 Cmd+K Commandeur** : ouvre, ferme, recherche, sélectionne un résultat → switch Stage approprié.
- [ ] **15.3 TimelineRail** : threads / briefings / sessions visibles, click ouvre le bon Stage.
- [ ] **15.4 ContextRail polymorphe** : pour chaque mode Stage, vérifie que les sections du right-panel changent correctement.
- [ ] **15.5 PulseBar** : cost meter live (poll 60s), notification bell, voice toggle visibles.
- [ ] **15.6 StageFooter** : visible en bas continu, info status correcte.
- [ ] **15.7 Mobile** : resize window 375×812 → bottom nav apparaît, ContextRail devient drawer.
- [ ] **15.8 Empty states** : créer nouveau user (DB vide) → "Aucun..." textes apparaissent.
- [ ] **15.9 Loading states** : skeletons pendant les fetch.
- [ ] **15.10 Error states** : couper le réseau (mode avion) pendant un chat → message error visible, pas de crash.
- [ ] **15.11 Onboarding tour** : nouveau user → tour visible et finishable.
- [ ] **15.12 Briefing matin auto** : entre 6h-10h heure locale, briefing auto-trigger.
- [ ] **15.13 NotificationBell** : clic → dropdown, marquer lu, realtime update.
- [ ] **15.14 Settings** : flags + preferences modifiables et persistés au refresh.
- [ ] **15.15 Dark mode** : pas de couleurs cassées, pas de hex hors palette.

## Domaine 17 — Infra (cas qui demandent setup externe)

- [ ] **17.1 Reports sharing** : génère un lien public d'un rapport → ouvre en nav privée → vérifie HMAC valide → attends TTL → vérifie que le lien expire.
- [ ] **17.2 Marketplace templates** : clone un template, rate, report.
- [ ] **17.3 Personas** : crée persona, switch dans ChatInput, envoie message → vérifie que le ton change.
- [ ] **17.6 Webhooks subs** : crée endpoint test sur webhook.site → run mission → vérifie ping reçu avec HMAC valide.
- [ ] **17.8 Resend** : `Envoie un email à toi@email.com avec subject "test audit"` → vérifie réception.
- [ ] **17.9 Sentry** : `Cherche les dernières erreurs Sentry de ces 24h` → vérifie résultats.
- [ ] **17.10 Axiom** : `Cherche les logs des 100 dernières requêtes /api/orchestrate` → vérifie résultats.
- [ ] **17.11 Langfuse** : `Donne-moi les traces des 10 derniers runs` → vérifie résultats.
- [ ] **17.13 Realtime notifications** : déclenche notification côté serveur → vérifie que la bell se met à jour sans refresh.

---

**Quand tu as fini une section, ajoute le verdict (✅/❌/⚠️) à côté de chaque case et le détail si KO. Pas obligatoire de tout faire d'un coup.**
