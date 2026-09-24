-- BL-21: server-side session revocation. Additive; existing rows start at 0, matching tokens that
-- carry no version claim, so sessions issued before this migration stay valid.
ALTER TABLE "User" ADD COLUMN "tokenVersion" INTEGER NOT NULL DEFAULT 0;
