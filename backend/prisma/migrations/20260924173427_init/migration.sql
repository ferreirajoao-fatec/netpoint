-- CreateEnum
CREATE TYPE "Role" AS ENUM ('ADMIN', 'TECHNICIAN', 'VIEWER');

-- CreateEnum
CREATE TYPE "LocationType" AS ENUM ('BUILDING', 'BLOCK', 'FLOOR', 'AREA');

-- CreateEnum
CREATE TYPE "DeviceType" AS ENUM ('COMPUTER', 'NOTEBOOK', 'PRINTER', 'ACCESS_POINT', 'SERVER', 'CAMERA', 'IP_PHONE', 'SWITCH', 'OTHER');

-- CreateEnum
CREATE TYPE "PortStatus" AS ENUM ('AVAILABLE', 'IN_USE', 'RESERVED', 'DISABLED', 'FAULTY');

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "role" "Role" NOT NULL DEFAULT 'VIEWER',
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Location" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "type" "LocationType" NOT NULL DEFAULT 'AREA',
    "parentId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Location_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Department" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Department_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Room" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "locationId" TEXT,
    "departmentId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Room_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Rack" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "roomId" TEXT,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Rack_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Switch" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "manufacturer" TEXT,
    "model" TEXT,
    "portCount" INTEGER NOT NULL,
    "ipAddress" TEXT,
    "macAddress" TEXT,
    "roomId" TEXT,
    "rackId" TEXT,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Switch_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SwitchPort" (
    "id" TEXT NOT NULL,
    "switchId" TEXT NOT NULL,
    "number" INTEGER NOT NULL,
    "status" "PortStatus" NOT NULL DEFAULT 'AVAILABLE',
    "notes" TEXT,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SwitchPort_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PatchPanel" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "portCount" INTEGER NOT NULL,
    "rackId" TEXT,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PatchPanel_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PatchPanelPort" (
    "id" TEXT NOT NULL,
    "patchPanelId" TEXT NOT NULL,
    "number" INTEGER NOT NULL,

    CONSTRAINT "PatchPanelPort_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "NetworkPoint" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "roomId" TEXT,
    "departmentId" TEXT,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "NetworkPoint_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Device" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "type" "DeviceType" NOT NULL DEFAULT 'COMPUTER',
    "responsibleUser" TEXT,
    "departmentId" TEXT,
    "roomId" TEXT,
    "hostname" TEXT,
    "ipAddress" TEXT,
    "macAddress" TEXT,
    "assetTag" TEXT,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Device_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Connection" (
    "id" TEXT NOT NULL,
    "networkPointId" TEXT NOT NULL,
    "deviceId" TEXT,
    "patchPanelPortId" TEXT,
    "switchPortId" TEXT,
    "cableLabel" TEXT,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Connection_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ConnectionHistory" (
    "id" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "userId" TEXT,
    "userName" TEXT NOT NULL,
    "entityType" TEXT NOT NULL,
    "entityId" TEXT,
    "entityLabel" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "field" TEXT,
    "previousValue" TEXT,
    "newValue" TEXT,
    "description" TEXT,

    CONSTRAINT "ConnectionHistory_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE INDEX "Location_parentId_idx" ON "Location"("parentId");

-- CreateIndex
CREATE UNIQUE INDEX "Department_name_key" ON "Department"("name");

-- CreateIndex
CREATE UNIQUE INDEX "Rack_name_key" ON "Rack"("name");

-- CreateIndex
CREATE UNIQUE INDEX "Switch_name_key" ON "Switch"("name");

-- CreateIndex
CREATE UNIQUE INDEX "SwitchPort_switchId_number_key" ON "SwitchPort"("switchId", "number");

-- CreateIndex
CREATE UNIQUE INDEX "PatchPanelPort_patchPanelId_number_key" ON "PatchPanelPort"("patchPanelId", "number");

-- CreateIndex
CREATE UNIQUE INDEX "NetworkPoint_code_key" ON "NetworkPoint"("code");

-- CreateIndex
CREATE INDEX "Device_hostname_idx" ON "Device"("hostname");

-- CreateIndex
CREATE INDEX "Device_ipAddress_idx" ON "Device"("ipAddress");

-- CreateIndex
CREATE UNIQUE INDEX "Connection_networkPointId_key" ON "Connection"("networkPointId");

-- CreateIndex
CREATE UNIQUE INDEX "Connection_deviceId_key" ON "Connection"("deviceId");

-- CreateIndex
CREATE UNIQUE INDEX "Connection_patchPanelPortId_key" ON "Connection"("patchPanelPortId");

-- CreateIndex
CREATE UNIQUE INDEX "Connection_switchPortId_key" ON "Connection"("switchPortId");

-- CreateIndex
CREATE INDEX "ConnectionHistory_createdAt_idx" ON "ConnectionHistory"("createdAt");

-- CreateIndex
CREATE INDEX "ConnectionHistory_entityType_entityId_idx" ON "ConnectionHistory"("entityType", "entityId");

-- AddForeignKey
ALTER TABLE "Location" ADD CONSTRAINT "Location_parentId_fkey" FOREIGN KEY ("parentId") REFERENCES "Location"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Room" ADD CONSTRAINT "Room_locationId_fkey" FOREIGN KEY ("locationId") REFERENCES "Location"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Room" ADD CONSTRAINT "Room_departmentId_fkey" FOREIGN KEY ("departmentId") REFERENCES "Department"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Rack" ADD CONSTRAINT "Rack_roomId_fkey" FOREIGN KEY ("roomId") REFERENCES "Room"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Switch" ADD CONSTRAINT "Switch_roomId_fkey" FOREIGN KEY ("roomId") REFERENCES "Room"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Switch" ADD CONSTRAINT "Switch_rackId_fkey" FOREIGN KEY ("rackId") REFERENCES "Rack"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SwitchPort" ADD CONSTRAINT "SwitchPort_switchId_fkey" FOREIGN KEY ("switchId") REFERENCES "Switch"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PatchPanel" ADD CONSTRAINT "PatchPanel_rackId_fkey" FOREIGN KEY ("rackId") REFERENCES "Rack"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PatchPanelPort" ADD CONSTRAINT "PatchPanelPort_patchPanelId_fkey" FOREIGN KEY ("patchPanelId") REFERENCES "PatchPanel"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "NetworkPoint" ADD CONSTRAINT "NetworkPoint_roomId_fkey" FOREIGN KEY ("roomId") REFERENCES "Room"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "NetworkPoint" ADD CONSTRAINT "NetworkPoint_departmentId_fkey" FOREIGN KEY ("departmentId") REFERENCES "Department"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Device" ADD CONSTRAINT "Device_departmentId_fkey" FOREIGN KEY ("departmentId") REFERENCES "Department"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Device" ADD CONSTRAINT "Device_roomId_fkey" FOREIGN KEY ("roomId") REFERENCES "Room"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Connection" ADD CONSTRAINT "Connection_networkPointId_fkey" FOREIGN KEY ("networkPointId") REFERENCES "NetworkPoint"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Connection" ADD CONSTRAINT "Connection_deviceId_fkey" FOREIGN KEY ("deviceId") REFERENCES "Device"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Connection" ADD CONSTRAINT "Connection_patchPanelPortId_fkey" FOREIGN KEY ("patchPanelPortId") REFERENCES "PatchPanelPort"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Connection" ADD CONSTRAINT "Connection_switchPortId_fkey" FOREIGN KEY ("switchPortId") REFERENCES "SwitchPort"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ConnectionHistory" ADD CONSTRAINT "ConnectionHistory_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
