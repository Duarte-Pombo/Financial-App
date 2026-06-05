/**
 * database/achievements.ts  —  API client
 *
 * Replaces the local achievement engine. All checking runs server-side.
 */

import { apiFetch } from "../api";

export type AchievementId =
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
	progress?: number;
	target?: number;
	current?: number;
};

/** Load achievements with current status + progress. */
export async function loadAchievements(user_id: string): Promise<AchievementWithStatus[]> {
	return apiFetch<AchievementWithStatus[]>(
		`/api/achievements?user_id=${encodeURIComponent(user_id)}`
	);
}

/**
 * Run the achievement engine (checks conditions + unlocks new ones),
 * then return the refreshed list.
 */
export async function runAchievementEngine(
	user_id: string
): Promise<{ newlyUnlocked: AchievementId[]; achievements: AchievementWithStatus[] }> {
	return apiFetch(`/api/achievements/check?user_id=${encodeURIComponent(user_id)}`, {
		method: "POST",
	});
}
