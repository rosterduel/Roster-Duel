-- CreateTable
CREATE TABLE "users" (
    "id" TEXT NOT NULL,
    "session_token" TEXT NOT NULL,
    "display_name" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "rosters" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "sport" "Sport" NOT NULL DEFAULT 'nba',
    "mode" TEXT,
    "slots" JSONB NOT NULL DEFAULT '{}',
    "is_locked" BOOLEAN NOT NULL DEFAULT false,
    "locked_at" TIMESTAMP(3),
    "draft_deadline" TIMESTAMP(3) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "rosters_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "matches" (
    "id" TEXT NOT NULL,
    "sport" "Sport" NOT NULL DEFAULT 'nba',
    "room_code" TEXT NOT NULL,
    "roster_a_id" TEXT,
    "roster_b_id" TEXT,
    "games_to_play" INTEGER NOT NULL DEFAULT 1,
    "draft_timer_seconds" INTEGER NOT NULL DEFAULT 300,
    "status" TEXT NOT NULL DEFAULT 'drafting',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "matches_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "game_results" (
    "id" TEXT NOT NULL,
    "match_id" TEXT NOT NULL,
    "game_number" INTEGER NOT NULL DEFAULT 1,
    "score_a" INTEGER NOT NULL,
    "score_b" INTEGER NOT NULL,
    "box_score" JSONB NOT NULL,
    "play_log" JSONB NOT NULL,
    "highlights" JSONB NOT NULL,
    "mvp" JSONB NOT NULL,
    "overtime_periods" INTEGER NOT NULL DEFAULT 0,
    "recap_headline" TEXT,
    "recap_article" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "game_results_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "users_session_token_key" ON "users"("session_token");

-- CreateIndex
CREATE UNIQUE INDEX "matches_room_code_key" ON "matches"("room_code");

-- CreateIndex
CREATE UNIQUE INDEX "matches_roster_a_id_key" ON "matches"("roster_a_id");

-- CreateIndex
CREATE UNIQUE INDEX "matches_roster_b_id_key" ON "matches"("roster_b_id");

-- AddForeignKey
ALTER TABLE "rosters" ADD CONSTRAINT "rosters_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "matches" ADD CONSTRAINT "matches_roster_a_id_fkey" FOREIGN KEY ("roster_a_id") REFERENCES "rosters"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "matches" ADD CONSTRAINT "matches_roster_b_id_fkey" FOREIGN KEY ("roster_b_id") REFERENCES "rosters"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "game_results" ADD CONSTRAINT "game_results_match_id_fkey" FOREIGN KEY ("match_id") REFERENCES "matches"("id") ON DELETE CASCADE ON UPDATE CASCADE;
