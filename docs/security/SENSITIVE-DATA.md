# Sensitive Personal Data — Column Boundary (design note)

> **Status:** CURRENT · **Verified:** 2026-09-27 against `wave-0/foundations` (BL-07) · **Sources:** `backend/src/common/sensitive-fields.ts`, `backend/prisma/schema.prisma` · **Owner:** Security Owner (Engineering Lead until assigned) · **Review:** pending (Security Owner, RD-6 privacy administrator when named)

## Why
BL-07 (Q7, RD-6) asks that national identifiers and health data stay **separable**, so that encryption at rest — and, if later required, field-level encryption — can be added without redesigning the data model.

## The boundary
| Model | Sensitive columns | Kind |
|---|---|---|
| `Student` | `bFormNumber`, `religion` | national identifier; special-category data |
| `StudentMedicalInfo` (own table, 1:1 with `Student`) | `bloodGroup`, `allergies`, `medicalConditions`, `specialEducationalNeeds`, `medicationNotes`, `emergencyMedicalNotes` | health |
| `ParentProfile` | `cnic` | national identifier |
| `Staff` | `cnic` | national identifier |
| `HiringCandidate` | `cnic` | national identifier |

The list lives in **one place**: `SENSITIVE_FIELDS` in `backend/src/common/sensitive-fields.ts`. A unit test fails if a listed column no longer exists in `schema.prisma`, so the list cannot drift silently.

## Rules
1. Code that copies personal data **out** of the system (exports — BL-41 —, reports, integrations) passes rows through `withoutSensitive(model, row)` unless the caller explicitly asked for the sensitive fields **and** is permitted to receive them; the request is audited.
2. Health data stays in `StudentMedicalInfo`; new health fields go there, never on `Student`.
3. A new identifier or health column is added to `SENSITIVE_FIELDS` in the same change.
4. Lookup by CNIC (guardian lookup, BL-23) uses exact match on the column; if the column is later encrypted, a deterministic keyed hash column (`cnicHash`) is added for lookup and uniqueness — the API does not change.

## Path to encryption (not done; post-pilot unless legal review requires it)
- **At rest:** managed PostgreSQL storage encryption (BL-13, Ops) covers every column and backups.
- **Field level, if required:** encrypt the columns above in the Prisma layer (a client extension on these models), keep a keyed hash next to each identifier for uniqueness/lookup, rotate keys through the secret store. The column list above is the complete scope.

## Related
[DATA-PROTECTION](DATA-PROTECTION.md) · [KNOWN-GAPS](KNOWN-GAPS.md) KG-17 · [BUSINESS-RULES](../product/BUSINESS-RULES.md) BR-STU-06
