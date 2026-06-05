
/**
 * routes/achievements.ts
 *
 * Achievement engine — runs server-side against the remote DB.
 * Ported from frontend/database/achievementEngine.ts
 *
 * GET  /api/achievements?user_id=...       → load all achievements with status + progress
 * POST /api/achievements/check?user_id=... → run engine, return newly unlocked
 */

import { Router } from "express";
import { getDb } from "../db";

const router = Router();

// ─── Types ────────────────────────────────────────────────────────────────────

type AchievementId =
	| "first_step"
	| "streak_7"
	| "cool_head"
	| "budget_hero"
	| "night_owl"
	| "journaler"
	| "century"
	| "mindful_month"
	| "early_bird"
	| "no_impulse_week"
	| "variety_pack"
	| "big_saver";

type AchievementDef = {
	id: AchievementId;
	emoji: string;
	title: string;
	description: string;
	type: "auto" | "goal";
};

export type AchievementWithStatus = AchievementDef & {
	unlocked: boolean;
	unlockedAt: string | null;
	progress?: number;
	target?: number;
	current?: number;
};

// ─── Static definitions ───────────────────────────────────────────────────────

const ACHIEVEMENT_DEFS: AchievementDef[] = [
	{ id: "first_step", emoji: "🏁", title: "First Step", description: "Log your very first purchase", type: "auto" },
	{ id: "streak_7", emoji: "🔥", title: "7-Day Streak", description: "Log at least one purchase every day for 7 days in a row", type: "auto" },
	{ id: "cool_head", emoji: "🧘", title: "Cool Head", description: "Make 10 purchases while feeling a positive emotion", type: "auto" },
	{ id: "budget_hero", emoji: "💰", title: "Budget Hero", description: "Stay under your monthly budget for a full month", type: "auto" },
	{ id: "night_owl", emoji: "🌙", title: "Night Owl", description: "Log 10 purchases after 9 PM", type: "auto" },
	{ id: "journaler", emoji: "📓", title: "Journaler", description: "Write 5 journal entries", type: "auto" },
	{ id: "century", emoji: "🎯", title: "Century", description: "Log 100 total purchases", type: "auto" },
	{ id: "mindful_month", emoji: "✨", title: "Mindful Month", description: "Have fewer than 3 impulse buys in a single calendar month", type: "auto" },
	{ id: "early_bird", emoji: "🌅", title: "Early Bird", description: "Log 5 purchases before 9 AM", type: "auto" },
	{ id: "no_impulse_week", emoji: "🛡️", title: "Impulse-Free Week", description: "Go 7 days without a single impulse buy", type: "goal" },
	{ id: "variety_pack", emoji: "🎨", title: "Variety Pack", description: "Log purchases across 5 different spending categories", type: "auto" },
	{ id: "big_saver", emoji: "🏦", title: "Big Saver", description: "Stay under budget for 3 consecutive months", type: "goal" },
];

// ─── Helpers ──────────────────────────────────────────────────────────────────

function isUnlocked(userId: string, achievementId: AchievementId): boolean {
	const db = getDb();
	const row = db
		.prepare("SELECT id FROM user_achievements WHERE user_id = ? AND achievement_id = ?")
		.get(userId, achievementId);
	return !!row;
}

function unlock(userId: string, achievementId: AchievementId): boolean {
	if (isUnlocked(userId, achievementId)) return false;
	const db = getDb();
	db.prepare(
		"INSERT OR IGNORE INTO user_achievements (user_id, achievement_id) VALUES (?, ?)"
	).run(userId, achievementId);
	return true;
}

// ─── Checkers ─────────────────────────────────────────────────────────────────

function checkFirstStep(userId: string): boolean {
	const db = getDb();
	const row = db
		.prepare<{ count: number }>("SELECT COUNT(*) as count FROM transactions WHERE user_id = ?")
		.get(userId);
	return (row?.count ?? 0) >= 1;
}

