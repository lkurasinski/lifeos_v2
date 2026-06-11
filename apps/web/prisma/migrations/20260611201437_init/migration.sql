-- CreateEnum
CREATE TYPE "FoodSource" AS ENUM ('USDA_SR', 'USDA_FOUNDATION', 'OFF', 'CUSTOM');

-- CreateEnum
CREATE TYPE "NutrientCategory" AS ENUM ('ENERGY', 'PROXIMATE', 'MINERAL', 'VITAMIN', 'LIPID', 'AMINO_ACID', 'CAROTENOID', 'OTHER');

-- CreateTable
CREATE TABLE "user" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "emailVerified" BOOLEAN NOT NULL DEFAULT false,
    "image" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "user_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "session" (
    "id" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "token" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "ipAddress" TEXT,
    "userAgent" TEXT,
    "userId" TEXT NOT NULL,

    CONSTRAINT "session_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "account" (
    "id" TEXT NOT NULL,
    "accountId" TEXT NOT NULL,
    "providerId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "accessToken" TEXT,
    "refreshToken" TEXT,
    "idToken" TEXT,
    "accessTokenExpiresAt" TIMESTAMP(3),
    "refreshTokenExpiresAt" TIMESTAMP(3),
    "scope" TEXT,
    "password" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "account_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "verification" (
    "id" TEXT NOT NULL,
    "identifier" TEXT NOT NULL,
    "value" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "verification_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "nutrient" (
    "id" TEXT NOT NULL,
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
    "brand" TEXT,
    "categoryId" UUID,
    "sourceCategory" TEXT,
    "servingSizeG" DOUBLE PRECISION,
    "userModified" BOOLEAN NOT NULL DEFAULT false,
    "imageUrl" TEXT,
    "imageThumbUrl" TEXT,
    "imageIngredientsUrl" TEXT,
    "imageNutritionUrl" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "food_product_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "food_nutrient" (
    "foodId" UUID NOT NULL,
    "nutrientId" TEXT NOT NULL,
    "amountPer100g" DECIMAL(10,4),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "food_nutrient_pkey" PRIMARY KEY ("foodId","nutrientId")
);

-- CreateIndex
CREATE UNIQUE INDEX "user_email_key" ON "user"("email");

-- CreateIndex
CREATE INDEX "session_userId_idx" ON "session"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "session_token_key" ON "session"("token");

-- CreateIndex
CREATE INDEX "account_userId_idx" ON "account"("userId");

-- CreateIndex
CREATE INDEX "verification_identifier_idx" ON "verification"("identifier");

-- CreateIndex
CREATE UNIQUE INDEX "food_category_slug_key" ON "food_category"("slug");

-- CreateIndex
CREATE INDEX "food_product_categoryId_idx" ON "food_product"("categoryId");

-- CreateIndex
CREATE UNIQUE INDEX "food_product_source_sourceId_key" ON "food_product"("source", "sourceId");

-- CreateIndex
CREATE INDEX "food_nutrient_nutrientId_idx" ON "food_nutrient"("nutrientId");

-- AddForeignKey
ALTER TABLE "session" ADD CONSTRAINT "session_userId_fkey" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "account" ADD CONSTRAINT "account_userId_fkey" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "food_product" ADD CONSTRAINT "food_product_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "food_category"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "food_nutrient" ADD CONSTRAINT "food_nutrient_foodId_fkey" FOREIGN KEY ("foodId") REFERENCES "food_product"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "food_nutrient" ADD CONSTRAINT "food_nutrient_nutrientId_fkey" FOREIGN KEY ("nutrientId") REFERENCES "nutrient"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
