-- CreateEnum
CREATE TYPE "MatchType" AS ENUM ('friend_link', 'random_matchmaking');

-- AlterTable
ALTER TABLE "matches" ADD COLUMN     "match_type" "MatchType" NOT NULL DEFAULT 'friend_link';

-- CreateIndex
CREATE UNIQUE INDEX "users_display_name_key" ON "users"("display_name");

