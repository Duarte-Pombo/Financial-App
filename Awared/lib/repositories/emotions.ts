import { getDb } from "../database";

export type Emotion = {
  id: number;
  name: string;
  category: "positive" | "negative" | "neutral";
  polarity: number;
  energy: number;
  emoji: string | null;
  color_hex: string | null;
  description: string | null;
};

export async function getEmotions(): Promise<Emotion[]> {
  const db = await getDb();
  return db.getAllAsync<Emotion>(
    "SELECT id, name, category, polarity, energy, emoji, color_hex, description FROM emotions ORDER BY name ASC;"
  );
}