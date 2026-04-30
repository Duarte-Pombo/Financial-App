import React, { useState, useCallback } from "react";
import {
  View,
  ScrollView,
  StyleSheet,
  Pressable,
  ActivityIndicator,
  RefreshControl,
  Modal,
  Dimensions,
} from "react-native";
import { Text } from "@/components/Text";
import { MaterialIcons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { useFocusEffect } from "expo-router";
import { getDb } from "../../database/db";
import { TopAppBar, TOP_APP_BAR_HEIGHT } from "@/components/TopAppBar";
import { colors, fonts, radii, spacing, glassCard, elevation } from "@/constants/theme";

const { height: SCREEN_HEIGHT } = Dimensions.get("window");

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
  emotion_polarity: number | null;
  emotion_energy: number | null;
  emotion_category: string | null;
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
let TEMP_USER_ID: string;
const AVG_SPEND = 20;
const DOW_NAMES = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
const HOUR_LABELS = (h: number) => {
  if (h >= 23 || h < 5) return "late night";
  if (h >= 21) return "evening";
  if (h >= 17) return "after-work hours";
  if (h >= 12) return "afternoon";
  return "morning";
};

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

// ─── Free-tier scoring helpers ────────────────────────────────────────────────

function emotionWeight(polarity: number | null, energy: number | null): number {
  if (polarity === null || energy === null) return 0;
  if (polarity > 0) return 0;
  const severity = Math.abs(polarity);
  const energyFactor = energy / 10;
  const raw = severity * energyFactor;
  if (raw >= 3.5) return 3;
  if (raw >= 2) return 2;
  if (raw >= 1) return 1;
  return 0;
}

function timeWeight(hour: number): number {
  if (hour >= 23 || hour < 5) return 3;
  if (hour >= 21) return 2;
  if (hour >= 20) return 1;
  return 0;
}

function amountWeight(amount: number, avg: number): number {
  const ratio = amount / avg;
  if (ratio > 3) return 3;
  if (ratio > 2) return 2;
  if (ratio > 1.3) return 1;
  return 0;
}

function frequencyWeight(count: number): number {
  if (count >= 5) return 2;
  if (count >= 3) return 1;
  return 0;
}

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
    breakdown.emotion + breakdown.time + breakdown.category + breakdown.amount + breakdown.frequency;
  return { ...tx, impulseScore, scoreBreakdown: breakdown };
}

// ─── Premium vector engine ────────────────────────────────────────────────────

function toFeatureVector(tx: RawTransaction, avgAmount: number): number[] {
  const polarity = tx.emotion_polarity ?? 0;
  const energy = tx.emotion_energy ?? 5;
  const date = new Date(tx.transacted_at);
  const hour = date.getHours();
  const dow = date.getDay();
  const catRisk = tx.category_name ? (CATEGORY_WEIGHTS[tx.category_name] ?? 1) : 1;
  return [
    (polarity + 5) / 10,
    (energy - 1) / 9,
    hour / 23,
    dow / 6,
    Math.min(tx.amount / Math.max(avgAmount * 4, 1), 1),
    catRisk / 3,
  ];
}

function cosineSimilarity(a: number[], b: number[]): number {
  let dot = 0,
    magA = 0,
    magB = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    magA += a[i] * a[i];
    magB += b[i] * b[i];
  }
  const denom = Math.sqrt(magA) * Math.sqrt(magB);
  return denom === 0 ? 0 : dot / denom;
}

function computeCentroid(vectors: number[][]): number[] {
  if (vectors.length === 0) return [];
  const dim = vectors[0].length;
  const centroid = new Array(dim).fill(0);
  for (const v of vectors) {
    for (let i = 0; i < dim; i++) centroid[i] += v[i];
  }
  return centroid.map((x) => x / vectors.length);
}

function pearsonCorrelation(xs: number[], ys: number[]): number {
  const n = xs.length;
  if (n < 2) return 0;
  const mx = xs.reduce((a, b) => a + b, 0) / n;
  const my = ys.reduce((a, b) => a + b, 0) / n;
  let num = 0,
    dx2 = 0,
    dy2 = 0;
  for (let i = 0; i < n; i++) {
    const dx = xs[i] - mx,
      dy = ys[i] - my;
    num += dx * dy;
    dx2 += dx * dx;
    dy2 += dy * dy;
  }
  const denom = Math.sqrt(dx2 * dy2);
  return denom === 0 ? 0 : num / denom;
}

// ─── Free insight generation ──────────────────────────────────────────────────

