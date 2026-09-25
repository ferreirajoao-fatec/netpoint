-- AlterTable
ALTER TABLE "SwitchPort" ADD COLUMN     "linkedPortId" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "SwitchPort_linkedPortId_key" ON "SwitchPort"("linkedPortId");

-- AddForeignKey
ALTER TABLE "SwitchPort" ADD CONSTRAINT "SwitchPort_linkedPortId_fkey" FOREIGN KEY ("linkedPortId") REFERENCES "SwitchPort"("id") ON DELETE SET NULL ON UPDATE CASCADE;

