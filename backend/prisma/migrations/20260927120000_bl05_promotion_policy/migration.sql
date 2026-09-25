-- BL-05 (Q5, part of M10 "promotion config"): promotion indicators, optional per-school blocking rules,
-- conditions text and an indicator snapshot on every decision. Additive only.
CREATE TABLE "PromotionPolicy" (
    "id" TEXT NOT NULL,
    "schoolId" TEXT NOT NULL,
    "minAttendancePercent" INTEGER NOT NULL DEFAULT 75,
    "minResultPercent" INTEGER NOT NULL DEFAULT 40,
    "blockOnAttendance" BOOLEAN NOT NULL DEFAULT false,
    "blockOnResults" BOOLEAN NOT NULL DEFAULT false,
    "blockOnFees" BOOLEAN NOT NULL DEFAULT false,
    "updatedById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "PromotionPolicy_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "PromotionPolicy_percent_check" CHECK ("minAttendancePercent" BETWEEN 0 AND 100 AND "minResultPercent" BETWEEN 0 AND 100)
);
CREATE UNIQUE INDEX "PromotionPolicy_schoolId_key" ON "PromotionPolicy"("schoolId");
ALTER TABLE "PromotionPolicy" ADD CONSTRAINT "PromotionPolicy_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "School"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "PromotionPolicy" ADD CONSTRAINT "PromotionPolicy_updatedById_fkey" FOREIGN KEY ("updatedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "StudentPromotion"
  ADD COLUMN "conditions" TEXT,
  ADD COLUMN "indicators" JSONB;

-- Promotion history is never modified (Q5): an UPDATE of a StudentPromotion row is refused.
-- (Rows still disappear with their student — ON DELETE CASCADE — which is a deletion, not an edit.)
CREATE FUNCTION "student_promotion_immutable"() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  RAISE EXCEPTION 'StudentPromotion rows are history and cannot be modified' USING ERRCODE = 'check_violation';
END;
$$;
CREATE TRIGGER "StudentPromotion_immutable" BEFORE UPDATE ON "StudentPromotion"
  FOR EACH ROW EXECUTE FUNCTION "student_promotion_immutable"();
