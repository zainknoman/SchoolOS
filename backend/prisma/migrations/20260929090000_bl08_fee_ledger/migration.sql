-- CreateEnum
CREATE TYPE "FeeItemKind" AS ENUM ('CHARGE', 'DISCOUNT', 'SCHOLARSHIP', 'WAIVER', 'LATE_FEE', 'OPENING_BALANCE', 'CARRIED_FORWARD');

-- CreateEnum
CREATE TYPE "FeeVoucherKind" AS ENUM ('REGULAR', 'OPENING_BALANCE');

-- CreateEnum
CREATE TYPE "FeeConcessionKind" AS ENUM ('DISCOUNT', 'SCHOLARSHIP');

-- AlterTable
ALTER TABLE "FeeItem" ADD COLUMN     "carryVoucherId" TEXT,
ADD COLUMN     "concessionId" TEXT,
ADD COLUMN     "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
ADD COLUMN     "createdById" TEXT,
ADD COLUMN     "kind" "FeeItemKind" NOT NULL DEFAULT 'CHARGE',
ADD COLUMN     "reason" TEXT,
ADD COLUMN     "reversesItemId" TEXT;

-- AlterTable
ALTER TABLE "FeePayment" ADD COLUMN     "note" TEXT,
ADD COLUMN     "recordedById" TEXT,
ADD COLUMN     "reversesPaymentId" TEXT;

-- AlterTable
ALTER TABLE "FeeVoucher" ADD COLUMN     "kind" "FeeVoucherKind" NOT NULL DEFAULT 'REGULAR';

