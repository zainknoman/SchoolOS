-- CreateEnum
CREATE TYPE "PasswordResetAudience" AS ENUM ('STAFF', 'PARENT');

-- AlterTable
ALTER TABLE "PasswordResetToken" ADD COLUMN     "audience" "PasswordResetAudience" NOT NULL DEFAULT 'STAFF';
