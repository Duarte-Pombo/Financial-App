/**
 * database/emotions.ts  —  API client
 *
 * Direct SQLite queries for the emotions lookup table.
 */

import { apiFetch } from "../api";

export type Emotion = {
	id: number;
	name: string;
	emoji: string | null;
	color_hex: string | null;
};

export async function getEmotions(): Promise<Emotion[]> {
	return apiFetch<Emotion[]>("/api/emotions");
}
