import React, { useState, useCallback, useMemo, useEffect } from "react";
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  Pressable,
  ActivityIndicator,
  RefreshControl,
  Modal,
  TouchableOpacity,
  Dimensions,
  Animated,
  Easing,
} from "react-native";
import Svg, {
  Path,
  Line,
  Circle,
  Rect,
  Text as SvgText,
  G,
  Defs,
  RadialGradient,
  LinearGradient,
  Stop,
} from "react-native-svg";
import { BlurView } from "expo-blur";
import { useFocusEffect } from "expo-router";
import { getDb } from "../../database/db";
import { EMOTION_COLORS, emotionColor } from "../../components/EmotionGlyph";

const { height: SCREEN_HEIGHT, width: SCREEN_WIDTH } = Dimensions.get("window");

// ─── Editorial design tokens ──────────────────────────────────────────────────
const C = {
  bg: "#F5F1EA",
  panel: "#FAF6EF",
  ink: "#1F1B16",
  inkSoft: "#5E574E",
  inkMute: "#9C9489",
  rule: "rgba(31,27,22,0.10)",
  ruleSoft: "rgba(31,27,22,0.06)",
  purple: "#9B82C9",
  purpleDeep: "#7E64B3",
  purpleSoft: "rgba(155,130,201,0.14)",
  paperEdge: "#E0CDA8",
};

const FONT_SERIF = "PlayfairDisplay_400Regular";
const FONT_SERIF_ITALIC = "PlayfairDisplay_400Regular_Italic";
const FONT_SERIF_BOLD = "PlayfairDisplay_700Bold";
const FONT_SERIF_BOLD_ITALIC = "PlayfairDisplay_700Bold_Italic";

const EMOTIONS_ORDER = [
  "sadness", "stress", "happy", "anxiety",
  "boredom", "excited", "calm", "anger",
];

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
  emoKey?: string;
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

type VizData = {
  highEmo: string;
  highSpend: number;
  lowEmo: string;
  lowSpend: number;
  riskScore: number;
  weekly: { label: string; total: number; dominant: string }[];
  weeklyPeak: number | null;
  scatter: { x: number; y: number; emo: string }[];
  pearsonR: number;
  fingerprint: Record<string, number>;
  hours: number[];
  vulnerable: { name: string; pct: number; emo: string }[];
  nextRisk: { day: string; window: string; probability: number } | null;
  centroidDow: number;
};

// ─── Constants ────────────────────────────────────────────────────────────────
let TEMP_USER_ID: string;
const AVG_SPEND = 20;
const DOW_NAMES = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
const DOW_SHORT = ["S", "M", "T", "W", "T", "F", "S"];
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
    breakdown.emotion + breakdown.time + breakdown.category +
    breakdown.amount + breakdown.frequency;
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
  let dot = 0, magA = 0, magB = 0;
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
  let num = 0, dx2 = 0, dy2 = 0;
  for (let i = 0; i < n; i++) {
    const dx = xs[i] - mx, dy = ys[i] - my;
    num += dx * dy; dx2 += dx * dx; dy2 += dy * dy;
  }
  const denom = Math.sqrt(dx2 * dy2);
  return denom === 0 ? 0 : num / denom;
}

// ─── Free insight generation ──────────────────────────────────────────────────

