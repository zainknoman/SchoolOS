# ADR-0004: External services sit behind adapters with dev fallbacks

**Status:** Accepted (retroactive) · **Verified:** 2026-09-20 against `main@15362b7`

## Context
Payment, push, mail, SMS, WhatsApp, AI and storage providers are unavailable or unverified in development.

## Decision
Each integration has an interface and an environment-selected implementation; unset variables select a stub/logging adapter, and partially set variables fail startup outside development/test.

## Evidence
- `storage/storage-adapter.ts`, `notifications/*-config.ts`, `fees/gateways/gateway-config.ts`, `ai-drafting/`.
- `.env.example` comments describe the fallback rules.

## Consequences
Development and CI run without credentials; but a fallback (logging adapter, stub) can silently mask a missing production configuration, e.g. push and mail fall back in every environment when unset.

## Review trigger
Revisit when live providers are wired and verified.
