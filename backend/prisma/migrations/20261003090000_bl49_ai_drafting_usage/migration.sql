-- AlterTable
ALTER TABLE "DraftSuggestion" ADD COLUMN     "inputTokens" INTEGER,
ADD COLUMN     "model" TEXT,
ADD COLUMN     "outputTokens" INTEGER;

-- CreateIndex
CREATE INDEX "DraftSuggestion_userId_createdAt_idx" ON "DraftSuggestion"("userId", "createdAt");
