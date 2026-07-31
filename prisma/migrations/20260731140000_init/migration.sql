-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateEnum
CREATE TYPE "Role" AS ENUM ('ADMINISTRADOR', 'ALMACENERO', 'JEFE_OFICINA', 'TRABAJADOR');

-- CreateEnum
CREATE TYPE "ItemType" AS ENUM ('CONSUMIBLE', 'PATRIMONIAL');

-- CreateEnum
CREATE TYPE "OrderStatus" AS ENUM ('PENDIENTE', 'AUTORIZADO_JEFE', 'AUTORIZADO_ALMACENERO', 'COMPLETADO', 'RECHAZADO');

-- CreateEnum
CREATE TYPE "AuthMethod" AS ENUM ('PIN', 'FIRMA_FISICA');

-- CreateEnum
CREATE TYPE "NotifType" AS ENUM ('STOCK_BAJO', 'PEDIDO_PENDIENTE', 'PEDIDO_AUTORIZADO', 'PEDIDO_RECHAZADO', 'BIEN_VENCIDO', 'REPORTE_MENSUAL', 'GARANTIA_PROXIMA_VENCER', 'ITEM_MOVIMIENTO', 'WORKFLOW_EJECUTADO', 'SOLICITUD_COMBUSTIBLE', 'PRESTAMO_CREADO');

-- CreateEnum
CREATE TYPE "FuelType" AS ENUM ('GASOLINA', 'PETROLEO');

-- CreateEnum
CREATE TYPE "AssignmentStatus" AS ENUM ('ASIGNADO', 'DEVUELTO', 'PERDIDO');

-- CreateEnum
CREATE TYPE "FuelRequestStatus" AS ENUM ('PENDIENTE', 'AUTORIZADO', 'COMPLETADO', 'RECHAZADO');

-- CreateEnum
CREATE TYPE "AuditSeverity" AS ENUM ('INFO', 'WARNING', 'CRITICAL');

-- CreateEnum
CREATE TYPE "WarrantyStatus" AS ENUM ('ACTIVE', 'EXPIRED', 'CLAIMED', 'VOID');

-- CreateEnum
CREATE TYPE "AssignmentRequestStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED');

-- CreateEnum
CREATE TYPE "BackupType" AS ENUM ('MANUAL', 'SCHEDULED');

-- CreateEnum
CREATE TYPE "BackupStatus" AS ENUM ('RUNNING', 'COMPLETED', 'FAILED');

-- CreateEnum
CREATE TYPE "TDRStatus" AS ENUM ('BORRADOR', 'GENERADO', 'APROBADO', 'OBSERVADO');

-- CreateEnum
CREATE TYPE "TDRType" AS ENUM ('BIENES', 'COMBUSTIBLE', 'DEVOLUCION');

-- CreateEnum
CREATE TYPE "LoanStatus" AS ENUM ('PENDIENTE', 'AUTORIZADO_ALMACENERO', 'AUTORIZADO_JEFE', 'PRESTADO', 'DEVUELTO', 'RECHAZADO');

