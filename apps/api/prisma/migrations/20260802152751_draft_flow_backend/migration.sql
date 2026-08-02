-- CreateEnum
CREATE TYPE "RolesMode" AS ENUM ('same_roles', 'independent_roles');

-- AlterTable
ALTER TABLE "matches" ADD COLUMN     "included_eras" "Era"[],
ADD COLUMN     "included_team_ids" TEXT[],
ADD COLUMN     "roles_mode" "RolesMode" NOT NULL DEFAULT 'independent_roles',
ADD COLUMN     "shared_slot_assignments" JSONB;

-- AlterTable
ALTER TABLE "rosters" ADD COLUMN     "era_respin_used" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "slot_assignments" JSONB NOT NULL DEFAULT '{}',
ADD COLUMN     "team_respin_used" BOOLEAN NOT NULL DEFAULT false;

