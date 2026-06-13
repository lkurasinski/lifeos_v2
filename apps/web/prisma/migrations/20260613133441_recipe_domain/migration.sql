-- CreateEnum
CREATE TYPE "RecipeStatus" AS ENUM ('DRAFT', 'PUBLISHED');

-- CreateEnum
CREATE TYPE "RecipeVisibility" AS ENUM ('PUBLIC', 'PRIVATE');

-- CreateEnum
CREATE TYPE "RecipeSource" AS ENUM ('USER_CREATED', 'IMPORTED');

-- CreateEnum
CREATE TYPE "RecipeDifficulty" AS ENUM ('EASY', 'MEDIUM', 'HARD');

-- CreateEnum
CREATE TYPE "UnitKind" AS ENUM ('MASS', 'VOLUME', 'COUNT');

-- AlterTable
ALTER TABLE "food_product" ADD COLUMN     "densityGPerMl" DOUBLE PRECISION,
ADD COLUMN     "pieceWeightG" DOUBLE PRECISION;

-- CreateTable
CREATE TABLE "recipe" (
    "id" UUID NOT NULL,
    "userId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "servings" INTEGER NOT NULL DEFAULT 1,
    "prepTimeMin" INTEGER,
    "cookTimeMin" INTEGER,
    "difficulty" "RecipeDifficulty",
    "source" "RecipeSource" NOT NULL DEFAULT 'USER_CREATED',
    "status" "RecipeStatus" NOT NULL DEFAULT 'DRAFT',
    "visibility" "RecipeVisibility" NOT NULL DEFAULT 'PUBLIC',
    "tips" TEXT[],
    "steps" JSONB NOT NULL DEFAULT '[]',
    "imageUrl" TEXT,
    "yieldWeightG" DOUBLE PRECISION,
    "cuisineId" UUID,
    "energyKcalTotal" DOUBLE PRECISION,
    "proteinTotal" DOUBLE PRECISION,
    "fatTotal" DOUBLE PRECISION,
    "carbsTotal" DOUBLE PRECISION,
    "energyKcalPerServing" DOUBLE PRECISION,
    "proteinPerServing" DOUBLE PRECISION,
    "fatPerServing" DOUBLE PRECISION,
    "carbsPerServing" DOUBLE PRECISION,
    "nutrients" JSONB NOT NULL DEFAULT '{}',
    "nutritionComplete" BOOLEAN NOT NULL DEFAULT false,
    "incompleteComponents" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "recipe_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "recipe_component" (
    "id" UUID NOT NULL,
    "recipeId" UUID NOT NULL,
    "orderIndex" INTEGER NOT NULL,
    "productId" UUID,
    "subRecipeId" UUID,
    "amount" DOUBLE PRECISION NOT NULL,
    "unitId" UUID NOT NULL,
    "gramsResolved" DOUBLE PRECISION,
    "note" TEXT,

    CONSTRAINT "recipe_component_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "unit" (
    "id" UUID NOT NULL,
    "slug" TEXT NOT NULL,
    "namePl" TEXT NOT NULL,
    "nameEn" TEXT NOT NULL,
    "kind" "UnitKind" NOT NULL,
    "baseFactor" DOUBLE PRECISION NOT NULL,
    "displayRank" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "unit_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "diet" (
    "id" UUID NOT NULL,
    "slug" TEXT NOT NULL,
    "namePl" TEXT NOT NULL,
    "nameEn" TEXT NOT NULL,
    "createdByUserId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "diet_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "technique" (
    "id" UUID NOT NULL,
    "slug" TEXT NOT NULL,
    "namePl" TEXT NOT NULL,
    "nameEn" TEXT NOT NULL,
    "createdByUserId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "technique_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "allergen" (
    "id" UUID NOT NULL,
    "slug" TEXT NOT NULL,
    "namePl" TEXT NOT NULL,
    "nameEn" TEXT NOT NULL,
    "createdByUserId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "allergen_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "meal_type" (
    "id" UUID NOT NULL,
    "slug" TEXT NOT NULL,
    "namePl" TEXT NOT NULL,
    "nameEn" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "meal_type_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "cuisine" (
    "id" UUID NOT NULL,
    "slug" TEXT NOT NULL,
    "namePl" TEXT NOT NULL,
    "nameEn" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "cuisine_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "recipe_favorite" (
    "userId" TEXT NOT NULL,
    "recipeId" UUID NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "recipe_favorite_pkey" PRIMARY KEY ("userId","recipeId")
);

-- CreateTable
CREATE TABLE "recipe_rating" (
    "userId" TEXT NOT NULL,
    "recipeId" UUID NOT NULL,
    "value" INTEGER NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "recipe_rating_pkey" PRIMARY KEY ("userId","recipeId")
);

-- CreateTable
CREATE TABLE "_RecipeToTechnique" (
    "A" UUID NOT NULL,
    "B" UUID NOT NULL,

    CONSTRAINT "_RecipeToTechnique_AB_pkey" PRIMARY KEY ("A","B")
);

-- CreateTable
CREATE TABLE "_DietToRecipe" (
    "A" UUID NOT NULL,
    "B" UUID NOT NULL,

    CONSTRAINT "_DietToRecipe_AB_pkey" PRIMARY KEY ("A","B")
);

-- CreateTable
CREATE TABLE "_AllergenToRecipe" (
    "A" UUID NOT NULL,
    "B" UUID NOT NULL,

    CONSTRAINT "_AllergenToRecipe_AB_pkey" PRIMARY KEY ("A","B")
);

-- CreateTable
CREATE TABLE "_MealTypeToRecipe" (
    "A" UUID NOT NULL,
    "B" UUID NOT NULL,

    CONSTRAINT "_MealTypeToRecipe_AB_pkey" PRIMARY KEY ("A","B")
);

-- CreateIndex
CREATE INDEX "recipe_userId_idx" ON "recipe"("userId");

-- CreateIndex
CREATE INDEX "recipe_status_idx" ON "recipe"("status");

-- CreateIndex
CREATE INDEX "recipe_visibility_idx" ON "recipe"("visibility");

-- CreateIndex
CREATE INDEX "recipe_cuisineId_idx" ON "recipe"("cuisineId");

-- CreateIndex
CREATE INDEX "recipe_component_recipeId_idx" ON "recipe_component"("recipeId");

-- CreateIndex
CREATE INDEX "recipe_component_productId_idx" ON "recipe_component"("productId");

-- CreateIndex
CREATE INDEX "recipe_component_subRecipeId_idx" ON "recipe_component"("subRecipeId");

-- CreateIndex
CREATE UNIQUE INDEX "unit_slug_key" ON "unit"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "diet_slug_key" ON "diet"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "technique_slug_key" ON "technique"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "allergen_slug_key" ON "allergen"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "meal_type_slug_key" ON "meal_type"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "cuisine_slug_key" ON "cuisine"("slug");

-- CreateIndex
CREATE INDEX "_RecipeToTechnique_B_index" ON "_RecipeToTechnique"("B");

-- CreateIndex
CREATE INDEX "_DietToRecipe_B_index" ON "_DietToRecipe"("B");

-- CreateIndex
CREATE INDEX "_AllergenToRecipe_B_index" ON "_AllergenToRecipe"("B");

-- CreateIndex
CREATE INDEX "_MealTypeToRecipe_B_index" ON "_MealTypeToRecipe"("B");

-- AddForeignKey
ALTER TABLE "recipe" ADD CONSTRAINT "recipe_userId_fkey" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "recipe" ADD CONSTRAINT "recipe_cuisineId_fkey" FOREIGN KEY ("cuisineId") REFERENCES "cuisine"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "recipe_component" ADD CONSTRAINT "recipe_component_recipeId_fkey" FOREIGN KEY ("recipeId") REFERENCES "recipe"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "recipe_component" ADD CONSTRAINT "recipe_component_productId_fkey" FOREIGN KEY ("productId") REFERENCES "food_product"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "recipe_component" ADD CONSTRAINT "recipe_component_subRecipeId_fkey" FOREIGN KEY ("subRecipeId") REFERENCES "recipe"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "recipe_component" ADD CONSTRAINT "recipe_component_unitId_fkey" FOREIGN KEY ("unitId") REFERENCES "unit"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "diet" ADD CONSTRAINT "diet_createdByUserId_fkey" FOREIGN KEY ("createdByUserId") REFERENCES "user"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "technique" ADD CONSTRAINT "technique_createdByUserId_fkey" FOREIGN KEY ("createdByUserId") REFERENCES "user"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "allergen" ADD CONSTRAINT "allergen_createdByUserId_fkey" FOREIGN KEY ("createdByUserId") REFERENCES "user"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "recipe_favorite" ADD CONSTRAINT "recipe_favorite_userId_fkey" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "recipe_favorite" ADD CONSTRAINT "recipe_favorite_recipeId_fkey" FOREIGN KEY ("recipeId") REFERENCES "recipe"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "recipe_rating" ADD CONSTRAINT "recipe_rating_userId_fkey" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "recipe_rating" ADD CONSTRAINT "recipe_rating_recipeId_fkey" FOREIGN KEY ("recipeId") REFERENCES "recipe"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_RecipeToTechnique" ADD CONSTRAINT "_RecipeToTechnique_A_fkey" FOREIGN KEY ("A") REFERENCES "recipe"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_RecipeToTechnique" ADD CONSTRAINT "_RecipeToTechnique_B_fkey" FOREIGN KEY ("B") REFERENCES "technique"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_DietToRecipe" ADD CONSTRAINT "_DietToRecipe_A_fkey" FOREIGN KEY ("A") REFERENCES "diet"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_DietToRecipe" ADD CONSTRAINT "_DietToRecipe_B_fkey" FOREIGN KEY ("B") REFERENCES "recipe"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_AllergenToRecipe" ADD CONSTRAINT "_AllergenToRecipe_A_fkey" FOREIGN KEY ("A") REFERENCES "allergen"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_AllergenToRecipe" ADD CONSTRAINT "_AllergenToRecipe_B_fkey" FOREIGN KEY ("B") REFERENCES "recipe"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_MealTypeToRecipe" ADD CONSTRAINT "_MealTypeToRecipe_A_fkey" FOREIGN KEY ("A") REFERENCES "meal_type"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_MealTypeToRecipe" ADD CONSTRAINT "_MealTypeToRecipe_B_fkey" FOREIGN KEY ("B") REFERENCES "recipe"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Exactly-one(productId, subRecipeId) — a RecipeComponent is either an ingredient
-- (product) or a sub-recipe, never both and never neither. Prisma can't express this,
-- so it's a hand-added CHECK (asserted in Zod + the server layer too).
ALTER TABLE "recipe_component"
    ADD CONSTRAINT "recipe_component_exactly_one_ref"
    CHECK ((("productId" IS NOT NULL)::int + ("subRecipeId" IS NOT NULL)::int) = 1);