-- CreateTable
CREATE TABLE "SystemConfig" (
    "id" SERIAL NOT NULL,
    "institutionName" TEXT NOT NULL DEFAULT 'Almac├®n Institucional',
    "logoUrl" TEXT,
    "primaryColor" TEXT NOT NULL DEFAULT '#1e40af',
    "secondaryColor" TEXT NOT NULL DEFAULT '#3b82f6',
    "accentColor" TEXT NOT NULL DEFAULT '#f59e0b',
    "faviconUrl" TEXT,
    "tabTitle" TEXT NOT NULL DEFAULT 'Almac├®n',
    "footerText" TEXT,
    "force2FA" BOOLEAN NOT NULL DEFAULT false,
    "exemptedRoles" TEXT DEFAULT '[]',
    "maxPinAttempts" INTEGER NOT NULL DEFAULT 5,
    "pinLockoutMinutes" INTEGER NOT NULL DEFAULT 15,
    "backupEnabled" BOOLEAN NOT NULL DEFAULT false,
    "backupSchedule" TEXT,
    "backupRetentionDays" INTEGER NOT NULL DEFAULT 30,
    "backupPath" TEXT NOT NULL DEFAULT './backups',
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SystemConfig_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ItemCatalog" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "brand" TEXT NOT NULL DEFAULT 'S/M',
    "model" TEXT NOT NULL DEFAULT 'S/M',
    "category" TEXT NOT NULL,
    "itemType" "ItemType" NOT NULL DEFAULT 'PATRIMONIAL',
    "unit" TEXT NOT NULL DEFAULT 'UNIDAD',
    "technicalSpecs" TEXT,
    "defaultMinStock" INTEGER NOT NULL DEFAULT 1,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ItemCatalog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "User" (
    "id" SERIAL NOT NULL,
    "fullName" TEXT NOT NULL,
    "dni" TEXT NOT NULL,
    "phone" TEXT,
    "position" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "password" TEXT NOT NULL,
    "pin" TEXT,
    "role" "Role" NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "officeId" INTEGER,
    "isDriver" BOOLEAN NOT NULL DEFAULT false,
    "canAuthorizeOrders" BOOLEAN NOT NULL DEFAULT false,
    "canAuthorizeFuel" BOOLEAN NOT NULL DEFAULT false,
    "canAuthorizeAssignments" BOOLEAN NOT NULL DEFAULT false,
    "canAuthorizeLoans" BOOLEAN NOT NULL DEFAULT false,
    "twoFactorEnabled" BOOLEAN NOT NULL DEFAULT false,
    "twoFactorSecret" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PasswordResetToken" (
    "id" SERIAL NOT NULL,
    "userId" INTEGER NOT NULL,
    "token" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "used" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PasswordResetToken_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Office" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "description" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Office_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Warehouse" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "location" TEXT NOT NULL,
    "description" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "managerId" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Warehouse_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Item" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "model" TEXT NOT NULL DEFAULT 'S/M',
    "brand" TEXT NOT NULL DEFAULT 'S/M',
    "color" TEXT,
    "series" TEXT DEFAULT 'S/S',
    "code" TEXT NOT NULL,
    "patrimonialCode" TEXT,
    "patrimonialCodes" TEXT,
    "itemType" "ItemType" NOT NULL,
    "category" TEXT NOT NULL,
    "unit" TEXT NOT NULL DEFAULT 'UNIDAD',
    "imageUrl" TEXT,
    "quantity" INTEGER NOT NULL DEFAULT 0,
    "minStock" INTEGER NOT NULL DEFAULT 5,
    "status" TEXT NOT NULL DEFAULT 'NUEVO',
    "location" TEXT,
    "warehouseId" INTEGER NOT NULL,
    "qrCode" TEXT,
    "barcodeData" TEXT,
    "technicalSpecs" TEXT,
    "supportDocumentUrl" TEXT,
    "isDeleted" BOOLEAN NOT NULL DEFAULT false,
    "deletedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Item_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ItemStatusLog" (
    "id" SERIAL NOT NULL,
    "itemId" INTEGER NOT NULL,
    "fromStatus" TEXT NOT NULL,
    "toStatus" TEXT NOT NULL,
    "reason" TEXT,
    "reportedBy" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ItemStatusLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Order" (
    "id" SERIAL NOT NULL,
    "orderNumber" TEXT NOT NULL,
    "status" "OrderStatus" NOT NULL DEFAULT 'PENDIENTE',
    "requestedById" INTEGER NOT NULL,
    "officeId" INTEGER NOT NULL,
    "notes" TEXT,
    "pdfUrl" TEXT,
    "signedPdfUrl" TEXT,
    "issueDate" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Order_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OrderItem" (
    "id" SERIAL NOT NULL,
    "orderId" INTEGER NOT NULL,
    "itemId" INTEGER NOT NULL,
    "quantity" INTEGER NOT NULL,
    "patrimonialCode" TEXT,
    "patrimonialUnitId" INTEGER,
    "issueDate" TIMESTAMP(3),
    "expectedReturnDate" TIMESTAMP(3),
    "returnDate" TIMESTAMP(3),
    "actualReturnDate" TIMESTAMP(3),
    "currentLocation" TEXT,
    "isOverdue" BOOLEAN NOT NULL DEFAULT false,
    "notes" TEXT,

    CONSTRAINT "OrderItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PatrimonialUnit" (
    "id" SERIAL NOT NULL,
    "itemId" INTEGER NOT NULL,
    "patrimonialCode" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'NUEVO',
    "currentHolderId" INTEGER,
    "isAvailable" BOOLEAN NOT NULL DEFAULT true,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PatrimonialUnit_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OrderAuthorization" (
    "id" SERIAL NOT NULL,
    "orderId" INTEGER NOT NULL,
    "userId" INTEGER NOT NULL,
    "role" "Role" NOT NULL,
    "authorizedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "method" "AuthMethod" NOT NULL DEFAULT 'PIN',
    "ipAddress" TEXT,

    CONSTRAINT "OrderAuthorization_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Document" (
    "id" SERIAL NOT NULL,
    "orderId" INTEGER,
    "uploadedBy" INTEGER NOT NULL,
    "fileName" TEXT NOT NULL,
    "fileUrl" TEXT NOT NULL,
    "fileType" TEXT NOT NULL,
    "description" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Document_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Notification" (
    "id" SERIAL NOT NULL,
    "userId" INTEGER NOT NULL,
    "title" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "type" "NotifType" NOT NULL,
    "isRead" BOOLEAN NOT NULL DEFAULT false,
    "relatedId" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Notification_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Ingress" (
    "id" SERIAL NOT NULL,
    "ingressNumber" TEXT NOT NULL,
    "itemId" INTEGER NOT NULL,
    "quantity" INTEGER NOT NULL,
    "previousStock" INTEGER NOT NULL,
    "newStock" INTEGER NOT NULL,
    "supplier" TEXT,
    "documentNumber" TEXT,
    "receiptUrl" TEXT,
    "notes" TEXT,
    "receivedById" INTEGER NOT NULL,
    "warehouseId" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Ingress_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Vehicle" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "plate" TEXT NOT NULL,
    "description" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "driverId" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Vehicle_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FuelInventory" (
    "id" SERIAL NOT NULL,
    "fuelType" "FuelType" NOT NULL,
    "quantity" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "minStock" DOUBLE PRECISION NOT NULL DEFAULT 10,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "FuelInventory_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FuelEntry" (
    "id" SERIAL NOT NULL,
    "entryNumber" TEXT NOT NULL,
    "fuelType" "FuelType" NOT NULL,
    "quantity" DOUBLE PRECISION NOT NULL,
    "previousStock" DOUBLE PRECISION NOT NULL,
    "newStock" DOUBLE PRECISION NOT NULL,
    "supplier" TEXT,
    "documentNumber" TEXT,
    "notes" TEXT,
    "receivedById" INTEGER NOT NULL,
    "fuelInventoryId" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "FuelEntry_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FuelRequest" (
    "id" SERIAL NOT NULL,
    "requestNumber" TEXT NOT NULL,
    "fuelType" "FuelType" NOT NULL,
    "quantity" DOUBLE PRECISION NOT NULL,
    "reason" TEXT NOT NULL,
    "destinations" TEXT NOT NULL,
    "requestDate" TIMESTAMP(3) NOT NULL,
    "status" "FuelRequestStatus" NOT NULL DEFAULT 'PENDIENTE',
    "requestedById" INTEGER NOT NULL,
    "vehicleId" INTEGER NOT NULL,
    "pdfUrl" TEXT,
    "signedPdfUrl" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "FuelRequest_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FuelRequestSignature" (
    "id" SERIAL NOT NULL,
    "fuelRequestId" INTEGER NOT NULL,
    "order" INTEGER NOT NULL,
    "position" TEXT NOT NULL,
    "signerName" TEXT,
    "signedAt" TIMESTAMP(3),
    "signatureType" TEXT,

    CONSTRAINT "FuelRequestSignature_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SignatureConfig" (
    "id" SERIAL NOT NULL,
    "type" TEXT NOT NULL,
    "position" INTEGER NOT NULL,
    "title" TEXT NOT NULL,
    "isRequired" BOOLEAN NOT NULL DEFAULT true,
    "isActive" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "SignatureConfig_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PatrimonialExitDocument" (
    "id" SERIAL NOT NULL,
    "orderId" INTEGER NOT NULL,
    "requesterName" TEXT NOT NULL,
    "exitReason" TEXT NOT NULL,
    "exitDate" TIMESTAMP(3) NOT NULL,
    "pdfUrl" TEXT,
    "signedPdfUrl" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PatrimonialExitDocument_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PatrimonialExitSignature" (
    "id" SERIAL NOT NULL,
    "patrimonialExitDocumentId" INTEGER NOT NULL,
    "order" INTEGER NOT NULL,
    "position" TEXT NOT NULL,
    "signerName" TEXT,
    "signedAt" TIMESTAMP(3),

    CONSTRAINT "PatrimonialExitSignature_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ItemStatusEnum" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "color" TEXT NOT NULL DEFAULT 'gray',
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ItemStatusEnum_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AuditLog" (
    "id" SERIAL NOT NULL,
    "userId" INTEGER,
    "action" TEXT NOT NULL,
    "entityType" TEXT NOT NULL,
    "entityId" INTEGER,
    "ipAddress" TEXT,
    "userAgent" TEXT,
    "oldValue" TEXT,
    "newValue" TEXT,
    "description" TEXT NOT NULL,
    "severity" "AuditSeverity" NOT NULL DEFAULT 'INFO',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AuditLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "UserSession" (
    "id" SERIAL NOT NULL,
    "userId" INTEGER NOT NULL,
    "sessionToken" TEXT NOT NULL,
    "ipAddress" TEXT,
    "userAgent" TEXT,
    "lastActivity" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "UserSession_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "NotificationPreference" (
    "id" SERIAL NOT NULL,
    "userId" INTEGER NOT NULL,
    "notifType" TEXT NOT NULL,
    "emailEnabled" BOOLEAN NOT NULL DEFAULT true,
    "pushEnabled" BOOLEAN NOT NULL DEFAULT true,
    "smsEnabled" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "NotificationPreference_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WorkflowRule" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "triggerType" TEXT NOT NULL,
    "conditions" TEXT NOT NULL,
    "actions" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "priority" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "WorkflowRule_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WorkflowExecution" (
    "id" SERIAL NOT NULL,
    "ruleId" INTEGER NOT NULL,
    "entityType" TEXT NOT NULL,
    "entityId" INTEGER NOT NULL,
    "status" TEXT NOT NULL,
    "executedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "result" TEXT,

    CONSTRAINT "WorkflowExecution_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ItemMovement" (
    "id" SERIAL NOT NULL,
    "patrimonialCode" TEXT NOT NULL,
    "itemId" INTEGER NOT NULL,
    "fromLocation" TEXT,
    "toLocation" TEXT NOT NULL,
    "fromUserId" INTEGER,
    "toUserId" INTEGER,
    "movedById" INTEGER NOT NULL,
    "reason" TEXT,
    "notes" TEXT,
    "latitude" DOUBLE PRECISION,
    "longitude" DOUBLE PRECISION,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ItemMovement_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "QRScanLog" (
    "id" SERIAL NOT NULL,
    "itemId" INTEGER,
    "code" TEXT NOT NULL,
    "scanType" TEXT NOT NULL,
    "scannedById" INTEGER NOT NULL,
    "latitude" DOUBLE PRECISION,
    "longitude" DOUBLE PRECISION,
    "deviceInfo" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "QRScanLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Warranty" (
    "id" SERIAL NOT NULL,
    "itemId" INTEGER NOT NULL,
    "purchaseDate" TIMESTAMP(3) NOT NULL,
    "expiryDate" TIMESTAMP(3) NOT NULL,
    "documentUrl" TEXT,
    "supplierName" TEXT,
    "supplierContact" TEXT,
    "warrantyTerms" TEXT,
    "status" "WarrantyStatus" NOT NULL DEFAULT 'ACTIVE',
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Warranty_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ReportTemplate" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "type" TEXT NOT NULL,
    "config" TEXT NOT NULL,
    "createdBy" INTEGER NOT NULL,
    "isPublic" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ReportTemplate_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DigitalSignature" (
    "id" SERIAL NOT NULL,
    "documentType" TEXT NOT NULL,
    "documentId" INTEGER NOT NULL,
    "userId" INTEGER NOT NULL,
    "signatureData" TEXT NOT NULL,
    "signedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "ipAddress" TEXT,
    "userAgent" TEXT,
    "certData" TEXT,

    CONSTRAINT "DigitalSignature_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ApiKey" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "userId" INTEGER NOT NULL,
    "permissions" TEXT NOT NULL,
    "lastUsedAt" TIMESTAMP(3),
    "expiresAt" TIMESTAMP(3),
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ApiKey_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Webhook" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "events" TEXT NOT NULL,
    "secret" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "lastTriggeredAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Webhook_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WebhookDelivery" (
    "id" SERIAL NOT NULL,
    "webhookId" INTEGER NOT NULL,
    "event" TEXT NOT NULL,
    "payload" TEXT NOT NULL,
    "responseCode" INTEGER,
    "success" BOOLEAN NOT NULL DEFAULT false,
    "attempts" INTEGER NOT NULL DEFAULT 1,
    "deliveredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "WebhookDelivery_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SyncLog" (
    "id" SERIAL NOT NULL,
    "system" TEXT NOT NULL,
    "operation" TEXT NOT NULL,
    "entityType" TEXT NOT NULL,
    "recordsTotal" INTEGER NOT NULL,
    "recordsSuccess" INTEGER NOT NULL,
    "recordsFailed" INTEGER NOT NULL,
    "status" TEXT NOT NULL,
    "errorDetails" TEXT,
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completedAt" TIMESTAMP(3),

    CONSTRAINT "SyncLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DemandPrediction" (
    "id" SERIAL NOT NULL,
    "itemId" INTEGER NOT NULL,
    "predictionDate" TIMESTAMP(3) NOT NULL,
    "predictedDemand" DOUBLE PRECISION NOT NULL,
    "confidence" DOUBLE PRECISION NOT NULL,
    "basedOnMonths" INTEGER NOT NULL,
    "actualDemand" DOUBLE PRECISION,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DemandPrediction_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AssignmentRequest" (
    "id" SERIAL NOT NULL,
    "userId" INTEGER NOT NULL,
    "userName" TEXT NOT NULL,
    "userOffice" TEXT NOT NULL,
    "items" TEXT NOT NULL,
    "notes" TEXT,
    "status" "AssignmentRequestStatus" NOT NULL DEFAULT 'PENDING',
    "rejectionReason" TEXT,
    "processedById" INTEGER,
    "processedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AssignmentRequest_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AssignedAsset" (
    "id" SERIAL NOT NULL,
    "userId" INTEGER NOT NULL,
    "itemId" INTEGER NOT NULL,
    "patrimonialUnitId" INTEGER,
    "quantity" INTEGER NOT NULL DEFAULT 1,
    "assignmentDate" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "assignmentDocNumber" TEXT NOT NULL,
    "assignmentDocUrl" TEXT,
    "returnDate" TIMESTAMP(3),
    "returnDocNumber" TEXT,
    "returnDocUrl" TEXT,
    "status" "AssignmentStatus" NOT NULL DEFAULT 'ASIGNADO',
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AssignedAsset_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SecurityEvent" (
    "id" SERIAL NOT NULL,
    "userId" INTEGER,
    "eventType" TEXT NOT NULL,
    "ipAddress" TEXT,
    "geolocation" TEXT,
    "userAgent" TEXT,
    "deviceFingerprint" TEXT,
    "details" TEXT,
    "severity" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SecurityEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BackupLog" (
    "id" SERIAL NOT NULL,
    "fileName" TEXT NOT NULL,
    "fileSize" BIGINT NOT NULL,
    "type" "BackupType" NOT NULL,
    "status" "BackupStatus" NOT NULL,
    "filePath" TEXT NOT NULL,
    "errorMessage" TEXT,
    "triggeredBy" INTEGER,
    "completedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "BackupLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DocumentSequence" (
    "id" SERIAL NOT NULL,
    "prefix" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "counter" INTEGER NOT NULL DEFAULT 0,
    "year" INTEGER NOT NULL DEFAULT 2026,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DocumentSequence_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TDR" (
    "id" SERIAL NOT NULL,
    "tdrNumber" TEXT NOT NULL,
    "tdrType" "TDRType" NOT NULL DEFAULT 'BIENES',
    "category" TEXT NOT NULL DEFAULT '',
    "title" TEXT NOT NULL,
    "justification" TEXT NOT NULL DEFAULT '',
    "objective" TEXT NOT NULL DEFAULT '',
    "items" TEXT NOT NULL,
    "requirements" TEXT NOT NULL DEFAULT '',
    "deliverySchedule" TEXT NOT NULL DEFAULT '',
    "lugarEntrega" TEXT NOT NULL DEFAULT '',
    "formaPago" TEXT NOT NULL DEFAULT '',
    "presupuesto" TEXT NOT NULL DEFAULT '',
    "penalidades" TEXT NOT NULL DEFAULT '',
    "marcoLegal" TEXT NOT NULL DEFAULT '',
    "riesgos" TEXT NOT NULL DEFAULT '',
    "anticorrupcion" TEXT NOT NULL DEFAULT '',
    "adicional" TEXT NOT NULL DEFAULT '',
    "status" "TDRStatus" NOT NULL DEFAULT 'BORRADOR',
    "fileUrl" TEXT,
    "generatedById" INTEGER NOT NULL,
    "isAutomatic" BOOLEAN NOT NULL DEFAULT false,
    "notes" TEXT,
    "deletedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TDR_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Loan" (
    "id" SERIAL NOT NULL,
    "documentNumber" TEXT NOT NULL,
    "documentLabel" TEXT NOT NULL DEFAULT 'Documento de Pr├®stamo',
    "borrowerName" TEXT NOT NULL,
    "borrowerDni" TEXT,
    "borrowerPhone" TEXT,
    "borrowerAddress" TEXT,
    "loanDate" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expectedReturnDate" TIMESTAMP(3) NOT NULL,
    "actualReturnDate" TIMESTAMP(3),
    "reason" TEXT NOT NULL,
    "status" "LoanStatus" NOT NULL DEFAULT 'PENDIENTE',
    "almaceneroAuthId" INTEGER,
    "almaceneroAuthAt" TIMESTAMP(3),
    "jefeAuthId" INTEGER,
    "jefeAuthAt" TIMESTAMP(3),
    "rejectionReason" TEXT,
    "rejectionAuthId" INTEGER,
    "rejectionAt" TIMESTAMP(3),
    "pdfUrl" TEXT,
    "signedPdfUrl" TEXT,
    "deletedAt" TIMESTAMP(3),
    "createdById" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Loan_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LoanItem" (
    "id" SERIAL NOT NULL,
    "loanId" INTEGER NOT NULL,
    "itemId" INTEGER NOT NULL,
    "quantity" INTEGER NOT NULL DEFAULT 1,
    "patrimonialUnitId" INTEGER,
    "itemName" TEXT NOT NULL,
    "itemCode" TEXT NOT NULL,
    "itemBrand" TEXT NOT NULL DEFAULT 'S/M',
    "itemModel" TEXT NOT NULL DEFAULT 'S/M',
    "itemCategory" TEXT,
    "patrimonialCode" TEXT,
    "itemType" TEXT NOT NULL,

    CONSTRAINT "LoanItem_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ItemCatalog_category_idx" ON "ItemCatalog"("category");

-- CreateIndex
CREATE INDEX "ItemCatalog_isActive_idx" ON "ItemCatalog"("isActive");

-- CreateIndex
CREATE UNIQUE INDEX "User_dni_key" ON "User"("dni");

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE INDEX "User_email_idx" ON "User"("email");

-- CreateIndex
CREATE INDEX "User_dni_idx" ON "User"("dni");

-- CreateIndex
CREATE INDEX "User_isActive_idx" ON "User"("isActive");

-- CreateIndex
CREATE INDEX "User_role_officeId_isActive_idx" ON "User"("role", "officeId", "isActive");

-- CreateIndex
CREATE UNIQUE INDEX "PasswordResetToken_userId_key" ON "PasswordResetToken"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "PasswordResetToken_token_key" ON "PasswordResetToken"("token");

-- CreateIndex
CREATE INDEX "PasswordResetToken_token_idx" ON "PasswordResetToken"("token");

-- CreateIndex
CREATE INDEX "PasswordResetToken_expiresAt_idx" ON "PasswordResetToken"("expiresAt");

-- CreateIndex
CREATE UNIQUE INDEX "Office_code_key" ON "Office"("code");

-- CreateIndex
CREATE INDEX "Office_isActive_idx" ON "Office"("isActive");

-- CreateIndex
CREATE INDEX "Warehouse_isActive_idx" ON "Warehouse"("isActive");

-- CreateIndex
CREATE INDEX "Warehouse_managerId_idx" ON "Warehouse"("managerId");

-- CreateIndex
CREATE UNIQUE INDEX "Item_code_key" ON "Item"("code");

-- CreateIndex
CREATE INDEX "Item_category_idx" ON "Item"("category");

-- CreateIndex
CREATE INDEX "Item_status_idx" ON "Item"("status");

-- CreateIndex
CREATE INDEX "Item_warehouseId_idx" ON "Item"("warehouseId");

-- CreateIndex
CREATE INDEX "Item_isDeleted_itemType_status_idx" ON "Item"("isDeleted", "itemType", "status");

-- CreateIndex
CREATE INDEX "Item_warehouseId_isDeleted_idx" ON "Item"("warehouseId", "isDeleted");

-- CreateIndex
CREATE INDEX "Item_name_idx" ON "Item"("name");

-- CreateIndex
CREATE INDEX "Item_warehouseId_isDeleted_status_idx" ON "Item"("warehouseId", "isDeleted", "status");

-- CreateIndex
CREATE INDEX "Item_category_status_isDeleted_idx" ON "Item"("category", "status", "isDeleted");

-- CreateIndex
CREATE INDEX "Item_itemType_status_isDeleted_idx" ON "Item"("itemType", "status", "isDeleted");

-- CreateIndex
CREATE INDEX "ItemStatusLog_itemId_idx" ON "ItemStatusLog"("itemId");

-- CreateIndex
CREATE INDEX "ItemStatusLog_createdAt_idx" ON "ItemStatusLog"("createdAt");

-- CreateIndex
CREATE INDEX "ItemStatusLog_itemId_createdAt_idx" ON "ItemStatusLog"("itemId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "Order_orderNumber_key" ON "Order"("orderNumber");

-- CreateIndex
CREATE INDEX "Order_createdAt_idx" ON "Order"("createdAt");

-- CreateIndex
CREATE INDEX "Order_status_createdAt_idx" ON "Order"("status", "createdAt");

-- CreateIndex
CREATE INDEX "Order_officeId_status_createdAt_idx" ON "Order"("officeId", "status", "createdAt");

-- CreateIndex
CREATE INDEX "Order_requestedById_status_createdAt_idx" ON "Order"("requestedById", "status", "createdAt");

-- CreateIndex
CREATE INDEX "Order_officeId_requestedById_status_createdAt_idx" ON "Order"("officeId", "requestedById", "status", "createdAt");

-- CreateIndex
CREATE INDEX "OrderItem_orderId_idx" ON "OrderItem"("orderId");

-- CreateIndex
CREATE INDEX "OrderItem_itemId_idx" ON "OrderItem"("itemId");

-- CreateIndex
CREATE INDEX "OrderItem_isOverdue_idx" ON "OrderItem"("isOverdue");

-- CreateIndex
CREATE INDEX "OrderItem_patrimonialUnitId_idx" ON "OrderItem"("patrimonialUnitId");

-- CreateIndex
CREATE INDEX "OrderItem_itemId_issueDate_actualReturnDate_idx" ON "OrderItem"("itemId", "issueDate", "actualReturnDate");

-- CreateIndex
CREATE UNIQUE INDEX "PatrimonialUnit_patrimonialCode_key" ON "PatrimonialUnit"("patrimonialCode");

-- CreateIndex
CREATE INDEX "PatrimonialUnit_itemId_idx" ON "PatrimonialUnit"("itemId");

-- CreateIndex
CREATE INDEX "PatrimonialUnit_isAvailable_idx" ON "PatrimonialUnit"("isAvailable");

-- CreateIndex
CREATE INDEX "PatrimonialUnit_currentHolderId_idx" ON "PatrimonialUnit"("currentHolderId");

-- CreateIndex
CREATE INDEX "PatrimonialUnit_itemId_isAvailable_idx" ON "PatrimonialUnit"("itemId", "isAvailable");

-- CreateIndex
CREATE INDEX "OrderAuthorization_orderId_idx" ON "OrderAuthorization"("orderId");

-- CreateIndex
CREATE INDEX "OrderAuthorization_userId_idx" ON "OrderAuthorization"("userId");

-- CreateIndex
CREATE INDEX "Document_orderId_idx" ON "Document"("orderId");

-- CreateIndex
CREATE INDEX "Document_uploadedBy_idx" ON "Document"("uploadedBy");

-- CreateIndex
CREATE INDEX "Notification_userId_idx" ON "Notification"("userId");

-- CreateIndex
CREATE INDEX "Notification_isRead_idx" ON "Notification"("isRead");

-- CreateIndex
CREATE INDEX "Notification_createdAt_idx" ON "Notification"("createdAt");

-- CreateIndex
CREATE INDEX "Notification_userId_isRead_createdAt_idx" ON "Notification"("userId", "isRead", "createdAt");

-- CreateIndex
CREATE INDEX "Notification_userId_createdAt_idx" ON "Notification"("userId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "Ingress_ingressNumber_key" ON "Ingress"("ingressNumber");

-- CreateIndex
CREATE INDEX "Ingress_itemId_idx" ON "Ingress"("itemId");

-- CreateIndex
CREATE INDEX "Ingress_warehouseId_idx" ON "Ingress"("warehouseId");

-- CreateIndex
CREATE INDEX "Ingress_createdAt_idx" ON "Ingress"("createdAt");

-- CreateIndex
CREATE INDEX "Ingress_warehouseId_createdAt_idx" ON "Ingress"("warehouseId", "createdAt");

-- CreateIndex
CREATE INDEX "Ingress_receivedById_idx" ON "Ingress"("receivedById");

-- CreateIndex
CREATE UNIQUE INDEX "Vehicle_plate_key" ON "Vehicle"("plate");

-- CreateIndex
CREATE UNIQUE INDEX "Vehicle_driverId_key" ON "Vehicle"("driverId");

-- CreateIndex
CREATE INDEX "Vehicle_isActive_idx" ON "Vehicle"("isActive");

-- CreateIndex
CREATE INDEX "Vehicle_plate_idx" ON "Vehicle"("plate");

-- CreateIndex
CREATE UNIQUE INDEX "FuelInventory_fuelType_key" ON "FuelInventory"("fuelType");

-- CreateIndex
CREATE INDEX "FuelInventory_fuelType_idx" ON "FuelInventory"("fuelType");

-- CreateIndex
CREATE UNIQUE INDEX "FuelEntry_entryNumber_key" ON "FuelEntry"("entryNumber");

-- CreateIndex
CREATE INDEX "FuelEntry_fuelType_idx" ON "FuelEntry"("fuelType");

-- CreateIndex
CREATE INDEX "FuelEntry_createdAt_idx" ON "FuelEntry"("createdAt");

-- CreateIndex
CREATE INDEX "FuelEntry_fuelInventoryId_idx" ON "FuelEntry"("fuelInventoryId");

-- CreateIndex
CREATE INDEX "FuelEntry_receivedById_idx" ON "FuelEntry"("receivedById");

-- CreateIndex
CREATE UNIQUE INDEX "FuelRequest_requestNumber_key" ON "FuelRequest"("requestNumber");

-- CreateIndex
CREATE INDEX "FuelRequest_vehicleId_idx" ON "FuelRequest"("vehicleId");

-- CreateIndex
CREATE INDEX "FuelRequest_requestedById_idx" ON "FuelRequest"("requestedById");

-- CreateIndex
CREATE INDEX "FuelRequest_requestDate_idx" ON "FuelRequest"("requestDate");

-- CreateIndex
CREATE INDEX "FuelRequest_status_createdAt_idx" ON "FuelRequest"("status", "createdAt");

-- CreateIndex
CREATE INDEX "FuelRequest_requestedById_status_createdAt_idx" ON "FuelRequest"("requestedById", "status", "createdAt");

-- CreateIndex
CREATE INDEX "FuelRequest_requestDate_status_fuelType_idx" ON "FuelRequest"("requestDate", "status", "fuelType");

-- CreateIndex
CREATE INDEX "FuelRequestSignature_fuelRequestId_idx" ON "FuelRequestSignature"("fuelRequestId");

-- CreateIndex
CREATE INDEX "FuelRequestSignature_fuelRequestId_order_idx" ON "FuelRequestSignature"("fuelRequestId", "order");

-- CreateIndex
CREATE INDEX "SignatureConfig_type_idx" ON "SignatureConfig"("type");

-- CreateIndex
CREATE INDEX "SignatureConfig_isActive_idx" ON "SignatureConfig"("isActive");

-- CreateIndex
CREATE UNIQUE INDEX "PatrimonialExitDocument_orderId_key" ON "PatrimonialExitDocument"("orderId");

-- CreateIndex
CREATE INDEX "PatrimonialExitDocument_orderId_idx" ON "PatrimonialExitDocument"("orderId");

-- CreateIndex
CREATE INDEX "PatrimonialExitDocument_exitDate_idx" ON "PatrimonialExitDocument"("exitDate");

-- CreateIndex
CREATE INDEX "PatrimonialExitSignature_patrimonialExitDocumentId_idx" ON "PatrimonialExitSignature"("patrimonialExitDocumentId");

-- CreateIndex
CREATE UNIQUE INDEX "ItemStatusEnum_name_key" ON "ItemStatusEnum"("name");

-- CreateIndex
CREATE INDEX "ItemStatusEnum_isActive_idx" ON "ItemStatusEnum"("isActive");

-- CreateIndex
CREATE INDEX "AuditLog_userId_idx" ON "AuditLog"("userId");

-- CreateIndex
CREATE INDEX "AuditLog_entityId_idx" ON "AuditLog"("entityId");

-- CreateIndex
CREATE INDEX "AuditLog_createdAt_idx" ON "AuditLog"("createdAt");

-- CreateIndex
CREATE INDEX "AuditLog_severity_idx" ON "AuditLog"("severity");

-- CreateIndex
CREATE INDEX "AuditLog_action_createdAt_idx" ON "AuditLog"("action", "createdAt");

-- CreateIndex
CREATE INDEX "AuditLog_entityType_entityId_idx" ON "AuditLog"("entityType", "entityId");

-- CreateIndex
CREATE INDEX "AuditLog_userId_action_createdAt_idx" ON "AuditLog"("userId", "action", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "UserSession_sessionToken_key" ON "UserSession"("sessionToken");

-- CreateIndex
CREATE INDEX "UserSession_userId_idx" ON "UserSession"("userId");

-- CreateIndex
CREATE INDEX "UserSession_sessionToken_idx" ON "UserSession"("sessionToken");

-- CreateIndex
CREATE INDEX "UserSession_isActive_idx" ON "UserSession"("isActive");

-- CreateIndex
CREATE INDEX "UserSession_expiresAt_idx" ON "UserSession"("expiresAt");

-- CreateIndex
CREATE INDEX "NotificationPreference_userId_idx" ON "NotificationPreference"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "NotificationPreference_userId_notifType_key" ON "NotificationPreference"("userId", "notifType");

-- CreateIndex
CREATE INDEX "WorkflowRule_triggerType_idx" ON "WorkflowRule"("triggerType");

-- CreateIndex
CREATE INDEX "WorkflowRule_isActive_idx" ON "WorkflowRule"("isActive");

-- CreateIndex
CREATE INDEX "WorkflowExecution_ruleId_idx" ON "WorkflowExecution"("ruleId");

-- CreateIndex
CREATE INDEX "WorkflowExecution_status_idx" ON "WorkflowExecution"("status");

-- CreateIndex
CREATE INDEX "ItemMovement_patrimonialCode_idx" ON "ItemMovement"("patrimonialCode");

-- CreateIndex
CREATE INDEX "ItemMovement_itemId_idx" ON "ItemMovement"("itemId");

-- CreateIndex
CREATE INDEX "ItemMovement_createdAt_idx" ON "ItemMovement"("createdAt");

-- CreateIndex
CREATE INDEX "ItemMovement_itemId_createdAt_idx" ON "ItemMovement"("itemId", "createdAt");

-- CreateIndex
CREATE INDEX "ItemMovement_itemId_fromLocation_toLocation_idx" ON "ItemMovement"("itemId", "fromLocation", "toLocation");

-- CreateIndex
CREATE INDEX "ItemMovement_toUserId_idx" ON "ItemMovement"("toUserId");

-- CreateIndex
CREATE INDEX "ItemMovement_movedById_idx" ON "ItemMovement"("movedById");

-- CreateIndex
CREATE INDEX "ItemMovement_patrimonialCode_createdAt_idx" ON "ItemMovement"("patrimonialCode", "createdAt");

-- CreateIndex
CREATE INDEX "QRScanLog_code_idx" ON "QRScanLog"("code");

-- CreateIndex
CREATE INDEX "QRScanLog_scannedById_idx" ON "QRScanLog"("scannedById");

-- CreateIndex
CREATE INDEX "QRScanLog_createdAt_idx" ON "QRScanLog"("createdAt");

-- CreateIndex
CREATE INDEX "QRScanLog_itemId_idx" ON "QRScanLog"("itemId");

-- CreateIndex
CREATE UNIQUE INDEX "Warranty_itemId_key" ON "Warranty"("itemId");

-- CreateIndex
CREATE INDEX "Warranty_status_idx" ON "Warranty"("status");

-- CreateIndex
CREATE INDEX "Warranty_expiryDate_idx" ON "Warranty"("expiryDate");

-- CreateIndex
CREATE INDEX "ReportTemplate_type_idx" ON "ReportTemplate"("type");

-- CreateIndex
CREATE INDEX "ReportTemplate_createdBy_idx" ON "ReportTemplate"("createdBy");

-- CreateIndex
CREATE INDEX "DigitalSignature_documentType_idx" ON "DigitalSignature"("documentType");

-- CreateIndex
CREATE INDEX "DigitalSignature_documentId_idx" ON "DigitalSignature"("documentId");

-- CreateIndex
CREATE INDEX "DigitalSignature_userId_idx" ON "DigitalSignature"("userId");

-- CreateIndex
CREATE INDEX "DigitalSignature_documentType_documentId_idx" ON "DigitalSignature"("documentType", "documentId");

-- CreateIndex
CREATE UNIQUE INDEX "ApiKey_key_key" ON "ApiKey"("key");

-- CreateIndex
CREATE INDEX "ApiKey_key_idx" ON "ApiKey"("key");

-- CreateIndex
CREATE INDEX "ApiKey_userId_idx" ON "ApiKey"("userId");

-- CreateIndex
CREATE INDEX "ApiKey_isActive_idx" ON "ApiKey"("isActive");

-- CreateIndex
CREATE INDEX "Webhook_isActive_idx" ON "Webhook"("isActive");

-- CreateIndex
CREATE INDEX "WebhookDelivery_webhookId_idx" ON "WebhookDelivery"("webhookId");

-- CreateIndex
CREATE INDEX "WebhookDelivery_deliveredAt_idx" ON "WebhookDelivery"("deliveredAt");

-- CreateIndex
CREATE INDEX "SyncLog_system_idx" ON "SyncLog"("system");

-- CreateIndex
CREATE INDEX "SyncLog_status_idx" ON "SyncLog"("status");

-- CreateIndex
CREATE INDEX "SyncLog_startedAt_idx" ON "SyncLog"("startedAt");

-- CreateIndex
CREATE INDEX "DemandPrediction_itemId_idx" ON "DemandPrediction"("itemId");

-- CreateIndex
CREATE INDEX "DemandPrediction_predictionDate_idx" ON "DemandPrediction"("predictionDate");

-- CreateIndex
CREATE INDEX "AssignmentRequest_createdAt_idx" ON "AssignmentRequest"("createdAt");

-- CreateIndex
CREATE INDEX "AssignmentRequest_userId_status_createdAt_idx" ON "AssignmentRequest"("userId", "status", "createdAt");

-- CreateIndex
CREATE INDEX "AssignedAsset_userId_idx" ON "AssignedAsset"("userId");

-- CreateIndex
CREATE INDEX "AssignedAsset_itemId_idx" ON "AssignedAsset"("itemId");

-- CreateIndex
CREATE INDEX "AssignedAsset_status_idx" ON "AssignedAsset"("status");

-- CreateIndex
CREATE INDEX "AssignedAsset_assignmentDate_idx" ON "AssignedAsset"("assignmentDate");

-- CreateIndex
CREATE INDEX "AssignedAsset_userId_status_idx" ON "AssignedAsset"("userId", "status");

-- CreateIndex
CREATE INDEX "SecurityEvent_userId_idx" ON "SecurityEvent"("userId");

-- CreateIndex
CREATE INDEX "SecurityEvent_eventType_idx" ON "SecurityEvent"("eventType");

-- CreateIndex
CREATE INDEX "SecurityEvent_severity_idx" ON "SecurityEvent"("severity");

-- CreateIndex
CREATE INDEX "SecurityEvent_createdAt_idx" ON "SecurityEvent"("createdAt");

-- CreateIndex
CREATE INDEX "SecurityEvent_eventType_createdAt_idx" ON "SecurityEvent"("eventType", "createdAt");

-- CreateIndex
CREATE INDEX "BackupLog_status_idx" ON "BackupLog"("status");

-- CreateIndex
CREATE INDEX "BackupLog_createdAt_idx" ON "BackupLog"("createdAt");

-- CreateIndex
CREATE INDEX "BackupLog_type_createdAt_idx" ON "BackupLog"("type", "createdAt");

-- CreateIndex
CREATE INDEX "BackupLog_triggeredBy_idx" ON "BackupLog"("triggeredBy");

-- CreateIndex
CREATE UNIQUE INDEX "DocumentSequence_prefix_key" ON "DocumentSequence"("prefix");

-- CreateIndex
CREATE UNIQUE INDEX "TDR_tdrNumber_key" ON "TDR"("tdrNumber");

-- CreateIndex
CREATE INDEX "TDR_createdAt_idx" ON "TDR"("createdAt");

-- CreateIndex
CREATE INDEX "TDR_tdrType_idx" ON "TDR"("tdrType");

-- CreateIndex
CREATE INDEX "TDR_category_idx" ON "TDR"("category");

-- CreateIndex
CREATE INDEX "TDR_generatedById_idx" ON "TDR"("generatedById");

-- CreateIndex
CREATE INDEX "TDR_deletedAt_idx" ON "TDR"("deletedAt");

-- CreateIndex
CREATE INDEX "TDR_status_createdAt_idx" ON "TDR"("status", "createdAt");

-- CreateIndex
CREATE INDEX "TDR_isAutomatic_createdAt_idx" ON "TDR"("isAutomatic", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "Loan_documentNumber_key" ON "Loan"("documentNumber");

-- CreateIndex
CREATE INDEX "Loan_documentNumber_idx" ON "Loan"("documentNumber");

-- CreateIndex
CREATE INDEX "Loan_createdAt_idx" ON "Loan"("createdAt");

-- CreateIndex
CREATE INDEX "Loan_borrowerName_idx" ON "Loan"("borrowerName");

-- CreateIndex
CREATE INDEX "Loan_deletedAt_idx" ON "Loan"("deletedAt");

-- CreateIndex
CREATE INDEX "Loan_status_createdAt_idx" ON "Loan"("status", "createdAt");

-- CreateIndex
CREATE INDEX "Loan_createdById_idx" ON "Loan"("createdById");

-- CreateIndex
CREATE INDEX "LoanItem_loanId_idx" ON "LoanItem"("loanId");

-- CreateIndex
CREATE INDEX "LoanItem_itemId_idx" ON "LoanItem"("itemId");

-- CreateIndex
CREATE INDEX "LoanItem_patrimonialUnitId_idx" ON "LoanItem"("patrimonialUnitId");

-- AddForeignKey
ALTER TABLE "User" ADD CONSTRAINT "User_officeId_fkey" FOREIGN KEY ("officeId") REFERENCES "Office"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PasswordResetToken" ADD CONSTRAINT "PasswordResetToken_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Warehouse" ADD CONSTRAINT "Warehouse_managerId_fkey" FOREIGN KEY ("managerId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Item" ADD CONSTRAINT "Item_warehouseId_fkey" FOREIGN KEY ("warehouseId") REFERENCES "Warehouse"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ItemStatusLog" ADD CONSTRAINT "ItemStatusLog_reportedBy_fkey" FOREIGN KEY ("reportedBy") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ItemStatusLog" ADD CONSTRAINT "ItemStatusLog_itemId_fkey" FOREIGN KEY ("itemId") REFERENCES "Item"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Order" ADD CONSTRAINT "Order_officeId_fkey" FOREIGN KEY ("officeId") REFERENCES "Office"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Order" ADD CONSTRAINT "Order_requestedById_fkey" FOREIGN KEY ("requestedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OrderItem" ADD CONSTRAINT "OrderItem_itemId_fkey" FOREIGN KEY ("itemId") REFERENCES "Item"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OrderItem" ADD CONSTRAINT "OrderItem_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OrderItem" ADD CONSTRAINT "OrderItem_patrimonialUnitId_fkey" FOREIGN KEY ("patrimonialUnitId") REFERENCES "PatrimonialUnit"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PatrimonialUnit" ADD CONSTRAINT "PatrimonialUnit_itemId_fkey" FOREIGN KEY ("itemId") REFERENCES "Item"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OrderAuthorization" ADD CONSTRAINT "OrderAuthorization_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OrderAuthorization" ADD CONSTRAINT "OrderAuthorization_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Document" ADD CONSTRAINT "Document_uploadedBy_fkey" FOREIGN KEY ("uploadedBy") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Document" ADD CONSTRAINT "Document_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Notification" ADD CONSTRAINT "Notification_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Ingress" ADD CONSTRAINT "Ingress_warehouseId_fkey" FOREIGN KEY ("warehouseId") REFERENCES "Warehouse"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Ingress" ADD CONSTRAINT "Ingress_receivedById_fkey" FOREIGN KEY ("receivedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Ingress" ADD CONSTRAINT "Ingress_itemId_fkey" FOREIGN KEY ("itemId") REFERENCES "Item"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Vehicle" ADD CONSTRAINT "Vehicle_driverId_fkey" FOREIGN KEY ("driverId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FuelEntry" ADD CONSTRAINT "FuelEntry_fuelInventoryId_fkey" FOREIGN KEY ("fuelInventoryId") REFERENCES "FuelInventory"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FuelEntry" ADD CONSTRAINT "FuelEntry_receivedById_fkey" FOREIGN KEY ("receivedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FuelRequest" ADD CONSTRAINT "FuelRequest_vehicleId_fkey" FOREIGN KEY ("vehicleId") REFERENCES "Vehicle"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FuelRequest" ADD CONSTRAINT "FuelRequest_requestedById_fkey" FOREIGN KEY ("requestedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FuelRequestSignature" ADD CONSTRAINT "FuelRequestSignature_fuelRequestId_fkey" FOREIGN KEY ("fuelRequestId") REFERENCES "FuelRequest"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PatrimonialExitDocument" ADD CONSTRAINT "PatrimonialExitDocument_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PatrimonialExitSignature" ADD CONSTRAINT "PatrimonialExitSignature_patrimonialExitDocumentId_fkey" FOREIGN KEY ("patrimonialExitDocumentId") REFERENCES "PatrimonialExitDocument"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AuditLog" ADD CONSTRAINT "AuditLog_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserSession" ADD CONSTRAINT "UserSession_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "NotificationPreference" ADD CONSTRAINT "NotificationPreference_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WorkflowExecution" ADD CONSTRAINT "WorkflowExecution_ruleId_fkey" FOREIGN KEY ("ruleId") REFERENCES "WorkflowRule"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ItemMovement" ADD CONSTRAINT "ItemMovement_itemId_fkey" FOREIGN KEY ("itemId") REFERENCES "Item"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ItemMovement" ADD CONSTRAINT "ItemMovement_movedById_fkey" FOREIGN KEY ("movedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "QRScanLog" ADD CONSTRAINT "QRScanLog_itemId_fkey" FOREIGN KEY ("itemId") REFERENCES "Item"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "QRScanLog" ADD CONSTRAINT "QRScanLog_scannedById_fkey" FOREIGN KEY ("scannedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Warranty" ADD CONSTRAINT "Warranty_itemId_fkey" FOREIGN KEY ("itemId") REFERENCES "Item"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DigitalSignature" ADD CONSTRAINT "DigitalSignature_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ApiKey" ADD CONSTRAINT "ApiKey_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WebhookDelivery" ADD CONSTRAINT "WebhookDelivery_webhookId_fkey" FOREIGN KEY ("webhookId") REFERENCES "Webhook"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DemandPrediction" ADD CONSTRAINT "DemandPrediction_itemId_fkey" FOREIGN KEY ("itemId") REFERENCES "Item"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AssignedAsset" ADD CONSTRAINT "AssignedAsset_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AssignedAsset" ADD CONSTRAINT "AssignedAsset_itemId_fkey" FOREIGN KEY ("itemId") REFERENCES "Item"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AssignedAsset" ADD CONSTRAINT "AssignedAsset_patrimonialUnitId_fkey" FOREIGN KEY ("patrimonialUnitId") REFERENCES "PatrimonialUnit"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SecurityEvent" ADD CONSTRAINT "SecurityEvent_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TDR" ADD CONSTRAINT "TDR_generatedById_fkey" FOREIGN KEY ("generatedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Loan" ADD CONSTRAINT "Loan_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Loan" ADD CONSTRAINT "Loan_almaceneroAuthId_fkey" FOREIGN KEY ("almaceneroAuthId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Loan" ADD CONSTRAINT "Loan_jefeAuthId_fkey" FOREIGN KEY ("jefeAuthId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Loan" ADD CONSTRAINT "Loan_rejectionAuthId_fkey" FOREIGN KEY ("rejectionAuthId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LoanItem" ADD CONSTRAINT "LoanItem_loanId_fkey" FOREIGN KEY ("loanId") REFERENCES "Loan"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LoanItem" ADD CONSTRAINT "LoanItem_itemId_fkey" FOREIGN KEY ("itemId") REFERENCES "Item"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LoanItem" ADD CONSTRAINT "LoanItem_patrimonialUnitId_fkey" FOREIGN KEY ("patrimonialUnitId") REFERENCES "PatrimonialUnit"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ÔöîÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔö
ÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÉ
Ôöé  Update available 6.19.3 -> 7.9.1                       Ôöé
Ôöé                                                         Ôöé
Ôöé  This is a major update - please follow the guide at    Ôöé
Ôöé  https://pris.ly/d/major-version-upgrade                Ôöé
Ôöé                                                         Ôöé
Ôöé  Run the following to update                            Ôöé
Ôöé    npm i --save-dev prisma@latest                       Ôöé
Ôöé    npm i @prisma/client@latest                          Ôöé
ÔööÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔö
ÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÿ

