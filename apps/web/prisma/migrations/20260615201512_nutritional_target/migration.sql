-- CreateTable
CREATE TABLE "nutritional_target" (
    "id" UUID NOT NULL,
    "userId" TEXT NOT NULL,
    "caloriesKcal" DOUBLE PRECISION,
    "proteinG" DOUBLE PRECISION,
    "carbsG" DOUBLE PRECISION,
    "fatG" DOUBLE PRECISION,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "nutritional_target_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "nutritional_target_userId_key" ON "nutritional_target"("userId");

-- AddForeignKey
ALTER TABLE "nutritional_target" ADD CONSTRAINT "nutritional_target_userId_fkey" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;
