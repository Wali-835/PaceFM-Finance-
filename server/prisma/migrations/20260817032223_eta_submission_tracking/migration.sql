-- CreateEnum
CREATE TYPE "EtaSubmissionStatus" AS ENUM ('not_submitted', 'pending_signature', 'signed', 'submitted', 'accepted', 'rejected', 'error');

-- AlterTable
ALTER TABLE "Invoice" ADD COLUMN     "etaError" TEXT,
ADD COLUMN     "etaLongId" TEXT,
ADD COLUMN     "etaStatus" "EtaSubmissionStatus" NOT NULL DEFAULT 'not_submitted',
ADD COLUMN     "etaSubmissionUuid" TEXT,
ADD COLUMN     "etaSubmittedAt" TIMESTAMP(3),
ADD COLUMN     "etaUuid" TEXT;
