-- M7 (BL-61, RD-10): final lifecycle terminology.
-- Expand only. `StudentStatus.LEFT` stays in the enum until a later contract migration, once no row uses it;
-- existing LEFT rows are converted by `npm run backfill:m7` (rules L1/L2 in docs/database/MIGRATION-STRATEGY.md),
-- never here. `EnrollmentStatus` is unchanged (rule L3).
ALTER TYPE "StudentStatus" ADD VALUE IF NOT EXISTS 'TRANSFERRED';

-- Metadata-only rename: existing StudentPromotion rows keep their meaning.
ALTER TYPE "PromotionDecision" RENAME VALUE 'TRANSFERRED_OUT' TO 'TRANSFERRED';
ALTER TYPE "PromotionDecision" ADD VALUE IF NOT EXISTS 'PROMOTED_WITH_CONDITIONS' AFTER 'PROMOTED';