function generateInsights(scored: ScoredTransaction[], avgSpend: number): Insight[] {
  const insights: Insight[] = [];

  if (scored.length === 0) {
    insights.push({
      id: "no-data", type: "tip",
      title: "Nothing to analyse yet",
      body: "Add a few purchases to start seeing insights about your spending patterns.",
      icon: "📊", accentColor: C.purpleDeep, bgColor: C.purpleSoft,
      actions: ["Log your first purchase"],
    });
    return insights;
  }

  const totalSpend = scored.reduce((s, t) => s + t.amount, 0);
  const computedAvg = totalSpend / scored.length;
  const topMerchants = (() => {
    const counts: Record<string, number> = {};
    scored.forEach((t) => { if (t.merchant_name) counts[t.merchant_name] = (counts[t.merchant_name] ?? 0) + 1; });
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
      id: "high-risk", type: "risk",
      title: "High-risk spending detected",
      body: `Your ${top.merchant_name ? `purchase at ${top.merchant_name}` : "recent purchase"} on ${when} scored ${top.impulseScore}/14 on the impulse scale. High-energy negative emotions, late hours, and above-average amounts are a triple warning sign.`,
      icon: "⚠️", accentColor: emotionColor(top.emotion_name) || "#C24A3A",
      bgColor: "#FADDD0", emoKey: top.emotion_name?.toLowerCase(),
      score: top.impulseScore,
      actions: [
        "Try a 20-minute spending cooldown before similar purchases",
        "Notice the emotion — write it in the note field next time",
        `Review your ${HOUR_LABELS(hour)} purchases as a separate category`,
      ],
    });
  } else if (midRisk.length > 0) {
    insights.push({
      id: "mid-risk", type: "pattern",
      title: "Mild impulse pattern spotted",
      body: `${midRisk.length} of your recent purchases show mild emotional spending signals. Not a red flag, but worth reflecting on.`,
      icon: "〰️", accentColor: "#B97A5C", bgColor: "#FADDD0",
      emoKey: "anxiety",
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
      if (!emotionCounts[name]) emotionCounts[name] = { count: 0, totalAmount: 0, emoji: tx.emotion_emoji ?? "😶" };
      emotionCounts[name].count++;
      emotionCounts[name].totalAmount += tx.amount;
    }
    const [topEmotion, topData] = Object.entries(emotionCounts)
      .sort((a, b) => b[1].count - a[1].count)[0];

    const merchantSentence = frequentMerchant
      ? ` Purchases at ${frequentMerchant} are among the most common outlets.`
      : "";

    insights.push({
      id: "emotion-trigger", type: "pattern",
      title: `${topEmotion} is your top spending trigger`,
      body: `You've made ${topData.count} purchase${topData.count > 1 ? "s" : ""} while feeling ${topEmotion.toLowerCase()}, totalling €${topData.totalAmount.toFixed(2)}.${merchantSentence} Emotional spending loops often start here.`,
      icon: topData.emoji, accentColor: emotionColor(topEmotion) || C.purpleDeep,
      bgColor: C.purpleSoft, emoKey: topEmotion.toLowerCase(),
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
      lateNight.forEach(t => { const h = new Date(t.transacted_at).getHours(); counts[h] = (counts[h] ?? 0) + 1; });
      return parseInt(Object.entries(counts).sort((a, b) => b[1] - a[1])[0][0]);
    })();
    insights.push({
      id: "late-night", type: "risk",
      title: "Late-night spending habit",
      body: `${lateNight.length} of your purchases happened after 9 PM, totalling €${lateTotal.toFixed(2)}. Your peak hour is ${peakHour}:00 — when willpower research says inhibition is at its lowest.`,
      icon: "🌙", accentColor: emotionColor("anxiety"), bgColor: "#B8E4E0",
      emoKey: "anxiety",
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
        id: "top-category", type: "pattern",
        title: `${catName} is your biggest spend`,
        body: `You've spent €${catData.total.toFixed(2)} across ${catData.count} purchase${catData.count > 1 ? "s" : ""} in ${catName} (avg €${perPurchase} each). This category carries elevated impulse risk.`,
        icon: catData.icon, accentColor: emotionColor("happy"), bgColor: "#F5E6B0",
        emoKey: "happy",
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
      id: "big-purchases", type: "tip",
      title: "Above-average purchases flagged",
      body: `${bigPurchases.length} transaction${bigPurchases.length > 1 ? "s were" : " was"} more than 2× your average (€${computedAvg.toFixed(2)}), totalling €${bigTotal.toFixed(2)}. These carry the highest financial risk when made impulsively.`,
      icon: "💸", accentColor: "#B97A5C", bgColor: "#FADDD0",
      emoKey: "anxiety",
      actions: [
        `For purchases over €${(computedAvg * 2).toFixed(0)}, sleep on it before buying`,
        "Keep a 'big purchase wishlist' — revisit it after 72 hours",
      ],
    });
  }

  const healthyTxs = scored.filter((t) => t.impulseScore <= 2 && t.emotion_category !== "negative");
  if (healthyTxs.length >= 3) {
    insights.push({
      id: "positive", type: "positive",
      title: "You're spending mindfully",
      body: `${healthyTxs.length} of your recent purchases showed low impulse risk and balanced emotional states — ${((healthyTxs.length / scored.length) * 100).toFixed(0)}% of your total. That's intentional spending in action.`,
      icon: "✅", accentColor: emotionColor("calm"), bgColor: "#C0E2CE",
      emoKey: "calm",
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
      id: "premium-insufficient", type: "tip",
      title: "Need more data for vector analysis",
      body: "Log at least 3 purchases to unlock premium vector insights. The more you log, the more precise your behavioral profile becomes.",
      icon: "📡", accentColor: C.purpleDeep, bgColor: C.purpleSoft, actions: [],
    });
    return insights;
  }

  const vectors = scored.map((tx) => toFeatureVector(tx, avgSpend));

  const txWithEmotion = scored.filter((t) => t.emotion_polarity !== null && t.emotion_energy !== null);
  if (txWithEmotion.length >= 3) {
    const polarities = txWithEmotion.map((t) => t.emotion_polarity!);
    const amounts = txWithEmotion.map((t) => t.amount);
    const r = pearsonCorrelation(polarities, amounts);
    const absR = Math.abs(r);
    const strength = absR > 0.6 ? "strong" : absR > 0.35 ? "moderate" : "weak";

    if (absR > 0.15) {
      const direction = r < 0
        ? "negative emotions predict higher spending"
        : "positive moods correlate with larger purchases";
      const interpretation = r < -0.35
        ? "Your spending climbs when your mood drops — a classic emotional compensation loop."
        : r > 0.35
          ? "You tend to reward yourself more generously when feeling good. Watch for celebratory overspending."
          : "There's a detectable link between your mood and spending, though it's not yet dominant.";

      insights.push({
        id: "premium-correlation", type: r < -0.35 ? "risk" : "pattern",
        title: `Emotion–spend correlation: r = ${r.toFixed(2)}`,
        body: `Pearson analysis across ${txWithEmotion.length} tagged transactions found a ${strength} link — ${direction} (r = ${r.toFixed(2)}, scale −1 to +1). ${interpretation}`,
        icon: "📈", accentColor: C.purpleDeep, bgColor: C.purpleSoft,
        actions: [
          r < -0.3
            ? `When you're feeling low, set a €${(avgSpend * 0.6).toFixed(0)} soft cap for the next 2 hours`
            : "Track spending before and after emotional highs to detect reward loops",
          "Log your emotion *before* opening your wallet — the act alone reduces impulse rates",
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

    let simSum = 0, simCount = 0;
    for (let i = 0; i < hrVectors.length; i++) {
      for (let j = i + 1; j < hrVectors.length; j++) {
        simSum += cosineSimilarity(hrVectors[i], hrVectors[j]);
        simCount++;
      }
    }
    const coherence = simCount > 0 ? (simSum / simCount * 100).toFixed(0) : "N/A";

    const emotionDesc = centroidPolarity < -2 ? "strongly negative" : centroidPolarity < 0 ? "mildly negative" : "neutral";
    const energyDesc = centroidEnergy > 6 ? "high-energy" : "low-energy";

    insights.push({
      id: "premium-cluster", type: "risk",
      title: "Your high-risk spending fingerprint",
      body: `Vector clustering of your ${highRiskTxs.length} riskiest transactions (cluster coherence: ${coherence}%) reveals a repeating pattern: ${energyDesc} ${emotionDesc} state, ${HOUR_LABELS(centroidHour)} on ${DOW_NAMES[centroidDow]}s, averaging €${centroidAmount.toFixed(2)} per purchase. This is your personal risk archetype.`,
      icon: "🧬", accentColor: C.purpleDeep, bgColor: C.purpleSoft,
      actions: [
        `On ${DOW_NAMES[centroidDow]} ${HOUR_LABELS(centroidHour)}s, activate a spending cooldown automatically`,
        `Set a hard limit of €${(centroidAmount * 0.6).toFixed(0)} for any single purchase during your risk window`,
        "Use this fingerprint as your personal warning sign — if these three factors align, pause first",
      ],
    });
  }

  const dowStats: Record<number, { totalAmount: number; count: number; totalScore: number }> = {};
  for (const tx of scored) {
    const dow = new Date(tx.transacted_at).getDay();
    if (!dowStats[dow]) dowStats[dow] = { totalAmount: 0, count: 0, totalScore: 0 };
    dowStats[dow].totalAmount += tx.amount;
    dowStats[dow].count++;
    dowStats[dow].totalScore += tx.impulseScore;
  }
  const dowEntries = Object.entries(dowStats).map(([dow, s]) => ({
    dow: parseInt(dow),
    avgRisk: s.totalScore / s.count,
    avgAmount: s.totalAmount / s.count,
    count: s.count,
  }));

  if (dowEntries.length >= 3) {
    const sorted = [...dowEntries].sort((a, b) => b.avgRisk - a.avgRisk);
    const riskiest = sorted[0];
    const safest = sorted[sorted.length - 1];
    const riskRatio = (riskiest.avgRisk / Math.max(safest.avgRisk, 0.1)).toFixed(1);

    insights.push({
      id: "premium-weekly-rhythm", type: "pattern",
      title: `${DOW_NAMES[riskiest.dow]} is your highest-risk day`,
      body: `Weekly rhythm analysis shows ${DOW_NAMES[riskiest.dow]} averages a risk score of ${riskiest.avgRisk.toFixed(1)} — ${riskRatio}× higher than ${DOW_NAMES[safest.dow]} (${safest.avgRisk.toFixed(1)}), your calmest day. Average spend on your risk day: €${riskiest.avgAmount.toFixed(2)}.`,
      icon: "📅", accentColor: C.purpleDeep, bgColor: C.purpleSoft,
      actions: [
        `Set a strict daily cap of €${(riskiest.avgAmount * 1.2).toFixed(0)} every ${DOW_NAMES[riskiest.dow]}`,
        `Schedule something grounding on ${DOW_NAMES[riskiest.dow]}s to reduce emotional pressure`,
        `Use ${DOW_NAMES[safest.dow]} to review any ${DOW_NAMES[riskiest.dow]} purchases and decide if you'd repeat them`,
      ],
    });
  }

  const merchantStats: Record<string, { count: number; totalAmount: number; polaritySum: number; energySum: number }> = {};
  for (const tx of scored) {
    if (!tx.merchant_name || tx.emotion_polarity === null) continue;
    const m = tx.merchant_name;
    if (!merchantStats[m]) merchantStats[m] = { count: 0, totalAmount: 0, polaritySum: 0, energySum: 0 };
    merchantStats[m].count++;
    merchantStats[m].totalAmount += tx.amount;
    merchantStats[m].polaritySum += tx.emotion_polarity;
    merchantStats[m].energySum += tx.emotion_energy ?? 5;
  }

  const vulnerableMerchants = Object.entries(merchantStats)
    .filter(([, s]) => s.count >= 2)
    .map(([name, s]) => ({
      name,
      avgPolarity: s.polaritySum / s.count,
      avgEnergy: s.energySum / s.count,
      count: s.count,
      totalAmount: s.totalAmount,
      avgAmount: s.totalAmount / s.count,
    }))
    .filter((m) => m.avgPolarity < -1)
    .sort((a, b) => a.avgPolarity - b.avgPolarity);

  if (vulnerableMerchants.length > 0) {
    const top = vulnerableMerchants[0];
    const vulnerabilityScore = (Math.abs(top.avgPolarity) * top.avgEnergy / 10 * 100).toFixed(0);
    insights.push({
      id: "premium-merchant", type: "risk",
      title: `You visit ${top.name} when emotionally low`,
      body: `Merchant vulnerability analysis: ${top.name} has an average emotional polarity of ${top.avgPolarity.toFixed(1)}/5 at visit time (vulnerability score: ${vulnerabilityScore}/100). Across ${top.count} visits you've spent €${top.totalAmount.toFixed(2)} — €${top.avgAmount.toFixed(2)} per visit on average.`,
      icon: "🏪", accentColor: C.purpleDeep, bgColor: C.purpleSoft,
      actions: [
        `Apply a 15-minute rule before visiting ${top.name} when feeling negative`,
        "This merchant may be serving an emotional need — identify the feeling it satisfies",
        `Try a €${(top.avgAmount * 0.6).toFixed(0)} spending cap when visiting ${top.name} in a low mood`,
      ],
    });
  }

  if (scored.length >= 5 && vectors.length >= 5) {
    const highRiskVectors = scored
      .filter((t) => t.impulseScore >= 7)
      .map((tx) => toFeatureVector(tx, avgSpend));

    if (highRiskVectors.length >= 1) {
      const hrCentroid = computeCentroid(highRiskVectors);
      const recentTxs = scored.slice(0, 3);
      const recentVecs = recentTxs.map((tx) => toFeatureVector(tx, avgSpend));
      const recentSims = recentVecs.map((v) => cosineSimilarity(v, hrCentroid));
      const maxSim = Math.max(...recentSims);
      const riskPct = (maxSim * 100).toFixed(0);

      if (maxSim > 0.7) {
        const closestTx = recentTxs[recentSims.indexOf(maxSim)];
        insights.push({
          id: "premium-predictive", type: "risk",
          title: `Recent pattern: ${riskPct}% match to your risk profile`,
          body: `Your ${closestTx.merchant_name ? `purchase at ${closestTx.merchant_name}` : "latest purchase"} has a ${riskPct}% cosine similarity to your historical high-risk sessions. The conditions that precede your impulsive purchases are present right now.`,
          icon: "🔮", accentColor: C.purpleDeep, bgColor: C.purpleSoft,
          actions: [
            "This is the window where a 10-minute pause has the highest ROI",
            "Check in with your emotional state before your next purchase today",
            "Consider setting a €0 intention for the next 2 hours",
          ],
        });
      }
    }
  }

  return insights;
}

// ─── Visualisation data builder ───────────────────────────────────────────────
function buildVizData(scored: ScoredTransaction[], avgSpend: number): VizData {
  // High/low emotion averages
  const emoBuckets: Record<string, { total: number; count: number }> = {};
  for (const tx of scored) {
    const key = tx.emotion_name?.toLowerCase();
    if (!key) continue;
    if (!emoBuckets[key]) emoBuckets[key] = { total: 0, count: 0 };
    emoBuckets[key].total += tx.amount;
    emoBuckets[key].count++;
  }
  const emoAvgs = Object.entries(emoBuckets)
    .map(([emo, s]) => ({ emo, avg: s.total / s.count }))
    .sort((a, b) => b.avg - a.avg);

  const highEmo = emoAvgs[0]?.emo ?? "stress";
  const highSpend = Math.round(emoAvgs[0]?.avg ?? 0);
  const lowEmo = emoAvgs[emoAvgs.length - 1]?.emo ?? "calm";
  const lowSpend = Math.round(emoAvgs[emoAvgs.length - 1]?.avg ?? 0);

  // Risk score on 0–10 scale
  const avgScore14 = scored.length
    ? scored.reduce((s, t) => s + t.impulseScore, 0) / scored.length
    : 0;
  const riskScore = Math.min(10, (avgScore14 / 14) * 10);

  // Weekly: 7 days starting from current day-of-week back
  const dowTotals: { total: number; emoCounts: Record<string, number> }[] =
    Array.from({ length: 7 }, () => ({ total: 0, emoCounts: {} }));
  for (const tx of scored) {
    const d = new Date(tx.transacted_at).getDay();
    dowTotals[d].total += tx.amount;
    const emo = tx.emotion_name?.toLowerCase() ?? "boredom";
    dowTotals[d].emoCounts[emo] = (dowTotals[d].emoCounts[emo] ?? 0) + 1;
  }
  const weekly = dowTotals.map((b, i) => {
    const dom = Object.entries(b.emoCounts).sort((a, c) => c[1] - a[1])[0]?.[0] ?? "calm";
    return { label: DOW_SHORT[i], total: Math.round(b.total), dominant: dom };
  });
  let weeklyPeak: number | null = null;
  let peakVal = -1;
  weekly.forEach((d, i) => { if (d.total > peakVal) { peakVal = d.total; weeklyPeak = i; } });
  if (peakVal === 0) weeklyPeak = null;

  // Scatter: x = polarity-based mood (calm→0, stressed→1), y = amount normalized
  const maxAmount = Math.max(1, ...scored.map((t) => t.amount));
  const scatter = scored
    .filter((t) => t.emotion_polarity !== null)
    .map((t) => ({
      x: Math.min(1, Math.max(0, (-t.emotion_polarity!) / 10 + 0.5)),
      y: Math.min(1, t.amount / maxAmount),
      emo: t.emotion_name?.toLowerCase() ?? "boredom",
    }))
    .slice(0, 20);

  // Pearson r between polarity and amount (signed for visual line)
  const polarities = scored
    .filter((t) => t.emotion_polarity !== null)
    .map((t) => t.emotion_polarity!);
  const amounts = scored
    .filter((t) => t.emotion_polarity !== null)
    .map((t) => t.amount);
  // Flip sign so positive r means "stress → more spending"
  const pearsonR = -pearsonCorrelation(polarities, amounts);

  // Fingerprint: 8 emotion intensities (count / max count) per emotion
  const fpCounts: Record<string, number> = {};
  for (const e of EMOTIONS_ORDER) fpCounts[e] = 0;
  for (const tx of scored) {
    const k = tx.emotion_name?.toLowerCase();
    if (k && k in fpCounts) fpCounts[k]++;
  }
  const maxCount = Math.max(1, ...Object.values(fpCounts));
  const fingerprint: Record<string, number> = {};
  for (const e of EMOTIONS_ORDER) fingerprint[e] = fpCounts[e] / maxCount;

  // Hours: 24-bucket impulse intensity
  const hourBuckets = new Array(24).fill(0);
  for (const tx of scored) {
    const h = new Date(tx.transacted_at).getHours();
    hourBuckets[h] += tx.impulseScore;
  }
  const maxHour = Math.max(1, ...hourBuckets);
  const hours = hourBuckets.map((v) => v / maxHour);

  // Vulnerable merchants: top 4 by vulnerability pct
  const merchAgg: Record<string, { count: number; polSum: number; enSum: number; emo: string; emoCounts: Record<string, number> }> = {};
  for (const tx of scored) {
    if (!tx.merchant_name) continue;
    if (!merchAgg[tx.merchant_name]) {
      merchAgg[tx.merchant_name] = { count: 0, polSum: 0, enSum: 0, emo: "boredom", emoCounts: {} };
    }
    const m = merchAgg[tx.merchant_name];
    m.count++;
    m.polSum += tx.emotion_polarity ?? 0;
    m.enSum += tx.emotion_energy ?? 5;
    const k = tx.emotion_name?.toLowerCase() ?? "boredom";
    m.emoCounts[k] = (m.emoCounts[k] ?? 0) + 1;
  }
  const vulnerable = Object.entries(merchAgg)
    .map(([name, m]) => {
      const avgPol = m.polSum / m.count;
      const avgEn = m.enSum / m.count;
      const pct = Math.min(99, Math.round(Math.abs(Math.min(0, avgPol)) * (avgEn / 10) * 100 / 5 * 10));
      const dom = Object.entries(m.emoCounts).sort((a, b) => b[1] - a[1])[0]?.[0] ?? "boredom";
      return { name, pct, emo: dom, avgPol };
    })
    .filter((m) => m.pct > 0)
    .sort((a, b) => b.pct - a.pct)
    .slice(0, 4)
    .map(({ name, pct, emo }) => ({ name, pct, emo }));

  // Next risk session — centroid of high-risk txs
  const highRiskTxs = scored.filter((t) => t.impulseScore >= 6);
  let nextRisk: VizData["nextRisk"] = null;
  let centroidDow = 4; // default Thursday
  if (highRiskTxs.length >= 2) {
    const hrVec = highRiskTxs.map((tx) => toFeatureVector(tx, avgSpend));
    const centroid = computeCentroid(hrVec);
    centroidDow = Math.round(centroid[3] * 6);
    const centroidHour = Math.round(centroid[2] * 23);
    const win0 = String(centroidHour).padStart(2, "0");
    const win1 = String((centroidHour + 2) % 24).padStart(2, "0");

    let simSum = 0, simCount = 0;
    for (let i = 0; i < hrVec.length; i++) {
      for (let j = i + 1; j < hrVec.length; j++) {
        simSum += cosineSimilarity(hrVec[i], hrVec[j]);
        simCount++;
      }
    }
    const coherence = simCount > 0 ? simSum / simCount : 0.7;
    nextRisk = {
      day: DOW_NAMES[centroidDow],
      window: `${win0}:00 — ${win1}:00`,
      probability: Math.round(coherence * 100),
    };
  }

  return {
    highEmo, highSpend, lowEmo, lowSpend,
    riskScore, weekly, weeklyPeak,
    scatter, pearsonR,
    fingerprint, hours, vulnerable,
    nextRisk, centroidDow,
  };
}

// ─── SVG components ───────────────────────────────────────────────────────────

function RiskArc({ score, size = 178 }: { score: number; size?: number }) {
  const cx = size / 2;
  const cy = size / 2 + 10;
  const r = size / 2 - 14;
  const startA = -210;
  const endA = 30;
  const max = 10;
  const pct = Math.min(1, score / max);
  const valA = startA + (endA - startA) * pct;

  const polar = (a: number, rad = r): [number, number] => {
    const rr = (a * Math.PI) / 180;
    return [cx + rad * Math.cos(rr), cy + rad * Math.sin(rr)];
  };
  const arcPath = (a0: number, a1: number) => {
    const [x0, y0] = polar(a0);
    const [x1, y1] = polar(a1);
    const large = a1 - a0 > 180 ? 1 : 0;
    return `M ${x0} ${y0} A ${r} ${r} 0 ${large} 1 ${x1} ${y1}`;
  };

  const color =
    score < 2 ? "#5F7A4F" :
    score < 4 ? "#D4A24C" :
    score < 7 ? "#B97A5C" : "#9B3A2F";

  const ticks = [0, 2.5, 5, 7.5, 10];
  const [hx, hy] = polar(valA, r - 2);

  return (
    <Svg width={size} height={size * 0.78} viewBox={`0 0 ${size} ${size * 0.78}`}>
      <Path d={arcPath(startA, endA)} stroke="rgba(31,27,22,0.12)" strokeWidth={1.4} fill="none" strokeLinecap="round" />
      <Path d={arcPath(startA, valA)} stroke={color} strokeWidth={2.6} fill="none" strokeLinecap="round" />
      {ticks.map((t, i) => {
        const a = startA + (endA - startA) * (t / max);
        const [x0, y0] = polar(a, r + 4);
        const [x1, y1] = polar(a, r - 4);
        return <Line key={i} x1={x0} y1={y0} x2={x1} y2={y1} stroke="rgba(31,27,22,0.18)" strokeWidth={1} />;
      })}
      <Line x1={cx} y1={cy} x2={hx} y2={hy} stroke={C.ink} strokeWidth={1.4} strokeLinecap="round" />
      <Circle cx={cx} cy={cy} r={3.2} fill={C.ink} />
      <SvgText
        x={cx} y={cy - 18} textAnchor="middle"
        fontFamily={FONT_SERIF} fontSize={34} fill={C.ink}
      >
        {score.toFixed(1)}
      </SvgText>
      <SvgText
        x={cx} y={cy - 4} textAnchor="middle"
        fontSize={9} fill={C.inkMute}
      >
        OUT OF 10
      </SvgText>
    </Svg>
  );
}

function WeeklyPulse({
  data, peakDay, height = 96, width,
}: {
  data: VizData["weekly"];
  peakDay: number | null;
  height?: number;
  width: number;
}) {
  const max = Math.max(...data.map((d) => d.total), 1);
  const gap = 6;
  const colWidth = (width - gap * (data.length - 1)) / data.length;
  const barWidth = colWidth * 0.7;
  const usableH = height - 16;

  return (
    <View style={{ width }}>
      <View style={{ flexDirection: "row", alignItems: "flex-end", height, gap }}>
        {data.map((d, i) => {
          const h = (d.total / max) * usableH;
          const isPeak = peakDay === i;
          const color = emotionColor(d.dominant);
          return (
            <View key={i} style={{ width: colWidth, alignItems: "center" }}>
              <Text style={{ fontFamily: FONT_SERIF, fontSize: 10, color: C.inkMute, marginBottom: 4 }}>
                {d.total > 0 ? `€${d.total}` : ""}
              </Text>
              <View
                style={{
                  width: barWidth,
                  height: Math.max(2, h),
                  backgroundColor: color,
                  opacity: d.total === 0 ? 0.15 : 1,
                  borderRadius: 1.5,
                  borderWidth: isPeak ? 2 : 0,
                  borderColor: C.bg,
                  ...(isPeak
                    ? {
                        shadowColor: color,
                        shadowOffset: { width: 0, height: 0 },
                        shadowOpacity: 1,
                        shadowRadius: 0,
                      }
                    : {}),
                }}
              />
            </View>
          );
        })}
      </View>
      <View style={{ flexDirection: "row", gap, marginTop: 6 }}>
        {data.map((d, i) => (
          <View key={i} style={{ width: colWidth, alignItems: "center" }}>
            <Text
              style={{
                fontSize: 10,
                letterSpacing: 0.5,
                color: peakDay === i ? emotionColor(d.dominant) : C.inkMute,
                fontWeight: peakDay === i ? "600" : "400",
              }}
            >
              {d.label}
            </Text>
          </View>
        ))}
      </View>
    </View>
  );
}

function CorrelationScatter({
  points, r, width,
}: {
  points: VizData["scatter"];
  r: number;
  width: number;
}) {
  const W = width;
  const H = 150;
  const pad = 18;
  const xy = (p: { x: number; y: number }): [number, number] => [
    pad + p.x * (W - pad * 2),
    H - pad - p.y * (H - pad * 2),
  ];
  const [lx0, ly0] = xy({ x: 0.05, y: Math.max(0, 0.2 + r * 0.4 - 0.3) });
  const [lx1, ly1] = xy({ x: 0.95, y: Math.min(1, 0.2 + r * 0.4 + 0.4) });

  return (
    <Svg width="100%" height={H} viewBox={`0 0 ${W} ${H}`}>
      <Line x1={pad} y1={H - pad} x2={W - pad} y2={H - pad} stroke="rgba(31,27,22,0.18)" strokeWidth={1} />
      <Line x1={pad} y1={pad} x2={pad} y2={H - pad} stroke="rgba(31,27,22,0.18)" strokeWidth={1} />
      {[0.25, 0.5, 0.75].map((t) => (
        <Line
          key={t}
          x1={pad}
          y1={H - pad - t * (H - pad * 2)}
          x2={W - pad}
          y2={H - pad - t * (H - pad * 2)}
          stroke="rgba(31,27,22,0.05)"
          strokeDasharray="2 3"
        />
      ))}
      <Line x1={lx0} y1={ly0} x2={lx1} y2={ly1} stroke={C.purpleDeep} strokeWidth={1.4} strokeDasharray="4 3" strokeLinecap="round" />
      {points.map((p, i) => {
        const [x, y] = xy(p);
        return (
          <Circle
            key={i}
            cx={x}
            cy={y}
            r={3.4}
            fill={emotionColor(p.emo)}
            fillOpacity={0.85}
            stroke={C.bg}
            strokeWidth={1}
          />
        );
      })}
      <SvgText x={pad} y={H - 4} fontFamily={FONT_SERIF_ITALIC} fontSize={10} fill={C.inkMute}>
        calm
      </SvgText>
      <SvgText x={W - pad} y={H - 4} textAnchor="end" fontFamily={FONT_SERIF_ITALIC} fontSize={10} fill={C.inkMute}>
        stressed
      </SvgText>
      <SvgText x={pad + 4} y={pad - 4} fontFamily={FONT_SERIF_ITALIC} fontSize={10} fill={C.inkMute}>
        amount €
      </SvgText>
      <G x={W - 76} y={pad + 8}>
        <Rect x={0} y={0} rx={3} width={62} height={18} fill={C.purpleSoft} />
        <SvgText x={6} y={12.5} fontSize={11} fill={C.purpleDeep}>
          r = {r.toFixed(2)}
        </SvgText>
      </G>
    </Svg>
  );
}

function Fingerprint({ values, size = 200 }: { values: Record<string, number>; size?: number }) {
  const cx = size / 2;
  const cy = size / 2;
  const rMax = size / 2 - 24;
  const N = EMOTIONS_ORDER.length;
  const angle = (i: number) => -Math.PI / 2 + (i / N) * Math.PI * 2;

  const pts: [number, number][] = EMOTIONS_ORDER.map((e, i) => {
    const v = Math.max(0.08, values[e] || 0); // minimum size so shape is visible
    const a = angle(i);
    return [cx + Math.cos(a) * rMax * v, cy + Math.sin(a) * rMax * v];
  });

  const pathFrom = (p: [number, number][]) => {
    let d = `M ${p[0][0].toFixed(1)} ${p[0][1].toFixed(1)} `;
    for (let i = 0; i < p.length; i++) {
      const p0 = p[i];
      const p1 = p[(i + 1) % p.length];
      const mx = (p0[0] + p1[0]) / 2;
      const my = (p0[1] + p1[1]) / 2;
      d += `Q ${p0[0].toFixed(1)} ${p0[1].toFixed(1)} ${mx.toFixed(1)} ${my.toFixed(1)} `;
    }
    d += "Z";
    return d;
  };

  return (
    <Svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
      <Defs>
        <RadialGradient id="fp-fill" cx="50%" cy="50%" r="50%">
          <Stop offset="0%" stopColor="rgba(155,130,201,0.45)" />
          <Stop offset="100%" stopColor="rgba(155,130,201,0.10)" />
        </RadialGradient>
      </Defs>
      {[0.33, 0.66, 1].map((t) => (
        <Circle
          key={t}
          cx={cx}
          cy={cy}
          r={rMax * t}
          fill="none"
          stroke="rgba(31,27,22,0.08)"
          strokeWidth={1}
          strokeDasharray={t === 1 ? undefined : "2 3"}
        />
      ))}
      {EMOTIONS_ORDER.map((e, i) => {
        const a = angle(i);
        return (
          <Line
            key={e}
            x1={cx}
            y1={cy}
            x2={cx + Math.cos(a) * rMax}
            y2={cy + Math.sin(a) * rMax}
            stroke="rgba(31,27,22,0.06)"
            strokeWidth={1}
          />
        );
      })}
      <Path d={pathFrom(pts)} fill="url(#fp-fill)" stroke={C.purpleDeep} strokeWidth={1.4} strokeLinejoin="round" />
      {pts.map((p, i) => (
        <Circle
          key={i}
          cx={p[0]}
          cy={p[1]}
          r={2.4}
          fill={emotionColor(EMOTIONS_ORDER[i])}
          stroke={C.bg}
          strokeWidth={1}
        />
      ))}
      {EMOTIONS_ORDER.map((e, i) => {
        const a = angle(i);
        const lx = cx + Math.cos(a) * (rMax + 12);
        const ly = cy + Math.sin(a) * (rMax + 12);
        return (
          <SvgText
            key={e}
            x={lx}
            y={ly + 3}
            textAnchor="middle"
            fontFamily={FONT_SERIF_ITALIC}
            fontSize={10}
            fill={emotionColor(e)}
          >
            {e}
          </SvgText>
        );
      })}
    </Svg>
  );
}

function HourRing({ hours, size = 168 }: { hours: number[]; size?: number }) {
  const cx = size / 2;
  const cy = size / 2;
  const rInner = size / 2 - 30;
  const rOuter = size / 2 - 8;
  const segA = (Math.PI * 2) / 24;

  let peak = 0;
  for (let i = 0; i < hours.length; i++) if (hours[i] > hours[peak]) peak = i;

  const arcs = hours.map((v, i) => {
    const a0 = -Math.PI / 2 + i * segA;
    const a1 = a0 + segA;
    const r0 = rInner;
    const r1 = rInner + v * (rOuter - rInner);
    const p0 = [cx + Math.cos(a0) * r0, cy + Math.sin(a0) * r0];
    const p1 = [cx + Math.cos(a1) * r0, cy + Math.sin(a1) * r0];
    const p2 = [cx + Math.cos(a1) * r1, cy + Math.sin(a1) * r1];
    const p3 = [cx + Math.cos(a0) * r1, cy + Math.sin(a0) * r1];
    return { p0, p1, p2, p3, v, i };
  });

  return (
    <Svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
      <Circle cx={cx} cy={cy} r={rInner - 2} fill="none" stroke="rgba(31,27,22,0.08)" strokeWidth={1} />
      {[0, 6, 12, 18].map((h) => {
        const a = -Math.PI / 2 + (h / 24) * Math.PI * 2;
        const x = cx + Math.cos(a) * (rOuter + 8);
        const y = cy + Math.sin(a) * (rOuter + 8);
        return (
          <SvgText
            key={h}
            x={x}
            y={y + 3}
            textAnchor="middle"
            fontSize={9}
            fill={C.inkMute}
          >
            {String(h).padStart(2, "0")}
          </SvgText>
        );
      })}
      {arcs.map((a) => (
        <Path
          key={a.i}
          d={`M ${a.p0[0]} ${a.p0[1]} L ${a.p1[0]} ${a.p1[1]} L ${a.p2[0]} ${a.p2[1]} L ${a.p3[0]} ${a.p3[1]} Z`}
          fill={a.i === peak ? C.purpleDeep : C.purple}
          fillOpacity={0.25 + a.v * 0.65}
        />
      ))}
      <SvgText x={cx} y={cy - 4} textAnchor="middle" fontFamily={FONT_SERIF_ITALIC} fontSize={11} fill={C.inkMute}>
        peak at
      </SvgText>
      <SvgText x={cx} y={cy + 16} textAnchor="middle" fontFamily={FONT_SERIF} fontSize={22} fill={C.ink}>
        {String(peak).padStart(2, "0")}:00
      </SvgText>
    </Svg>
  );
}

function VulnRow({ name, pct, emo, last }: { name: string; pct: number; emo: string; last: boolean }) {
  const color = emotionColor(emo);
  return (
    <View
      style={{
        flexDirection: "row",
        alignItems: "center",
        gap: 12,
        paddingVertical: 10,
        borderBottomWidth: last ? 0 : StyleSheet.hairlineWidth,
        borderBottomColor: C.ruleSoft,
      }}
    >
      <View style={{ flex: 1 }}>
        <Text style={{ fontSize: 13.5, fontWeight: "600", color: C.ink }}>{name}</Text>
        <Text style={{ fontSize: 11, color: C.inkSoft, marginTop: 2, fontFamily: FONT_SERIF_ITALIC }}>
          while feeling <Text style={{ color, fontWeight: "600" }}>{emo}</Text>
        </Text>
      </View>
      <View style={{ width: 80, height: 4, backgroundColor: C.ruleSoft, borderRadius: 2, overflow: "hidden" }}>
        <View style={{ width: `${pct}%`, height: 4, backgroundColor: color, borderRadius: 2 }} />
      </View>
      <Text style={{ width: 42, textAlign: "right", fontFamily: FONT_SERIF, fontSize: 16, color: C.ink }}>
        {pct}%
      </Text>
    </View>
  );
}

// ─── Editorial UI components ──────────────────────────────────────────────────

function InsHeader({ premium, period }: { premium: boolean; period: string }) {
  return (
    <View style={u.headerRow}>
      <View>
        <Text style={u.title}>insights</Text>
        <Text style={u.period}>{period}</Text>
      </View>
      {premium ? (
        <View style={u.premiumChip}>
          <Svg width={11} height={11} viewBox="0 0 24 24">
            <Path d="M12 2 L13 9 L20 10 L13 11 L12 18 L11 11 L4 10 L11 9 Z" fill={C.purpleDeep} />
          </Svg>
          <Text style={u.premiumChipText}>PREMIUM</Text>
        </View>
      ) : (
        <View style={{ padding: 6 }}>
          <Svg width={18} height={18} viewBox="0 0 24 24">
            <Path d="M4 6 L20 6" stroke={C.inkSoft} strokeWidth={1.6} strokeLinecap="round" />
            <Path d="M4 12 L20 12" stroke={C.inkSoft} strokeWidth={1.6} strokeLinecap="round" />
            <Path d="M4 18 L14 18" stroke={C.inkSoft} strokeWidth={1.6} strokeLinecap="round" />
          </Svg>
        </View>
      )}
    </View>
  );
}

function HeroLead({ d }: { d: VizData }) {
  if (!d.highEmo || d.highSpend === 0) return null;
  return (
    <View style={{ paddingHorizontal: 24, paddingTop: 14 }}>
      <Text style={u.eyebrow}>THE FINDING</Text>
      <Text style={u.heroLine}>
        Your{" "}
        <Text style={[u.heroEmo, { color: emotionColor(d.highEmo) }]}>{d.highEmo}</Text>{" "}
        purchases averaged{" "}
        <Text style={u.heroEmoNum}>€{d.highSpend}</Text>
        <Text style={{ color: C.inkSoft }}> — your </Text>
        <Text style={[u.heroEmo, { color: emotionColor(d.lowEmo) }]}>{d.lowEmo}</Text>{" "}
        ones <Text style={u.heroEmoNum}>€{d.lowSpend}</Text>.
      </Text>
    </View>
  );
}

function RiskBlock({ d }: { d: VizData }) {
  const label = d.riskScore < 2 ? "calm pattern —" :
    d.riskScore < 4 ? "mild risk —" :
    d.riskScore < 7 ? "elevated risk —" : "high risk —";
  const sub = d.weeklyPeak !== null
    ? `watch your\n${DOW_NAMES[d.weeklyPeak]}s.`
    : "track more days\nto see patterns.";
  return (
    <View style={{ paddingHorizontal: 24, paddingTop: 20 }}>
      <Text style={u.eyebrow}>IMPULSE RISK · 30 DAYS</Text>
      <View style={{ flexDirection: "row", alignItems: "flex-end", gap: 14, marginTop: 12 }}>
        <View style={{ width: 178, marginLeft: -14, marginBottom: -10 }}>
          <RiskArc score={d.riskScore} size={178} />
        </View>
        <View style={{ flex: 1, paddingBottom: 10 }}>
          <Text style={u.riskLabel}>{label}</Text>
          <Text style={u.riskSub}>{sub}</Text>
        </View>
      </View>
    </View>
  );
}

function StatsRow({
  totalSpend, txCount, topEmotion,
}: {
  totalSpend: number;
  txCount: number;
  topEmotion: string | null;
}) {
  return (
    <View style={{ paddingHorizontal: 24, paddingTop: 8 }}>
      <View style={{ height: StyleSheet.hairlineWidth, backgroundColor: C.rule, marginVertical: 14 }} />
      <View style={{ flexDirection: "row", gap: 8 }}>
        <View style={{ flex: 1 }}>
          <Text style={u.eyebrow}>SPENT</Text>
          <Text style={u.statValue}>€{Math.round(totalSpend)}</Text>
        </View>
        <View style={{ flex: 1 }}>
          <Text style={u.eyebrow}>PURCHASES</Text>
          <Text style={u.statValue}>{txCount}</Text>
        </View>
        <View style={{ flex: 1 }}>
          <Text style={u.eyebrow}>TOP MOOD</Text>
          <Text
            style={[
              u.statValue,
              { fontFamily: FONT_SERIF_ITALIC, color: topEmotion ? emotionColor(topEmotion) : C.ink },
            ]}
          >
            {topEmotion ?? "—"}
          </Text>
        </View>
      </View>
    </View>
  );
}

function FindingRow({ f, last }: { f: Insight; last: boolean }) {
  const [open, setOpen] = useState(false);
  const color = f.accentColor;
  return (
    <View style={{ borderBottomWidth: last ? 0 : StyleSheet.hairlineWidth, borderBottomColor: C.ruleSoft }}>
      <Pressable
        onPress={() => setOpen((o) => !o)}
        style={{ flexDirection: "row", alignItems: "flex-start", gap: 10, paddingVertical: 14 }}
      >
        <View style={{ width: 3, alignSelf: "stretch", minHeight: 28, borderRadius: 2, backgroundColor: color, marginTop: 2 }} />
        <View style={{ flex: 1 }}>
          <Text style={{ fontSize: 14, fontWeight: "600", color: C.ink, lineHeight: 19 }}>{f.title}</Text>
          {open && (
            <>
              <Text
                style={{
                  fontSize: 12.5,
                  color: C.inkSoft,
                  fontFamily: FONT_SERIF_ITALIC,
                  marginTop: 6,
                  lineHeight: 18,
                }}
              >
                {f.body}
              </Text>
              {f.actions.length > 0 && (
                <View style={{ marginTop: 10, gap: 6 }}>
                  {f.actions.map((a, i) => (
                    <View
                      key={i}
                      style={{
                        flexDirection: "row",
                        gap: 8,
                        paddingLeft: 8,
                        borderLeftWidth: 2,
                        borderLeftColor: color,
                      }}
                    >
                      <Text style={{ fontSize: 12, color: C.inkSoft, lineHeight: 17 }}>{a}</Text>
                    </View>
                  ))}
                </View>
              )}
              {f.score !== undefined && (
                <Text style={{ fontSize: 10.5, color, fontWeight: "600", marginTop: 8, letterSpacing: 0.4 }}>
                  IMPULSE SCORE · {f.score}/14
                </Text>
              )}
            </>
          )}
        </View>
        <Text
          style={{
            fontSize: 10,
            color: C.inkSoft,
            marginTop: 4,
            transform: [{ rotate: open ? "180deg" : "0deg" }],
          }}
        >
          ▼
        </Text>
      </Pressable>
    </View>
  );
}

function FindingsList({ findings }: { findings: Insight[] }) {
  return (
    <View style={{ paddingHorizontal: 24, marginTop: 22 }}>
      <View
        style={{
          flexDirection: "row",
          alignItems: "baseline",
          justifyContent: "space-between",
          paddingBottom: 6,
          borderBottomWidth: StyleSheet.hairlineWidth,
          borderBottomColor: C.paperEdge,
        }}
      >
        <Text style={u.sectionTitle}>what we found</Text>
        <Text style={{ fontSize: 10, color: C.inkMute, letterSpacing: 0.6 }}>
          {findings.length} signals
        </Text>
      </View>
      <View>
        {findings.map((f, i) => (
          <FindingRow key={f.id} f={f} last={i === findings.length - 1} />
        ))}
      </View>
    </View>
  );
}

function PremiumCard({
  title, subtitle, locked, onUnlock, denseHeader, children,
}: {
  title: string;
  subtitle?: string;
  locked: boolean;
  onUnlock: () => void;
  denseHeader?: boolean;
  children: React.ReactNode;
}) {
  return (
    <View style={u.premiumCard}>
      <View style={{ position: "absolute", top: 10, right: 10, opacity: 0.5 }}>
        <Svg width={18} height={18} viewBox="0 0 24 24">
          <Path d="M12 2 L13 9 L20 10 L13 11 L12 18 L11 11 L4 10 L11 9 Z" fill={C.purple} />
        </Svg>
      </View>

      <Text style={[u.premiumCardTitle, { marginBottom: denseHeader ? 6 : (subtitle ? 4 : 10) }]}>
        {title}
      </Text>
      {subtitle && (
        <Text style={u.premiumCardSubtitle}>{subtitle}</Text>
      )}

      <View style={{ opacity: locked ? 0.55 : 1 }} pointerEvents={locked ? "none" : "auto"}>
        {children}
      </View>

      {locked && (
        <View style={u.lockOverlay} pointerEvents="box-none">
          <BlurView
            intensity={14}
            tint="light"
            style={StyleSheet.absoluteFill}
          />
          <View style={u.lockGradient} pointerEvents="none" />
          <Pressable onPress={onUnlock} style={u.unlockBtn}>
            <Svg width={11} height={11} viewBox="0 0 24 24">
              <Rect x={5} y={11} width={14} height={10} rx={2} stroke={C.purpleDeep} strokeWidth={2.2} fill="none" />
              <Path d="M8 11 V8 a4 4 0 0 1 8 0 V11" stroke={C.purpleDeep} strokeWidth={2.2} fill="none" />
            </Svg>
            <Text style={u.unlockBtnText}>Unlock with Premium</Text>
          </Pressable>
        </View>
      )}
    </View>
  );
}

function DeeperAnalysis({
  d, premium, onUnlock, contentWidth,
}: {
  d: VizData;
  premium: boolean;
  onUnlock: () => void;
  contentWidth: number;
}) {
  const innerWidth = contentWidth - 24 * 2 - 16 * 2; // outer pad 24, card pad 16
  return (
    <View style={{ paddingHorizontal: 24, paddingTop: 24 }}>
      <View
        style={{
          flexDirection: "row",
          alignItems: "baseline",
          justifyContent: "space-between",
          paddingBottom: 6,
          borderBottomWidth: StyleSheet.hairlineWidth,
          borderBottomColor: C.paperEdge,
        }}
      >
        <Text style={u.sectionTitle}>deeper analysis</Text>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 5 }}>
          <View
            style={{
              width: 6,
              height: 6,
              borderRadius: 3,
              backgroundColor: premium ? "#5F7A4F" : C.purpleDeep,
            }}
          />
          <Text
            style={{
              fontSize: 9.5,
              letterSpacing: 0.6,
              color: premium ? "#5F7A4F" : C.purpleDeep,
              fontWeight: "600",
            }}
          >
            {premium ? "PREMIUM · ACTIVE" : "LOCKED"}
          </Text>
        </View>
      </View>

      <PremiumCard
        title="Emotion–spend correlation"
        subtitle="Pearson r between mood intensity and purchase amount."
        locked={!premium}
        onUnlock={onUnlock}
      >
        <CorrelationScatter points={d.scatter} r={d.pearsonR} width={innerWidth} />
        <Text style={u.cardFootnote}>
          {d.pearsonR > 0.35
            ? "A moderate positive correlation: as stress rises, so does the amount you spend."
            : d.pearsonR < -0.35
              ? "A negative link: you spend more when calm, less when stressed."
              : "Mood and spending move only weakly together — patterns vary."}
        </Text>
      </PremiumCard>

      <PremiumCard
        title="Your spending fingerprint"
        subtitle="Vector clustering across 8 emotion dimensions — uniquely yours."
        locked={!premium}
        onUnlock={onUnlock}
      >
        <View style={{ alignItems: "center" }}>
          <Fingerprint values={d.fingerprint} />
        </View>
      </PremiumCard>

      <PremiumCard
        title="Weekly rhythm"
        subtitle="Spend per day across the past 30 days, coloured by dominant emotion."
        locked={!premium}
        onUnlock={onUnlock}
      >
        <WeeklyPulse data={d.weekly} peakDay={d.weeklyPeak} width={innerWidth} />
        {d.weeklyPeak !== null && (
          <View style={u.peakNote}>
            <Text style={u.peakNoteText}>
              {DOW_NAMES[d.weeklyPeak]} is your highest-risk day — average spend{" "}
              <Text style={{ fontWeight: "700" }}>€{d.weekly[d.weeklyPeak].total}</Text>
              {" "}with{" "}
              <Text style={{ color: emotionColor(d.weekly[d.weeklyPeak].dominant), fontWeight: "700" }}>
                {d.weekly[d.weeklyPeak].dominant}
              </Text>
              {" "}dominant.
            </Text>
          </View>
        )}
      </PremiumCard>

      <PremiumCard
        title="Merchant vulnerability"
        subtitle="Places you are most likely to overspend at, given your mood."
        locked={!premium}
        onUnlock={onUnlock}
      >
        {d.vulnerable.length > 0 ? (
          d.vulnerable.map((v, i) => (
            <VulnRow key={i} {...v} last={i === d.vulnerable.length - 1} />
          ))
        ) : (
          <Text style={u.cardFootnote}>No vulnerable merchant patterns yet.</Text>
        )}
      </PremiumCard>

      <PremiumCard
        title="Circadian map"
        subtitle="Where your impulse purchases cluster across the 24-hour day."
        locked={!premium}
        onUnlock={onUnlock}
      >
        <View style={{ flexDirection: "row", alignItems: "center", gap: 14 }}>
          <HourRing hours={d.hours} />
          <View style={{ flex: 1 }}>
            <Text style={u.circadianHead}>
              Most of your risky spending happens between{" "}
              <Text style={{ color: C.purpleDeep }}>
                {String((() => {
                  let p = 0;
                  for (let i = 0; i < d.hours.length; i++) if (d.hours[i] > d.hours[p]) p = i;
                  return p;
                })()).padStart(2, "0")}:00 and {String((() => {
                  let p = 0;
                  for (let i = 0; i < d.hours.length; i++) if (d.hours[i] > d.hours[p]) p = i;
                  return (p + 2) % 24;
                })()).padStart(2, "0")}:00
              </Text>.
            </Text>
            <Text style={u.cardFootnote}>
              Setting a reminder before this window could prevent ~3 impulse purchases / week.
            </Text>
          </View>
        </View>
      </PremiumCard>

      <PremiumCard
        title="Next high-risk session"
        subtitle="Predicted from your last 30 days of behaviour."
        locked={!premium}
        onUnlock={onUnlock}
        denseHeader
      >
        <View style={u.nextRiskBox}>
          {d.nextRisk ? (
            <>
              <View style={{ flexDirection: "row", alignItems: "baseline", gap: 8 }}>
                <Text style={{ fontFamily: FONT_SERIF, fontSize: 22, color: C.purpleDeep }}>
                  {d.nextRisk.day}
                </Text>
                <Text style={{ fontFamily: FONT_SERIF_ITALIC, fontSize: 14, color: C.inkSoft }}>
                  {d.nextRisk.window}
                </Text>
              </View>
              <Text
                style={{
                  marginTop: 6,
                  fontFamily: FONT_SERIF_ITALIC,
                  fontSize: 13,
                  color: C.ink,
                  lineHeight: 18,
                }}
              >
                Probability of an impulse session:{" "}
                <Text style={{ fontWeight: "700", color: C.purpleDeep }}>
                  {d.nextRisk.probability}%
                </Text>
                . We will nudge you 20 minutes before it begins.
              </Text>
            </>
          ) : (
            <Text style={u.cardFootnote}>Need more high-risk samples to predict your next session.</Text>
          )}
        </View>
      </PremiumCard>
    </View>
  );
}

// ─── Floating premium pill ────────────────────────────────────────────────────
function PremiumPill({ onPress }: { onPress: () => void }) {
  return (
    <Pressable onPress={onPress} style={u.pillWrap}>
      <View style={u.pillIcon}>
        <Svg width={18} height={18} viewBox="0 0 24 24">
          <Path d="M12 2 L13 9 L20 10 L13 11 L12 18 L11 11 L4 10 L11 9 Z" fill="#fff" />
        </Svg>
      </View>
      <View style={{ flex: 1 }}>
        <Text style={u.pillTitle}>unlock the full report</Text>
        <Text style={u.pillSub}>vector analysis · behavioral clusters · €1.99/mo</Text>
      </View>
      <Svg width={18} height={18} viewBox="0 0 24 24">
        <Path d="M9 6 L15 12 L9 18" stroke={C.purpleDeep} strokeWidth={2} fill="none" strokeLinecap="round" strokeLinejoin="round" />
      </Svg>
    </Pressable>
  );
}

// ─── Footnote (premium) ───────────────────────────────────────────────────────
function Footnote() {
  return (
    <Text style={u.footnote}>
      Scores reflect your patterns — not judgements.{"\n"}
      Awared is here to help you understand the feeling,{"\n"}not shame the purchase.
    </Text>
  );
}

// ─── Paywall sheet ────────────────────────────────────────────────────────────
const PW_ROWS = [
  { free: "Impulse risk score", pro: "Vector behavioral fingerprint" },
  { free: "Emotion pattern flags", pro: "Pearson correlation engine" },
  { free: "Category breakdown", pro: "Merchant vulnerability mapping" },
  { free: "Late-night detection", pro: "Weekly rhythm + circadian map" },
  { free: "—", pro: "Predictive risk-session alerts" },
  { free: "—", pro: "Personalised coaching prompts" },
];

function PaywallSheet({
  visible, onClose, onUnlock,
}: {
  visible: boolean;
  onClose: () => void;
  onUnlock: () => void;
}) {
  const [shimmer] = useState(() => new Animated.Value(0));
  useEffect(() => {
    if (!visible) return;
    const loop = Animated.loop(
      Animated.timing(shimmer, {
        toValue: 1,
        duration: 2600,
        easing: Easing.linear,
        useNativeDriver: true,
      })
    );
    loop.start();
    return () => loop.stop();
  }, [visible, shimmer]);
  const shimmerX = shimmer.interpolate({
    inputRange: [0, 1],
    outputRange: [-260, 260],
  });

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <View style={pw.overlay}>
        <Pressable style={StyleSheet.absoluteFill} onPress={onClose} />
        <View style={pw.sheet}>
          <View style={pw.grainEdge} />
          <View style={pw.handleWrap}>
            <View style={pw.handle} />
          </View>

          <ScrollView
            contentContainerStyle={{ paddingHorizontal: 26, paddingBottom: 24 }}
            showsVerticalScrollIndicator={false}
          >
            <View style={pw.ribbon}>
              <Svg width={12} height={12} viewBox="0 0 24 24">
                <Path d="M12 2 L13 9 L20 10 L13 11 L12 18 L11 11 L4 10 L11 9 Z" fill={C.purpleDeep} />
              </Svg>
              <Text style={pw.ribbonText}>AWARED PREMIUM</Text>
            </View>

            <Text style={pw.headline}>
              See <Text style={{ color: C.purpleDeep }}>why</Text>{"\n"}
              you spend — not{"\n"}just{" "}
              <Text style={{ textDecorationLine: "underline" }}>that</Text> you did.
            </Text>

            <Text style={pw.lead}>
              Powered by vector similarity, Pearson correlation, and behavioral
              clustering — not rule-based flags.
            </Text>

            <View style={pw.table}>
              <View style={pw.tableHead}>
                <Text style={[pw.tableEyebrow, { color: C.inkMute }]}>FREE</Text>
                <Text style={[pw.tableEyebrow, { color: C.purpleDeep, letterSpacing: 1.8 }]}>
                  ✦  PREMIUM
                </Text>
              </View>
              {PW_ROWS.map((r, i) => (
                <View
                  key={i}
                  style={[
                    pw.tableRow,
                    i < PW_ROWS.length - 1 && {
                      borderBottomWidth: StyleSheet.hairlineWidth,
                      borderBottomColor: C.ruleSoft,
                    },
                  ]}
                >
                  <Text
                    style={[
                      pw.tableFreeCell,
                      {
                        color: r.free === "—" ? C.inkMute : C.inkSoft,
                        fontFamily: r.free === "—" ? FONT_SERIF_ITALIC : FONT_SERIF,
                      },
                    ]}
                  >
                    {r.free}
                  </Text>
                  <Text style={pw.tableProCell}>{r.pro}</Text>
                </View>
              ))}
            </View>

            <View style={pw.priceRow}>
              <Text style={pw.price}>€1.99</Text>
              <Text style={pw.priceMonth}>/ month</Text>
              <Text style={pw.cancel}>CANCEL ANYTIME</Text>
            </View>

            <Pressable style={pw.cta} onPress={onUnlock}>
              <Text style={pw.ctaText}>Unlock Awared Premium</Text>
              <Animated.View
                pointerEvents="none"
                style={[
                  pw.shimmer,
                  { transform: [{ translateX: shimmerX }] },
                ]}
              />
            </Pressable>

            <Pressable style={{ alignSelf: "center", marginTop: 12 }} onPress={onClose}>
              <Text style={pw.maybeLater}>maybe later</Text>
            </Pressable>
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

// ─── Main screen ──────────────────────────────────────────────────────────────

export default function Insights() {
  const [insights, setInsights] = useState<Insight[]>([]);
  const [vizData, setVizData] = useState<VizData | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [stats, setStats] = useState<{
    totalSpend: number; txCount: number; avgScore: number;
    topEmotion: string | null;
  } | null>(null);
  const [isPremium, setIsPremium] = useState(false);
  const [showPaywall, setShowPaywall] = useState(false);
  const [contentWidth, setContentWidth] = useState(SCREEN_WIDTH);

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
        setVizData(null);
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

      const emotionCounts: Record<string, { count: number }> = {};
      for (const tx of scored) {
        if (tx.emotion_name) {
          const k = tx.emotion_name.toLowerCase();
          if (!emotionCounts[k]) emotionCounts[k] = { count: 0 };
          emotionCounts[k].count++;
        }
      }
      const topEmotionEntry = Object.entries(emotionCounts)
        .sort((a, b) => b[1].count - a[1].count)[0];

      setStats({
        totalSpend,
        txCount: rows.length,
        avgScore,
        topEmotion: topEmotionEntry?.[0] ?? null,
      });

      const free = generateInsights(scored, avgSpend);
      // Premium insights are computed but rendered through visualisation cards;
      // ensure they run so any cached state from prior versions stays warm.
      generatePremiumInsights(scored, avgSpend);

      setInsights(free);
      setVizData(buildVizData(scored, avgSpend));
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

  const onRefresh = () => { setRefreshing(true); loadInsights(); };

  const period = "Last 30 days";

  return (
    <View
      style={u.root}
      onLayout={(e) => setContentWidth(e.nativeEvent.layout.width)}
    >
      <ScrollView
        contentContainerStyle={{ paddingBottom: isPremium ? 120 : 200 }}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={C.purpleDeep} />
        }
      >
        <InsHeader premium={isPremium} period={period} />

        {loading ? (
          <ActivityIndicator style={{ marginTop: 60 }} color={C.purpleDeep} size="large" />
        ) : (
          <>
            {vizData && <HeroLead d={vizData} />}
            {vizData && <RiskBlock d={vizData} />}
            {stats && (
              <StatsRow
                totalSpend={stats.totalSpend}
                txCount={stats.txCount}
                topEmotion={stats.topEmotion}
              />
            )}
            <FindingsList findings={insights} />
            {vizData && (
              <DeeperAnalysis
                d={vizData}
                premium={isPremium}
                onUnlock={() => setShowPaywall(true)}
                contentWidth={contentWidth}
              />
            )}
            {isPremium ? <Footnote /> : <View style={{ height: 96 }} />}
          </>
        )}
      </ScrollView>

      {!isPremium && !loading && (
        <PremiumPill onPress={() => setShowPaywall(true)} />
      )}

      <PaywallSheet
        visible={showPaywall}
        onClose={() => setShowPaywall(false)}
        onUnlock={() => {
          setIsPremium(true);
          setShowPaywall(false);
        }}
      />
    </View>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────
const u = StyleSheet.create({
  root: { flex: 1, backgroundColor: C.bg },

  headerRow: {
    flexDirection: "row",
    alignItems: "flex-end",
    justifyContent: "space-between",
    paddingHorizontal: 24,
    paddingTop: 60,
    paddingBottom: 6,
  },
  title: {
    fontFamily: FONT_SERIF_BOLD_ITALIC,
    fontSize: 32,
    letterSpacing: -0.3,
    color: C.ink,
    lineHeight: 36,
  },
  period: {
    fontFamily: FONT_SERIF_ITALIC,
    fontSize: 13,
    color: C.inkMute,
    marginTop: 2,
  },
  premiumChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    paddingHorizontal: 9,
    paddingVertical: 5,
    borderRadius: 999,
    backgroundColor: "rgba(126,100,179,0.10)",
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: "rgba(126,100,179,0.30)",
  },
  premiumChipText: {
    fontSize: 9.5,
    letterSpacing: 1.6,
    color: C.purpleDeep,
    fontWeight: "600",
  },

  eyebrow: {
    fontSize: 10.5,
    letterSpacing: 1.8,
    color: C.inkMute,
    fontWeight: "500",
    textTransform: "uppercase",
  },

  heroLine: {
    fontFamily: FONT_SERIF_BOLD,
    fontSize: 26,
    lineHeight: 32,
    letterSpacing: -0.3,
    color: C.ink,
    marginTop: 10,
  },
  heroEmo: {
    fontFamily: FONT_SERIF_BOLD_ITALIC,
  },
  heroEmoNum: {
    fontFamily: FONT_SERIF_BOLD_ITALIC,
    color: C.ink,
  },

  riskLabel: {
    fontFamily: FONT_SERIF_BOLD_ITALIC,
    fontSize: 22,
    lineHeight: 25,
    color: C.ink,
    letterSpacing: -0.2,
  },
  riskSub: {
    fontFamily: FONT_SERIF_ITALIC,
    fontSize: 16,
    lineHeight: 20,
    color: C.inkSoft,
    marginTop: 4,
  },

  statValue: {
    fontSize: 24,
    fontFamily: FONT_SERIF,
    color: C.ink,
    marginTop: 5,
  },

  sectionTitle: {
    fontFamily: FONT_SERIF_BOLD_ITALIC,
    fontSize: 22,
    color: C.ink,
  },

  premiumCard: {
    position: "relative",
    marginTop: 14,
    padding: 16,
    paddingTop: 14,
    backgroundColor: C.panel,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: C.rule,
    borderRadius: 18,
    overflow: "hidden",
  },
  premiumCardTitle: {
    fontSize: 13.5,
    fontWeight: "600",
    color: C.ink,
    paddingRight: 28,
  },
  premiumCardSubtitle: {
    fontFamily: FONT_SERIF_ITALIC,
    fontSize: 12,
    color: C.inkSoft,
    marginBottom: 12,
    lineHeight: 17,
  },

  lockOverlay: {
    position: "absolute",
    left: 0,
    right: 0,
    top: 0,
    bottom: 0,
    justifyContent: "flex-end",
    alignItems: "center",
    paddingBottom: 18,
  },
  lockGradient: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(250,246,239,0.55)",
  },
  unlockBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 16,
    paddingVertical: 9,
    borderRadius: 999,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: "rgba(126,100,179,0.45)",
    backgroundColor: "rgba(255,253,247,0.92)",
    shadowColor: C.purpleDeep,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.16,
    shadowRadius: 12,
    elevation: 6,
  },
  unlockBtnText: {
    fontSize: 12.5,
    fontWeight: "600",
    letterSpacing: 0.3,
    color: C.purpleDeep,
  },

  cardFootnote: {
    marginTop: 8,
    fontFamily: FONT_SERIF_ITALIC,
    fontSize: 12,
    color: C.inkSoft,
    lineHeight: 17,
  },

  peakNote: {
    marginTop: 10,
    paddingVertical: 8,
    paddingHorizontal: 10,
    borderRadius: 8,
    backgroundColor: "rgba(155,130,201,0.10)",
  },
  peakNoteText: {
    fontFamily: FONT_SERIF_ITALIC,
    fontSize: 12,
    color: C.ink,
    lineHeight: 17,
  },

  circadianHead: {
    fontFamily: FONT_SERIF_BOLD_ITALIC,
    fontSize: 16,
    lineHeight: 20,
    color: C.ink,
  },

  nextRiskBox: {
    padding: 14,
    backgroundColor: "rgba(155,130,201,0.10)",
    borderRadius: 12,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: "rgba(126,100,179,0.40)",
    borderStyle: "dashed",
  },

  pillWrap: {
    position: "absolute",
    left: 16,
    right: 16,
    bottom: 108,
    padding: 14,
    paddingLeft: 16,
    borderRadius: 18,
    backgroundColor: "rgba(255,251,243,0.96)",
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: "rgba(126,100,179,0.30)",
    shadowColor: "#1F1B16",
    shadowOffset: { width: 0, height: 14 },
    shadowOpacity: 0.14,
    shadowRadius: 32,
    elevation: 18,
  },
  pillIcon: {
    width: 36,
    height: 36,
    borderRadius: 12,
    backgroundColor: C.purple,
    alignItems: "center",
    justifyContent: "center",
    shadowColor: C.purpleDeep,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.3,
    shadowRadius: 14,
  },
  pillTitle: {
    fontFamily: FONT_SERIF_BOLD_ITALIC,
    fontSize: 16,
    color: C.ink,
    lineHeight: 18,
  },
  pillSub: {
    fontSize: 11,
    color: C.inkSoft,
    marginTop: 2,
  },

  footnote: {
    paddingHorizontal: 24,
    paddingTop: 22,
    paddingBottom: 18,
    fontFamily: FONT_SERIF_ITALIC,
    fontSize: 11,
    color: C.inkMute,
    textAlign: "center",
    lineHeight: 17,
  },
});

const pw = StyleSheet.create({
  overlay: {
    flex: 1,
    justifyContent: "flex-end",
    backgroundColor: "rgba(31,27,22,0.42)",
  },
  sheet: {
    backgroundColor: C.bg,
    borderTopLeftRadius: 32,
    borderTopRightRadius: 32,
    overflow: "hidden",
    maxHeight: SCREEN_HEIGHT * 0.92,
    paddingBottom: 22,
    shadowColor: "#1F1B16",
    shadowOffset: { width: 0, height: -16 },
    shadowOpacity: 0.18,
    shadowRadius: 40,
    elevation: 20,
  },
  grainEdge: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    height: 1,
    backgroundColor: "rgba(155,130,201,0.45)",
  },
  handleWrap: {
    alignItems: "center",
    paddingTop: 10,
    paddingBottom: 8,
  },
  handle: {
    width: 36,
    height: 4,
    borderRadius: 4,
    backgroundColor: "rgba(31,27,22,0.18)",
  },

  ribbon: {
    alignSelf: "flex-start",
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 999,
    backgroundColor: "rgba(126,100,179,0.10)",
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: "rgba(126,100,179,0.30)",
    marginTop: 4,
  },
  ribbonText: {
    fontSize: 10,
    letterSpacing: 2,
    color: C.purpleDeep,
    fontWeight: "600",
  },

  headline: {
    fontFamily: FONT_SERIF_BOLD_ITALIC,
    fontSize: 32,
    lineHeight: 36,
    letterSpacing: -0.4,
    color: C.ink,
    marginTop: 14,
  },
  lead: {
    marginTop: 12,
    fontSize: 13.5,
    color: C.inkSoft,
    fontFamily: FONT_SERIF_ITALIC,
    lineHeight: 19,
  },

  table: {
    marginTop: 22,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderColor: C.rule,
  },
  tableHead: {
    flexDirection: "row",
    paddingVertical: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: C.rule,
  },
  tableEyebrow: {
    flex: 1,
    fontSize: 10.5,
    letterSpacing: 1.8,
    fontWeight: "600",
    textTransform: "uppercase",
  },
  tableRow: {
    flexDirection: "row",
    paddingVertical: 9,
  },
  tableFreeCell: {
    flex: 1,
    fontSize: 12.5,
  },
  tableProCell: {
    flex: 1,
    fontSize: 12.5,
    color: C.purpleDeep,
    fontWeight: "600",
    fontFamily: FONT_SERIF,
  },

  priceRow: {
    flexDirection: "row",
    alignItems: "baseline",
    gap: 8,
    marginTop: 18,
    marginBottom: 6,
  },
  price: {
    fontFamily: FONT_SERIF,
    fontSize: 38,
    color: C.ink,
  },
  priceMonth: {
    fontFamily: FONT_SERIF_BOLD_ITALIC,
    fontSize: 16,
    color: C.inkSoft,
  },
  cancel: {
    marginLeft: "auto",
    fontSize: 10.5,
    letterSpacing: 1.4,
    color: C.inkMute,
  },

  cta: {
    marginTop: 12,
    paddingVertical: 15,
    paddingHorizontal: 16,
    borderRadius: 14,
    backgroundColor: C.purpleDeep,
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
    shadowColor: C.purpleDeep,
    shadowOffset: { width: 0, height: 14 },
    shadowOpacity: 0.34,
    shadowRadius: 28,
    elevation: 10,
  },
  ctaText: {
    color: "#fff",
    fontSize: 15.5,
    fontWeight: "600",
    letterSpacing: 0.3,
  },
  shimmer: {
    position: "absolute",
    top: 0,
    bottom: 0,
    width: 90,
    backgroundColor: "rgba(255,255,255,0.18)",
    transform: [{ skewX: "-20deg" }],
  },

  maybeLater: {
    fontFamily: FONT_SERIF_ITALIC,
    fontSize: 13.5,
    color: C.inkSoft,
  },
});
