import React, { useEffect, useState, useCallback } from "react";
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  Pressable,
  ActivityIndicator,
  RefreshControl,
} from "react-native";
import { useFocusEffect } from "expo-router";
import { getDb } from "../../database/db";

// ─── Types ────────────────────────────────────────────────────────────────────
type RawTransaction = {
  id: string;
  amount: number;
  merchant_name: string | null;
  transacted_at: string;
  category_id: number | null;
  category_name: string | null;
  category_icon: string | null;
  emotion_id: number | null;
  emotion_name: string | null;
  emotion_emoji: string | null;
  emotion_polarity: number | null; // -5 to 5
  emotion_energy: number | null;   // 1 to 10
  emotion_category: string | null; // 'positive' | 'negative' | 'neutral'
};

type Insight = {
  id: string;
  type: "risk" | "pattern" | "positive" | "tip";
  title: string;
  body: string;
  icon: string;
  accentColor: string;
  bgColor: string;
  score?: number;
  actions: string[];
};

type ScoredTransaction = RawTransaction & {
  impulseScore: number;
  scoreBreakdown: {
    emotion: number;
    time: number;
    category: number;
    amount: number;
    frequency: number;
  };
};

// ─── Constants ────────────────────────────────────────────────────────────────
const TEMP_USER_ID = "local-user";
const AVG_SPEND = 20; // baseline average transaction amount in EUR

// Category impulse weights (matched to spending_categories names)
const CATEGORY_WEIGHTS: Record<string, number> = {
  "Food & Drink": 1,
  Transport: 0,
  Shopping: 2,
  Entertainment: 2,
  Health: 0,
  Bills: 0,
  Education: 0,
  Other: 2,
};

// ─── Scoring helpers ──────────────────────────────────────────────────────────

/**
 * Maps emotion polarity + energy to an impulse risk weight (0–3).
 * Negative, high-energy emotions (anger, anxiety, stress) = highest risk.
 * Positive or neutral emotions = low risk.
 */
function emotionWeight(polarity: number | null, energy: number | null): number {
  if (polarity === null || energy === null) return 0;
  if (polarity > 0) return 0; // positive emotions → no extra risk
  const severity = Math.abs(polarity); // 0–5
  const energyFactor = energy / 10; // 0–1
  const raw = severity * energyFactor; // 0–5
  if (raw >= 3.5) return 3;
  if (raw >= 2) return 2;
  if (raw >= 1) return 1;
  return 0;
}

/** Late-night / impulsive hours carry higher risk */
function timeWeight(hour: number): number {
  if (hour >= 23 || hour < 5) return 3;
  if (hour >= 21) return 2;
  if (hour >= 20) return 1;
  return 0;
}

/** Amount relative to the user's typical spend */
function amountWeight(amount: number, avg: number): number {
  const ratio = amount / avg;
  if (ratio > 3) return 3;
  if (ratio > 2) return 2;
  if (ratio > 1.3) return 1;
  return 0;
}

/** Multiple purchases in a short window = stress/binge pattern */
function frequencyWeight(count: number): number {
  if (count >= 5) return 2;
  if (count >= 3) return 1;
  return 0;
}

/** Full impulse score for a single transaction (max ~14) */
function scoreTransaction(
  tx: RawTransaction,
  purchasesToday: number,
  avgSpend: number
): ScoredTransaction {
  const hour = new Date(tx.transacted_at).getHours();
  const catWeight = tx.category_name ? (CATEGORY_WEIGHTS[tx.category_name] ?? 1) : 1;

  const breakdown = {
    emotion: emotionWeight(tx.emotion_polarity, tx.emotion_energy),
    time: timeWeight(hour),
    category: catWeight,
    amount: amountWeight(tx.amount, avgSpend),
    frequency: frequencyWeight(purchasesToday),
  };

  const impulseScore =
    breakdown.emotion +
    breakdown.time +
    breakdown.category +
    breakdown.amount +
    breakdown.frequency;

  return { ...tx, impulseScore, scoreBreakdown: breakdown };
}

// ─── Insight generation ───────────────────────────────────────────────────────

