-- BL-20 migration M2 (expand step, additive; MIGRATION-STRATEGY rules C1-C3, H1-H2) and the
-- MigrationReviewItem queue (decision D8). Backfill: npm run backfill:m2 (idempotent).
-- AlterTable
ALTER TABLE "Circular" ADD COLUMN     "schoolId" TEXT;

-- AlterTable
ALTER TABLE "Holiday" ADD COLUMN     "schoolId" TEXT;

-- CreateTable
CREATE TABLE "MigrationReviewItem" (
    "id" TEXT NOT NULL,
    "migration" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "entity" TEXT NOT NULL,
    "entityId" TEXT NOT NULL,
    "detail" TEXT NOT NULL,
    "blocking" BOOLEAN NOT NULL DEFAULT false,
    "status" TEXT NOT NULL DEFAULT 'OPEN',
    "resolution" TEXT,
    "resolvedById" TEXT,
    "resolvedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MigrationReviewItem_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "MigrationReviewItem_status_idx" ON "MigrationReviewItem"("status");

-- CreateIndex
CREATE UNIQUE INDEX "MigrationReviewItem_migration_category_entity_entityId_key" ON "MigrationReviewItem"("migration", "category", "entity", "entityId");

-- CreateIndex
CREATE INDEX "Circular_schoolId_idx" ON "Circular"("schoolId");

-- CreateIndex
CREATE INDEX "Holiday_schoolId_idx" ON "Holiday"("schoolId");

-- AddForeignKey
ALTER TABLE "Circular" ADD CONSTRAINT "Circular_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "School"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Holiday" ADD CONSTRAINT "Holiday_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "School"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MigrationReviewItem" ADD CONSTRAINT "MigrationReviewItem_resolvedById_fkey" FOREIGN KEY ("resolvedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

