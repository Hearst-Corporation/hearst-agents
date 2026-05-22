-- Migration 0093 : Ajout de computer_action à l'enum run_kind
-- Déjà appliqué en prod (2026-05-22) — fichier créé pour l'historique repo.
-- Idempotent : IF NOT EXISTS ne fail pas si la valeur existe déjà.

ALTER TYPE run_kind ADD VALUE IF NOT EXISTS 'computer_action';
