import { getDb } from "@/database/db";

// ─────────────────────────────────────────────────────────────
//  TYPES
// ─────────────────────────────────────────────────────────────

export type AchievementId =
  | "first_step"
  | "streak_7"
  | "cool_head"
  | "night_owl"
  | "century"
  | "mindful_month"
  | "no_impulse_week"
  | "early_bird"
  | "variety_pack"

export type AchievementDef = {
  id: AchievementId;
  emoji: string;
  title: string;
  description: string;
  type: "auto" | "goal";
};

export type AchievementWithStatus = AchievementDef & {
  unlocked: boolean;
  unlockedAt: string | null;
  progress?: number;   // 0–100 percent
  target?: number;
  current?: number;
};

export type EngineStats = {
  totalTransactions: number;
  nightOwlCount: number;
  earlyBirdCount: number;
  coolHeadCount: number;
  varietyPackCount: number;
  mindfulMonthCount: number;
};

// ─────────────────────────────────────────────────────────────
//  STATIC DEFINITIONS
// ─────────────────────────────────────────────────────────────

export const ACHIEVEMENT_DEFS: AchievementDef[] = [
  { id: "first_step", emoji: "🏁", title: "First Step", description: "Log your very first purchase", type: "auto" },
  { id: "streak_7", emoji: "🔥", title: "7-Day Streak", description: "Log at least one purchase every day for 7 days in a row", type: "auto" },
  { id: "cool_head", emoji: "🧘", title: "Cool Head", description: "Make 10 purchases while feeling a positive emotion", type: "auto" },
  { id: "night_owl", emoji: "🌙", title: "Night Owl", description: "Log 10 purchases after 9 PM", type: "auto" },
  { id: "century", emoji: "🎯", title: "Century", description: "Log 100 total purchases", type: "auto" },
  { id: "mindful_month", emoji: "✨", title: "Mindful Month", description: "Have fewer than 3 impulse buys in a single calendar month", type: "auto" },
  { id: "early_bird", emoji: "🌅", title: "Early Bird", description: "Log 5 purchases before 9 AM", type: "auto" },
  { id: "no_impulse_week", emoji: "🛡️", title: "Impulse-Free Week", description: "Go 7 days without a single impulse buy", type: "goal" },
  { id: "variety_pack", emoji: "🎨", title: "Variety Pack", description: "Log purchases across 5 different spending categories", type: "auto" },
];

// ─────────────────────────────────────────────────────────────
//  HELPERS & CORE STATS FETCHING
// ─────────────────────────────────────────────────────────────

async function isUnlocked(userId: number, achievementId: AchievementId): Promise<boolean> {
  const db = await getDb();
  const row = await db.getFirstAsync(
    "SELECT id FROM user_achievements WHERE user_id = ? AND achievement_id = ?",
    [userId, achievementId]
  );
  return !!row;
}

async function unlock(userId: number, achievementId: AchievementId): Promise<boolean> {
  if (await isUnlocked(userId, achievementId)) return false;
  const db = await getDb();
  await db.runAsync(
    "INSERT OR IGNORE INTO user_achievements (user_id, achievement_id) VALUES (?, ?)",
    [userId, achievementId]
  );
  return true;
}

export async function fetchEngineStats(userId: number): Promise<EngineStats> {
  const db = await getDb();

  const baseTxPromise = db.getFirstAsync<{ total: number; night_owl: number; early_bird: number }>(
    `SELECT 
      COUNT(*) as total,
      SUM(CASE WHEN CAST(strftime('%H', transacted_at) AS INTEGER) >= 21 THEN 1 ELSE 0 END) as night_owl,
      SUM(CASE WHEN CAST(strftime('%H', transacted_at) AS INTEGER) < 9 THEN 1 ELSE 0 END) as early_bird
     FROM transactions WHERE user_id = ?`,
    [userId]
  );

  const coolHeadPromise = db.getFirstAsync<{ count: number }>(
    `SELECT COUNT(*) as count FROM transactions t
     JOIN emotion_logs el ON t.emotion_log_id = el.id
     JOIN emotions e ON el.emotion_id = e.id
     WHERE t.user_id = ? AND e.category = 'positive'`,
    [userId]
  );

  const varietyPackPromise = db.getFirstAsync<{ count: number }>(
    "SELECT COUNT(DISTINCT category_id) as count FROM transactions WHERE user_id = ? AND category_id IS NOT NULL",
    [userId]
  );

  const mindfulMonthPromise = db.getFirstAsync<{ count: number }>(
    `SELECT COUNT(*) as count
     FROM (
       SELECT strftime('%Y-%m', transacted_at) as month
       FROM transactions
       WHERE user_id = ?
         AND strftime('%Y-%m', transacted_at) < strftime('%Y-%m', 'now')
       GROUP BY month
       HAVING SUM(CASE WHEN is_impulse = 1 THEN 1 ELSE 0 END) < 3
     )`,
    [userId]
  );

  const [baseTx, coolHead, varietyPack, mindfulMonth] = await Promise.all([
    baseTxPromise,
    coolHeadPromise,
    varietyPackPromise,
    mindfulMonthPromise,
  ]);

  return {
    totalTransactions: baseTx?.total ?? 0,
    nightOwlCount: baseTx?.night_owl ?? 0,
    earlyBirdCount: baseTx?.early_bird ?? 0,
    coolHeadCount: coolHead?.count ?? 0,
    varietyPackCount: varietyPack?.count ?? 0,
    mindfulMonthCount: mindfulMonth?.count ?? 0,
  };
}