function generateInsights(
  scored: ScoredTransaction[],
  avgSpend: number
): Insight[] {
  const insights: Insight[] = [];

  if (scored.length === 0) {
    insights.push({
      id: "no-data",
      type: "tip",
      title: "Nothing to analyse yet",
      body: "Add a few purchases to start seeing insights about your spending patterns.",
      icon: "📊",
      accentColor: "#6b21a8",
      bgColor: "#f3e8ff",
      actions: ["Log your first purchase"],
    });
    return insights;
  }

  // ── 1. Identify high-risk transactions ──────────────────────────────────────
  const highRisk = scored.filter((t) => t.impulseScore >= 7);
  const midRisk = scored.filter((t) => t.impulseScore >= 4 && t.impulseScore < 7);

  if (highRisk.length > 0) {
    const top = highRisk.sort((a, b) => b.impulseScore - a.impulseScore)[0];
    insights.push({
      id: "high-risk",
      type: "risk",
      title: "High-risk spending detected",
      body: `Your purchase${top.merchant_name ? ` at ${top.merchant_name}` : ""} scored ${top.impulseScore}/14 on our impulse scale. High-energy negative emotions, late hours, and above-average amounts are a triple warning sign.`,
      icon: "⚠️",
      accentColor: "#dc2626",
      bgColor: "#fef2f2",
      score: top.impulseScore,
      actions: [
        "Try a 20-minute spending cooldown before similar purchases",
        "Notice the emotion — write it in the note field next time",
        "Review your late-night purchases as a separate category",
      ],
    });
  } else if (midRisk.length > 0) {
    insights.push({
      id: "mid-risk",
      type: "pattern",
      title: "Mild impulse pattern spotted",
      body: `${midRisk.length} of your recent purchases show mild emotional spending signals. Not a red flag, but worth reflecting on.`,
      icon: "~",
      accentColor: "#b45309",
      bgColor: "#fefce8",
      actions: [
        "Ask yourself: would I make this same purchase tomorrow morning?",
        "Try logging your emotion before spending, not just after",
      ],
    });
  }

  // ── 2. Dominant emotional trigger analysis ───────────────────────────────────
  const negativeTxs = scored.filter(
    (t) => t.emotion_category === "negative" && t.emotion_name !== null
  );

  if (negativeTxs.length >= 2) {
    // Count which negative emotion appears most
    const emotionCounts: Record<string, { count: number; totalAmount: number; emoji: string }> = {};
    for (const tx of negativeTxs) {
      const name = tx.emotion_name!;
      if (!emotionCounts[name]) {
        emotionCounts[name] = { count: 0, totalAmount: 0, emoji: tx.emotion_emoji ?? "😶" };
      }
      emotionCounts[name].count++;
      emotionCounts[name].totalAmount += tx.amount;
    }

    const [topEmotion, topData] = Object.entries(emotionCounts).sort(
      (a, b) => b[1].count - a[1].count
    )[0];

    insights.push({
      id: "emotion-trigger",
      type: "pattern",
      title: `${topData.emoji} ${topEmotion} is your top spending trigger`,
      body: `You've made ${topData.count} purchase${topData.count > 1 ? "s" : ""} while feeling ${topEmotion.toLowerCase()}, totalling €${topData.totalAmount.toFixed(2)}. Emotional spending loops often start here.`,
      icon: topData.emoji,
      accentColor: "#7c3aed",
      bgColor: "#f5f3ff",
      actions: [
        `When you feel ${topEmotion.toLowerCase()}, try journaling for 5 minutes first`,
        "Notice: does this emotion always lead to spending in the same category?",
        "Set a personal rule for purchases made during this state",
      ],
    });
  }

  // ── 3. Late-night spending pattern ───────────────────────────────────────────
  const lateNight = scored.filter((t) => {
    const h = new Date(t.transacted_at).getHours();
    return h >= 21 || h < 5;
  });

  if (lateNight.length >= 2) {
    const lateTotal = lateNight.reduce((s, t) => s + t.amount, 0);
    insights.push({
      id: "late-night",
      type: "risk",
      title: "Late-night spending habit",
      body: `${lateNight.length} of your purchases happened after 9 PM, totalling €${lateTotal.toFixed(2)}. Willpower dips at night — and our data backs that up.`,
      icon: "🌙",
      accentColor: "#1d4ed8",
      bgColor: "#eff6ff",
      actions: [
        "Enable Do Not Disturb mode after 10 PM on shopping apps",
        "Add a screen lock on payment apps during late hours",
        "Log how you feel before any purchase after 9 PM",
      ],
    });
  }

  // ── 4. Category breakdown ─────────────────────────────────────────────────────
  const categoryTotals: Record<string, { total: number; count: number; icon: string }> = {};
  for (const tx of scored) {
    const cat = tx.category_name ?? "Other";
    const icon = tx.category_icon ?? "📦";
    if (!categoryTotals[cat]) categoryTotals[cat] = { total: 0, count: 0, icon };
    categoryTotals[cat].total += tx.amount;
    categoryTotals[cat].count++;
  }

  const topCategory = Object.entries(categoryTotals).sort(
    (a, b) => b[1].total - a[1].total
  )[0];

  if (topCategory) {
    const [catName, catData] = topCategory;
    const weight = CATEGORY_WEIGHTS[catName] ?? 1;
    if (weight >= 2) {
      insights.push({
        id: "top-category",
        type: "pattern",
        title: `${catData.icon} ${catName} is your biggest spend`,
        body: `You've spent €${catData.total.toFixed(2)} across ${catData.count} purchases in ${catName}. This category tends to carry higher impulse risk.`,
        icon: catData.icon,
        accentColor: "#0369a1",
        bgColor: "#f0f9ff",
        actions: [
          `Set a weekly cap for ${catName} spending`,
          "Review if each purchase in this category was planned",
          "Try a 1-week challenge: log the urge before you spend here",
        ],
      });
    }
  }

  // ── 5. Average spend deviation ────────────────────────────────────────────────
  const totalSpend = scored.reduce((s, t) => s + t.amount, 0);
  const computedAvg = totalSpend / scored.length;
  const bigPurchases = scored.filter((t) => t.amount > computedAvg * 2);

  if (bigPurchases.length > 0) {
    insights.push({
      id: "big-purchases",
      type: "tip",
      title: "Above-average purchases flagged",
      body: `${bigPurchases.length} transaction${bigPurchases.length > 1 ? "s were" : " was"} more than 2× your average (€${computedAvg.toFixed(2)}). These carry the highest financial risk when made impulsively.`,
      icon: "💸",
      accentColor: "#b45309",
      bgColor: "#fff7ed",
      actions: [
        "For purchases > €" + (computedAvg * 2).toFixed(0) + ", sleep on it before buying",
        "Keep a 'big purchase wishlist' — revisit it after 72 hours",
      ],
    });
  }

  // ── 6. Positive reinforcement ──────────────────────────────────────────────────
  const healthyTxs = scored.filter(
    (t) => t.impulseScore <= 2 && t.emotion_category !== "negative"
  );

  if (healthyTxs.length >= 3) {
    insights.push({
      id: "positive",
      type: "positive",
      title: "You're spending mindfully 🎉",
      body: `${healthyTxs.length} of your recent purchases showed low impulse risk and balanced emotional states. That's intentional spending in action.`,
      icon: "✅",
      accentColor: "#059669",
      bgColor: "#ecfdf5",
      actions: [
        "Notice what makes these purchases feel different — write it down",
        "This is what your spending looks like at its best",
      ],
    });
  }

  return insights;
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function Insights() {
  const [insights, setInsights] = useState<Insight[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [stats, setStats] = useState<{
    totalSpend: number;
    txCount: number;
    avgScore: number;
    topEmotion: string | null;
    topEmoji: string | null;
  } | null>(null);
  const [expanded, setExpanded] = useState<string | null>(null);

  const loadInsights = useCallback(async () => {
    try {
      const db = await getDb();

      // Fetch last 30 days of transactions joined with emotion + category data
      const rows = await db.getAllAsync<RawTransaction>(
        `SELECT
           t.id,
           t.amount,
           t.merchant_name,
           t.transacted_at,
           t.category_id,
           sc.name       AS category_name,
           sc.icon       AS category_icon,
           el.emotion_id,
           e.name        AS emotion_name,
           e.emoji       AS emotion_emoji,
           e.polarity    AS emotion_polarity,
           e.energy      AS emotion_energy,
           e.category    AS emotion_category
         FROM transactions t
         LEFT JOIN emotion_logs el        ON el.id  = t.emotion_log_id
         LEFT JOIN emotions e             ON e.id   = el.emotion_id
         LEFT JOIN spending_categories sc ON sc.id  = t.category_id
         WHERE t.user_id = ?
           AND t.transacted_at >= datetime('now', '-30 days')
         ORDER BY t.transacted_at DESC`,
        [TEMP_USER_ID]
      );

      if (rows.length === 0) {
        setInsights(generateInsights([], AVG_SPEND));
        setStats(null);
        return;
      }

      // Count purchases per day to measure frequency pressure
      const dayCountMap: Record<string, number> = {};
      for (const row of rows) {
        const day = row.transacted_at.slice(0, 10);
        dayCountMap[day] = (dayCountMap[day] ?? 0) + 1;
      }

      const totalSpend = rows.reduce((s, r) => s + r.amount, 0);
      const avgSpend = totalSpend / rows.length;

      // Score all transactions
      const scored: ScoredTransaction[] = rows.map((tx) => {
        const day = tx.transacted_at.slice(0, 10);
        return scoreTransaction(tx, dayCountMap[day] ?? 1, avgSpend);
      });

      const avgScore =
        scored.reduce((s, t) => s + t.impulseScore, 0) / scored.length;

      // Top emotion
      const emotionCounts: Record<string, { count: number; emoji: string | null }> = {};
      for (const tx of scored) {
        if (tx.emotion_name) {
          if (!emotionCounts[tx.emotion_name]) {
            emotionCounts[tx.emotion_name] = { count: 0, emoji: tx.emotion_emoji };
          }
          emotionCounts[tx.emotion_name].count++;
        }
      }
      const topEmotionEntry = Object.entries(emotionCounts).sort(
        (a, b) => b[1].count - a[1].count
      )[0];

      setStats({
        totalSpend,
        txCount: rows.length,
        avgScore,
        topEmotion: topEmotionEntry?.[0] ?? null,
        topEmoji: topEmotionEntry?.[1].emoji ?? null,
      });

      setInsights(generateInsights(scored, avgSpend));
    } catch (err) {
      console.error("[insights]", err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      setLoading(true);
      loadInsights();
    }, [loadInsights])
  );

  const onRefresh = () => {
    setRefreshing(true);
    loadInsights();
  };

  // ── Score zone label ──────────────────────────────────────────────────────
  function scoreZoneLabel(avg: number): { label: string; color: string } {
    if (avg < 3) return { label: "Healthy pattern", color: "#059669" };
    if (avg < 6) return { label: "Mild impulse risk", color: "#b45309" };
    if (avg < 9) return { label: "Emotional spending", color: "#dc2626" };
    return { label: "High-risk pattern", color: "#7f1d1d" };
  }

  return (
    <View style={styles.container}>
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#7c3aed" />
        }
      >
        {/* ── Header ── */}
        <View style={styles.header}>
          <Text style={styles.headerTitle}>Insights</Text>
          <Text style={styles.headerSub}>Last 30 days</Text>
        </View>

        {loading ? (
          <ActivityIndicator style={{ marginTop: 60 }} color="#7c3aed" size="large" />
        ) : (
          <>
            {/* ── Stats strip ── */}
            {stats && (
              <View style={styles.statsStrip}>
                <View style={styles.statCard}>
                  <Text style={styles.statValue}>€{stats.totalSpend.toFixed(0)}</Text>
                  <Text style={styles.statLabel}>Total spent</Text>
                </View>
                <View style={styles.statCard}>
                  <Text style={styles.statValue}>{stats.txCount}</Text>
                  <Text style={styles.statLabel}>Purchases</Text>
                </View>
                <View style={styles.statCard}>
                  <Text
                    style={[
                      styles.statValue,
                      { color: scoreZoneLabel(stats.avgScore).color },
                    ]}
                  >
                    {stats.avgScore.toFixed(1)}
                  </Text>
                  <Text style={styles.statLabel}>Avg risk score</Text>
                </View>
                {stats.topEmotion && (
                  <View style={styles.statCard}>
                    <Text style={styles.statValue}>{stats.topEmoji ?? "—"}</Text>
                    <Text style={styles.statLabel}>{stats.topEmotion}</Text>
                  </View>
                )}
              </View>
            )}

            {/* ── Score zone pill ── */}
            {stats && (
              <View
                style={[
                  styles.zonePill,
                  { backgroundColor: scoreZoneLabel(stats.avgScore).color + "20" },
                ]}
              >
                <View
                  style={[
                    styles.zoneDot,
                    { backgroundColor: scoreZoneLabel(stats.avgScore).color },
                  ]}
                />
                <Text
                  style={[
                    styles.zoneLabel,
                    { color: scoreZoneLabel(stats.avgScore).color },
                  ]}
                >
                  {scoreZoneLabel(stats.avgScore).label}
                </Text>
              </View>
            )}

            {/* ── Insight cards ── */}
            <Text style={styles.sectionTitle}>What we found</Text>
            {insights.map((insight) => {
              const isOpen = expanded === insight.id;
              return (
                <Pressable
                  key={insight.id}
                  style={[
                    styles.card,
                    { backgroundColor: insight.bgColor, borderLeftColor: insight.accentColor },
                  ]}
                  onPress={() => setExpanded(isOpen ? null : insight.id)}
                >
                  <View style={styles.cardHeader}>
                    <View
                      style={[
                        styles.iconBadge,
                        { backgroundColor: insight.accentColor + "20" },
                      ]}
                    >
                      <Text style={styles.iconText}>{insight.icon}</Text>
                    </View>
                    <View style={styles.cardTitleBlock}>
                      <Text style={styles.cardTitle}>{insight.title}</Text>
                      {insight.score !== undefined && (
                        <Text style={[styles.scoreBadge, { color: insight.accentColor }]}>
                          Score {insight.score}/14
                        </Text>
                      )}
                    </View>
                    <Text style={[styles.chevron, { color: insight.accentColor }]}>
                      {isOpen ? "▲" : "▼"}
                    </Text>
                  </View>

                  {isOpen && (
                    <View style={styles.cardBody}>
                      <Text style={styles.cardBodyText}>{insight.body}</Text>
                      <View style={styles.actionsBlock}>
                        {insight.actions.map((action, i) => (
                          <View
                            key={i}
                            style={[
                              styles.actionRow,
                              { borderLeftColor: insight.accentColor },
                            ]}
                          >
                            <Text style={styles.actionText}>{action}</Text>
                          </View>
                        ))}
                      </View>
                    </View>
                  )}
                </Pressable>
              );
            })}

            {/* ── Footer note ── */}
            <Text style={styles.footer}>
              Scores reflect your patterns — not judgements. Awared is here to help you
              understand the feeling, not shame the purchase.
            </Text>
          </>
        )}
      </ScrollView>
    </View>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#fdf3ff",
  },
  scrollContent: {
    paddingHorizontal: 20,
    paddingTop: 60,
    paddingBottom: 120,
    maxWidth: 480,
    alignSelf: "center",
    width: "100%",
  },

  // Header
  header: {
    marginBottom: 20,
  },
  headerTitle: {
    fontSize: 28,
    fontWeight: "700",
    color: "#1a1a1a",
    letterSpacing: -0.5,
  },
  headerSub: {
    fontSize: 13,
    color: "#888",
    marginTop: 2,
  },

  // Stats
  statsStrip: {
    flexDirection: "row",
    gap: 8,
    marginBottom: 12,
    flexWrap: "wrap",
  },
  statCard: {
    flex: 1,
    minWidth: 70,
    backgroundColor: "#fff",
    borderRadius: 14,
    padding: 12,
    alignItems: "center",
    shadowColor: "#c4a8e0",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.12,
    shadowRadius: 6,
    elevation: 2,
  },
  statValue: {
    fontSize: 20,
    fontWeight: "700",
    color: "#1a1a1a",
  },
  statLabel: {
    fontSize: 10,
    color: "#999",
    marginTop: 2,
    textAlign: "center",
  },

  // Zone pill
  zonePill: {
    flexDirection: "row",
    alignItems: "center",
    alignSelf: "flex-start",
    borderRadius: 20,
    paddingVertical: 5,
    paddingHorizontal: 12,
    marginBottom: 24,
    gap: 6,
  },
  zoneDot: {
    width: 7,
    height: 7,
    borderRadius: 4,
  },
  zoneLabel: {
    fontSize: 12,
    fontWeight: "600",
  },

  // Section title
  sectionTitle: {
    fontSize: 14,
    fontWeight: "600",
    color: "#555",
    textTransform: "uppercase",
    letterSpacing: 0.6,
    marginBottom: 12,
  },

  // Card
  card: {
    borderRadius: 16,
    borderLeftWidth: 3,
    padding: 14,
    marginBottom: 12,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 1,
  },
  cardHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  iconBadge: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
  },
  iconText: {
    fontSize: 16,
  },
  cardTitleBlock: {
    flex: 1,
  },
  cardTitle: {
    fontSize: 14,
    fontWeight: "600",
    color: "#1a1a1a",
    lineHeight: 19,
  },
  scoreBadge: {
    fontSize: 11,
    fontWeight: "500",
    marginTop: 2,
  },
  chevron: {
    fontSize: 10,
    paddingLeft: 4,
  },

  // Card body (expanded)
  cardBody: {
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: 0.5,
    borderTopColor: "#00000015",
  },
  cardBodyText: {
    fontSize: 13,
    color: "#444",
    lineHeight: 20,
    marginBottom: 12,
  },
  actionsBlock: {
    gap: 6,
  },
  actionRow: {
    borderLeftWidth: 2,
    paddingLeft: 10,
    paddingVertical: 5,
    backgroundColor: "#00000008",
    borderRadius: 4,
  },
  actionText: {
    fontSize: 12,
    color: "#555",
    lineHeight: 17,
  },

  // Footer
  footer: {
    fontSize: 11,
    color: "#aaa",
    textAlign: "center",
    lineHeight: 16,
    marginTop: 16,
    paddingHorizontal: 10,
  },
});
