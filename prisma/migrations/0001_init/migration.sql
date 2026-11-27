-- CreateTable
CREATE TABLE "Project" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "slug" TEXT NOT NULL,
    "shareToken" TEXT NOT NULL,
    "locale" TEXT NOT NULL DEFAULT 'zh',
    "title" TEXT NOT NULL,
    "summary" TEXT NOT NULL,
    "property" JSONB NOT NULL,
    "household" JSONB NOT NULL,
    "requirements" JSONB NOT NULL,
    "principles" JSONB NOT NULL,
    "openItems" JSONB NOT NULL,
    "generationConstraints" JSONB NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "Room" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "projectId" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "beforeSrc" TEXT NOT NULL,
    "beforeAlt" TEXT NOT NULL,
    "beforeCaption" TEXT NOT NULL,
    "plan" JSONB NOT NULL,
    "dimensions" JSONB NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    CONSTRAINT "Room_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Scheme" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "projectId" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "nameEn" TEXT,
    "sortOrder" INTEGER NOT NULL,
    "summary" TEXT,
    "summaryLines" JSONB,
    "imageAlt" TEXT NOT NULL,
    "decorMode" TEXT NOT NULL,
    "decorCaveat" TEXT,
    "decorGrid" JSONB,
    "plan" JSONB,
    "hotspots" JSONB NOT NULL,
    "compareRows" JSONB NOT NULL,
    CONSTRAINT "Scheme_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "OptionGroup" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "schemeId" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "labelEn" TEXT,
    "phase" TEXT NOT NULL,
    "sortOrder" INTEGER NOT NULL,
    "unavailableReason" TEXT,
    CONSTRAINT "OptionGroup_schemeId_fkey" FOREIGN KEY ("schemeId") REFERENCES "Scheme" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Option" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "groupId" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "labelEn" TEXT,
    "detail" TEXT,
    "isDefault" BOOLEAN NOT NULL DEFAULT false,
    "costBand" TEXT,
    "timelineBand" TEXT,
    "significant" BOOLEAN NOT NULL DEFAULT false,
    "sortOrder" INTEGER NOT NULL,
    CONSTRAINT "Option_groupId_fkey" FOREIGN KEY ("groupId") REFERENCES "OptionGroup" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Render" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "schemeId" TEXT NOT NULL,
    "role" TEXT NOT NULL,
    "src" TEXT NOT NULL,
    "frames" INTEGER NOT NULL DEFAULT 1,
    "frame" INTEGER NOT NULL DEFAULT 0,
    "when" JSONB NOT NULL,
    "note" TEXT,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    CONSTRAINT "Render_schemeId_fkey" FOREIGN KEY ("schemeId") REFERENCES "Scheme" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "DecorSet" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "projectId" TEXT NOT NULL,
    "presets" JSONB NOT NULL,
    "axes" JSONB NOT NULL,
    "compareRows" JSONB NOT NULL,
    "limitedNote" TEXT,
    CONSTRAINT "DecorSet_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Selection" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "projectId" TEXT NOT NULL,
    "state" JSONB NOT NULL,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Selection_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Generation" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "projectId" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "prompt" TEXT NOT NULL,
    "result" JSONB,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Generation_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE UNIQUE INDEX "Project_slug_key" ON "Project"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "Project_shareToken_key" ON "Project"("shareToken");

-- CreateIndex
CREATE UNIQUE INDEX "Scheme_projectId_key_key" ON "Scheme"("projectId", "key");

-- CreateIndex
CREATE UNIQUE INDEX "OptionGroup_schemeId_key_key" ON "OptionGroup"("schemeId", "key");

-- CreateIndex
CREATE UNIQUE INDEX "Option_groupId_key_key" ON "Option"("groupId", "key");

-- CreateIndex
CREATE UNIQUE INDEX "DecorSet_projectId_key" ON "DecorSet"("projectId");

-- CreateIndex
CREATE UNIQUE INDEX "Selection_projectId_key" ON "Selection"("projectId");

