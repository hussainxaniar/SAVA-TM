-- CreateTable
CREATE TABLE "DocTaskLink" (
    "pageId" TEXT NOT NULL,
    "taskId" TEXT NOT NULL,

    CONSTRAINT "DocTaskLink_pkey" PRIMARY KEY ("pageId","taskId")
);

-- CreateIndex
CREATE INDEX "DocTaskLink_taskId_idx" ON "DocTaskLink"("taskId");

-- AddForeignKey
ALTER TABLE "DocTaskLink" ADD CONSTRAINT "DocTaskLink_pageId_fkey" FOREIGN KEY ("pageId") REFERENCES "DocPage"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DocTaskLink" ADD CONSTRAINT "DocTaskLink_taskId_fkey" FOREIGN KEY ("taskId") REFERENCES "Task"("id") ON DELETE CASCADE ON UPDATE CASCADE;
