-- CreateEnum
CREATE TYPE "FoodSource" AS ENUM ('USDA_SR', 'USDA_FOUNDATION', 'OFF', 'CUSTOM');

-- CreateEnum
CREATE TYPE "NutrientCategory" AS ENUM ('ENERGY', 'PROXIMATE', 'MINERAL', 'VITAMIN', 'LIPID', 'AMINO_ACID', 'CAROTENOID', 'OTHER');

-- CreateTable
CREATE TABLE "nutrient" (
    "id" UUID NOT NULL,
    "infoodsTagname" TEXT NOT NULL,
    "usdaNutrientId" INTEGER,
    "usdaNutrientNbr" TEXT,
    "offSlug" TEXT,
    "nameEn" TEXT NOT NULL,
    "namePl" TEXT NOT NULL DEFAULT '',
    "unit" TEXT NOT NULL,
    "category" "NutrientCategory" NOT NULL,
    "displayRank" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "nutrient_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "food_category" (
    "id" UUID NOT NULL,
    "slug" TEXT NOT NULL,
    "namePl" TEXT NOT NULL,
    "nameEn" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "food_category_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "food_product" (
    "id" UUID NOT NULL,
    "source" "FoodSource" NOT NULL,
    "sourceId" TEXT NOT NULL,
    "nameEn" TEXT NOT NULL,
    "namePl" TEXT,
    "categoryId" UUID,
    "sourceCategory" TEXT,
    "servingSizeG" DOUBLE PRECISION,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "food_product_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "food_nutrient" (
    "foodId" UUID NOT NULL,
    "nutrientId" UUID NOT NULL,
    "amountPer100g" DECIMAL(10,4),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "food_nutrient_pkey" PRIMARY KEY ("foodId","nutrientId")
);

-- CreateIndex
CREATE UNIQUE INDEX "nutrient_infoodsTagname_key" ON "nutrient"("infoodsTagname");

-- CreateIndex
CREATE UNIQUE INDEX "food_category_slug_key" ON "food_category"("slug");

-- CreateIndex
CREATE INDEX "food_product_categoryId_idx" ON "food_product"("categoryId");

-- CreateIndex
CREATE UNIQUE INDEX "food_product_source_sourceId_key" ON "food_product"("source", "sourceId");

-- CreateIndex
CREATE INDEX "food_nutrient_nutrientId_idx" ON "food_nutrient"("nutrientId");

-- AddForeignKey
ALTER TABLE "food_product" ADD CONSTRAINT "food_product_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "food_category"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "food_nutrient" ADD CONSTRAINT "food_nutrient_foodId_fkey" FOREIGN KEY ("foodId") REFERENCES "food_product"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "food_nutrient" ADD CONSTRAINT "food_nutrient_nutrientId_fkey" FOREIGN KEY ("nutrientId") REFERENCES "nutrient"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
