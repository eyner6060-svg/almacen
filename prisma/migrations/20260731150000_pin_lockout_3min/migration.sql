-- AlterTable
ALTER TABLE "SystemConfig" ALTER COLUMN "pinLockoutMinutes" SET DEFAULT 3;

-- Aplicar el nuevo valor a la configuración existente
UPDATE "SystemConfig" SET "pinLockoutMinutes" = 3;
