-- AlterTable
ALTER TABLE "Notification" ADD COLUMN     "deliveryAttempts" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "deliveryStatus" TEXT,
ADD COLUMN     "lastDeliveryError" TEXT,
ADD COLUMN     "nextAttemptAt" TIMESTAMP(3);

-- CreateIndex
CREATE INDEX "Notification_deliveryStatus_nextAttemptAt_idx" ON "Notification"("deliveryStatus", "nextAttemptAt");

-- KI-5: only the values the code writes (same pattern as M12)
ALTER TABLE "Notification" ADD CONSTRAINT "Notification_deliveryStatus_check" CHECK ("deliveryStatus" IS NULL OR "deliveryStatus" IN ('PENDING', 'SENT', 'RETRY', 'FAILED'));
