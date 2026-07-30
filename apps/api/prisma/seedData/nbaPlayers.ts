/**
 * Phase 1 MVP player pool — 36 real NBA players (6 per position), hand-
 * curated rather than pulled from a bulk dataset or API.
 *
 * WHY hand-curated: the spec's own legal notes (section 10) flag that
 * scraping Basketball-Reference/similar sites may violate their ToS, and
 * budget for a licensed API (e.g. SportRadar) or a properly-licensed bulk
 * dataset instead. This project's ground rules for Phase 1 rule out paid
 * APIs entirely and rule out scraping. Rather than pull in a third-party
 * dataset of uncertain licensing/provenance for a seed set this small,
 * these are widely-known, publicly-cited career statistics (facts, not
 * copyrightable expression — same reasoning the spec's C.B.C. v. MLBAM
 * discussion relies on) entered directly, the same way the sim-engine demo
 * rosters were. No scraping, no redistributed dataset, no ToS exposure.
 *
 * Accuracy caveat: these are approximate/illustrative career averages
 * compiled from general public knowledge, spot-checked against web search
 * for the still-active players (Curry, LeBron, Durant, Harden, Giannis,
 * Jokić) whose numbers are still moving and most likely to be stale from
 * memory; the retired players' career averages are long-settled, widely-
 * cited facts. None of this is verified against a canonical source
 * line-by-line. Treat it as MVP placeholder data — the real pipeline (spec
 * section 6, an offline batch job against a real open dataset) should
 * replace this pool before any real launch. era/active-status calls for a
 * couple of recently-retired players (Chris Paul, Lou Williams) are
 * best-effort guesses, not verified.
 *
 * Rate stats (astRate/rebRate/stlRate/blkRate/threePtRate) do double duty:
 * they feed both the offline rating computation (computeRatings.ts) AND,
 * unchanged, the sim-engine's per-trip attribution weights
 * (assistRate/reboundRate/stealRate/blockRate/threePointRate) — one set of
 * numbers, two consumers, matching how player_stats is meant to be a
 * flexible, reusable store rather than sim-specific.
 */

export type NbaPosition = 'PG' | 'SG' | 'SF' | 'PF' | 'C' | '6MAN';

export interface SeedPlayerStats {
  ppg: number;
  rpg: number;
  apg: number;
  spg: number;
  bpg: number;
  tovPg: number;
  fgPct: number;
  threePtPct: number;
  /** Share of this player's FGA that are 3-point attempts. */
  threePtRate: number;
  ftPct: number;
  /** Share of teammates' made shots this player assists on. */
  astRate: number;
  /** Share of available rebounds this player grabs. */
  rebRate: number;
  /** Share of live-ball turnovers converted into a steal. */
  stlRate: number;
  /** Share of opponent missed shots this player blocks. */
  blkRate: number;
}

export interface SeedPlayer {
  name: string;
  position: NbaPosition;
  eraStartYear: number;
  /** null = still active. */
  eraEndYear: number | null;
  isActive: boolean;
  stats: SeedPlayerStats;
  /** Goes directly to player_ratings.usage_rate — hand-authored like the rest, not computed. */
  usageRate: number;
}

