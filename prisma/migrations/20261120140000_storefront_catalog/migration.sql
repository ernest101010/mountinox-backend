-- CreateEnum
CREATE TYPE "Season" AS ENUM ('three_season', 'winter', 'all_season');

ALTER TABLE "Category" ADD COLUMN "imageUrl" TEXT;

ALTER TABLE "Product" ADD COLUMN "tagline" JSONB;
ALTER TABLE "Product" ADD COLUMN "specs" JSONB;
ALTER TABLE "Product" ADD COLUMN "season" "Season";
ALTER TABLE "Product" ADD COLUMN "features" TEXT[] DEFAULT ARRAY[]::TEXT[];
ALTER TABLE "Product" ADD COLUMN "featured" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "Product" ADD COLUMN "ratingAvg" DOUBLE PRECISION;
ALTER TABLE "Product" ADD COLUMN "ratingCount" INTEGER NOT NULL DEFAULT 0;

CREATE TABLE "Subscriber" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "locale" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Subscriber_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "Subscriber_email_key" ON "Subscriber"("email");
