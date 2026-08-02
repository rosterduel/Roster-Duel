-- CreateEnum
CREATE TYPE "StatEstimateReason" AS ENUM ('pre_tracking_era', 'hypothetical_pre_three_point');

-- AlterTable
ALTER TABLE "player_stint_stats" ADD COLUMN     "estimate_reason" "StatEstimateReason";

