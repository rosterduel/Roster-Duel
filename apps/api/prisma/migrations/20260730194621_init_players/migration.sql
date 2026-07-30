-- CreateEnum
CREATE TYPE "Sport" AS ENUM ('nba', 'nfl');

-- CreateTable
CREATE TABLE "players" (
    "id" TEXT NOT NULL,
    "sport" "Sport" NOT NULL,
    "name" TEXT NOT NULL,
    "primary_position" TEXT NOT NULL,
    "era_start_year" INTEGER NOT NULL,
    "era_end_year" INTEGER,
    "is_active" BOOLEAN NOT NULL,
    "photo_url" TEXT,

    CONSTRAINT "players_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "player_stats" (
    "id" TEXT NOT NULL,
    "player_id" TEXT NOT NULL,
    "stat_key" TEXT NOT NULL,
    "stat_value" DECIMAL(8,4) NOT NULL,
    "scope" TEXT NOT NULL,

    CONSTRAINT "player_stats_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "player_ratings" (
    "player_id" TEXT NOT NULL,
    "base_rating" DECIMAL(6,2) NOT NULL,
    "offense_rating" DECIMAL(6,2) NOT NULL,
    "defense_rating" DECIMAL(6,2) NOT NULL,
    "clutch_modifier" DECIMAL(4,3) NOT NULL,
    "usage_rate" DECIMAL(5,4) NOT NULL,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "player_ratings_pkey" PRIMARY KEY ("player_id")
);

-- CreateIndex
CREATE UNIQUE INDEX "players_sport_name_key" ON "players"("sport", "name");

-- CreateIndex
CREATE UNIQUE INDEX "player_stats_player_id_stat_key_scope_key" ON "player_stats"("player_id", "stat_key", "scope");

-- AddForeignKey
ALTER TABLE "player_stats" ADD CONSTRAINT "player_stats_player_id_fkey" FOREIGN KEY ("player_id") REFERENCES "players"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "player_ratings" ADD CONSTRAINT "player_ratings_player_id_fkey" FOREIGN KEY ("player_id") REFERENCES "players"("id") ON DELETE CASCADE ON UPDATE CASCADE;
