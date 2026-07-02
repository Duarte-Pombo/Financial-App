import React, { useState, useCallback } from "react";
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
} from "react-native";
import { useFocusEffect } from "expo-router";
import { useAuth } from "../context/AuthContext";
import { apiFetch } from "@/api";


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

type AiInsight = {
  type: "pattern" | "warning" | "tip" | "positive";
  title: string;
  body: string;
  actions: string[];
};

type AiInsightsState =
  | { status: "idle" }
  | { status: "loading" }
  | { status: "success"; data: AiInsight[]; latencyMs: number }
  | { status: "error"; message: string; retryable: boolean };

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

// ─── Design tokens (matches the rest of the app) ─────────────────────────────
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
  danger: "#C24A3A",
  dangerSoft: "rgba(194,74,58,0.10)",
  amber: "#A0742A",
  amberSoft: "rgba(160,116,42,0.10)",
  green: "#3A7C5E",
  greenSoft: "rgba(58,124,94,0.10)",
};

// Map insight types to the editorial palette
const AI_INSIGHT_STYLE: Record<
  AiInsight["type"],
  { icon: string; accentColor: string; bgColor: string }
> = {
  warning: { icon: "·", accentColor: C.danger, bgColor: C.dangerSoft },
  pattern: { icon: "·", accentColor: C.purpleDeep, bgColor: C.purpleSoft },
  tip: { icon: "·", accentColor: C.amber, bgColor: C.amberSoft },
  positive: { icon: "·", accentColor: C.green, bgColor: C.greenSoft },
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

/**
 * Maps a transaction to a 6-dimensional feature vector:
 * [emotionPolarity, emotionEnergy, hourOfDay, dayOfWeek, relativeAmount, categoryRisk]
 * All dimensions normalised to [0, 1].
 */
function toFeatureVector(tx: RawTransaction, avgAmount: number): number[] {
  const polarity = tx.emotion_polarity ?? 0;
  const energy = tx.emotion_energy ?? 5;
  const date = new Date(tx.transacted_at);
  const hour = date.getHours();
  const dow = date.getDay();
  const catRisk = tx.category_name ? (CATEGORY_WEIGHTS[tx.category_name] ?? 1) : 1;
  return [
    (polarity + 5) / 10,                            // 0–1  (negative = low)
    (energy - 1) / 9,                               // 0–1
    hour / 23,                                       // 0–1
    dow / 6,                                         // 0–1
    Math.min(tx.amount / Math.max(avgAmount * 4, 1), 1), // 0–1 capped
    catRisk / 3,                                     // 0–1 (max weight is 3)
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

/** Element-wise mean of a set of vectors */
function computeCentroid(vectors: number[][]): number[] {
  if (vectors.length === 0) return [];
  const dim = vectors[0].length;
  const centroid = new Array(dim).fill(0);
  for (const v of vectors) {
    for (let i = 0; i < dim; i++) centroid[i] += v[i];
  }
  return centroid.map((x) => x / vectors.length);
}

/** Pearson product-moment correlation coefficient */
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

function generateInsights(scored: ScoredTransaction[], avgSpend: number, currency: string): Insight[] {
  const insights: Insight[] = [];

  if (scored.length === 0) {
    insights.push({
      id: "no-data", type: "tip",
      title: "Nothing to analyse yet",
      body: "Add a few purchases to start seeing insights about your spending patterns.",
      icon: "·", accentColor: C.purpleDeep, bgColor: C.purpleSoft,
      actions: ["Log your first purchase"],
    });
    return insights;
  }

  // ── Dynamic context variables ──────────────────────────────────────────────
  const totalSpend = scored.reduce((s, t) => s + t.amount, 0);
  const computedAvg = totalSpend / scored.length;
  const topMerchants = (() => {
    const counts: Record<string, number> = {};
    scored.forEach((t) => { if (t.merchant_name) counts[t.merchant_name] = (counts[t.merchant_name] ?? 0) + 1; });
    return Object.entries(counts).sort((a, b) => b[1] - a[1]);
  })();
  const frequentMerchant = topMerchants[0]?.[0] ?? null;

  // ── 1. High-risk transactions ──────────────────────────────────────────────
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
      icon: "·", accentColor: C.danger, bgColor: C.dangerSoft, score: top.impulseScore,
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
      icon: "·", accentColor: C.amber, bgColor: C.amberSoft,
      actions: [
        "Ask yourself: would I make this same purchase tomorrow morning?",
        "Try logging your emotion before spending, not just after",
      ],
    });
  }

  // ── 2. Dominant negative emotion ──────────────────────────────────────────
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

    // Craft a merchant-aware sentence if we have one
    const merchantSentence = frequentMerchant
      ? ` Purchases at ${frequentMerchant} are among the most common outlets.`
      : "";

    insights.push({
      id: "emotion-trigger", type: "pattern",
      title: `${topData.emoji} ${topEmotion} is your top spending trigger`,
      body: `You've made ${topData.count} purchase${topData.count > 1 ? "s" : ""} while feeling ${topEmotion.toLowerCase()}, totalling ${currency}${topData.totalAmount.toFixed(2)}.${merchantSentence} Emotional spending loops often start here.`,
      icon: "·", accentColor: C.purpleDeep, bgColor: C.purpleSoft,
      actions: [
        `When you feel ${topEmotion.toLowerCase()}, try journaling for 5 minutes first`,
        "Notice: does this emotion always lead to spending in the same category?",
        "Set a personal rule for purchases made during this state",
      ],
    });
  }

  // ── 3. Late-night spending pattern ──────────────────────────────────────────
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
      body: `${lateNight.length} of your purchases happened after 9 PM, totalling ${currency}${lateTotal.toFixed(2)}. Your peak hour is ${peakHour}:00 — when willpower research says inhibition is at its lowest.`,
      icon: "·", accentColor: C.purpleDeep, bgColor: C.purpleSoft,
      actions: [
        "Enable Do Not Disturb mode after 10 PM on shopping apps",
        `Add a screen lock on payment apps between ${peakHour}:00 and ${(peakHour + 2) % 24}:00`,
        "Log how you feel before any purchase after 9 PM",
      ],
    });
  }

  // ── 4. Top high-impulse category ──────────────────────────────────────────
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
        title: `${catData.icon} ${catName} is your biggest spend`,
        body: `You've spent ${currency}${catData.total.toFixed(2)} across ${catData.count} purchase${catData.count > 1 ? "s" : ""} in ${catName} (avg ${currency}${perPurchase} each). This category carries elevated impulse risk.`,
        icon: "·", accentColor: C.purpleDeep, bgColor: C.purpleSoft,
        actions: [
          `Set a weekly cap of ${currency}${(catData.total * 0.75).toFixed(0)} for ${catName}`,
          "Review if each purchase here was planned or spontaneous",
          "Try a 1-week challenge: log the urge before you spend here",
        ],
      });
    }
  }

  // ── 5. Above-average purchases ────────────────────────────────────────────
  const bigPurchases = scored.filter((t) => t.amount > computedAvg * 2);
  if (bigPurchases.length > 0) {
    const bigTotal = bigPurchases.reduce((s, t) => s + t.amount, 0);
    insights.push({
      id: "big-purchases", type: "tip",
      title: "Above-average purchases flagged",
      body: `${bigPurchases.length} transaction${bigPurchases.length > 1 ? "s were" : " was"} more than 2× your average (${currency}${computedAvg.toFixed(2)}), totalling ${currency}${bigTotal.toFixed(2)}. These carry the highest financial risk when made impulsively.`,
      icon: "·", accentColor: C.amber, bgColor: C.amberSoft,
      actions: [
        `For purchases over ${currency}${(computedAvg * 2).toFixed(0)}, sleep on it before buying`,
        "Keep a 'big purchase wishlist' — revisit it after 72 hours",
      ],
    });
  }

  // ── 6. Positive reinforcement ──────────────────────────────────────────────
  const healthyTxs = scored.filter((t) => t.impulseScore <= 2 && t.emotion_category !== "negative");
  if (healthyTxs.length >= 3) {
    insights.push({
      id: "positive", type: "positive",
      title: "You're spending mindfully 🎉",
      body: `${healthyTxs.length} of your recent purchases showed low impulse risk and balanced emotional states — ${((healthyTxs.length / scored.length) * 100).toFixed(0)}% of your total. That's intentional spending in action.`,
      icon: "·", accentColor: C.green, bgColor: C.greenSoft,
      actions: [
        "Notice what makes these purchases feel different — write it down",
        "This is what your spending looks like at its best",
      ],
    });
  }

  return insights;
}

