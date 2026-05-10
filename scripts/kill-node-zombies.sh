#!/usr/bin/env bash
# Kill Node Zombies — nettoie les processus node orphelins

set -euo pipefail

# PID du serveur Next.js actif (port 9001)
NEXT_PID=$(lsof -ti tcp:9001 2>/dev/null || echo "")

if [ -z "$NEXT_PID" ]; then
  echo "❌ Serveur Next.js non trouvé sur port 9001"
  exit 1
fi

echo "✓ Serveur Next.js actif: PID $NEXT_PID"

# Identifier les processus node/npm à préserver
PRESERVE_PIDS=$(pgrep -P "$NEXT_PID" 2>/dev/null || echo "")
PRESERVE_PIDS="$NEXT_PID $PRESERVE_PIDS"

echo "Processus préservés: $PRESERVE_PIDS"

# Liste tous les node/npm sauf ceux préservés et les helpers VSCode/Cursor
ZOMBIE_PIDS=$(ps aux | \
  grep -E "node|npm" | \
  grep -v grep | \
  grep -v "Code Helper" | \
  grep -v "Cursor Helper" | \
  awk '{print $2}' | \
  grep -vE "$(echo "$PRESERVE_PIDS" | tr ' ' '|')" || echo "")

if [ -z "$ZOMBIE_PIDS" ]; then
  echo "✓ Aucun zombie détecté"
  exit 0
fi

echo "🔪 Zombies détectés: $(echo "$ZOMBIE_PIDS" | wc -l | tr -d ' ') processus"
echo "$ZOMBIE_PIDS"

# Kill les zombies
echo "$ZOMBIE_PIDS" | xargs kill -9 2>/dev/null || true

echo "✓ Nettoyage terminé"
