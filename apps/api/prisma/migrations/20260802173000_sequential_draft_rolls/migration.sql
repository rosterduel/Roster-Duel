-- Spec 4c's sequential-roll redesign supersedes the earlier per-slot-
-- simultaneous version: rosters.slot_assignments (position -> combo map)
-- becomes rosters.roll_sequence (an ARRAY of combos, one per round, not
-- keyed by position); matches.shared_slot_assignments becomes
-- matches.shared_roll_sequence (same reshape, for same_roles matches).
--
-- Spec section 4 also flips the draft timer's default to OFF (untimed is
-- now the default experience, opt-in per match) — draft_timer_seconds and
-- draft_deadline become nullable, with null meaning "no timer."

-- AlterTable: rosters
ALTER TABLE "rosters" RENAME COLUMN "slot_assignments" TO "roll_sequence";
ALTER TABLE "rosters" ALTER COLUMN "roll_sequence" SET DEFAULT '[]';
ALTER TABLE "rosters" ALTER COLUMN "draft_deadline" DROP NOT NULL;

-- AlterTable: matches
ALTER TABLE "matches" RENAME COLUMN "shared_slot_assignments" TO "shared_roll_sequence";
ALTER TABLE "matches" ALTER COLUMN "draft_timer_seconds" DROP NOT NULL;
ALTER TABLE "matches" ALTER COLUMN "draft_timer_seconds" DROP DEFAULT;
