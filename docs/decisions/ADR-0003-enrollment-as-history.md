# ADR-0003: Enrollment is a dated history entity

**Status:** Accepted (retroactive) · **Verified:** 2026-09-20 against `main@15362b7`

## Context
A student moves between sections and sessions; the school must keep where each student studied.

## Decision
Placement is a dated `Enrollment` row with status ACTIVE/TRANSFERRED/COMPLETED/WITHDRAWN; promotions close one and open another and write a `StudentPromotion` record.

## Evidence
- `Enrollment` and `StudentPromotion` models; `promotions.service.ts:139-230`.
- Origin: archived `docs/archive/original-mvp-plan/DATA-MODEL-CORRECTION-PLAN.md` (Sprint 6.5).

## Consequences
Full placement history and safe promotions; the code assumes one ACTIVE enrollment per student (`findFirst`) with no DB uniqueness evidence.

## Review trigger
Revisit if teacher/staff assignment history is added.
