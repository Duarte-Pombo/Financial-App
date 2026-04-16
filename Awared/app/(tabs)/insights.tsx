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
import { getDb } from "../../database/db";

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

function generateInsights(scored: ScoredTransaction[], avgSpend: number): Insight[] {
  const insights: Insight[] = [];

  if (scored.length === 0) {
    insights.push({
      id: "no-data", type: "tip",
      title: "Nothing to analyse yet",
      body: "Add a few purchases to start seeing insights about your spending patterns.",
      icon: "📊", accentColor: "#6b21a8", bgColor: "#f3e8ff",
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
      icon: "⚠️", accentColor: "#dc2626", bgColor: "#fef2f2", score: top.impulseScore,
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
      icon: "〰️", accentColor: "#b45309", bgColor: "#fefce8",
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
      body: `You've made ${topData.count} purchase${topData.count > 1 ? "s" : ""} while feeling ${topEmotion.toLowerCase()}, totalling €${topData.totalAmount.toFixed(2)}.${merchantSentence} Emotional spending loops often start here.`,
      icon: topData.emoji, accentColor: "#7c3aed", bgColor: "#f5f3ff",
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
      body: `${lateNight.length} of your purchases happened after 9 PM, totalling €${lateTotal.toFixed(2)}. Your peak hour is ${peakHour}:00 — when willpower research says inhibition is at its lowest.`,
      icon: "🌙", accentColor: "#1d4ed8", bgColor: "#eff6ff",
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
        body: `You've spent €${catData.total.toFixed(2)} across ${catData.count} purchase${catData.count > 1 ? "s" : ""} in ${catName} (avg €${perPurchase} each). This category carries elevated impulse risk.`,
        icon: catData.icon, accentColor: "#0369a1", bgColor: "#f0f9ff",
        actions: [
          `Set a weekly cap of €${(catData.total * 0.75).toFixed(0)} for ${catName}`,
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
      body: `${bigPurchases.length} transaction${bigPurchases.length > 1 ? "s were" : " was"} more than 2× your average (€${computedAvg.toFixed(2)}), totalling €${bigTotal.toFixed(2)}. These carry the highest financial risk when made impulsively.`,
      icon: "💸", accentColor: "#b45309", bgColor: "#fff7ed",
      actions: [
        `For purchases over €${(computedAvg * 2).toFixed(0)}, sleep on it before buying`,
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
      icon: "✅", accentColor: "#059669", bgColor: "#ecfdf5",
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
      icon: "📡", accentColor: "#7c3aed", bgColor: "#f5f3ff", actions: [],
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
        icon: "📈", accentColor: r < -0.3 ? "#dc2626" : "#7c3aed",
        bgColor: r < -0.3 ? "#fef2f2" : "#f5f3ff",
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
      body: `Vector clustering of your ${highRiskTxs.length} riskiest transactions (cluster coherence: ${coherence}%) reveals a repeating pattern: ${energyDesc} ${emotionDesc} state, ${HOUR_LABELS(centroidHour)} on ${DOW_NAMES[centroidDow]}s, averaging €${centroidAmount.toFixed(2)} per purchase. This is your personal risk archetype.`,
      icon: "🧬", accentColor: "#7c3aed", bgColor: "#f5f3ff",
      actions: [
        `On ${DOW_NAMES[centroidDow]} ${HOUR_LABELS(centroidHour)}s, activate a spending cooldown automatically`,
        `Set a hard limit of €${(centroidAmount * 0.6).toFixed(0)} for any single purchase during your risk window`,
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
      body: `Weekly rhythm analysis shows ${DOW_NAMES[riskiest.dow]} averages a risk score of ${riskiest.avgRisk.toFixed(1)} — ${riskRatio}× higher than ${DOW_NAMES[safest.dow]} (${safest.avgRisk.toFixed(1)}), your calmest day. Average spend on your risk day: €${riskiest.avgAmount.toFixed(2)}.`,
      icon: "📅", accentColor: "#0369a1", bgColor: "#f0f9ff",
      actions: [
        `Set a strict daily cap of €${(riskiest.avgAmount * 1.2).toFixed(0)} every ${DOW_NAMES[riskiest.dow]}`,
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
      body: `Merchant vulnerability analysis: ${top.name} has an average emotional polarity of ${top.avgPolarity.toFixed(1)}/5 at visit time (vulnerability score: ${vulnerabilityScore}/100). Across ${top.count} visits you've spent €${top.totalAmount.toFixed(2)} — €${top.avgAmount.toFixed(2)} per visit on average.`,
      icon: "🏪", accentColor: "#b45309", bgColor: "#fff7ed",
      actions: [
        `Apply a 15-minute rule before visiting ${top.name} when feeling negative`,
        "This merchant may be serving an emotional need — identify the feeling it satisfies",
        `Try a €${(top.avgAmount * 0.6).toFixed(0)} spending cap when visiting ${top.name} in a low mood`,
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
          icon: "🔮", accentColor: "#dc2626", bgColor: "#fef2f2",
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

// ─── Locked preview cards (shown to free users) ───────────────────────────────
const LOCKED_PREVIEWS = [
  {
    title: "Emotion–spend correlation",
    sub: "Pearson analysis of mood vs purchase amount",
    icon: "📈",
  },
  {
    title: "Your high-risk spending fingerprint",
    sub: "Vector clustering of your riskiest sessions",
    icon: "🧬",
  },
  {
    title: "Weekly rhythm & merchant vulnerability",
    sub: "Day-of-week patterns + merchant risk mapping",
    icon: "📅",
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
            <Text style={ms.ctaText}>Unlock for €1.99 / month</Text>
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

// ─── Component ────────────────────────────────────────────────────────────────

export default function Insights() {
  const [insights, setInsights] = useState<Insight[]>([]);
  const [premiumInsights, setPremiumInsights] = useState<Insight[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [stats, setStats] = useState<{
    totalSpend: number; txCount: number; avgScore: number;
    topEmotion: string | null; topEmoji: string | null;
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
      const topEmotionEntry = Object.entries(emotionCounts)
        .sort((a, b) => b[1].count - a[1].count)[0];

      setStats({
        totalSpend, txCount: rows.length, avgScore,
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

  const onRefresh = () => { setRefreshing(true); loadInsights(); };

  function scoreZoneLabel(avg: number): { label: string; color: string } {
    if (avg < 3) return { label: "Healthy pattern", color: "#059669" };
    if (avg < 6) return { label: "Mild impulse risk", color: "#b45309" };
    if (avg < 9) return { label: "Emotional spending", color: "#dc2626" };
    return { label: "High-risk pattern", color: "#7f1d1d" };
  }

  const renderInsightCard = (insight: Insight) => {
    const isOpen = expanded === insight.id;
    return (
      <Pressable
        key={insight.id}
        style={[styles.card, { backgroundColor: insight.bgColor, borderLeftColor: insight.accentColor }]}
        onPress={() => setExpanded(isOpen ? null : insight.id)}
      >
        <View style={styles.cardHeader}>
          <View style={[styles.iconBadge, { backgroundColor: insight.accentColor + "20" }]}>
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
                <View key={i} style={[styles.actionRow, { borderLeftColor: insight.accentColor }]}>
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
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#7c3aed" />
        }
      >
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.headerTitle}>Insights</Text>
          <Text style={styles.headerSub}>Last 30 days</Text>
        </View>

        {loading ? (
          <ActivityIndicator style={{ marginTop: 60 }} color="#7c3aed" size="large" />
        ) : (
          <>
            {/* Stats strip */}
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
                  <Text style={[styles.statValue, { color: scoreZoneLabel(stats.avgScore).color }]}>
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

            {/* Zone pill */}
            {stats && (
              <View style={[styles.zonePill, { backgroundColor: scoreZoneLabel(stats.avgScore).color + "20" }]}>
                <View style={[styles.zoneDot, { backgroundColor: scoreZoneLabel(stats.avgScore).color }]} />
                <Text style={[styles.zoneLabel, { color: scoreZoneLabel(stats.avgScore).color }]}>
                  {scoreZoneLabel(stats.avgScore).label}
                </Text>
              </View>
            )}

            {/* Free insight cards */}
            <Text style={styles.sectionTitle}>What we found</Text>
            {insights.map(renderInsightCard)}

            {/* ── Premium section ── */}
            <View style={styles.premiumSectionHeader}>
              <View style={styles.premiumSectionLeft}>
                <Text style={styles.sectionTitle}>
                  {isPremium ? "Premium Analysis" : "Premium Analysis"}
                </Text>
                {!isPremium && (
                  <View style={styles.premiumLockBadge}>
                    <Text style={styles.premiumLockBadgeText}>🔒 Locked</Text>
                  </View>
                )}
              </View>
              {isPremium && (
                <View style={styles.premiumActiveBadge}>
                  <Text style={styles.premiumActiveBadgeText}>✨ Active</Text>
                </View>
              )}
            </View>

            {isPremium ? (
              // Full premium cards
              premiumInsights.map(renderInsightCard)
            ) : (
              // Locked preview cards
              <>
                {LOCKED_PREVIEWS.map((card, i) => (
                  <Pressable
                    key={i}
                    style={styles.lockedCard}
                    onPress={() => setShowUpgradeModal(true)}
                  >
                    <View style={styles.lockedLeft}>
                      <View style={styles.lockedIconWrap}>
                        <Text style={styles.lockedIcon}>{card.icon}</Text>
                      </View>
                      <View style={styles.lockedTextWrap}>
                        <Text style={styles.lockedTitle}>{card.title}</Text>
                        <Text style={styles.lockedSub}>{card.sub}</Text>
                      </View>
                    </View>
                    <View style={styles.lockedCTA}>
                      <Text style={styles.lockedCTAText}>Unlock</Text>
                    </View>
                  </Pressable>
                ))}
                <Text style={styles.premiumTeaser}>
                  Vector algorithms · Pearson correlation · Merchant vulnerability maps
                </Text>
              </>
            )}

            {/* Footer */}
            <Text style={styles.footer}>
              Scores reflect your patterns — not judgements. Awared is here to help you
              understand the feeling, not shame the purchase.
            </Text>
          </>
        )}
      </ScrollView>

      {/* Sticky bottom upgrade bar */}
      {!isPremium && !loading && (
        <Pressable style={styles.upgradeBanner} onPress={() => setShowUpgradeModal(true)}>
          <View style={styles.upgradeBannerLeft}>
            <Text style={styles.upgradeBannerTitle}>✨ Unlock Premium Insights</Text>
            <Text style={styles.upgradeBannerSub}>Vector analysis · Behavioral clusters</Text>
          </View>
          <View style={styles.upgradeBannerBtn}>
            <Text style={styles.upgradeBannerBtnText}>€1.99 / mo</Text>
          </View>
        </Pressable>
      )}

      {/* Upgrade modal */}
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

// ─── Styles ───────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#fdf3ff" },
  scrollContent: {
    paddingHorizontal: 20, paddingTop: 60, paddingBottom: 140,
    maxWidth: 480, alignSelf: "center", width: "100%",
  },

  // Header
  header: { marginBottom: 20 },
  headerTitle: { fontSize: 28, fontWeight: "700", color: "#1a1a1a", letterSpacing: -0.5 },
  headerSub: { fontSize: 13, color: "#888", marginTop: 2 },

  // Stats
  statsStrip: { flexDirection: "row", gap: 8, marginBottom: 12, flexWrap: "wrap" },
  statCard: {
    flex: 1, minWidth: 70, backgroundColor: "#fff", borderRadius: 14,
    padding: 12, alignItems: "center",
    shadowColor: "#c4a8e0", shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.12, shadowRadius: 6, elevation: 2,
  },
  statValue: { fontSize: 20, fontWeight: "700", color: "#1a1a1a" },
  statLabel: { fontSize: 10, color: "#999", marginTop: 2, textAlign: "center" },

  // Zone pill
  zonePill: {
    flexDirection: "row", alignItems: "center", alignSelf: "flex-start",
    borderRadius: 20, paddingVertical: 5, paddingHorizontal: 12,
    marginBottom: 24, gap: 6,
  },
  zoneDot: { width: 7, height: 7, borderRadius: 4 },
  zoneLabel: { fontSize: 12, fontWeight: "600" },

  // Section title
  sectionTitle: {
    fontSize: 14, fontWeight: "600", color: "#555",
    textTransform: "uppercase", letterSpacing: 0.6, marginBottom: 12,
  },

  // Insight card
  card: {
    borderRadius: 16, borderLeftWidth: 3, padding: 14, marginBottom: 12,
    shadowColor: "#000", shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05, shadowRadius: 4, elevation: 1,
  },
  cardHeader: { flexDirection: "row", alignItems: "center", gap: 10 },
  iconBadge: { width: 36, height: 36, borderRadius: 18, alignItems: "center", justifyContent: "center", flexShrink: 0 },
  iconText: { fontSize: 16 },
  cardTitleBlock: { flex: 1 },
  cardTitle: { fontSize: 14, fontWeight: "600", color: "#1a1a1a", lineHeight: 19 },
  scoreBadge: { fontSize: 11, fontWeight: "500", marginTop: 2 },
  chevron: { fontSize: 10, paddingLeft: 4 },
  cardBody: { marginTop: 12, paddingTop: 12, borderTopWidth: 0.5, borderTopColor: "#00000015" },
  cardBodyText: { fontSize: 13, color: "#444", lineHeight: 20, marginBottom: 12 },
  actionsBlock: { gap: 6 },
  actionRow: { borderLeftWidth: 2, paddingLeft: 10, paddingVertical: 5, backgroundColor: "#00000008", borderRadius: 4 },
  actionText: { fontSize: 12, color: "#555", lineHeight: 17 },

  // Premium section header
  premiumSectionHeader: {
    flexDirection: "row", alignItems: "center", justifyContent: "space-between",
    marginTop: 12, marginBottom: 0,
  },
  premiumSectionLeft: { flexDirection: "row", alignItems: "center", gap: 8 },
  premiumLockBadge: { backgroundColor: "#f3e8ff", borderRadius: 10, paddingHorizontal: 8, paddingVertical: 2 },
  premiumLockBadgeText: { fontSize: 11, color: "#7c3aed", fontWeight: "600" },
  premiumActiveBadge: { backgroundColor: "#ecfdf5", borderRadius: 10, paddingHorizontal: 8, paddingVertical: 2 },
  premiumActiveBadgeText: { fontSize: 11, color: "#059669", fontWeight: "600" },

  // Locked cards
  lockedCard: {
    flexDirection: "row", alignItems: "center", justifyContent: "space-between",
    backgroundColor: "#fff", borderRadius: 16, borderWidth: 1.5,
    borderColor: "#e9d8fd", borderStyle: "dashed",
    padding: 14, marginBottom: 10,
  },
  lockedLeft: { flexDirection: "row", alignItems: "center", gap: 10, flex: 1 },
  lockedIconWrap: {
    width: 36, height: 36, borderRadius: 18, backgroundColor: "#f3e8ff",
    alignItems: "center", justifyContent: "center",
  },
  lockedIcon: { fontSize: 16 },
  lockedTextWrap: { flex: 1 },
  lockedTitle: { fontSize: 13, fontWeight: "600", color: "#6b21a8" },
  lockedSub: { fontSize: 11, color: "#a78bfa", marginTop: 2 },
  lockedCTA: {
    backgroundColor: "#7c3aed", borderRadius: 10,
    paddingHorizontal: 12, paddingVertical: 6,
  },
  lockedCTAText: { fontSize: 12, fontWeight: "700", color: "#fff" },

  premiumTeaser: {
    fontSize: 11, color: "#a78bfa", textAlign: "center",
    marginTop: 4, marginBottom: 16, fontStyle: "italic",
  },

  // Footer
  footer: {
    fontSize: 11, color: "#aaa", textAlign: "center",
    lineHeight: 16, marginTop: 16, paddingHorizontal: 10,
  },

  // Sticky upgrade banner
  upgradeBanner: {
    position: "absolute", bottom: 0, left: 0, right: 0,
    flexDirection: "row", alignItems: "center", justifyContent: "space-between",
    backgroundColor: "#4c1d95",
    paddingHorizontal: 20, paddingTop: 14, paddingBottom: 28,
    shadowColor: "#4c1d95", shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.25, shadowRadius: 12, elevation: 10,
  },
  upgradeBannerLeft: { flex: 1 },
  upgradeBannerTitle: { fontSize: 15, fontWeight: "700", color: "#fff" },
  upgradeBannerSub: { fontSize: 11, color: "#c4b5fd", marginTop: 2 },
  upgradeBannerBtn: {
    backgroundColor: "#fff", borderRadius: 12,
    paddingHorizontal: 14, paddingVertical: 8,
  },
  upgradeBannerBtnText: { fontSize: 13, fontWeight: "700", color: "#4c1d95" },
});

// ─── Modal styles ─────────────────────────────────────────────────────────────
const ms = StyleSheet.create({
  overlay: {
    flex: 1, justifyContent: "flex-end",
    backgroundColor: "rgba(0,0,0,0.45)",
  },
  backdrop: { ...StyleSheet.absoluteFillObject },
  sheet: {
    backgroundColor: "#fff", borderTopLeftRadius: 28, borderTopRightRadius: 28,
    paddingHorizontal: 24, paddingTop: 12, paddingBottom: 40,
    maxHeight: SCREEN_HEIGHT * 0.88,
  },
  handle: {
    width: 36, height: 4, borderRadius: 2, backgroundColor: "#e0e0e0",
    alignSelf: "center", marginBottom: 20,
  },

  badge: {
    alignSelf: "center", backgroundColor: "#f3e8ff",
    borderRadius: 20, paddingHorizontal: 14, paddingVertical: 5,
    marginBottom: 16,
  },
  badgeText: { fontSize: 12, fontWeight: "700", color: "#7c3aed", letterSpacing: 1 },

  headline: {
    fontSize: 22, fontWeight: "800", color: "#1a1a1a",
    textAlign: "center", lineHeight: 30, marginBottom: 8,
  },
  sub: {
    fontSize: 13, color: "#666", textAlign: "center", lineHeight: 19, marginBottom: 20,
  },

  // Feature comparison table
  table: { borderRadius: 14, overflow: "hidden", marginBottom: 20, borderWidth: 1, borderColor: "#f0e6ff" },
  tableHeader: { flexDirection: "row", backgroundColor: "#f9f5ff", paddingVertical: 8 },
  tableColHead: { fontSize: 12, fontWeight: "700", color: "#6b21a8", textAlign: "center" },
  tablePremiumHead: { color: "#7c3aed" },
  tableRow: { flexDirection: "row", paddingVertical: 9, paddingHorizontal: 4 },
  tableRowAlt: { backgroundColor: "#fdf8ff" },
  tableCol: { flex: 1, fontSize: 12, color: "#555", textAlign: "center", paddingHorizontal: 6 },
  tableColFree: { color: "#999" },
  tableColPremium: { color: "#7c3aed", fontWeight: "600" },

  cta: {
    backgroundColor: "#7c3aed", borderRadius: 16,
    paddingVertical: 16, alignItems: "center", marginBottom: 12,
    shadowColor: "#7c3aed", shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3, shadowRadius: 8, elevation: 5,
  },
  ctaText: { fontSize: 16, fontWeight: "800", color: "#fff", letterSpacing: 0.2 },

  dismissBtn: { alignItems: "center", paddingVertical: 10, marginBottom: 4 },
  dismissText: { fontSize: 14, color: "#aaa" },

  legal: { fontSize: 10, color: "#ccc", textAlign: "center" },
});