// ─── Premium insight generation ───────────────────────────────────────────────

function generatePremiumInsights(scored: ScoredTransaction[], avgSpend: number, currency: string): Insight[] {
  const insights: Insight[] = [];

  if (scored.length < 3) {
    insights.push({
      id: "premium-insufficient", type: "tip",
      title: "Need more data for vector analysis",
      body: "Log at least 3 purchases to unlock premium vector insights. The more you log, the more precise your behavioral profile becomes.",
      icon: "·", accentColor: C.purpleDeep, bgColor: C.purpleSoft, actions: [],
    });
    return insights;
  }

  const vectors = scored.map((tx) => toFeatureVector(tx, avgSpend));

  // ── P1. Emotion–spend correlation (Pearson) ────────────────────────────────
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
        icon: "·", accentColor: r < -0.3 ? "#dc2626" : "#7c3aed",
        bgColor: r < -0.3 ? "#fef2f2" : "#f5f3ff",
        actions: [
          r < -0.3
            ? `When you're feeling low, set a ${currency}${(avgSpend * 0.6).toFixed(0)} soft cap for the next 2 hours`
            : "Track spending before and after emotional highs to detect reward loops",
          "Log your emotion *before* opening your wallet — the act alone reduces impulse rates",
          "Compare your mood score to your daily spend total at week's end",
        ],
      });
    }
  }

  // ── P2. High-risk cluster fingerprint (cosine similarity centroid) ─────────
  const highRiskTxs = scored.filter((t) => t.impulseScore >= 6);
  if (highRiskTxs.length >= 2) {
    const hrVectors = highRiskTxs.map((tx) => toFeatureVector(tx, avgSpend));
    const centroid = computeCentroid(hrVectors);

    // Decode centroid back to human-readable dimensions
    const centroidPolarity = centroid[0] * 10 - 5;
    const centroidEnergy = centroid[1] * 9 + 1;
    const centroidHour = Math.round(centroid[2] * 23);
    const centroidDow = Math.round(centroid[3] * 6);
    const centroidAmount = centroid[4] * avgSpend * 4;

    // How consistent is this cluster? Compute average intra-cluster cosine similarity
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
      body: `Vector clustering of your ${highRiskTxs.length} riskiest transactions (cluster coherence: ${coherence}%) reveals a repeating pattern: ${energyDesc} ${emotionDesc} state, ${HOUR_LABELS(centroidHour)} on ${DOW_NAMES[centroidDow]}s, averaging ${currency}${centroidAmount.toFixed(2)} per purchase. This is your personal risk archetype.`,
      icon: "·", accentColor: C.purpleDeep, bgColor: C.purpleSoft,
      actions: [
        `On ${DOW_NAMES[centroidDow]} ${HOUR_LABELS(centroidHour)}s, activate a spending cooldown automatically`,
        `Set a hard limit of ${currency}${(centroidAmount * 0.6).toFixed(0)} for any single purchase during your risk window`,
        "Use this fingerprint as your personal warning sign — if these three factors align, pause first",
      ],
    });
  }

  // ── P3. Weekly rhythm analysis ─────────────────────────────────────────────
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
      body: `Weekly rhythm analysis shows ${DOW_NAMES[riskiest.dow]} averages a risk score of ${riskiest.avgRisk.toFixed(1)} — ${riskRatio}× higher than ${DOW_NAMES[safest.dow]} (${safest.avgRisk.toFixed(1)}), your calmest day. Average spend on your risk day: ${currency}${riskiest.avgAmount.toFixed(2)}.`,
      icon: "·", accentColor: C.purpleDeep, bgColor: C.purpleSoft,
      actions: [
        `Set a strict daily cap of ${currency}${(riskiest.avgAmount * 1.2).toFixed(0)} every ${DOW_NAMES[riskiest.dow]}`,
        `Schedule something grounding on ${DOW_NAMES[riskiest.dow]}s to reduce emotional pressure`,
        `Use ${DOW_NAMES[safest.dow]} to review any ${DOW_NAMES[riskiest.dow]} purchases and decide if you'd repeat them`,
      ],
    });
  }

  // ── P4. Merchant vulnerability mapping ────────────────────────────────────
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
      body: `Merchant vulnerability analysis: ${top.name} has an average emotional polarity of ${top.avgPolarity.toFixed(1)}/5 at visit time (vulnerability score: ${vulnerabilityScore}/100). Across ${top.count} visits you've spent ${currency}${top.totalAmount.toFixed(2)} — ${currency}${top.avgAmount.toFixed(2)} per visit on average.`,
      icon: "·", accentColor: C.amber, bgColor: C.amberSoft,
      actions: [
        `Apply a 15-minute rule before visiting ${top.name} when feeling negative`,
        "This merchant may be serving an emotional need — identify the feeling it satisfies",
        `Try a ${currency}${(top.avgAmount * 0.6).toFixed(0)} spending cap when visiting ${top.name} in a low mood`,
      ],
    });
  }

  // ── P5. Behavioral similarity — predict next risk session ─────────────────
  if (scored.length >= 5 && vectors.length >= 5) {
    const highRiskVectors = scored
      .filter((t) => t.impulseScore >= 7)
      .map((tx) => toFeatureVector(tx, avgSpend));

    if (highRiskVectors.length >= 1) {
      const hrCentroid = computeCentroid(highRiskVectors);
      const recentTxs = scored.slice(0, 3); // 3 most recent
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
          icon: "·", accentColor: C.danger, bgColor: C.dangerSoft,
          actions: [
            "This is the window where a 10-minute pause has the highest ROI",
            "Check in with your emotional state before your next purchase today",
            `Consider setting a ${currency}0 intention for the next 2 hours`,
          ],
        });
      }
    }
  }

  return insights;
}

