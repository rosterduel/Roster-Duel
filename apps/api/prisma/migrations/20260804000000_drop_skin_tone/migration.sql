-- Drops per-player skin-tone personalization for the GameCast sprite
-- entirely (not replaced with an inferred/approximated value) -- no real
-- player's sprite should be interpretable as a depiction of that person's
-- actual race/appearance. Sprites are now differentiated visually by each
-- player's drafted-from team color instead, read directly off the
-- existing team relation at render time -- no replacement column needed.

ALTER TABLE "player_stints" DROP COLUMN "skin_tone";

DROP TYPE "SkinTone";
