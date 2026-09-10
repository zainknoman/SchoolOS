-- CreateEnum
CREATE TYPE "NotificationChannel" AS ENUM ('PUSH', 'WHATSAPP', 'SMS');

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "notificationChannel" "NotificationChannel" NOT NULL DEFAULT 'PUSH',
ADD COLUMN     "digestEnabled" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "Notification" ADD COLUMN     "dispatchedAt" TIMESTAMP(3);
