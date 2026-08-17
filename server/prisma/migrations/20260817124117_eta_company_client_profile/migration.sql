-- AlterTable
ALTER TABLE "Client" ADD COLUMN     "etaBuildingNumber" TEXT,
ADD COLUMN     "etaBuyerType" TEXT NOT NULL DEFAULT 'B',
ADD COLUMN     "etaGovernorate" TEXT,
ADD COLUMN     "etaRegionCity" TEXT,
ADD COLUMN     "etaStreet" TEXT,
ADD COLUMN     "etaTaxRegistrationNumber" TEXT;

-- AlterTable
ALTER TABLE "Company" ADD COLUMN     "etaActivityCode" TEXT,
ADD COLUMN     "etaBranchId" TEXT NOT NULL DEFAULT '0',
ADD COLUMN     "etaBuildingNumber" TEXT,
ADD COLUMN     "etaGovernorate" TEXT,
ADD COLUMN     "etaRegionCity" TEXT,
ADD COLUMN     "etaStreet" TEXT,
ADD COLUMN     "etaTaxRegistrationNumber" TEXT;