// ─────────────────────────────────────────────────────────────
//  COMPLEX LINEAR CHECKERS
// ─────────────────────────────────────────────────────────────

async function checkStreak7(userId: number): Promise<boolean> {
  const db = await getDb();
  const rows = await db.getAllAsync<{ day: string }>(
    `SELECT DISTINCT date(transacted_at) as day FROM transactions WHERE user_id = ? ORDER BY day DESC`,
    [userId]
  );
  if (rows.length < 7) return false;

  let streak = 1;
  for (let i = 1; i < rows.length; i++) {
    const prev = new Date(rows[i - 1].day);
    const curr = new Date(rows[i].day);
    const diff = (prev.getTime() - curr.getTime()) / (1000 * 60 * 60 * 24);
    if (diff === 1) {
      streak++;
      if (streak >= 7) return true;
    } else {
      streak = 1;
    }
  }
  return false;
}

/**
 * FIX: Evaluates historical timeline records to see if the user has completed 
 * any continuous 7-day period with activity but zero impulse purchases.
 */
async function checkNoImpulseWeek(userId: number): Promise<boolean> {
  const db = await getDb();

  // Pull all active transaction days along with their impulse counts ordered chronologically
  const rows = await db.getAllAsync<{ day: string; impulse_count: number }>(
    `SELECT 
      date(transacted_at) as day,
      SUM(CASE WHEN is_impulse = 1 THEN 1 ELSE 0 END) as impulse_count
     FROM transactions
     WHERE user_id = ?
     GROUP BY day
     ORDER BY day ASC`,
    [userId]
  );

  if (rows.length < 7) return false;

  // Use a linear window scan over the active calendar array
  for (let i = 0; i <= rows.length - 7; i++) {
    let cleanDaysSequence = 0;
    
    for (let j = 0; j < 7; j++) {
      const currentIdx = i + j;
      
      // If any day in this block contains an impulse purchase, break out immediately
      if (rows[currentIdx].impulse_count > 0) {
        break;
      }

      // Check chronological spacing continuity for inner elements
      if (j > 0) {
        const prevDate = new Date(rows[currentIdx - 1].day);
        const currDate = new Date(rows[currentIdx].day);
        const dayDiff = (currDate.getTime() - prevDate.getTime()) / (1000 * 60 * 60 * 24);
        
        if (dayDiff !== 1) {
          break; // Days are not contiguous
        }
      }

      cleanDaysSequence++;
    }

    if (cleanDaysSequence === 7) return true;
  }

  return false;
}

// ─────────────────────────────────────────────────────────────
//  MAIN ENGINE
// ─────────────────────────────────────────────────────────────

export async function runAchievementEngine(userId: number, precalculatedStats?: EngineStats): Promise<AchievementId[]> {
  const stats = precalculatedStats || await fetchEngineStats(userId);
  const newlyUnlocked: AchievementId[] = [];

  const tryUnlock = async (id: AchievementId, conditionMet: boolean) => {
    if (conditionMet) {
      const isNew = await unlock(userId, id);
      if (isNew) newlyUnlocked.push(id);
    }
  };

  const isStreak7Met = await checkStreak7(userId);
  const isNoImpulseWeekMet = await checkNoImpulseWeek(userId);

  await tryUnlock("first_step",       stats.totalTransactions >= 1);
  await tryUnlock("streak_7",        isStreak7Met);
  await tryUnlock("cool_head",       stats.coolHeadCount >= 10);
  await tryUnlock("night_owl",       stats.nightOwlCount >= 10);
  await tryUnlock("century",         stats.totalTransactions >= 100);
  await tryUnlock("mindful_month",   stats.mindfulMonthCount >= 1);
  await tryUnlock("early_bird",      stats.earlyBirdCount >= 5);
  await tryUnlock("variety_pack",    stats.varietyPackCount >= 5);
  await tryUnlock("no_impulse_week", isNoImpulseWeekMet);

  return newlyUnlocked;
}

// ─────────────────────────────────────────────────────────────
//  LOAD
// ─────────────────────────────────────────────────────────────

export async function loadAchievements(userId: number): Promise<AchievementWithStatus[]> {
  const db = await getDb();

  const stats = await fetchEngineStats(userId);
  await runAchievementEngine(userId, stats);

  const unlocked = await db.getAllAsync<{ achievement_id: string; unlocked_at: string }>(
    "SELECT achievement_id, unlocked_at FROM user_achievements WHERE user_id = ?",
    [userId]
  );
  const unlockedMap = new Map(unlocked.map((r) => [r.achievement_id, r.unlocked_at]));

  const progressMap: Record<string, { current: number; target: number }> = {
    cool_head:    { current: stats.coolHeadCount,    target: 10  },
    night_owl:    { current: stats.nightOwlCount,    target: 10  },
    century:      { current: stats.totalTransactions,target: 100 },
    early_bird:   { current: stats.earlyBirdCount,   target: 5   },
    variety_pack: { current: stats.varietyPackCount, target: 5   },
  };

  return ACHIEVEMENT_DEFS.map((def) => {
    const unlockedAt = unlockedMap.get(def.id) ?? null;
    const prog = progressMap[def.id];
    return {
      ...def,
      unlocked: !!unlockedAt,
      unlockedAt,
      ...(prog && {
        current: prog.current,
        target: prog.target,
        progress: prog.current,
      }),
    };
  });
}