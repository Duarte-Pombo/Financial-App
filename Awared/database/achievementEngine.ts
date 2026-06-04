import { getDb } from "@/database/db";

// ─────────────────────────────────────────────────────────────
//  TYPES
// ─────────────────────────────────────────────────────────────

export type AchievementId =
  | "first_step"
  | "streak_7"
  | "cool_head"
  | "budget_hero"
  | "night_owl"
  | "journaler"
  | "century"
  | "mindful_month"
  | "no_impulse_week"
  | "early_bird"
  | "variety_pack"
  | "big_saver";

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

// ─────────────────────────────────────────────────────────────
//  STATIC DEFINITIONS  (no DB needed)
// ─────────────────────────────────────────────────────────────

export const ACHIEVEMENT_DEFS: AchievementDef[] = [
  {
    id: "first_step",
    emoji: "🏁",
    title: "First Step",
    description: "Log your very first purchase",
    type: "auto",
  },
  {
    id: "streak_7",
    emoji: "🔥",
    title: "7-Day Streak",
    description: "Log at least one purchase every day for 7 days in a row",
    type: "auto",
  },
  {
    id: "cool_head",
    emoji: "🧘",
    title: "Cool Head",
    description: "Make 10 purchases while feeling a positive emotion",
    type: "auto",
  },
  {
    id: "budget_hero",
    emoji: "💰",
    title: "Budget Hero",
    description: "Stay under your monthly budget for a full month",
    type: "auto",
  },
  {
    id: "night_owl",
    emoji: "🌙",
    title: "Night Owl",
    description: "Log 10 purchases after 9 PM",
    type: "auto",
  },
  {
    id: "journaler",
    emoji: "📓",
    title: "Journaler",
    description: "Write 5 journal entries",
    type: "auto",
  },
  {
    id: "century",
    emoji: "🎯",
    title: "Century",
    description: "Log 100 total purchases",
    type: "auto",
  },
  {
    id: "mindful_month",
    emoji: "✨",
    title: "Mindful Month",
    description: "Have fewer than 3 impulse buys in a single calendar month",
    type: "auto",
  },
  {
    id: "early_bird",
    emoji: "🌅",
    title: "Early Bird",
    description: "Log 5 purchases before 9 AM",
    type: "auto",
  },
  {
    id: "no_impulse_week",
    emoji: "🛡️",
    title: "Impulse-Free Week",
    description: "Go 7 days without a single impulse buy",
    type: "goal",
  },
  {
    id: "variety_pack",
    emoji: "🎨",
    title: "Variety Pack",
    description: "Log purchases across 5 different spending categories",
    type: "auto",
  },
  {
    id: "big_saver",
    emoji: "🏦",
    title: "Big Saver",
    description: "Stay under budget for 3 consecutive months",
    type: "goal",
  },
];

// ─────────────────────────────────────────────────────────────
//  HELPERS
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

// ─────────────────────────────────────────────────────────────
//  CHECKERS
// ─────────────────────────────────────────────────────────────

async function checkFirstStep(userId: number): Promise<boolean> {
  const db = await getDb();
  const row = await db.getFirstAsync<{ count: number }>(
    "SELECT COUNT(*) as count FROM transactions WHERE user_id = ?",
    [userId]
  );
  return (row?.count ?? 0) >= 1;
}