-- CreateTable
CREATE TABLE "StudentFeeConcession" (
    "id" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "schoolId" TEXT NOT NULL,
    "kind" "FeeConcessionKind" NOT NULL,
    "label" TEXT NOT NULL,
    "percent" INTEGER,
    "amount" INTEGER,
    "reason" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdById" TEXT,
    "endedById" TEXT,
    "endedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "StudentFeeConcession_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FeePolicy" (
    "id" TEXT NOT NULL,
    "schoolId" TEXT NOT NULL,
    "lateFeeAmount" INTEGER NOT NULL DEFAULT 0,
    "lateFeeGraceDays" INTEGER NOT NULL DEFAULT 0,
    "updatedById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "FeePolicy_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "StudentFeeConcession_studentId_idx" ON "StudentFeeConcession"("studentId");

-- CreateIndex
CREATE INDEX "StudentFeeConcession_schoolId_idx" ON "StudentFeeConcession"("schoolId");

-- CreateIndex
CREATE UNIQUE INDEX "FeePolicy_schoolId_key" ON "FeePolicy"("schoolId");

-- CreateIndex
CREATE UNIQUE INDEX "FeeItem_reversesItemId_key" ON "FeeItem"("reversesItemId");

-- CreateIndex
CREATE INDEX "FeeItem_feeVoucherId_idx" ON "FeeItem"("feeVoucherId");

-- CreateIndex
CREATE INDEX "FeeItem_carryVoucherId_idx" ON "FeeItem"("carryVoucherId");

-- CreateIndex
CREATE UNIQUE INDEX "FeePayment_reversesPaymentId_key" ON "FeePayment"("reversesPaymentId");

-- AddForeignKey
ALTER TABLE "FeeItem" ADD CONSTRAINT "FeeItem_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FeeItem" ADD CONSTRAINT "FeeItem_reversesItemId_fkey" FOREIGN KEY ("reversesItemId") REFERENCES "FeeItem"("id") ON DELETE NO ACTION ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FeeItem" ADD CONSTRAINT "FeeItem_carryVoucherId_fkey" FOREIGN KEY ("carryVoucherId") REFERENCES "FeeVoucher"("id") ON DELETE NO ACTION ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FeeItem" ADD CONSTRAINT "FeeItem_concessionId_fkey" FOREIGN KEY ("concessionId") REFERENCES "StudentFeeConcession"("id") ON DELETE NO ACTION ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StudentFeeConcession" ADD CONSTRAINT "StudentFeeConcession_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "Student"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StudentFeeConcession" ADD CONSTRAINT "StudentFeeConcession_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "School"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StudentFeeConcession" ADD CONSTRAINT "StudentFeeConcession_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StudentFeeConcession" ADD CONSTRAINT "StudentFeeConcession_endedById_fkey" FOREIGN KEY ("endedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FeePolicy" ADD CONSTRAINT "FeePolicy_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "School"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FeePayment" ADD CONSTRAINT "FeePayment_reversesPaymentId_fkey" FOREIGN KEY ("reversesPaymentId") REFERENCES "FeePayment"("id") ON DELETE NO ACTION ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FeePayment" ADD CONSTRAINT "FeePayment_recordedById_fkey" FOREIGN KEY ("recordedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- BL-08: paid history and ledger lines are never edited; corrections are new reversing rows.
-- (Deletion is already blocked by the Restrict FKs and there is no delete endpoint.)
CREATE FUNCTION "fee_item_immutable"() RETURNS trigger AS $$
BEGIN
  IF (NEW."id", NEW."feeVoucherId", NEW."label", NEW."amount", NEW."kind", NEW."reason",
      NEW."createdAt", NEW."reversesItemId", NEW."carryVoucherId", NEW."concessionId")
     IS DISTINCT FROM
     (OLD."id", OLD."feeVoucherId", OLD."label", OLD."amount", OLD."kind", OLD."reason",
      OLD."createdAt", OLD."reversesItemId", OLD."carryVoucherId", OLD."concessionId") THEN
    RAISE EXCEPTION 'A voucher line cannot be changed; add a reversing line instead';
  END IF;
  -- The M5 backfill may still link a legacy line (null -> structure); a set link never moves.
  IF OLD."feeStructureId" IS NOT NULL AND NEW."feeStructureId" IS DISTINCT FROM OLD."feeStructureId" THEN
    RAISE EXCEPTION 'A voucher line cannot be changed; add a reversing line instead';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER "FeeItem_immutable"
  BEFORE UPDATE ON "FeeItem"
  FOR EACH ROW EXECUTE FUNCTION "fee_item_immutable"();

CREATE FUNCTION "fee_payment_immutable"() RETURNS trigger AS $$
BEGIN
  IF OLD."status" <> 'pending' AND
     (NEW."id", NEW."amount", NEW."method", NEW."status", NEW."reference", NEW."reversesPaymentId", NEW."note", NEW."createdAt")
     IS DISTINCT FROM
     (OLD."id", OLD."amount", OLD."method", OLD."status", OLD."reference", OLD."reversesPaymentId", OLD."note", OLD."createdAt") THEN
    RAISE EXCEPTION 'A settled payment cannot be changed; record a reversal instead';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER "FeePayment_immutable"
  BEFORE UPDATE ON "FeePayment"
  FOR EACH ROW EXECUTE FUNCTION "fee_payment_immutable"();

CREATE FUNCTION "fee_allocation_immutable"() RETURNS trigger AS $$
BEGIN
  IF EXISTS (SELECT 1 FROM "FeePayment" p WHERE p."id" = OLD."feePaymentId" AND p."status" <> 'pending') THEN
    RAISE EXCEPTION 'A settled payment cannot be changed; record a reversal instead';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER "FeePaymentAllocation_immutable"
  BEFORE UPDATE ON "FeePaymentAllocation"
  FOR EACH ROW EXECUTE FUNCTION "fee_allocation_immutable"();

CREATE FUNCTION "receipt_immutable"() RETURNS trigger AS $$
BEGIN
  RAISE EXCEPTION 'A receipt cannot be changed';
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER "Receipt_immutable"
  BEFORE UPDATE ON "Receipt"
  FOR EACH ROW EXECUTE FUNCTION "receipt_immutable"();
