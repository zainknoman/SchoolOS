-- Synthetic migration used ONLY by the harness self-tests (never applied to a real database).
ALTER TABLE "Student" ADD COLUMN "selftestMarker" TEXT;