export const NBA_SEED_PLAYERS: SeedPlayer[] = [
  // ---- PG ----
  {
    name: 'Magic Johnson',
    position: 'PG',
    eraStartYear: 1979,
    eraEndYear: 1996,
    isActive: false,
    stats: {
      ppg: 19.5, rpg: 7.2, apg: 11.2, spg: 1.9, bpg: 0.4, tovPg: 3.6,
      fgPct: 0.520, threePtPct: 0.303, threePtRate: 0.05, ftPct: 0.848,
      astRate: 0.42, rebRate: 0.14, stlRate: 0.024, blkRate: 0.010,
    },
    usageRate: 0.23,
  },
  {
    name: 'Stephen Curry',
    position: 'PG',
    eraStartYear: 2009,
    eraEndYear: null,
    isActive: true,
    stats: {
      ppg: 24.8, rpg: 4.7, apg: 6.3, spg: 1.5, bpg: 0.2, tovPg: 3.1,
      fgPct: 0.473, threePtPct: 0.423, threePtRate: 0.55, ftPct: 0.908,
      astRate: 0.30, rebRate: 0.07, stlRate: 0.018, blkRate: 0.004,
    },
    usageRate: 0.30,
  },
  {
    name: 'Chris Paul',
    position: 'PG',
    eraStartYear: 2005,
    eraEndYear: 2025,
    isActive: false,
    stats: {
      ppg: 17.4, rpg: 4.4, apg: 9.4, spg: 2.1, bpg: 0.1, tovPg: 2.4,
      fgPct: 0.471, threePtPct: 0.370, threePtRate: 0.30, ftPct: 0.870,
      astRate: 0.40, rebRate: 0.08, stlRate: 0.031, blkRate: 0.003,
    },
    usageRate: 0.24,
  },
  {
    name: 'John Stockton',
    position: 'PG',
    eraStartYear: 1984,
    eraEndYear: 2003,
    isActive: false,
    stats: {
      ppg: 13.1, rpg: 2.7, apg: 10.5, spg: 2.2, bpg: 0.2, tovPg: 2.7,
      fgPct: 0.515, threePtPct: 0.384, threePtRate: 0.15, ftPct: 0.826,
      astRate: 0.44, rebRate: 0.06, stlRate: 0.032, blkRate: 0.005,
    },
    usageRate: 0.18,
  },
  {
    name: 'Steve Nash',
    position: 'PG',
    eraStartYear: 1996,
    eraEndYear: 2014,
    isActive: false,
    stats: {
      ppg: 14.3, rpg: 3.0, apg: 8.5, spg: 0.7, bpg: 0.1, tovPg: 2.8,
      fgPct: 0.490, threePtPct: 0.428, threePtRate: 0.35, ftPct: 0.904,
      astRate: 0.39, rebRate: 0.07, stlRate: 0.011, blkRate: 0.003,
    },
    usageRate: 0.21,
  },
  {
    name: 'Isiah Thomas',
    position: 'PG',
    eraStartYear: 1981,
    eraEndYear: 1994,
    isActive: false,
    stats: {
      ppg: 19.2, rpg: 3.6, apg: 9.3, spg: 1.9, bpg: 0.2, tovPg: 3.4,
      fgPct: 0.452, threePtPct: 0.290, threePtRate: 0.15, ftPct: 0.759,
      astRate: 0.38, rebRate: 0.08, stlRate: 0.027, blkRate: 0.005,
    },
    usageRate: 0.25,
  },

  // ---- SG ----
  {
    name: 'Michael Jordan',
    position: 'SG',
    eraStartYear: 1984,
    eraEndYear: 2003,
    isActive: false,
    stats: {
      ppg: 30.1, rpg: 6.2, apg: 5.3, spg: 2.3, bpg: 0.8, tovPg: 2.7,
      fgPct: 0.497, threePtPct: 0.327, threePtRate: 0.10, ftPct: 0.835,
      astRate: 0.22, rebRate: 0.11, stlRate: 0.031, blkRate: 0.017,
    },
    usageRate: 0.33,
  },
  {
    name: 'Kobe Bryant',
    position: 'SG',
    eraStartYear: 1996,
    eraEndYear: 2016,
    isActive: false,
    stats: {
      ppg: 25.0, rpg: 5.2, apg: 4.7, spg: 1.4, bpg: 0.5, tovPg: 2.9,
      fgPct: 0.447, threePtPct: 0.329, threePtRate: 0.22, ftPct: 0.837,
      astRate: 0.20, rebRate: 0.09, stlRate: 0.018, blkRate: 0.011,
    },
    usageRate: 0.32,
  },
  {
    name: 'Dwyane Wade',
    position: 'SG',
    eraStartYear: 2003,
    eraEndYear: 2019,
    isActive: false,
    stats: {
      ppg: 22.0, rpg: 4.7, apg: 5.4, spg: 1.5, bpg: 0.8, tovPg: 3.1,
      fgPct: 0.482, threePtPct: 0.288, threePtRate: 0.10, ftPct: 0.765,
      astRate: 0.24, rebRate: 0.09, stlRate: 0.020, blkRate: 0.017,
    },
    usageRate: 0.29,
  },
  {
    name: 'Allen Iverson',
    position: 'SG',
    eraStartYear: 1996,
    eraEndYear: 2010,
    isActive: false,
    stats: {
      ppg: 26.7, rpg: 3.7, apg: 6.2, spg: 2.2, bpg: 0.2, tovPg: 3.5,
      fgPct: 0.425, threePtPct: 0.313, threePtRate: 0.18, ftPct: 0.780,
      astRate: 0.27, rebRate: 0.06, stlRate: 0.032, blkRate: 0.004,
    },
    usageRate: 0.31,
  },
  {
    name: 'James Harden',
    position: 'SG',
    eraStartYear: 2009,
    eraEndYear: null,
    isActive: true,
    stats: {
      ppg: 24.8, rpg: 5.8, apg: 7.0, spg: 1.5, bpg: 0.5, tovPg: 3.8,
      fgPct: 0.440, threePtPct: 0.365, threePtRate: 0.45, ftPct: 0.860,
      astRate: 0.34, rebRate: 0.10, stlRate: 0.018, blkRate: 0.007,
    },
    usageRate: 0.31,
  },
  {
    name: 'Reggie Miller',
    position: 'SG',
    eraStartYear: 1987,
    eraEndYear: 2005,
    isActive: false,
    stats: {
      ppg: 18.2, rpg: 3.0, apg: 3.0, spg: 1.1, bpg: 0.2, tovPg: 1.9,
      fgPct: 0.471, threePtPct: 0.395, threePtRate: 0.40, ftPct: 0.888,
      astRate: 0.13, rebRate: 0.06, stlRate: 0.014, blkRate: 0.005,
    },
    usageRate: 0.22,
  },

  // ---- SF ----
  {
    name: 'LeBron James',
    position: 'SF',
    eraStartYear: 2003,
    eraEndYear: null,
    isActive: true,
    stats: {
      ppg: 26.8, rpg: 7.5, apg: 7.4, spg: 1.7, bpg: 0.7, tovPg: 3.5,
      fgPct: 0.505, threePtPct: 0.345, threePtRate: 0.25, ftPct: 0.735,
      astRate: 0.34, rebRate: 0.14, stlRate: 0.021, blkRate: 0.014,
    },
    usageRate: 0.31,
  },
  {
    name: 'Larry Bird',
    position: 'SF',
    eraStartYear: 1979,
    eraEndYear: 1992,
    isActive: false,
    stats: {
      ppg: 24.3, rpg: 10.0, apg: 6.3, spg: 1.7, bpg: 0.8, tovPg: 2.9,
      fgPct: 0.496, threePtPct: 0.376, threePtRate: 0.15, ftPct: 0.886,
      astRate: 0.26, rebRate: 0.16, stlRate: 0.021, blkRate: 0.014,
    },
    usageRate: 0.27,
  },
  {
    name: 'Kevin Durant',
    position: 'SF',
    eraStartYear: 2007,
    eraEndYear: null,
    isActive: true,
    stats: {
      ppg: 27.1, rpg: 6.9, apg: 4.4, spg: 1.1, bpg: 1.1, tovPg: 3.2,
      fgPct: 0.499, threePtPct: 0.386, threePtRate: 0.35, ftPct: 0.883,
      astRate: 0.19, rebRate: 0.12, stlRate: 0.013, blkRate: 0.024,
    },
    usageRate: 0.30,
  },
  {
    name: 'Julius Erving',
    position: 'SF',
    eraStartYear: 1971,
    eraEndYear: 1987,
    isActive: false,
    stats: {
      ppg: 22.0, rpg: 6.7, apg: 3.9, spg: 1.8, bpg: 1.5, tovPg: 3.0,
      fgPct: 0.507, threePtPct: 0.200, threePtRate: 0.02, ftPct: 0.777,
      astRate: 0.17, rebRate: 0.12, stlRate: 0.024, blkRate: 0.025,
    },
    usageRate: 0.27,
  },
  {
    name: 'Scottie Pippen',
    position: 'SF',
    eraStartYear: 1987,
    eraEndYear: 2004,
    isActive: false,
    stats: {
      ppg: 16.1, rpg: 6.4, apg: 5.2, spg: 2.0, bpg: 0.8, tovPg: 2.7,
      fgPct: 0.474, threePtPct: 0.327, threePtRate: 0.15, ftPct: 0.704,
      astRate: 0.24, rebRate: 0.13, stlRate: 0.028, blkRate: 0.016,
    },
    usageRate: 0.21,
  },
  {
    name: 'Paul Pierce',
    position: 'SF',
    eraStartYear: 1998,
    eraEndYear: 2017,
    isActive: false,
    stats: {
      ppg: 19.7, rpg: 5.6, apg: 3.5, spg: 1.4, bpg: 0.4, tovPg: 2.6,
      fgPct: 0.445, threePtPct: 0.368, threePtRate: 0.30, ftPct: 0.806,
      astRate: 0.16, rebRate: 0.11, stlRate: 0.019, blkRate: 0.009,
    },
    usageRate: 0.26,
  },

  // ---- PF ----
  {
    name: 'Tim Duncan',
    position: 'PF',
    eraStartYear: 1997,
    eraEndYear: 2016,
    isActive: false,
    stats: {
      ppg: 19.0, rpg: 10.8, apg: 3.0, spg: 0.7, bpg: 2.2, tovPg: 2.5,
      fgPct: 0.506, threePtPct: 0.180, threePtRate: 0.02, ftPct: 0.696,
      astRate: 0.15, rebRate: 0.22, stlRate: 0.013, blkRate: 0.052,
    },
    usageRate: 0.24,
  },
  {
    name: 'Karl Malone',
    position: 'PF',
    eraStartYear: 1985,
    eraEndYear: 2004,
    isActive: false,
    stats: {
      ppg: 25.0, rpg: 10.1, apg: 3.6, spg: 1.4, bpg: 0.8, tovPg: 2.7,
      fgPct: 0.516, threePtPct: 0.274, threePtRate: 0.02, ftPct: 0.742,
      astRate: 0.13, rebRate: 0.19, stlRate: 0.018, blkRate: 0.019,
    },
    usageRate: 0.26,
  },
  {
    name: 'Dirk Nowitzki',
    position: 'PF',
    eraStartYear: 1998,
    eraEndYear: 2019,
    isActive: false,
    stats: {
      ppg: 20.7, rpg: 7.5, apg: 2.4, spg: 0.8, bpg: 0.8, tovPg: 2.1,
      fgPct: 0.471, threePtPct: 0.380, threePtRate: 0.30, ftPct: 0.879,
      astRate: 0.10, rebRate: 0.15, stlRate: 0.011, blkRate: 0.017,
    },
    usageRate: 0.25,
  },
  {
    name: 'Charles Barkley',
    position: 'PF',
    eraStartYear: 1984,
    eraEndYear: 2000,
    isActive: false,
    stats: {
      ppg: 22.1, rpg: 11.7, apg: 3.9, spg: 1.5, bpg: 0.8, tovPg: 2.9,
      fgPct: 0.541, threePtPct: 0.266, threePtRate: 0.08, ftPct: 0.735,
      astRate: 0.17, rebRate: 0.21, stlRate: 0.021, blkRate: 0.016,
    },
    usageRate: 0.27,
  },
  {
    name: 'Kevin Garnett',
    position: 'PF',
    eraStartYear: 1995,
    eraEndYear: 2016,
    isActive: false,
    stats: {
      ppg: 17.8, rpg: 10.0, apg: 3.7, spg: 1.3, bpg: 1.4, tovPg: 2.4,
      fgPct: 0.497, threePtPct: 0.275, threePtRate: 0.03, ftPct: 0.789,
      astRate: 0.16, rebRate: 0.19, stlRate: 0.018, blkRate: 0.036,
    },
    usageRate: 0.23,
  },
  {
    name: 'Giannis Antetokounmpo',
    position: 'PF',
    eraStartYear: 2013,
    eraEndYear: null,
    isActive: true,
    stats: {
      ppg: 24.1, rpg: 9.9, apg: 5.0, spg: 1.1, bpg: 1.2, tovPg: 3.2,
      fgPct: 0.552, threePtPct: 0.287, threePtRate: 0.08, ftPct: 0.715,
      astRate: 0.24, rebRate: 0.20, stlRate: 0.015, blkRate: 0.033,
    },
    usageRate: 0.32,
  },

  // ---- C ----
  {
    name: 'Shaquille O’Neal',
    position: 'C',
    eraStartYear: 1992,
    eraEndYear: 2011,
    isActive: false,
    stats: {
      ppg: 23.7, rpg: 10.9, apg: 2.5, spg: 0.6, bpg: 2.3, tovPg: 2.9,
      fgPct: 0.582, threePtPct: 0.045, threePtRate: 0.00, ftPct: 0.527,
      astRate: 0.12, rebRate: 0.24, stlRate: 0.009, blkRate: 0.058,
    },
    usageRate: 0.29,
  },
  {
    name: 'Hakeem Olajuwon',
    position: 'C',
    eraStartYear: 1984,
    eraEndYear: 2002,
    isActive: false,
    stats: {
      ppg: 21.8, rpg: 11.1, apg: 2.5, spg: 1.7, bpg: 3.1, tovPg: 3.1,
      fgPct: 0.512, threePtPct: 0.020, threePtRate: 0.00, ftPct: 0.712,
      astRate: 0.13, rebRate: 0.24, stlRate: 0.024, blkRate: 0.072,
    },
    usageRate: 0.26,
  },
  {
    name: 'Kareem Abdul-Jabbar',
    position: 'C',
    eraStartYear: 1969,
    eraEndYear: 1989,
    isActive: false,
    stats: {
      ppg: 24.6, rpg: 11.2, apg: 3.6, spg: 0.9, bpg: 2.6, tovPg: 3.0,
      fgPct: 0.559, threePtPct: 0.056, threePtRate: 0.00, ftPct: 0.721,
      astRate: 0.15, rebRate: 0.23, stlRate: 0.012, blkRate: 0.060,
    },
    usageRate: 0.27,
  },
  {
    name: 'Bill Russell',
    position: 'C',
    eraStartYear: 1956,
    eraEndYear: 1969,
    isActive: false,
    stats: {
      ppg: 15.1, rpg: 22.5, apg: 4.3, spg: 1.5, bpg: 2.5, tovPg: 3.0,
      fgPct: 0.440, threePtPct: 0.000, threePtRate: 0.00, ftPct: 0.561,
      astRate: 0.17, rebRate: 0.28, stlRate: 0.015, blkRate: 0.055,
    },
    usageRate: 0.20,
  },
  {
    name: 'David Robinson',
    position: 'C',
    eraStartYear: 1989,
    eraEndYear: 2003,
    isActive: false,
    stats: {
      ppg: 21.1, rpg: 10.6, apg: 2.5, spg: 1.4, bpg: 3.0, tovPg: 2.6,
      fgPct: 0.518, threePtPct: 0.196, threePtRate: 0.01, ftPct: 0.736,
      astRate: 0.13, rebRate: 0.22, stlRate: 0.022, blkRate: 0.065,
    },
    usageRate: 0.25,
  },
  {
    name: 'Nikola Jokić',
    position: 'C',
    eraStartYear: 2015,
    eraEndYear: null,
    isActive: true,
    stats: {
      ppg: 21.8, rpg: 10.9, apg: 7.2, spg: 1.3, bpg: 0.7, tovPg: 3.0,
      fgPct: 0.555, threePtPct: 0.345, threePtRate: 0.18, ftPct: 0.819,
      astRate: 0.35, rebRate: 0.24, stlRate: 0.024, blkRate: 0.017,
    },
    usageRate: 0.29,
  },

  // ---- 6MAN ---- (Sixth Man of the Year winners / iconic instant-offense bench players)
  {
    name: 'Manu Ginobili',
    position: '6MAN',
    eraStartYear: 2002,
    eraEndYear: 2018,
    isActive: false,
    stats: {
      ppg: 13.3, rpg: 3.5, apg: 3.8, spg: 1.3, bpg: 0.3, tovPg: 2.1,
      fgPct: 0.445, threePtPct: 0.369, threePtRate: 0.35, ftPct: 0.826,
      astRate: 0.25, rebRate: 0.09, stlRate: 0.022, blkRate: 0.009,
    },
    usageRate: 0.20,
  },
  {
    name: 'Lou Williams',
    position: '6MAN',
    eraStartYear: 2005,
    eraEndYear: 2023,
    isActive: false,
    stats: {
      ppg: 14.6, rpg: 2.2, apg: 3.2, spg: 0.8, bpg: 0.2, tovPg: 1.8,
      fgPct: 0.415, threePtPct: 0.355, threePtRate: 0.40, ftPct: 0.846,
      astRate: 0.22, rebRate: 0.05, stlRate: 0.015, blkRate: 0.004,
    },
    usageRate: 0.24,
  },
  {
    name: 'Jamal Crawford',
    position: '6MAN',
    eraStartYear: 2000,
    eraEndYear: 2020,
    isActive: false,
    stats: {
      ppg: 14.6, rpg: 2.2, apg: 3.4, spg: 0.8, bpg: 0.2, tovPg: 1.9,
      fgPct: 0.415, threePtPct: 0.349, threePtRate: 0.40, ftPct: 0.863,
      astRate: 0.22, rebRate: 0.05, stlRate: 0.014, blkRate: 0.005,
    },
    usageRate: 0.23,
  },
  {
    name: 'Kevin McHale',
    position: '6MAN',
    eraStartYear: 1980,
    eraEndYear: 1993,
    isActive: false,
    stats: {
      ppg: 17.9, rpg: 7.3, apg: 1.7, spg: 0.6, bpg: 1.7, tovPg: 1.9,
      fgPct: 0.554, threePtPct: 0.024, threePtRate: 0.00, ftPct: 0.799,
      astRate: 0.09, rebRate: 0.16, stlRate: 0.011, blkRate: 0.041,
    },
    usageRate: 0.21,
  },
  {
    name: 'Ricky Pierce',
    position: '6MAN',
    eraStartYear: 1982,
    eraEndYear: 1998,
    isActive: false,
    stats: {
      ppg: 15.0, rpg: 2.9, apg: 1.9, spg: 0.7, bpg: 0.2, tovPg: 1.6,
      fgPct: 0.484, threePtPct: 0.338, threePtRate: 0.20, ftPct: 0.876,
      astRate: 0.12, rebRate: 0.07, stlRate: 0.013, blkRate: 0.006,
    },
    usageRate: 0.20,
  },
  {
    name: 'Detlef Schrempf',
    position: '6MAN',
    eraStartYear: 1985,
    eraEndYear: 2001,
    isActive: false,
    stats: {
      ppg: 13.9, rpg: 6.3, apg: 4.4, spg: 1.0, bpg: 0.4, tovPg: 2.3,
      fgPct: 0.475, threePtPct: 0.345, threePtRate: 0.20, ftPct: 0.831,
      astRate: 0.20, rebRate: 0.14, stlRate: 0.017, blkRate: 0.011,
    },
    usageRate: 0.19,
  },
];