function checkStreak7(userId: string): boolean {
	const db = getDb();
	const rows = db
		.prepare<{ day: string }>(
			`SELECT DISTINCT date(transacted_at) as day
       FROM transactions
       WHERE user_id = ?
       ORDER BY day DESC`
		)
		.all(userId);
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

function checkCoolHead(userId: string): { met: boolean; count: number } {
	const db = getDb();
	const row = db
		.prepare<{ count: number }>(
			`SELECT COUNT(*) as count
       FROM transactions t
       JOIN emotion_logs el ON t.emotion_log_id = el.id
       JOIN emotions e ON el.emotion_id = e.id
       WHERE t.user_id = ? AND e.category = 'positive'`
		)
		.get(userId);
	const count = row?.count ?? 0;
	return { met: count >= 10, count };
}

function checkBudgetHero(userId: string): boolean {
	const db = getDb();
	const row = db
		.prepare<{ count: number }>(
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
         ) < b.amount_limit`
		)
		.get(userId);
	return (row?.count ?? 0) >= 1;
}

function checkNightOwl(userId: string): { met: boolean; count: number } {
	const db = getDb();
	const row = db
		.prepare<{ count: number }>(
			`SELECT COUNT(*) as count
       FROM transactions
       WHERE user_id = ?
         AND CAST(strftime('%H', transacted_at) AS INTEGER) >= 21`
		)
		.get(userId);
	const count = row?.count ?? 0;
	return { met: count >= 10, count };
}

function checkJournaler(userId: string): { met: boolean; count: number } {
	const db = getDb();
	const row = db
		.prepare<{ count: number }>("SELECT COUNT(*) as count FROM journal_entries WHERE user_id = ?")
		.get(userId);
	const count = row?.count ?? 0;
	return { met: count >= 5, count };
}

function checkCentury(userId: string): { met: boolean; count: number } {
	const db = getDb();
	const row = db
		.prepare<{ count: number }>("SELECT COUNT(*) as count FROM transactions WHERE user_id = ?")
		.get(userId);
	const count = row?.count ?? 0;
	return { met: count >= 100, count };
}

function checkMindfulMonth(userId: string): boolean {
	const db = getDb();
	const row = db
		.prepare<{ count: number }>(
			`SELECT COUNT(*) as count
       FROM (
         SELECT strftime('%Y-%m', transacted_at) as month
         FROM transactions
         WHERE user_id = ?
         GROUP BY month
         HAVING SUM(CASE WHEN is_impulse = 1 THEN 1 ELSE 0 END) < 3
       )`
		)
		.get(userId);
	return (row?.count ?? 0) >= 1;
}

function checkEarlyBird(userId: string): { met: boolean; count: number } {
	const db = getDb();
	const row = db
		.prepare<{ count: number }>(
			`SELECT COUNT(*) as count
       FROM transactions
       WHERE user_id = ?
         AND CAST(strftime('%H', transacted_at) AS INTEGER) < 9`
		)
		.get(userId);
	const count = row?.count ?? 0;
	return { met: count >= 5, count };
}

function checkVarietyPack(userId: string): { met: boolean; count: number } {
	const db = getDb();
	const row = db
		.prepare<{ count: number }>(
			`SELECT COUNT(DISTINCT category_id) as count
       FROM transactions
       WHERE user_id = ? AND category_id IS NOT NULL`
		)
		.get(userId);
	const count = row?.count ?? 0;
	return { met: count >= 5, count };
}

function checkNoImpulseWeek(userId: string): boolean {
	const db = getDb();

	const accountCheck = db
		.prepare<{ is_eligible: number }>(
			`SELECT COUNT(*) as is_eligible
       FROM users
       WHERE id = ?
         AND created_at <= strftime('%Y-%m-%dT%H:%M:%SZ', datetime('now', '-7 days'))`
		)
		.get(userId);

	if (!accountCheck || accountCheck.is_eligible === 0) return false;

	const row = db
		.prepare<{ count: number }>(
			`SELECT COUNT(*) as count
       FROM transactions
       WHERE user_id = ?
         AND is_impulse = 1
         AND transacted_at >= strftime('%Y-%m-%dT%H:%M:%SZ', datetime('now', '-7 days'))`
		)
		.get(userId);

	return (row?.count ?? 0) === 0;
}

function checkBigSaver(userId: string): boolean {
	const db = getDb();
	const row = db
		.prepare<{ count: number }>(
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
       )`
		)
		.get(userId);
	return (row?.count ?? 0) >= 3;
}