// ─── Locked preview cards (shown to free users) ───────────────────────────────
const LOCKED_PREVIEWS = [
  {
    title: "Emotion–spend correlation",
    sub: "Pearson analysis of mood vs purchase amount",
    icon: "·",
  },
  {
    title: "Your high-risk spending fingerprint",
    sub: "Vector clustering of your riskiest sessions",
    icon: "·",
  },
  {
    title: "Weekly rhythm & merchant vulnerability",
    sub: "Day-of-week patterns + merchant risk mapping",
    icon: "·",
  },
];

// ─── Upgrade modal ────────────────────────────────────────────────────────────

const FEATURE_ROWS = [
  { free: "Impulse risk scoring", premium: "Vector-based behavioral fingerprint" },
  { free: "Emotion pattern detection", premium: "Pearson correlation engine" },
  { free: "Category breakdown", premium: "Merchant vulnerability mapping" },
  { free: "Late-night detection", premium: "Weekly rhythm analysis" },
  { free: "—", premium: "Predictive risk session alerts" },
];

function UpgradeModal({
  visible,
  onClose,
  onUpgrade,
  currency,
}: {
  visible: boolean;
  onClose: () => void;
  onUpgrade: () => void;
  currency: string;
}) {
  return (
    <Modal visible={visible} animationType="slide" transparent presentationStyle="overFullScreen">
      <View style={ms.overlay}>
        <Pressable style={ms.backdrop} onPress={onClose} />
        <View style={ms.sheet}>
          <View style={ms.handle} />

          {/* Badge */}
          <View style={ms.badge}>
            <Text style={ms.badgeText}>✨  AWARED PREMIUM</Text>
          </View>

          <Text style={ms.headline}>{"Understand your spending\nat a deeper level"}</Text>
          <Text style={ms.sub}>
            Powered by vector similarity, Pearson correlation, and behavioral clustering — not just rule-based flags.
          </Text>

          {/* Feature table */}
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

          {/* CTA */}
          <TouchableOpacity style={ms.cta} onPress={onUpgrade} activeOpacity={0.85}>
            <Text style={ms.ctaText}>Unlock for {currency}1.99 / month</Text>
          </TouchableOpacity>

          <TouchableOpacity onPress={onClose} style={ms.dismissBtn}>
            <Text style={ms.dismissText}>Maybe later</Text>
          </TouchableOpacity>

          <Text style={ms.legal}>Cancel anytime · No commitments · Billed monthly</Text>
        </View>
      </View>
    </Modal>
  );
}

