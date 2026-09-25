-- BL-32 (Q18): ACCOUNTS is finance-only by default; other modules need an explicit grant.
-- Expand-only: a new enum and a defaulted array column. Existing ACCOUNTS users get NO grants,
-- which is the intended behaviour change (they lose admissions/complaints/messages until an
-- admin grants them). No backfill.
CREATE TYPE "StaffGrant" AS ENUM ('ADMISSIONS', 'COMPLAINTS', 'MESSAGES');

ALTER TABLE "User" ADD COLUMN "grants" "StaffGrant"[] NOT NULL DEFAULT ARRAY[]::"StaffGrant"[];