// ─── Engine ───────────────────────────────────────────────────────────────────

function runEngine(userId: string): AchievementId[] {
	const newlyUnlocked: AchievementId[] = [];

	const tryUnlock = (id: AchievementId, conditionMet: boolean) => {
		if (conditionMet) {
			const isNew = unlock(userId, id);
			if (isNew) newlyUnlocked.push(id);
		}
	};

	tryUnlock("first_step", checkFirstStep(userId));
	tryUnlock("streak_7", checkStreak7(userId));
	tryUnlock("cool_head", checkCoolHead(userId).met);
	tryUnlock("budget_hero", checkBudgetHero(userId));
	tryUnlock("night_owl", checkNightOwl(userId).met);
	tryUnlock("journaler", checkJournaler(userId).met);
	tryUnlock("century", checkCentury(userId).met);
	tryUnlock("mindful_month", checkMindfulMonth(userId));
	tryUnlock("early_bird", checkEarlyBird(userId).met);
	tryUnlock("variety_pack", checkVarietyPack(userId).met);
	tryUnlock("no_impulse_week", checkNoImpulseWeek(userId));
	tryUnlock("big_saver", checkBigSaver(userId));

	return newlyUnlocked;
}

function loadAchievements(userId: string): AchievementWithStatus[] {
	const db = getDb();

	const unlocked = db
		.prepare<{ achievement_id: string; unlocked_at: string }>(
			"SELECT achievement_id, unlocked_at FROM user_achievements WHERE user_id = ?"
		)
		.all(userId);
	const unlockedMap = new Map(unlocked.map((r) => [r.achievement_id, r.unlocked_at]));

	const [coolHead, nightOwl, journaler, century, earlyBird, varietyPack] = [
		checkCoolHead(userId),
		checkNightOwl(userId),
		checkJournaler(userId),
		checkCentury(userId),
		checkEarlyBird(userId),
		checkVarietyPack(userId),
	];

	const progressMap: Record<string, { current: number; target: number }> = {
		cool_head: { current: coolHead.count, target: 10 },
		night_owl: { current: nightOwl.count, target: 10 },
		journaler: { current: journaler.count, target: 5 },
		century: { current: century.count, target: 100 },
		early_bird: { current: earlyBird.count, target: 5 },
		variety_pack: { current: varietyPack.count, target: 5 },
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

// ─── Routes ───────────────────────────────────────────────────────────────────

router.get("/", (req, res) => {
	const { user_id } = req.query;
	if (!user_id) {
		res.status(400).json({ error: "user_id query param is required" });
		return;
	}

	try {
		// Optionally run engine first (uncomment if you want auto-check on load)
		// runEngine(user_id as string);

		const achievements = loadAchievements(user_id as string);
		res.json(achievements);
	} catch (err) {
		console.error("[achievements] GET error:", err);
		res.status(500).json({ error: "Failed to load achievements" });
	}
});

router.post("/check", (req, res) => {
	const { user_id } = req.query;
	if (!user_id) {
		res.status(400).json({ error: "user_id query param is required" });
		return;
	}

	try {
		const newlyUnlocked = runEngine(user_id as string);
		const achievements = loadAchievements(user_id as string);
		res.json({ newlyUnlocked, achievements });
	} catch (err) {
		console.error("[achievements] check error:", err);
		res.status(500).json({ error: "Failed to run achievement engine" });
	}
});

export default router;
export { ACHIEVEMENT_DEFS };
export type { AchievementWithStatus };
