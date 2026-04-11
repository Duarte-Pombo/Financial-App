import { getDb } from "./db";

export async function seedDatabase(): Promise<void> {
  const db = await getDb();

  // Check if already seeded — if emotions table has rows, skip
  const existing = await db.getFirstAsync<{ count: number }>(
    "SELECT COUNT(*) as count FROM emotions;"
  );
  if (existing && existing.count > 0) return;

  await db.withTransactionAsync(async () => {
    // ── Emotions ──────────────────────────────────────────────────────────────
    const emotions = [
      { name: "Sadness", category: "negative", polarity: -3, energy: 2, emoji: "😢", color_hex: "#c8daf5", description: "Feeling of sorrow or unhappiness" },
      { name: "Stress", category: "negative", polarity: -4, energy: 7, emoji: "😤", color_hex: "#d8b4fe", description: "Feeling overwhelmed or under pressure" },
      { name: "Happy", category: "positive", polarity: 4, energy: 7, emoji: "😊", color_hex: "#f5e642", description: "Feeling of joy or contentment" },
      { name: "Anxiety", category: "negative", polarity: -4, energy: 8, emoji: "😰", color_hex: "#fca5a5", description: "Feeling of worry or unease" },
      { name: "Boredom", category: "neutral", polarity: -1, energy: 2, emoji: "😑", color_hex: "#d1d5db", description: "Feeling of disengagement" },
      { name: "Excited", category: "positive", polarity: 5, energy: 9, emoji: "🤩", color_hex: "#6ee7b7", description: "Feeling of enthusiasm or eagerness" },
      { name: "Calm", category: "positive", polarity: 2, energy: 3, emoji: "😌", color_hex: "#e9d5ff", description: "Feeling of peace and relaxation" },
      { name: "Anger", category: "negative", polarity: -5, energy: 9, emoji: "😠", color_hex: "#fca5a5", description: "Feeling of frustration or rage" },
    ];

    for (const e of emotions) {
      await db.runAsync(
        `INSERT OR IGNORE INTO emotions (name, category, polarity, energy, emoji, color_hex, description)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [e.name, e.category, e.polarity, e.energy, e.emoji, e.color_hex, e.description]
      );
    }

    // ── Spending categories ───────────────────────────────────────────────────
    const categories = [
      { name: "Food & Drink", icon: "🍔", color_hex: "#fde68a" },
      { name: "Transport", icon: "🚌", color_hex: "#bfdbfe" },
      { name: "Shopping", icon: "🛍️", color_hex: "#f3d0ff" },
      { name: "Entertainment", icon: "🎬", color_hex: "#a7f3d0" },
      { name: "Health", icon: "💊", color_hex: "#fca5a5" },
      { name: "Bills", icon: "🧾", color_hex: "#d1d5db" },
      { name: "Education", icon: "📚", color_hex: "#c8daf5" },
      { name: "Other", icon: "📦", color_hex: "#e5e7eb" },
    ];

    for (const c of categories) {
      await db.runAsync(
        `INSERT OR IGNORE INTO spending_categories (name, icon, color_hex, is_system)
         VALUES (?, ?, ?, 1)`,
        [c.name, c.icon, c.color_hex]
      );
    }
  });

  console.log("[db] seeded emotions and categories");
}
