-- CreateEnum
CREATE TYPE "Era" AS ENUM ('sixties', 'seventies', 'eighties', 'nineties', 'two_thousands', 'twenty_tens', 'twenty_twenties');

-- CreateEnum
CREATE TYPE "SkinTone" AS ENUM ('light', 'medium', 'dark');

-- DropForeignKey
ALTER TABLE "player_ratings" DROP CONSTRAINT "player_ratings_player_id_fkey";

-- DropForeignKey
ALTER TABLE "player_stats" DROP CONSTRAINT "player_stats_player_id_fkey";

-- DropTable
DROP TABLE "player_ratings";

-- DropTable
DROP TABLE "player_stats";

-- DropTable
DROP TABLE "players";

-- CreateTable
CREATE TABLE "teams" (
    "id" TEXT NOT NULL,
    "sport" "Sport" NOT NULL,
    "name" TEXT NOT NULL,
    "color_hex" TEXT NOT NULL,

    CONSTRAINT "teams_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "player_stints" (
    "id" TEXT NOT NULL,
    "sport" "Sport" NOT NULL,
    "person_key" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "primary_position" TEXT NOT NULL,
    "team_id" TEXT NOT NULL,
    "era" "Era" NOT NULL,
    "stint_start_year" INTEGER NOT NULL,
    "stint_end_year" INTEGER NOT NULL,
    "is_active" BOOLEAN NOT NULL,
    "skin_tone" "SkinTone" NOT NULL,

    CONSTRAINT "player_stints_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "player_stint_stats" (
    "id" TEXT NOT NULL,
    "stint_id" TEXT NOT NULL,
    "stat_key" TEXT NOT NULL,
    "stat_value" DECIMAL(8,4) NOT NULL,
    "scope" TEXT NOT NULL,

    CONSTRAINT "player_stint_stats_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "player_stint_ratings" (
    "stint_id" TEXT NOT NULL,
    "base_rating" DECIMAL(6,2) NOT NULL,
    "offense_rating" DECIMAL(6,2) NOT NULL,
    "defense_rating" DECIMAL(6,2) NOT NULL,
    "clutch_modifier" DECIMAL(4,3) NOT NULL,
    "usage_rate" DECIMAL(5,4) NOT NULL,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "player_stint_ratings_pkey" PRIMARY KEY ("stint_id")
);

-- CreateIndex
CREATE UNIQUE INDEX "teams_sport_name_key" ON "teams"("sport", "name");

-- CreateIndex
CREATE UNIQUE INDEX "player_stints_sport_team_id_era_name_key" ON "player_stints"("sport", "team_id", "era", "name");

-- CreateIndex
CREATE UNIQUE INDEX "player_stint_stats_stint_id_stat_key_scope_key" ON "player_stint_stats"("stint_id", "stat_key", "scope");

-- AddForeignKey
ALTER TABLE "player_stints" ADD CONSTRAINT "player_stints_team_id_fkey" FOREIGN KEY ("team_id") REFERENCES "teams"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "player_stint_stats" ADD CONSTRAINT "player_stint_stats_stint_id_fkey" FOREIGN KEY ("stint_id") REFERENCES "player_stints"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "player_stint_ratings" ADD CONSTRAINT "player_stint_ratings_stint_id_fkey" FOREIGN KEY ("stint_id") REFERENCES "player_stints"("id") ON DELETE CASCADE ON UPDATE CASCADE;