function generateInsights(scored: ScoredTransaction[], avgSpend: number): Insight[] {
  const insights: Insight[] = [];

  if (scored.length === 0) {
    insights.push({
      id: "no-data",
      type: "tip",
      title: "Nothing to analyse yet",
      body: "Add a few purchases to start seeing insights about your spending patterns.",
      icon: "📊",
      accentColor: colors.primary,
      bgColor: colors.surfaceContainer,
      actions: ["Log your first purchase"],
    });
    return insights;
  }

  const totalSpend = scored.reduce((s, t) => s + t.amount, 0);
  const computedAvg = totalSpend / scored.length;
  const topMerchants = (() => {
    const counts: Record<string, number> = {};
    scored.forEach((t) => {
      if (t.merchant_name) counts[t.merchant_name] = (counts[t.merchant_name] ?? 0) + 1;
    });
    return Object.entries(counts).sort((a, b) => b[1] - a[1]);
  })();
  const frequentMerchant = topMerchants[0]?.[0] ?? null;

  const highRisk = scored.filter((t) => t.impulseScore >= 7);
  const midRisk = scored.filter((t) => t.impulseScore >= 4 && t.impulseScore < 7);

  if (highRisk.length > 0) {
    const top = [...highRisk].sort((a, b) => b.impulseScore - a.impulseScore)[0];
    const hour = new Date(top.transacted_at).getHours();
    const dow = DOW_NAMES[new Date(top.transacted_at).getDay()];
    const when = `${dow} ${HOUR_LABELS(hour)}`;
    insights.push({
      id: "high-risk",
      type: "risk",
      title: "High-risk spending detected",
      body: `Your ${top.merchant_name ? `purchase at ${top.merchant_name}` : "recent purchase"} on ${when} scored ${top.impulseScore}/14 on the impulse scale. High-energy negative emotions, late hours, and above-average amounts are a triple warning sign.`,
      icon: "⚠️",
      accentColor: colors.error,
      bgColor: colors.errorContainer,
      score: top.impulseScore,
      actions: [
        "Try a 20-minute spending cooldown before similar purchases",
        "Notice the emotion — write it in the note field next time",
        `Review your ${HOUR_LABELS(hour)} purchases as a separate category`,
      ],
    });
  } else if (midRisk.length > 0) {
    insights.push({
      id: "mid-risk",
      type: "pattern",
      title: "Mild impulse pattern spotted",
      body: `${midRisk.length} of your recent purchases show mild emotional spending signals. Not a red flag, but worth reflecting on.`,
      icon: "〰️",
      accentColor: colors.secondary,
      bgColor: colors.secondaryFixed,
      actions: [
        "Ask yourself: would I make this same purchase tomorrow morning?",
        "Try logging your emotion before spending, not just after",
      ],
    });
  }

  const negativeTxs = scored.filter((t) => t.emotion_category === "negative" && t.emotion_name);
  if (negativeTxs.length >= 2) {
    const emotionCounts: Record<string, { count: number; totalAmount: number; emoji: string }> = {};
    for (const tx of negativeTxs) {
      const name = tx.emotion_name!;
      if (!emotionCounts[name])
        emotionCounts[name] = { count: 0, totalAmount: 0, emoji: tx.emotion_emoji ?? "😶" };
      emotionCounts[name].count++;
      emotionCounts[name].totalAmount += tx.amount;
    }
    const [topEmotion, topData] = Object.entries(emotionCounts).sort(
      (a, b) => b[1].count - a[1].count
    )[0];

    const merchantSentence = frequentMerchant
      ? ` Purchases at ${frequentMerchant} are among the most common outlets.`
      : "";

    insights.push({
      id: "emotion-trigger",
      type: "pattern",
      title: `${topData.emoji} ${topEmotion} is your top spending trigger`,
      body: `You've made ${topData.count} purchase${topData.count > 1 ? "s" : ""} while feeling ${topEmotion.toLowerCase()}, totalling €${topData.totalAmount.toFixed(2)}.${merchantSentence} Emotional spending loops often start here.`,
      icon: topData.emoji,
      accentColor: colors.primary,
      bgColor: colors.primaryFixed,
      actions: [
        `When you feel ${topEmotion.toLowerCase()}, try journaling for 5 minutes first`,
        "Notice: does this emotion always lead to spending in the same category?",
        "Set a personal rule for purchases made during this state",
      ],
    });
  }

  const lateNight = scored.filter((t) => {
    const h = new Date(t.transacted_at).getHours();
    return h >= 21 || h < 5;
  });
  if (lateNight.length >= 2) {
    const lateTotal = lateNight.reduce((s, t) => s + t.amount, 0);
    const peakHour = (() => {
      const counts: Record<number, number> = {};
      lateNight.forEach((t) => {
        const h = new Date(t.transacted_at).getHours();
        counts[h] = (counts[h] ?? 0) + 1;
      });
      return parseInt(Object.entries(counts).sort((a, b) => b[1] - a[1])[0][0]);
    })();
    insights.push({
      id: "late-night",
      type: "risk",
      title: "Late-night spending habit",
      body: `${lateNight.length} of your purchases happened after 9 PM, totalling €${lateTotal.toFixed(2)}. Your peak hour is ${peakHour}:00 — when willpower research says inhibition is at its lowest.`,
      icon: "🌙",
      accentColor: colors.tertiary,
      bgColor: colors.tertiaryFixed,
      actions: [
        "Enable Do Not Disturb mode after 10 PM on shopping apps",
        `Add a screen lock on payment apps between ${peakHour}:00 and ${(peakHour + 2) % 24}:00`,
        "Log how you feel before any purchase after 9 PM",
      ],
    });
  }

  const categoryTotals: Record<string, { total: number; count: number; icon: string }> = {};
  for (const tx of scored) {
    const cat = tx.category_name ?? "Other";
    const icon = tx.category_icon ?? "📦";
    if (!categoryTotals[cat]) categoryTotals[cat] = { total: 0, count: 0, icon };
    categoryTotals[cat].total += tx.amount;
    categoryTotals[cat].count++;
  }
  const topCategory = Object.entries(categoryTotals).sort((a, b) => b[1].total - a[1].total)[0];
  if (topCategory) {
    const [catName, catData] = topCategory;
    if ((CATEGORY_WEIGHTS[catName] ?? 1) >= 2) {
      const perPurchase = (catData.total / catData.count).toFixed(2);
      insights.push({
        id: "top-category",
        type: "pattern",
        title: `${catData.icon} ${catName} is your biggest spend`,
        body: `You've spent €${catData.total.toFixed(2)} across ${catData.count} purchase${catData.count > 1 ? "s" : ""} in ${catName} (avg €${perPurchase} each). This category carries elevated impulse risk.`,
        icon: catData.icon,
        accentColor: colors.primaryContainer,
        bgColor: colors.surfaceContainer,
        actions: [
          `Set a weekly cap of €${(catData.total * 0.75).toFixed(0)} for ${catName}`,
          "Review if each purchase here was planned or spontaneous",
          "Try a 1-week challenge: log the urge before you spend here",
        ],
      });
    }
  }

  const bigPurchases = scored.filter((t) => t.amount > computedAvg * 2);
  if (bigPurchases.length > 0) {
    const bigTotal = bigPurchases.reduce((s, t) => s + t.amount, 0);
    insights.push({
      id: "big-purchases",
      type: "tip",
      title: "Above-average purchases flagged",
      body: `${bigPurchases.length} transaction${bigPurchases.length > 1 ? "s were" : " was"} more than 2× your average (€${computedAvg.toFixed(2)}), totalling €${bigTotal.toFixed(2)}. These carry the highest financial risk when made impulsively.`,
      icon: "💸",
      accentColor: colors.secondary,
      bgColor: colors.secondaryFixed,
      actions: [
        `For purchases over €${(computedAvg * 2).toFixed(0)}, sleep on it before buying`,
        "Keep a 'big purchase wishlist' — revisit it after 72 hours",
      ],
    });
  }

  const healthyTxs = scored.filter(
    (t) => t.impulseScore <= 2 && t.emotion_category !== "negative"
  );
  if (healthyTxs.length >= 3) {
    insights.push({
      id: "positive",
      type: "positive",
      title: "You're spending mindfully 🎉",
      body: `${healthyTxs.length} of your recent purchases showed low impulse risk and balanced emotional states — ${((healthyTxs.length / scored.length) * 100).toFixed(0)}% of your total. That's intentional spending in action.`,
      icon: "✅",
      accentColor: "#0d9488",
      bgColor: "#ccfbf1",
      actions: [
        "Notice what makes these purchases feel different — write it down",
        "This is what your spending looks like at its best",
      ],
    });
  }

  return insights;
}