async function checkStreak7(userId: number): Promise<boolean> {
  const db = await getDb();
  const rows = await db.getAllAsync<{ day: string }>(
    `SELECT DISTINCT date(transacted_at) as day
     FROM transactions
     WHERE user_id = ?
     ORDER BY day DESC`,
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

async function checkCoolHead(userId: number): Promise<{ met: boolean; count: number }> {
  const db = await getDb();
  const row = await db.getFirstAsync<{ count: number }>(
    `SELECT COUNT(*) as count
     FROM transactions t
     JOIN emotion_logs el ON t.emotion_log_id = el.id
     JOIN emotions e ON el.emotion_id = e.id
     WHERE t.user_id = ? AND e.category = 'positive'`,
    [userId]
  );
  const count = row?.count ?? 0;
  return { met: count >= 10, count };
}

async function checkBudgetHero(userId: number): Promise<boolean> {
  const db = await getDb();
  const row = await db.getFirstAsync<{ count: number }>(
    `SELECT COUNT(*) as count
     FROM budgets b
     WHERE b.user_id = ?
       AND b.period = 'monthly'
       AND b.is_active = 1
       AND (
         SELECT COALESCE(SUM(t.amount), 0)
         FROM transactions t
         WHERE t.user_id = b.user_id
           AND t.transacted_at >= b.period_start
           AND t.transacted_at <= b.period_end
           AND t.type != 'refunded'
       ) < b.amount_limit`,
    [userId]
  );
  return (row?.count ?? 0) >= 1;
}

async function checkNightOwl(userId: number): Promise<{ met: boolean; count: number }> {
  const db = await getDb();
  const row = await db.getFirstAsync<{ count: number }>(
    `SELECT COUNT(*) as count
     FROM transactions
     WHERE user_id = ?
       AND CAST(strftime('%H', transacted_at) AS INTEGER) >= 21`,
    [userId]
  );
  const count = row?.count ?? 0;
  return { met: count >= 10, count };
}

async function checkJournaler(userId: number): Promise<{ met: boolean; count: number }> {
  const db = await getDb();
  const row = await db.getFirstAsync<{ count: number }>(
    "SELECT COUNT(*) as count FROM journal_entries WHERE user_id = ?",
    [userId]
  );
  const count = row?.count ?? 0;
  return { met: count >= 5, count };
}

async function checkCentury(userId: number): Promise<{ met: boolean; count: number }> {
  const db = await getDb();
  const row = await db.getFirstAsync<{ count: number }>(
    "SELECT COUNT(*) as count FROM transactions WHERE user_id = ?",
    [userId]
  );
  const count = row?.count ?? 0;
  return { met: count >= 100, count };
}

async function checkMindfulMonth(userId: number): Promise<boolean> {
  const db = await getDb();
  const row = await db.getFirstAsync<{ count: number }>(
    `SELECT COUNT(*) as count
     FROM (
       SELECT strftime('%Y-%m', transacted_at) as month
       FROM transactions
       WHERE user_id = ?
       GROUP BY month
       HAVING SUM(CASE WHEN is_impulse = 1 THEN 1 ELSE 0 END) < 3
     )`,
    [userId]
  );
  return (row?.count ?? 0) >= 1;
}

async function checkEarlyBird(userId: number): Promise<{ met: boolean; count: number }> {
  const db = await getDb();
  const row = await db.getFirstAsync<{ count: number }>(
    `SELECT COUNT(*) as count
     FROM transactions
     WHERE user_id = ?
       AND CAST(strftime('%H', transacted_at) AS INTEGER) < 9`,
    [userId]
  );
  const count = row?.count ?? 0;
  return { met: count >= 5, count };
}

async function checkVarietyPack(userId: number): Promise<{ met: boolean; count: number }> {
  const db = await getDb();
  const row = await db.getFirstAsync<{ count: number }>(
    `SELECT COUNT(DISTINCT category_id) as count
     FROM transactions
     WHERE user_id = ? AND category_id IS NOT NULL`,
    [userId]
  );
  const count = row?.count ?? 0;
  return { met: count >= 5, count };
}

async function checkNoImpulseWeek(userId: number): Promise<boolean> {
  const db = await getDb();

  // 1. Verify that the user's account has existed for at least 7 days
  const accountCheck = await db.getFirstAsync<{ is_eligible: number }>(
    `SELECT COUNT(*) as is_eligible 
     FROM users 
     WHERE id = ? 
       AND created_at <= strftime('%Y-%m-%dT%H:%M:%SZ', datetime('now', '-7 days'))`,
    [userId]
  );

  if (!accountCheck || accountCheck.is_eligible === 0) {
    return false; // Account is too new to claim an impulse-free week
  }

  // 2. Check if they have zero impulse purchases in the last 7 days
  const row = await db.getFirstAsync<{ count: number }>(
    `SELECT COUNT(*) as count
     FROM transactions
     WHERE user_id = ?
       AND is_impulse = 1
       AND transacted_at >= strftime('%Y-%m-%dT%H:%M:%SZ', datetime('now', '-7 days'))`,
    [userId]
  );
  
  return (row?.count ?? 0) === 0;
}

async function checkBigSaver(userId: number): Promise<boolean> {
  const db = await getDb();
  const row = await db.getFirstAsync<{ count: number }>(
    `SELECT COUNT(*) as count
     FROM (
       SELECT b.id
       FROM budgets b
       WHERE b.user_id = ?
         AND b.period = 'monthly'
         AND (
           SELECT COALESCE(SUM(t.amount), 0)
           FROM transactions t
           WHERE t.user_id = b.user_id
             AND t.transacted_at >= b.period_start
             AND t.transacted_at <= b.period_end
             AND t.type != 'refunded'
         ) < b.amount_limit
     )`,
    [userId]
  );
  return (row?.count ?? 0) >= 3;
}

// ─────────────────────────────────────────────────────────────
//  MAIN ENGINE
// ─────────────────────────────────────────────────────────────

export async function runAchievementEngine(userId: number): Promise<AchievementId[]> {
  const newlyUnlocked: AchievementId[] = [];

  const tryUnlock = async (id: AchievementId, conditionMet: boolean) => {
    if (conditionMet) {
      const isNew = await unlock(userId, id);
      if (isNew) newlyUnlocked.push(id);
    }
  };

  await tryUnlock("first_step",       await checkFirstStep(userId));
  await tryUnlock("streak_7",        await checkStreak7(userId));
  await tryUnlock("cool_head",       (await checkCoolHead(userId)).met);
  await tryUnlock("budget_hero",     await checkBudgetHero(userId));
  await tryUnlock("night_owl",       (await checkNightOwl(userId)).met);
  await tryUnlock("journaler",       (await checkJournaler(userId)).met);
  await tryUnlock("century",         (await checkCentury(userId)).met);
  await tryUnlock("mindful_month",   await checkMindfulMonth(userId));
  await tryUnlock("early_bird",      (await checkEarlyBird(userId)).met);
  await tryUnlock("variety_pack",    (await checkVarietyPack(userId)).met);
  await tryUnlock("no_impulse_week", await checkNoImpulseWeek(userId));
  await tryUnlock("big_saver",       await checkBigSaver(userId));

  return newlyUnlocked;
}

// ─────────────────────────────────────────────────────────────
//  LOAD
// ─────────────────────────────────────────────────────────────

export async function loadAchievements(userId: number): Promise<AchievementWithStatus[]> {
  const db = await getDb();

  const unlocked = await db.getAllAsync<{ achievement_id: string; unlocked_at: string }>(
    "SELECT achievement_id, unlocked_at FROM user_achievements WHERE user_id = ?",
    [userId]
  );
  const unlockedMap = new Map(unlocked.map((r) => [r.achievement_id, r.unlocked_at]));

  const [coolHead, nightOwl, journaler, century, earlyBird, varietyPack] = await Promise.all([
    checkCoolHead(userId),
    checkNightOwl(userId),
    checkJournaler(userId),
    checkCentury(userId),
    checkEarlyBird(userId),
    checkVarietyPack(userId),
  ]);

  const progressMap: Record<string, { current: number; target: number }> = {
    cool_head:    { current: coolHead.count,    target: 10  },
    night_owl:    { current: nightOwl.count,    target: 10  },
    journaler:    { current: journaler.count,   target: 5   },
    century:      { current: century.count,     target: 100 },
    early_bird:   { current: earlyBird.count,   target: 5   },
    variety_pack: { current: varietyPack.count, target: 5   },
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
        progress: Math.min(Math.round((prog.current / prog.target) * 100), 100),
      }),
    };
  });
}