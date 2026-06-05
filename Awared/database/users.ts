/**
 * database/users.ts  —  API client
 *
 * Direct SQLite queries for user profile lookups and updates.
 */

import { apiFetch } from "../api";

export type UserProfile = {
	id: string;
	email: string;
	username: string;
	timezone: string;
	currency_code: string;
	avatar_url: string | null;
	created_at: string | null;
};

export type UserStats = {
	username: string;
	avatar_url: string | null;
	created_at: string | null;
	totalPurchases: number;
	topEmotionName: string | null;
	topEmotionEmoji: string | null;
	topEmotionColor: string | null;
};

export async function getUserProfile(user_id: string): Promise<UserProfile | null> {
	try {
		return await apiFetch<UserProfile>(`/api/users/${encodeURIComponent(user_id)}`);
	} catch (err: any) {
		if (err.message?.includes("404")) return null;
		throw err;
	}
}

export async function getUserStats(user_id: string): Promise<UserStats | null> {
	try {
		return await apiFetch<UserStats>(`/api/users/${encodeURIComponent(user_id)}/stats`);
	} catch (err: any) {
		if (err.message?.includes("404")) return null;
		throw err;
	}
}

export async function updateUserProfile(
	user_id: string,
	patch: Partial<Pick<UserProfile, "email" | "username" | "currency_code" | "avatar_url">>
): Promise<void> {
	await apiFetch(`/api/users/${encodeURIComponent(user_id)}`, {
		method: "PATCH",
		body: JSON.stringify(patch),
	});
}

export async function updateUserAvatar(user_id: string, avatar_url: string): Promise<void> {
	await updateUserProfile(user_id, { avatar_url });
}

export async function changeUserPassword(
	user_id: string,
	current_password: string,
	new_password: string
): Promise<void> {
	await apiFetch(`/api/users/${encodeURIComponent(user_id)}/password`, {
		method: "PATCH",
		body: JSON.stringify({ current_password, new_password }),
	});
}

export async function deleteUserAccount(user_id: string): Promise<void> {
	await apiFetch(`/api/users/${encodeURIComponent(user_id)}`, {
		method: "DELETE",
	});
}
