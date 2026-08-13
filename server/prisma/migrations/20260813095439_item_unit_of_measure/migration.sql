-- AlterTable
ALTER TABLE "BillItem" ADD COLUMN     "unit" TEXT NOT NULL DEFAULT '';

-- AlterTable
ALTER TABLE "InvoiceItem" ADD COLUMN     "unit" TEXT NOT NULL DEFAULT '';
