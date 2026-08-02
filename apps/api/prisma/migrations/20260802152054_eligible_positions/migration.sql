-- AlterTable
ALTER TABLE "player_stints" DROP COLUMN "primary_position",
ADD COLUMN     "eligible_positions" TEXT[];

