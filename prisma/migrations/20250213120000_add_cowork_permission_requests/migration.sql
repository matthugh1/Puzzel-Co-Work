-- CreateEnum
CREATE TYPE "CoworkPermissionRequestStatus" AS ENUM ('pending', 'approved', 'denied', 'timeout');

-- CreateTable
CREATE TABLE "cowork_permission_requests" (
    "id" TEXT NOT NULL,
    "sessionId" TEXT NOT NULL,
    "requestId" TEXT NOT NULL,
    "toolName" TEXT NOT NULL,
    "toolInput" JSONB NOT NULL,
    "status" "CoworkPermissionRequestStatus" NOT NULL DEFAULT 'pending',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "resolvedAt" TIMESTAMP(3),

    CONSTRAINT "cowork_permission_requests_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "cowork_permission_requests_sessionId_idx" ON "cowork_permission_requests"("sessionId");

-- CreateIndex
CREATE INDEX "cowork_permission_requests_requestId_idx" ON "cowork_permission_requests"("requestId");

-- CreateIndex
CREATE UNIQUE INDEX "cowork_permission_requests_sessionId_requestId_key" ON "cowork_permission_requests"("sessionId", "requestId");

-- AddForeignKey
ALTER TABLE "cowork_permission_requests" ADD CONSTRAINT "cowork_permission_requests_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "cowork_sessions"("id") ON DELETE CASCADE ON UPDATE CASCADE;
