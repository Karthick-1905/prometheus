-- CreateEnum
CREATE TYPE "UserRole" AS ENUM ('FLEET_MANAGER', 'SITE_ENGINEER');

-- CreateEnum
CREATE TYPE "ProjectSiteStatus" AS ENUM ('ACTIVE', 'COMPLETED', 'ON_HOLD');

-- CreateEnum
CREATE TYPE "EquipmentStatus" AS ENUM ('AVAILABLE', 'RENTED', 'MAINTENANCE');

-- CreateEnum
CREATE TYPE "RentalContractStatus" AS ENUM ('ACTIVE', 'COMPLETED', 'OVERDUE');

-- CreateEnum
CREATE TYPE "AssignmentStatus" AS ENUM ('ACTIVE', 'RETURNED');

-- CreateTable
CREATE TABLE "Dealer" (
    "dealer_id" SERIAL NOT NULL,
    "dealer_name" VARCHAR,
    "email" VARCHAR,
    "phone" VARCHAR,
    "address" TEXT,
    "created_at" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(6) NOT NULL,

    CONSTRAINT "Dealer_pkey" PRIMARY KEY ("dealer_id")
);

-- CreateTable
CREATE TABLE "Company" (
    "company_id" SERIAL NOT NULL,
    "company_name" VARCHAR,
    "email" VARCHAR,
    "phone" VARCHAR,
    "address" TEXT,
    "created_at" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(6) NOT NULL,

    CONSTRAINT "Company_pkey" PRIMARY KEY ("company_id")
);

-- CreateTable
CREATE TABLE "User" (
    "user_id" SERIAL NOT NULL,
    "company_id" INTEGER NOT NULL,
    "name" VARCHAR,
    "email" VARCHAR,
    "password" VARCHAR,
    "role" "UserRole",
    "created_at" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(6) NOT NULL,

    CONSTRAINT "User_pkey" PRIMARY KEY ("user_id")
);

-- CreateTable
CREATE TABLE "ProjectSite" (
    "site_id" SERIAL NOT NULL,
    "company_id" INTEGER NOT NULL,
    "site_name" VARCHAR,
    "location" VARCHAR,
    "status" "ProjectSiteStatus",
    "created_at" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(6) NOT NULL,

    CONSTRAINT "ProjectSite_pkey" PRIMARY KEY ("site_id")
);

-- CreateTable
CREATE TABLE "Equipment" (
    "equipment_id" SERIAL NOT NULL,
    "dealer_id" INTEGER NOT NULL,
    "equipment_name" VARCHAR,
    "equipment_type" VARCHAR,
    "model" VARCHAR,
    "serial_number" VARCHAR,
    "qr_code" VARCHAR,
    "rfid_tag" VARCHAR,
    "status" "EquipmentStatus",
    "daily_rental_cost" DECIMAL(10,2),
    "created_at" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(6) NOT NULL,

    CONSTRAINT "Equipment_pkey" PRIMARY KEY ("equipment_id")
);

-- CreateTable
CREATE TABLE "RentalContract" (
    "contract_id" SERIAL NOT NULL,
    "dealer_id" INTEGER NOT NULL,
    "company_id" INTEGER NOT NULL,
    "equipment_id" INTEGER NOT NULL,
    "rental_start" TIMESTAMP(6),
    "expected_return" TIMESTAMP(6),
    "actual_return" TIMESTAMP(6),
    "rental_status" "RentalContractStatus",
    "created_at" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(6) NOT NULL,

    CONSTRAINT "RentalContract_pkey" PRIMARY KEY ("contract_id")
);

-- CreateTable
CREATE TABLE "EquipmentAssignment" (
    "assignment_id" SERIAL NOT NULL,
    "contract_id" INTEGER NOT NULL,
    "site_id" INTEGER NOT NULL,
    "assigned_by" INTEGER NOT NULL,
    "checked_out_by" INTEGER NOT NULL,
    "checkout_time" TIMESTAMP(6),
    "checkin_time" TIMESTAMP(6),
    "status" "AssignmentStatus",
    "created_at" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(6) NOT NULL,

    CONSTRAINT "EquipmentAssignment_pkey" PRIMARY KEY ("assignment_id")
);

-- CreateTable
CREATE TABLE "UsageLog" (
    "usage_id" SERIAL NOT NULL,
    "assignment_id" INTEGER NOT NULL,
    "runtime_hours" DECIMAL(10,2),
    "idle_hours" DECIMAL(10,2),
    "fuel_consumed" DECIMAL(10,2),
    "latitude" DECIMAL(9,6),
    "longitude" DECIMAL(9,6),
    "recorded_at" TIMESTAMP(6),

    CONSTRAINT "UsageLog_pkey" PRIMARY KEY ("usage_id")
);

-- AddForeignKey
ALTER TABLE "User" ADD CONSTRAINT "User_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "Company"("company_id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProjectSite" ADD CONSTRAINT "ProjectSite_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "Company"("company_id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Equipment" ADD CONSTRAINT "Equipment_dealer_id_fkey" FOREIGN KEY ("dealer_id") REFERENCES "Dealer"("dealer_id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RentalContract" ADD CONSTRAINT "RentalContract_dealer_id_fkey" FOREIGN KEY ("dealer_id") REFERENCES "Dealer"("dealer_id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RentalContract" ADD CONSTRAINT "RentalContract_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "Company"("company_id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RentalContract" ADD CONSTRAINT "RentalContract_equipment_id_fkey" FOREIGN KEY ("equipment_id") REFERENCES "Equipment"("equipment_id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EquipmentAssignment" ADD CONSTRAINT "EquipmentAssignment_contract_id_fkey" FOREIGN KEY ("contract_id") REFERENCES "RentalContract"("contract_id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EquipmentAssignment" ADD CONSTRAINT "EquipmentAssignment_site_id_fkey" FOREIGN KEY ("site_id") REFERENCES "ProjectSite"("site_id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EquipmentAssignment" ADD CONSTRAINT "EquipmentAssignment_assigned_by_fkey" FOREIGN KEY ("assigned_by") REFERENCES "User"("user_id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EquipmentAssignment" ADD CONSTRAINT "EquipmentAssignment_checked_out_by_fkey" FOREIGN KEY ("checked_out_by") REFERENCES "User"("user_id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UsageLog" ADD CONSTRAINT "UsageLog_assignment_id_fkey" FOREIGN KEY ("assignment_id") REFERENCES "EquipmentAssignment"("assignment_id") ON DELETE CASCADE ON UPDATE CASCADE;