// ─── AI Section Fetch Logic & Components ──────────────────────────────────────

async function fetchAiInsights(
  scored: ScoredTransaction[],
  setAiInsights: React.Dispatch<React.SetStateAction<AiInsightsState>>,
  signal?: AbortSignal
): Promise<void> {
  setAiInsights({ status: "loading" });

  try {
    const json = await apiFetch<{
      ok: boolean;
      insights: AiInsight[];
      meta?: { modelLatencyMs: number };
      error?: string;
      retryable?: boolean;
    }>("/api/insights/analyze", {
      method: "POST",
      body: JSON.stringify({ transactions: scored }),
      signal,
    });

    if (!json.ok) {
      setAiInsights({
        status: "error",
        message: json.error ?? "Something went wrong. Please try again.",
        retryable: json.retryable ?? false,
      });
      return;
    }

    setAiInsights({
      status: "success",
      data: json.insights,
      latencyMs: json.meta?.modelLatencyMs ?? 0,
    });

  } catch (err: unknown) {
    if ((err as Error).name === "AbortError") return; // component unmounted

    setAiInsights({
      status: "error",
      message: "Could not reach the analysis server. Check your connection.",
      retryable: true,
    });
  }
}

function AiInsightsSection({
  state,
  onRetry,
  expanded,
  onToggle,
}: {
  state: AiInsightsState;
  onRetry: () => void;
  expanded: string | null;
  onToggle: (id: string) => void;
}) {
  if (state.status === "idle") return null;

  return (
    <View style={{ marginTop: 4 }}>
      {/* Section header */}
      <View style={aiStyles.sectionHeader}>
        <Text style={aiStyles.sectionTitle}>AI behavioral analysis</Text>
        {state.status === "success" && (
          <Text style={aiStyles.latencyBadge}>
            {(state.latencyMs / 1000).toFixed(1)}s
          </Text>
        )}
      </View>

      {state.status === "loading" && (
        <View style={aiStyles.loadingCard}>
          <ActivityIndicator color="#7c3aed" />
          <Text style={aiStyles.loadingText}>
            Analysing your emotional spending patterns…
          </Text>
        </View>
      )}

      {state.status === "error" && (
        <View style={aiStyles.errorCard}>
          <Text style={aiStyles.errorText}>{state.message}</Text>
          {state.retryable && (
            <Pressable style={aiStyles.retryBtn} onPress={onRetry}>
              <Text style={aiStyles.retryText}>Try again</Text>
            </Pressable>
          )}
        </View>
      )}

      {state.status === "success" &&
        state.data.map((insight, i) => {
          const style = AI_INSIGHT_STYLE[insight.type];
          const cardId = `ai_${i}`;
          const isOpen = expanded === cardId;

          return (
            <Pressable
              key={cardId}
              style={[
                aiStyles.card,
                { backgroundColor: style.bgColor, borderLeftColor: style.accentColor },
              ]}
              onPress={() => onToggle(cardId)}
            >
              <View style={aiStyles.cardHeader}>
                <View
                  style={[
                    aiStyles.iconBadge,
                    { backgroundColor: style.accentColor + "18" },
                  ]}
                >
                  <View style={[s.iconDot, { backgroundColor: style.accentColor }]} />
                </View>
                <View style={aiStyles.cardTitleBlock}>
                  <Text style={aiStyles.cardTitle}>{insight.title}</Text>
                  <Text style={[aiStyles.aiBadge, { color: style.accentColor }]}>
                    AI · Human-grade
                  </Text>
                </View>
                <Text style={[aiStyles.chevron, { color: style.accentColor }]}>
                  {isOpen ? "▲" : "▼"}
                </Text>
              </View>

              {isOpen && (
                <View style={aiStyles.cardBody}>
                  <Text style={aiStyles.cardBodyText}>{insight.body}</Text>
                  {insight.actions.length > 0 && (
                    <View style={aiStyles.actionsBlock}>
                      {insight.actions.map((action, j) => (
                        <View
                          key={j}
                          style={[
                            aiStyles.actionRow,
                            { borderLeftColor: style.accentColor },
                          ]}
                        >
                          <Text style={aiStyles.actionText}>{action}</Text>
                        </View>
                      ))}
                    </View>
                  )}
                </View>
              )}
            </Pressable>
          );
        })}
    </View>
  );
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function Insights() {
  const { userId, currencyCode } = useAuth();
  const [insights, setInsights] = useState<Insight[]>([]);
  const [premiumInsights, setPremiumInsights] = useState<Insight[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [currency, setCurrency] = useState<string>("€");
  const [stats, setStats] = useState<{
    totalSpend: number; txCount: number; avgScore: number;
    topEmotion: string | null; topEmoji: string | null;
  } | null>(null);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [isPremium, setIsPremium] = useState(true);
  const [showUpgradeModal, setShowUpgradeModal] = useState(false);

  const [aiInsights, setAiInsights] = useState<AiInsightsState>({ status: "idle" });
  const [lastScored, setLastScored] = useState<ScoredTransaction[]>([]);

  const loadInsights = useCallback(async () => {
    if (!userId) return;   // not logged in yet, AuthContext is still loading

    try {
      // ── 1. Fetch enriched transactions from the server ──────────────────────
      const data = await apiFetch<{ ok: boolean; transactions: RawTransaction[] }>(
        `/api/transactions/insights?user_id=${userId}`
      );

      const rows = data.transactions ?? [];
      const userCurrency = currencyCode ?? "€";
      setCurrency(userCurrency);

      if (rows.length === 0) {
        setInsights(generateInsights([], AVG_SPEND, userCurrency));
        setPremiumInsights([]);
        setStats(null);
        return;
      }

      // ── 2. Score transactions (same logic as before) ────────────────────────
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

      setLastScored(scored);

      const avgScore = scored.reduce((s, t) => s + t.impulseScore, 0) / scored.length;

      const emotionCounts: Record<string, { count: number; emoji: string | null }> = {};
      for (const tx of scored) {
        if (tx.emotion_name) {
          if (!emotionCounts[tx.emotion_name])
            emotionCounts[tx.emotion_name] = { count: 0, emoji: tx.emotion_emoji };
          emotionCounts[tx.emotion_name].count++;
        }
      }
      const topEmotionEntry = Object.entries(emotionCounts)
        .sort((a, b) => b[1].count - a[1].count)[0];

      setStats({
        totalSpend,
        txCount: rows.length,
        avgScore,
        topEmotion: topEmotionEntry?.[0] ?? null,
        topEmoji: topEmotionEntry?.[1].emoji ?? null,
      });

      setInsights(generateInsights(scored, avgSpend, userCurrency));
      setPremiumInsights(generatePremiumInsights(scored, avgSpend, userCurrency));

      // ── 3. Trigger AI insights if premium + enough data ─────────────────────
      if (isPremium && scored.length >= 3) {
        fetchAiInsights(scored, setAiInsights);
      }
    } catch (err) {
      console.error("[insights]", err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [userId, currencyCode, isPremium]);

  const onRefresh = () => { setRefreshing(true); loadInsights(); };

  function scoreZoneLabel(avg: number): { label: string; color: string } {
    if (avg < 3) return { label: "healthy pattern", color: C.green };
    if (avg < 6) return { label: "mild impulse risk", color: C.amber };
    if (avg < 9) return { label: "emotional spending", color: C.danger };
    return { label: "high-risk pattern", color: C.danger };
  }

  const renderInsightCard = (insight: Insight) => {
    const isOpen = expanded === insight.id;
    return (
      <Pressable
        key={insight.id}
        style={[s.card, { borderLeftColor: insight.accentColor }]}
        onPress={() => setExpanded(isOpen ? null : insight.id)}
      >
        <View style={s.cardHeader}>
          <View style={[s.iconBadge, { backgroundColor: insight.accentColor + "18" }]}>
            <View style={[s.iconDot, { backgroundColor: insight.accentColor }]} />
          </View>
          <View style={s.cardTitleBlock}>
            <Text style={s.cardTitle}>{insight.title}</Text>
            {insight.score !== undefined && (
              <Text style={[s.scoreBadge, { color: insight.accentColor }]}>
                Score {insight.score}/14
              </Text>
            )}
          </View>
          <Text style={[s.chevron, { color: C.inkMute }]}>
            {isOpen ? "▲" : "▼"}
          </Text>
        </View>

        {isOpen && (
          <View style={s.cardBody}>
            <Text style={s.cardBodyText}>{insight.body}</Text>
            <View style={s.actionsBlock}>
              {insight.actions.map((action, i) => (
                <View key={i} style={[s.actionRow, { borderLeftColor: insight.accentColor }]}>
                  <Text style={s.actionText}>{action}</Text>
                </View>
              ))}
            </View>
          </View>
        )}
      </Pressable>
    );
  };

  return (
    <View style={s.root}>
      <ScrollView
        contentContainerStyle={s.scrollContent}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={C.purpleDeep} />
        }
      >
        {/* ── Header ── */}
        <View style={s.header}>
          <Text style={s.headerKicker}>INSIGHTS</Text>
          <Text style={s.headerTitle}>your patterns,{"\n"}laid bare.</Text>
          <Text style={s.headerSub}>last 30 days</Text>
        </View>

        {loading ? (
          <View style={s.loadingWrap}>
            <ActivityIndicator color={C.purpleDeep} size="large" />
            <Text style={s.loadingText}>reading your patterns…</Text>
          </View>
        ) : (
          <>
            {/* ── Stats strip ── */}
            {stats && (
              <View style={s.statsStrip}>
                <View style={s.statCard}>
                  <Text style={s.statValue}>{currency}{stats.totalSpend.toFixed(0)}</Text>
                  <Text style={s.statLabel}>total spent</Text>
                </View>
                <View style={s.statDivider} />
                <View style={s.statCard}>
                  <Text style={s.statValue}>{stats.txCount}</Text>
                  <Text style={s.statLabel}>purchases</Text>
                </View>
                <View style={s.statDivider} />
                <View style={s.statCard}>
                  <Text style={[s.statValue, { color: scoreZoneLabel(stats.avgScore).color }]}>
                    {stats.avgScore.toFixed(1)}
                  </Text>
                  <Text style={s.statLabel}>avg risk</Text>
                </View>
                {stats.topEmotion && (
                  <>
                    <View style={s.statDivider} />
                    <View style={s.statCard}>
                      <Text style={s.statValue}>{stats.topEmoji ?? "—"}</Text>
                      <Text style={s.statLabel}>{stats.topEmotion}</Text>
                    </View>
                  </>
                )}
              </View>
            )}

            {/* ── Zone pill ── */}
            {stats && (
              <View style={[s.zonePill, { backgroundColor: scoreZoneLabel(stats.avgScore).color + "18" }]}>
                <View style={[s.zoneDot, { backgroundColor: scoreZoneLabel(stats.avgScore).color }]} />
                <Text style={[s.zoneLabel, { color: scoreZoneLabel(stats.avgScore).color }]}>
                  {scoreZoneLabel(stats.avgScore).label}
                </Text>
              </View>
            )}

            {/* ── Free insight cards ── */}
            <Text style={s.sectionTitle}>what we found</Text>
            {insights.map(renderInsightCard)}

            {/* ── Premium section ── */}
            <View style={s.premiumSectionHeader}>
              <Text style={s.sectionTitle}>
                {isPremium ? "premium analysis" : "premium analysis"}
              </Text>
              {isPremium ? (
                <View style={[s.badge, { backgroundColor: C.greenSoft }]}>
                  <Text style={[s.badgeText, { color: C.green }]}>active</Text>
                </View>
              ) : (
                <View style={[s.badge, { backgroundColor: C.purpleSoft }]}>
                  <Text style={[s.badgeText, { color: C.purpleDeep }]}>locked</Text>
                </View>
              )}
            </View>

            {isPremium ? (
              <>
                {premiumInsights.map(renderInsightCard)}
                <AiInsightsSection
                  state={aiInsights}
                  onRetry={() => fetchAiInsights(lastScored, setAiInsights)}
                  expanded={expanded}
                  onToggle={(id) => setExpanded(expanded === id ? null : id)}
                />
              </>
            ) : (
              <>
                {LOCKED_PREVIEWS.map((card, i) => (
                  <Pressable
                    key={i}
                    style={s.lockedCard}
                    onPress={() => setShowUpgradeModal(true)}
                  >
                    <View style={s.lockedLeft}>
                      <View style={s.lockedIconWrap}>
                        <View style={[s.iconDot, { backgroundColor: C.purpleDeep }]} />
                      </View>
                      <View style={s.lockedTextWrap}>
                        <Text style={s.lockedTitle}>{card.title}</Text>
                        <Text style={s.lockedSub}>{card.sub}</Text>
                      </View>
                    </View>
                    <View style={s.lockedCTA}>
                      <Text style={s.lockedCTAText}>Unlock</Text>
                    </View>
                  </Pressable>
                ))}
                <Text style={s.premiumTeaser}>
                  Vector algorithms · Pearson correlation · Merchant vulnerability maps
                </Text>
              </>
            )}

            {/* ── Footer ── */}
            <Text style={s.footer}>
              Scores reflect your patterns — not judgements. Awared is here to help you
              understand the feeling, not shame the purchase.
            </Text>
          </>
        )}
      </ScrollView>

      {/* ── Sticky upgrade banner ── */}
      {!isPremium && !loading && (
        <Pressable style={s.upgradeBanner} onPress={() => setShowUpgradeModal(true)}>
          <View style={{ flex: 1 }}>
            <Text style={s.upgradeBannerTitle}>Unlock Premium Insights</Text>
            <Text style={s.upgradeBannerSub}>Vector analysis · Behavioral clusters</Text>
          </View>
          <View style={s.upgradeBannerBtn}>
            <Text style={s.upgradeBannerBtnText}>{currency}1.99 / mo</Text>
          </View>
        </Pressable>
      )}

      <UpgradeModal
        visible={showUpgradeModal}
        onClose={() => setShowUpgradeModal(false)}
        onUpgrade={() => {
          setIsPremium(true);
          setShowUpgradeModal(false);
          if (lastScored.length >= 3) fetchAiInsights(lastScored, setAiInsights);
        }}
        currency={currency}
      />
    </View>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────
const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: C.bg },
  scrollContent: {
    paddingHorizontal: 20, paddingTop: 56, paddingBottom: 140,
  },

  // Header
  header: { marginBottom: 24 },
  headerKicker: {
    fontFamily: "Manrope_600SemiBold", fontSize: 11, color: C.inkMute,
    letterSpacing: 1.6, marginBottom: 6,
  },
  headerTitle: {
    fontFamily: "PlayfairDisplay_700Bold_Italic", fontSize: 32,
    color: C.ink, letterSpacing: -0.4, lineHeight: 38,
  },
  headerSub: {
    fontFamily: "PlayfairDisplay_400Regular_Italic", fontSize: 14,
    color: C.inkMute, marginTop: 4,
  },

  // Loading
  loadingWrap: { alignItems: "center", paddingTop: 60, gap: 14 },
  loadingText: {
    fontFamily: "PlayfairDisplay_400Regular_Italic", fontSize: 15, color: C.inkMute,
  },

  // Stats strip — single card, horizontal rule dividers
  statsStrip: {
    flexDirection: "row", backgroundColor: C.panel, borderRadius: 18,
    borderWidth: 1, borderColor: C.rule,
    paddingVertical: 14, paddingHorizontal: 8,
    marginBottom: 12, alignItems: "center",
  },
  statCard: { flex: 1, alignItems: "center" },
  statDivider: { width: 1, height: 32, backgroundColor: C.rule },
  statValue: {
    fontFamily: "LibreCaslonText_700Bold", fontSize: 18, color: C.ink, letterSpacing: -0.4,
  },
  statLabel: {
    fontFamily: "Manrope_400Regular", fontSize: 10, color: C.inkMute,
    marginTop: 2, textAlign: "center",
  },

  // Zone pill
  zonePill: {
    flexDirection: "row", alignItems: "center", alignSelf: "flex-start",
    borderRadius: 20, paddingVertical: 5, paddingHorizontal: 12,
    marginBottom: 24, gap: 6,
  },
  zoneDot: { width: 7, height: 7, borderRadius: 4 },
  zoneLabel: {
    fontFamily: "Manrope_600SemiBold", fontSize: 12,
  },

  // Section title
  sectionTitle: {
    fontFamily: "PlayfairDisplay_400Regular_Italic", fontSize: 14,
    color: C.inkSoft, letterSpacing: 0.3, marginBottom: 10,
  },

  // Insight card
  card: {
    backgroundColor: C.panel, borderRadius: 18, borderWidth: 1,
    borderColor: C.rule, borderLeftWidth: 3,
    padding: 14, marginBottom: 10,
  },
  cardHeader: { flexDirection: "row", alignItems: "center", gap: 10 },
  iconBadge: {
    width: 36, height: 36, borderRadius: 18,
    alignItems: "center", justifyContent: "center", flexShrink: 0,
  },
  iconDot: { width: 10, height: 10, borderRadius: 5 },
  cardTitleBlock: { flex: 1 },
  cardTitle: {
    fontFamily: "Manrope_600SemiBold", fontSize: 14, color: C.ink, lineHeight: 19,
  },
  scoreBadge: {
    fontFamily: "Manrope_400Regular", fontSize: 11, marginTop: 2,
  },
  chevron: { fontSize: 10, paddingLeft: 4 },
  cardBody: { marginTop: 12, paddingTop: 12, borderTopWidth: 1, borderTopColor: C.ruleSoft },
  cardBodyText: {
    fontFamily: "Manrope_400Regular", fontSize: 13, color: C.inkSoft,
    lineHeight: 20, marginBottom: 12,
  },
  actionsBlock: { gap: 6 },
  actionRow: {
    borderLeftWidth: 2, paddingLeft: 10, paddingVertical: 5,
    backgroundColor: C.ruleSoft, borderRadius: 4,
  },
  actionText: {
    fontFamily: "Manrope_400Regular", fontSize: 12, color: C.inkSoft, lineHeight: 17,
  },

  // Premium section header
  premiumSectionHeader: {
    flexDirection: "row", alignItems: "center",
    justifyContent: "space-between", marginTop: 16, marginBottom: 10,
  },
  badge: { borderRadius: 10, paddingHorizontal: 9, paddingVertical: 3 },
  badgeText: { fontFamily: "Manrope_600SemiBold", fontSize: 11 },

  // Locked cards
  lockedCard: {
    flexDirection: "row", alignItems: "center", justifyContent: "space-between",
    backgroundColor: C.panel, borderRadius: 18, borderWidth: 1,
    borderColor: C.rule, borderStyle: "dashed",
    padding: 14, marginBottom: 10,
  },
  lockedLeft: { flexDirection: "row", alignItems: "center", gap: 10, flex: 1 },
  lockedIconWrap: {
    width: 36, height: 36, borderRadius: 18, backgroundColor: C.purpleSoft,
    alignItems: "center", justifyContent: "center",
  },
  lockedIcon: { fontSize: 16 },
  lockedTextWrap: { flex: 1 },
  lockedTitle: { fontFamily: "Manrope_600SemiBold", fontSize: 13, color: C.purpleDeep },
  lockedSub: { fontFamily: "Manrope_400Regular", fontSize: 11, color: C.inkMute, marginTop: 2 },
  lockedCTA: {
    backgroundColor: C.purpleDeep, borderRadius: 10,
    paddingHorizontal: 12, paddingVertical: 6,
  },
  lockedCTAText: { fontFamily: "Manrope_700Bold", fontSize: 12, color: "#fff" },

  premiumTeaser: {
    fontFamily: "PlayfairDisplay_400Regular_Italic", fontSize: 11,
    color: C.inkMute, textAlign: "center", marginTop: 4, marginBottom: 16,
  },

  // Footer
  footer: {
    fontFamily: "PlayfairDisplay_400Regular_Italic", fontSize: 11,
    color: C.inkMute, textAlign: "center", lineHeight: 17,
    marginTop: 16, paddingHorizontal: 10,
  },

  // Sticky upgrade banner
  upgradeBanner: {
    position: "absolute", bottom: 0, left: 0, right: 0,
    flexDirection: "row", alignItems: "center", justifyContent: "space-between",
    backgroundColor: C.purpleDeep,
    paddingHorizontal: 20, paddingTop: 14, paddingBottom: 28,
    shadowColor: C.purpleDeep, shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.25, shadowRadius: 12, elevation: 10,
  },
  upgradeBannerTitle: {
    fontFamily: "PlayfairDisplay_700Bold_Italic", fontSize: 15, color: "#fff",
  },
  upgradeBannerSub: {
    fontFamily: "Manrope_400Regular", fontSize: 11,
    color: "rgba(255,255,255,0.65)", marginTop: 2,
  },
  upgradeBannerBtn: {
    backgroundColor: "#fff", borderRadius: 12,
    paddingHorizontal: 14, paddingVertical: 8,
  },
  upgradeBannerBtnText: {
    fontFamily: "Manrope_700Bold", fontSize: 13, color: C.purpleDeep,
  },
});

// ─── Modal styles ─────────────────────────────────────────────────────────────
const ms = StyleSheet.create({
  overlay: { flex: 1, justifyContent: "flex-end", backgroundColor: "rgba(0,0,0,0.45)" },
  backdrop: { ...StyleSheet.absoluteFillObject },
  sheet: {
    backgroundColor: C.panel, borderTopLeftRadius: 28, borderTopRightRadius: 28,
    paddingHorizontal: 24, paddingTop: 12, paddingBottom: 40,
    maxHeight: SCREEN_HEIGHT * 0.88,
  },
  handle: {
    width: 36, height: 4, borderRadius: 2, backgroundColor: C.rule,
    alignSelf: "center", marginBottom: 20,
  },
  badge: {
    alignSelf: "center", backgroundColor: C.purpleSoft,
    borderRadius: 20, paddingHorizontal: 14, paddingVertical: 5, marginBottom: 16,
  },
  badgeText: {
    fontFamily: "Manrope_700Bold", fontSize: 12, color: C.purpleDeep, letterSpacing: 1,
  },
  headline: {
    fontFamily: "PlayfairDisplay_700Bold_Italic", fontSize: 24, color: C.ink,
    textAlign: "center", lineHeight: 32, marginBottom: 8,
  },
  sub: {
    fontFamily: "Manrope_400Regular", fontSize: 13, color: C.inkSoft,
    textAlign: "center", lineHeight: 19, marginBottom: 20,
  },
  table: {
    borderRadius: 14, overflow: "hidden", marginBottom: 20,
    borderWidth: 1, borderColor: C.rule,
  },
  tableHeader: { flexDirection: "row", backgroundColor: C.purpleSoft, paddingVertical: 8 },
  tableColHead: {
    fontFamily: "Manrope_700Bold", fontSize: 12, color: C.purpleDeep, textAlign: "center",
  },
  tablePremiumHead: { color: C.purpleDeep },
  tableRow: { flexDirection: "row", paddingVertical: 9, paddingHorizontal: 4 },
  tableRowAlt: { backgroundColor: C.bg },
  tableCol: {
    flex: 1, fontFamily: "Manrope_400Regular", fontSize: 12,
    color: C.inkSoft, textAlign: "center", paddingHorizontal: 6,
  },
  tableColFree: { color: C.inkMute },
  tableColPremium: { color: C.purpleDeep, fontFamily: "Manrope_600SemiBold" },
  cta: {
    backgroundColor: C.purpleDeep, borderRadius: 16,
    paddingVertical: 16, alignItems: "center", marginBottom: 12,
    shadowColor: C.purpleDeep, shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3, shadowRadius: 8, elevation: 5,
  },
  ctaText: {
    fontFamily: "PlayfairDisplay_700Bold_Italic", fontSize: 17, color: "#fff", letterSpacing: 0.2,
  },
  dismissBtn: { alignItems: "center", paddingVertical: 10, marginBottom: 4 },
  dismissText: { fontFamily: "Manrope_400Regular", fontSize: 14, color: C.inkMute },
  legal: {
    fontFamily: "Manrope_400Regular", fontSize: 10, color: C.inkMute, textAlign: "center",
  },
});

// ─── AI Section Styles ────────────────────────────────────────────────────────
const aiStyles = StyleSheet.create({
  sectionHeader: {
    flexDirection: "row", alignItems: "center",
    justifyContent: "space-between", marginBottom: 10, marginTop: 8,
  },
  sectionTitle: {
    fontFamily: "PlayfairDisplay_400Regular_Italic", fontSize: 14,
    color: C.inkSoft, letterSpacing: 0.3,
  },
  latencyBadge: {
    fontFamily: "Manrope_400Regular", fontSize: 11, color: C.inkMute, fontStyle: "italic",
  },
  loadingCard: {
    flexDirection: "row", alignItems: "center", gap: 12,
    backgroundColor: C.purpleSoft, borderRadius: 18,
    borderWidth: 1, borderColor: C.rule,
    padding: 16, marginBottom: 10,
  },
  loadingText: {
    fontFamily: "PlayfairDisplay_400Regular_Italic", fontSize: 13,
    color: C.purpleDeep, flex: 1,
  },
  errorCard: {
    backgroundColor: C.dangerSoft, borderRadius: 18, borderWidth: 1,
    borderColor: C.rule, borderLeftWidth: 3, borderLeftColor: C.danger,
    padding: 14, marginBottom: 10, gap: 10,
  },
  errorText: {
    fontFamily: "Manrope_400Regular", fontSize: 13, color: C.danger, lineHeight: 19,
  },
  retryBtn: {
    alignSelf: "flex-start", backgroundColor: C.danger,
    borderRadius: 8, paddingHorizontal: 12, paddingVertical: 6,
  },
  retryText: { fontFamily: "Manrope_700Bold", fontSize: 12, color: "#fff" },
  card: {
    backgroundColor: C.panel, borderRadius: 18, borderWidth: 1,
    borderColor: C.rule, borderLeftWidth: 3,
    padding: 14, marginBottom: 10,
  },
  cardHeader: { flexDirection: "row", alignItems: "center", gap: 10 },
  iconBadge: {
    width: 36, height: 36, borderRadius: 18,
    alignItems: "center", justifyContent: "center", flexShrink: 0,
  },
  iconText: { fontSize: 16 },
  cardTitleBlock: { flex: 1 },
  cardTitle: {
    fontFamily: "Manrope_600SemiBold", fontSize: 14, color: C.ink, lineHeight: 19,
  },
  aiBadge: {
    fontFamily: "Manrope_400Regular", fontSize: 10, marginTop: 2, letterSpacing: 0.3,
  },
  chevron: { fontSize: 10, paddingLeft: 4 },
  cardBody: { marginTop: 12, paddingTop: 12, borderTopWidth: 1, borderTopColor: C.ruleSoft },
  cardBodyText: {
    fontFamily: "Manrope_400Regular", fontSize: 13, color: C.inkSoft,
    lineHeight: 20, marginBottom: 12,
  },
  actionsBlock: { gap: 6 },
  actionRow: {
    borderLeftWidth: 2, paddingLeft: 10, paddingVertical: 5,
    backgroundColor: C.ruleSoft, borderRadius: 4,
  },
  actionText: {
    fontFamily: "Manrope_400Regular", fontSize: 12, color: C.inkSoft, lineHeight: 17,
  },
});