// ─── Premium insight generation ───────────────────────────────────────────────

function generatePremiumInsights(scored: ScoredTransaction[], avgSpend: number): Insight[] {
  const insights: Insight[] = [];

  if (scored.length < 3) {
    insights.push({
      id: "premium-insufficient",
      type: "tip",
      title: "Need more data for vector analysis",
      body: "Log at least 3 purchases to unlock premium vector insights.",
      icon: "📡",
      accentColor: colors.primary,
      bgColor: colors.primaryFixed,
      actions: [],
    });
    return insights;
  }

  const vectors = scored.map((tx) => toFeatureVector(tx, avgSpend));

  const txWithEmotion = scored.filter(
    (t) => t.emotion_polarity !== null && t.emotion_energy !== null
  );
  if (txWithEmotion.length >= 3) {
    const polarities = txWithEmotion.map((t) => t.emotion_polarity!);
    const amounts = txWithEmotion.map((t) => t.amount);
    const r = pearsonCorrelation(polarities, amounts);
    const absR = Math.abs(r);
    const strength = absR > 0.6 ? "strong" : absR > 0.35 ? "moderate" : "weak";

    if (absR > 0.15) {
      const direction =
        r < 0
          ? "negative emotions predict higher spending"
          : "positive moods correlate with larger purchases";
      const interpretation =
        r < -0.35
          ? "Your spending climbs when your mood drops — a classic emotional compensation loop."
          : r > 0.35
            ? "You tend to reward yourself more generously when feeling good. Watch for celebratory overspending."
            : "There's a detectable link between your mood and spending, though it's not yet dominant.";

      insights.push({
        id: "premium-correlation",
        type: r < -0.35 ? "risk" : "pattern",
        title: `Emotion–spend correlation: r = ${r.toFixed(2)}`,
        body: `Pearson analysis across ${txWithEmotion.length} tagged transactions found a ${strength} link — ${direction} (r = ${r.toFixed(2)}, scale −1 to +1). ${interpretation}`,
        icon: "📈",
        accentColor: r < -0.3 ? colors.error : colors.primary,
        bgColor: r < -0.3 ? colors.errorContainer : colors.primaryFixed,
        actions: [
          r < -0.3
            ? `When you're feeling low, set a €${(avgSpend * 0.6).toFixed(0)} soft cap for the next 2 hours`
            : "Track spending before and after emotional highs to detect reward loops",
          "Log your emotion *before* opening your wallet",
          "Compare your mood score to your daily spend total at week's end",
        ],
      });
    }
  }

  const highRiskTxs = scored.filter((t) => t.impulseScore >= 6);
  if (highRiskTxs.length >= 2) {
    const hrVectors = highRiskTxs.map((tx) => toFeatureVector(tx, avgSpend));
    const centroid = computeCentroid(hrVectors);
    const centroidPolarity = centroid[0] * 10 - 5;
    const centroidEnergy = centroid[1] * 9 + 1;
    const centroidHour = Math.round(centroid[2] * 23);
    const centroidDow = Math.round(centroid[3] * 6);
    const centroidAmount = centroid[4] * avgSpend * 4;

    let simSum = 0,
      simCount = 0;
    for (let i = 0; i < hrVectors.length; i++) {
      for (let j = i + 1; j < hrVectors.length; j++) {
        simSum += cosineSimilarity(hrVectors[i], hrVectors[j]);
        simCount++;
      }
    }
    const coherence = simCount > 0 ? ((simSum / simCount) * 100).toFixed(0) : "N/A";
    const emotionDesc =
      centroidPolarity < -2 ? "strongly negative" : centroidPolarity < 0 ? "mildly negative" : "neutral";
    const energyDesc = centroidEnergy > 6 ? "high-energy" : "low-energy";

    insights.push({
      id: "premium-cluster",
      type: "risk",
      title: "Your high-risk spending fingerprint",
      body: `Vector clustering of your ${highRiskTxs.length} riskiest transactions (cluster coherence: ${coherence}%) reveals a repeating pattern: ${energyDesc} ${emotionDesc} state, ${HOUR_LABELS(centroidHour)} on ${DOW_NAMES[centroidDow]}s, averaging €${centroidAmount.toFixed(2)} per purchase.`,
      icon: "🧬",
      accentColor: colors.primary,
      bgColor: colors.primaryFixed,
      actions: [
        `On ${DOW_NAMES[centroidDow]} ${HOUR_LABELS(centroidHour)}s, activate a spending cooldown automatically`,
        `Set a hard limit of €${(centroidAmount * 0.6).toFixed(0)} for any single purchase during your risk window`,
        "Use this fingerprint as your personal warning sign",
      ],
    });
  }

  return insights;
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function Insights() {
  const [insights, setInsights] = useState<Insight[]>([]);
  const [premiumInsights, setPremiumInsights] = useState<Insight[]>([]);
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
  const [isPremium, setIsPremium] = useState(false);
  const [showUpgradeModal, setShowUpgradeModal] = useState(false);

  const loadInsights = useCallback(async () => {
    try {
      const db = await getDb();
      TEMP_USER_ID = global.userID;

      const rows = await db.getAllAsync<RawTransaction>(
        `SELECT
           t.id, t.amount, t.merchant_name, t.transacted_at,
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
        setPremiumInsights([]);
        setStats(null);
        return;
      }

      const dayCountMap: Record<string, number> = {};
      for (const row of rows) {
        const day = row.transacted_at.slice(0, 10);
        dayCountMap[day] = (dayCountMap[day] ?? 0) + 1;
      }

      const totalSpend = rows.reduce((s, r) => s + r.amount, 0);
      const avgSpend = totalSpend / rows.length;

      const scored: ScoredTransaction[] = rows.map((tx) => {
        const day = tx.transacted_at.slice(0, 10);
        return scoreTransaction(tx, dayCountMap[day] ?? 1, avgSpend);
      });

      const avgScore = scored.reduce((s, t) => s + t.impulseScore, 0) / scored.length;

      const emotionCounts: Record<string, { count: number; emoji: string | null }> = {};
      for (const tx of scored) {
        if (tx.emotion_name) {
          if (!emotionCounts[tx.emotion_name])
            emotionCounts[tx.emotion_name] = { count: 0, emoji: tx.emotion_emoji };
          emotionCounts[tx.emotion_name].count++;
        }
      }
      const topEmotionEntry = Object.entries(emotionCounts).sort((a, b) => b[1].count - a[1].count)[0];

      setStats({
        totalSpend,
        txCount: rows.length,
        avgScore,
        topEmotion: topEmotionEntry?.[0] ?? null,
        topEmoji: topEmotionEntry?.[1].emoji ?? null,
      });

      setInsights(generateInsights(scored, avgSpend));
      setPremiumInsights(generatePremiumInsights(scored, avgSpend));
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

  function scoreZoneLabel(avg: number): { label: string; color: string } {
    if (avg < 3) return { label: "Healthy", color: "#0d9488" };
    if (avg < 6) return { label: "Moderate", color: colors.secondaryContainer };
    if (avg < 9) return { label: "High Risk", color: colors.error };
    return { label: "Critical", color: colors.error };
  }

  const scoreZone = stats ? scoreZoneLabel(stats.avgScore) : null;
  const scorePct = stats ? Math.min((stats.avgScore / 10) * 100, 100) : 0;

  const renderInsightCard = (insight: Insight) => {
    const isOpen = expanded === insight.id;
    return (
      <Pressable
        key={insight.id}
        style={[styles.insightCard, glassCard]}
        onPress={() => setExpanded(isOpen ? null : insight.id)}
      >
        <View style={styles.insightHeader}>
          <View style={styles.insightHeaderLeft}>
            <View style={[styles.insightIconCircle, { backgroundColor: insight.bgColor }]}>
              <Text style={{ fontSize: 18 }}>{insight.icon}</Text>
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.insightCardTitle}>{insight.title}</Text>
              {insight.score !== undefined && (
                <Text style={[styles.scoreBadge, { color: insight.accentColor }]}>
                  Score {insight.score}/14
                </Text>
              )}
            </View>
          </View>
          <MaterialIcons
            name={isOpen ? "expand-less" : "expand-more"}
            size={22}
            color={colors.outline}
          />
        </View>
        {isOpen && (
          <View style={styles.insightBody}>
            <Text style={styles.insightBodyText}>{insight.body}</Text>
            <View style={{ gap: 6 }}>
              {insight.actions.map((action, i) => (
                <View
                  key={i}
                  style={[styles.actionRow, { borderLeftColor: insight.accentColor }]}
                >
                  <Text style={styles.actionText}>{action}</Text>
                </View>
              ))}
            </View>
          </View>
        )}
      </Pressable>
    );
  };

  return (
    <View style={styles.container}>
      <TopAppBar />

      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={colors.primary}
          />
        }
      >
        {loading ? (
          <ActivityIndicator style={{ marginTop: 60 }} color={colors.primary} size="large" />
        ) : (
          <>
            {/* ── Overview (2x2 bento) ── */}
            <Text style={styles.sectionTitle}>Overview</Text>
            <View style={styles.bentoGrid}>
              {/* Total Spent */}
              <View style={[styles.statCard, glassCard]}>
                <View style={styles.statRow}>
                  <MaterialIcons
                    name="account-balance-wallet"
                    size={20}
                    color={colors.primary}
                  />
                  <Text style={styles.statLabel}>Total Spent</Text>
                </View>
                <View>
                  <Text style={styles.statValue}>€{stats?.totalSpend.toFixed(0) ?? 0}</Text>
                  <Text style={styles.statSub}>Past 30 days</Text>
                </View>
              </View>

              {/* Purchases */}
              <View style={[styles.statCard, glassCard]}>
                <View style={styles.statRow}>
                  <MaterialIcons name="receipt-long" size={20} color={colors.secondary} />
                  <Text style={styles.statLabel}>Purchases</Text>
                </View>
                <View>
                  <Text style={styles.statValue}>{stats?.txCount ?? 0}</Text>
                  <Text style={styles.statSub}>Transactions</Text>
                </View>
              </View>
            </View>

            {/* Avg Risk Score (full width) */}
            <View style={[styles.fullWidthCard, glassCard]}>
              <View style={styles.statRow}>
                <View style={styles.statRowLeft}>
                  <MaterialIcons name="warning" size={20} color={colors.tertiary} />
                  <Text style={styles.statLabel}>Avg Risk Score</Text>
                </View>
                {scoreZone && (
                  <View
                    style={[
                      styles.zonePill,
                      { backgroundColor: `${scoreZone.color}22` },
                    ]}
                  >
                    <Text style={[styles.zonePillText, { color: scoreZone.color }]}>
                      {scoreZone.label}
                    </Text>
                  </View>
                )}
              </View>
              <View style={{ marginTop: spacing.md }}>
                <Text style={styles.scoreBig}>
                  {stats?.avgScore.toFixed(1) ?? "0.0"}
                  <Text style={styles.scoreOutOf}> /10</Text>
                </Text>
                <View style={styles.progressTrack}>
                  <LinearGradient
                    colors={[colors.primary, colors.secondary]}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 0 }}
                    style={[styles.progressFill, { width: `${scorePct}%` }]}
                  />
                </View>
              </View>
            </View>

            {/* Top Emotion (full width) */}
            {stats?.topEmotion && (
              <View style={[styles.fullWidthCard, glassCard, { marginTop: spacing.sm }]}>
                <View style={styles.statRow}>
                  <View style={styles.statRowLeft}>
                    <MaterialIcons
                      name="mood"
                      size={20}
                      color={colors.primaryContainer}
                    />
                    <Text style={styles.statLabel}>Top Emotion</Text>
                  </View>
                </View>
                <View style={styles.topEmotionRow}>
                  <View style={styles.topEmotionBubble}>
                    <Text style={{ fontSize: 24 }}>{stats.topEmoji ?? "🌊"}</Text>
                  </View>
                  <View>
                    <Text style={styles.topEmotionName}>{stats.topEmotion}</Text>
                    <Text style={styles.statSub}>Linked to recent spending</Text>
                  </View>
                </View>
              </View>
            )}

            {/* ── What we found ── */}
            <Text style={[styles.sectionTitle, { marginTop: spacing.lg }]}>What we found</Text>
            <View style={{ gap: spacing.sm }}>
              {insights.map(renderInsightCard)}
            </View>

            {/* ── Premium section ── */}
            <View style={styles.premiumSectionHeader}>
              <MaterialIcons name="star" size={22} color={colors.tertiary} />
              <Text style={styles.sectionTitle}>Premium Analysis</Text>
            </View>

            {isPremium ? (
              <View style={{ gap: spacing.sm }}>{premiumInsights.map(renderInsightCard)}</View>
            ) : (
              <View style={styles.lockedSection}>
                {/* Locked content shown blurred-style behind */}
                <View style={[styles.lockedCard, glassCard]}>
                  <View style={styles.statRow}>
                    <MaterialIcons name="data-exploration" size={20} color={colors.tertiary} />
                    <Text style={styles.statLabel}>Emotion-spend correlation</Text>
                  </View>
                  <LinearGradient
                    colors={[colors.primaryFixed, colors.secondaryFixed]}
                    style={styles.lockedChartPlaceholder}
                  />
                </View>

                {/* Lock overlay */}
                <View style={styles.lockOverlay}>
                  <View style={styles.lockIconWrap}>
                    <MaterialIcons name="lock" size={32} color={colors.primary} />
                  </View>
                  <Text style={styles.lockTitle}>Unlock Deep Insights</Text>
                  <Text style={styles.lockSub}>
                    Understand the exact correlation between your mood shifts and financial habits.
                  </Text>
                  <Pressable onPress={() => setShowUpgradeModal(true)}>
                    <LinearGradient
                      colors={[colors.primary, colors.secondary]}
                      start={{ x: 0, y: 0 }}
                      end={{ x: 1, y: 0 }}
                      style={styles.unlockBtn}
                    >
                      <Text style={styles.unlockBtnText}>Upgrade to Premium</Text>
                    </LinearGradient>
                  </Pressable>
                </View>
              </View>
            )}

            <Text style={styles.footer}>
              Scores reflect your patterns — not judgements. Awared is here to help you understand
              the feeling, not shame the purchase.
            </Text>
          </>
        )}

        <View style={{ height: 110 }} />
      </ScrollView>

      <UpgradeModal
        visible={showUpgradeModal}
        onClose={() => setShowUpgradeModal(false)}
        onUpgrade={() => {
          setIsPremium(true);
          setShowUpgradeModal(false);
        }}
      />
    </View>
  );
}

const FEATURE_ROWS = [
  { free: "Impulse risk scoring", premium: "Vector behavioral fingerprint" },
  { free: "Emotion patterns", premium: "Pearson correlation engine" },
  { free: "Category breakdown", premium: "Merchant vulnerability map" },
  { free: "Late-night detection", premium: "Weekly rhythm analysis" },
  { free: "—", premium: "Predictive risk session alerts" },
];

function UpgradeModal({
  visible,
  onClose,
  onUpgrade,
}: {
  visible: boolean;
  onClose: () => void;
  onUpgrade: () => void;
}) {
  return (
    <Modal visible={visible} animationType="slide" transparent presentationStyle="overFullScreen">
      <View style={ms.overlay}>
        <Pressable style={ms.backdrop} onPress={onClose} />
        <View style={ms.sheet}>
          <View style={ms.handle} />
          <View style={ms.badge}>
            <Text style={ms.badgeText}>✨  AWARED PREMIUM</Text>
          </View>
          <Text style={ms.headline}>{"Understand your spending\nat a deeper level"}</Text>
          <Text style={ms.sub}>
            Powered by vector similarity, Pearson correlation, and behavioral clustering.
          </Text>

          <View style={ms.table}>
            <View style={ms.tableHeader}>
              <Text style={[ms.tableCol, ms.tableColHead]}>Free</Text>
              <Text style={[ms.tableCol, ms.tableColHead, ms.tablePremiumHead]}>✨ Premium</Text>
            </View>
            {FEATURE_ROWS.map((row, i) => (
              <View key={i} style={[ms.tableRow, i % 2 === 0 && ms.tableRowAlt]}>
                <Text style={[ms.tableCol, ms.tableColFree]}>{row.free}</Text>
                <Text style={[ms.tableCol, ms.tableColPremium]}>{row.premium}</Text>
              </View>
            ))}
          </View>

          <Pressable onPress={onUpgrade}>
            <LinearGradient
              colors={[colors.primary, colors.secondary]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={ms.cta}
            >
              <Text style={ms.ctaText}>Unlock for €1.99 / month</Text>
            </LinearGradient>
          </Pressable>

          <Pressable onPress={onClose} style={ms.dismissBtn}>
            <Text style={ms.dismissText}>Maybe later</Text>
          </Pressable>

          <Text style={ms.legal}>Cancel anytime · No commitments · Billed monthly</Text>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  scrollContent: {
    paddingTop: TOP_APP_BAR_HEIGHT + spacing.md,
    paddingHorizontal: spacing.containerMargin,
    paddingBottom: 40,
  },

  sectionTitle: {
    fontFamily: fonts.semibold,
    fontSize: 22,
    color: colors.onSurface,
    marginBottom: spacing.md,
  },

  bentoGrid: {
    flexDirection: "row",
    gap: spacing.sm,
    marginBottom: spacing.sm,
  },
  statCard: {
    flex: 1,
    aspectRatio: 1,
    borderRadius: radii.base,
    padding: spacing.md,
    justifyContent: "space-between",
  },
  fullWidthCard: {
    borderRadius: radii.base,
    padding: spacing.md,
  },
  statRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 6,
  },
  statRowLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  statLabel: {
    fontFamily: fonts.semibold,
    fontSize: 14,
    color: colors.onSurfaceVariant,
  },
  statValue: {
    fontFamily: fonts.extrabold,
    fontSize: 32,
    color: colors.onSurface,
    letterSpacing: -0.6,
    lineHeight: 38,
  },
  statSub: {
    fontFamily: fonts.medium,
    fontSize: 12,
    color: colors.outline,
    marginTop: 4,
  },

  zonePill: {
    paddingHorizontal: spacing.sm,
    paddingVertical: 4,
    borderRadius: radii.pill,
  },
  zonePillText: {
    fontFamily: fonts.semibold,
    fontSize: 12,
  },

  scoreBig: {
    fontFamily: fonts.bold,
    fontSize: 32,
    color: colors.onSurface,
    letterSpacing: -0.6,
  },
  scoreOutOf: {
    fontFamily: fonts.regular,
    fontSize: 16,
    color: colors.outline,
  },
  progressTrack: {
    height: 8,
    borderRadius: 4,
    backgroundColor: colors.surfaceContainerHighest,
    overflow: "hidden",
    marginTop: spacing.sm,
  },
  progressFill: {
    height: "100%",
    borderRadius: 4,
  },

  topEmotionRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    marginTop: spacing.md,
  },
  topEmotionBubble: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: colors.primaryFixed,
    alignItems: "center",
    justifyContent: "center",
  },
  topEmotionName: {
    fontFamily: fonts.semibold,
    fontSize: 22,
    color: colors.onSurface,
  },

  // Insight cards
  insightCard: {
    borderRadius: radii.base,
    padding: spacing.md,
  },
  insightHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  insightHeaderLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    flex: 1,
  },
  insightIconCircle: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
  },
  insightCardTitle: {
    fontFamily: fonts.semibold,
    fontSize: 16,
    color: colors.onSurface,
    lineHeight: 22,
  },
  scoreBadge: {
    fontFamily: fonts.medium,
    fontSize: 12,
    marginTop: 2,
  },
  insightBody: {
    marginTop: spacing.sm,
    paddingTop: spacing.sm,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.outlineVariant,
  },
  insightBodyText: {
    fontFamily: fonts.regular,
    fontSize: 14,
    color: colors.onSurfaceVariant,
    lineHeight: 20,
    marginBottom: spacing.sm,
  },
  actionRow: {
    borderLeftWidth: 2,
    paddingLeft: spacing.sm,
    paddingVertical: 4,
  },
  actionText: {
    fontFamily: fonts.regular,
    fontSize: 12,
    color: colors.onSurfaceVariant,
    lineHeight: 18,
  },

  premiumSectionHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginTop: spacing.lg,
  },
  lockedSection: {
    position: "relative",
    minHeight: 240,
  },
  lockedCard: {
    borderRadius: radii.base,
    padding: spacing.md,
    opacity: 0.5,
  },
  lockedChartPlaceholder: {
    height: 120,
    width: "100%",
    borderRadius: radii.base,
    marginTop: spacing.sm,
    opacity: 0.5,
  },
  lockOverlay: {
    position: "absolute",
    top: 0,
    bottom: 0,
    left: 0,
    right: 0,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(255,255,255,0.6)",
    borderRadius: radii.base,
    padding: spacing.lg,
    gap: spacing.sm,
  },
  lockIconWrap: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: colors.surface,
    alignItems: "center",
    justifyContent: "center",
    ...elevation.card,
  },
  lockTitle: {
    fontFamily: fonts.semibold,
    fontSize: 22,
    color: colors.onSurface,
  },
  lockSub: {
    fontFamily: fonts.regular,
    fontSize: 14,
    color: colors.onSurfaceVariant,
    textAlign: "center",
    paddingHorizontal: spacing.md,
    lineHeight: 20,
  },
  unlockBtn: {
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
    borderRadius: radii.pill,
    marginTop: spacing.sm,
  },
  unlockBtnText: {
    fontFamily: fonts.bold,
    fontSize: 14,
    color: colors.onPrimary,
    letterSpacing: 0.14,
  },

  footer: {
    fontFamily: fonts.regular,
    fontSize: 12,
    color: colors.outline,
    textAlign: "center",
    lineHeight: 18,
    marginTop: spacing.lg,
    paddingHorizontal: spacing.md,
  },
});

const ms = StyleSheet.create({
  overlay: {
    flex: 1,
    justifyContent: "flex-end",
    backgroundColor: "rgba(21,28,39,0.45)",
  },
  backdrop: { ...StyleSheet.absoluteFillObject },
  sheet: {
    backgroundColor: colors.surface,
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    paddingHorizontal: spacing.lg,
    paddingTop: 12,
    paddingBottom: 40,
    maxHeight: SCREEN_HEIGHT * 0.88,
  },
  handle: {
    width: 36,
    height: 4,
    borderRadius: 2,
    backgroundColor: colors.outlineVariant,
    alignSelf: "center",
    marginBottom: spacing.lg,
  },
  badge: {
    alignSelf: "center",
    backgroundColor: colors.primaryFixed,
    borderRadius: radii.pill,
    paddingHorizontal: spacing.md,
    paddingVertical: 5,
    marginBottom: spacing.base,
  },
  badgeText: {
    fontFamily: fonts.bold,
    fontSize: 12,
    color: colors.primary,
    letterSpacing: 1,
  },
  headline: {
    fontFamily: fonts.extrabold,
    fontSize: 26,
    color: colors.onSurface,
    textAlign: "center",
    lineHeight: 32,
    marginBottom: spacing.base,
    letterSpacing: -0.5,
  },
  sub: {
    fontFamily: fonts.regular,
    fontSize: 14,
    color: colors.onSurfaceVariant,
    textAlign: "center",
    lineHeight: 20,
    marginBottom: spacing.lg,
  },
  table: {
    borderRadius: radii.base,
    overflow: "hidden",
    marginBottom: spacing.lg,
    borderWidth: 1,
    borderColor: colors.outlineVariant,
  },
  tableHeader: {
    flexDirection: "row",
    backgroundColor: colors.surfaceContainerLow,
    paddingVertical: 10,
  },
  tableColHead: {
    fontFamily: fonts.bold,
    fontSize: 12,
    color: colors.onSurface,
    textAlign: "center",
  },
  tablePremiumHead: { color: colors.primary },
  tableRow: { flexDirection: "row", paddingVertical: 10, paddingHorizontal: 4 },
  tableRowAlt: { backgroundColor: colors.surfaceContainerLowest },
  tableCol: {
    flex: 1,
    fontFamily: fonts.regular,
    fontSize: 12,
    color: colors.onSurfaceVariant,
    textAlign: "center",
    paddingHorizontal: 6,
  },
  tableColFree: { color: colors.outline },
  tableColPremium: { color: colors.primary, fontFamily: fonts.semibold },
  cta: {
    borderRadius: radii.pill,
    paddingVertical: 16,
    alignItems: "center",
    marginBottom: 12,
    ...elevation.raised,
  },
  ctaText: {
    fontFamily: fonts.bold,
    fontSize: 16,
    color: colors.onPrimary,
    letterSpacing: 0.2,
  },
  dismissBtn: { alignItems: "center", paddingVertical: 10, marginBottom: 4 },
  dismissText: {
    fontFamily: fonts.regular,
    fontSize: 14,
    color: colors.outline,
  },
  legal: {
    fontFamily: fonts.regular,
    fontSize: 10,
    color: colors.outline,
    textAlign: "center",
  },
});
