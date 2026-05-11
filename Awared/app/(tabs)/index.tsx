import React, { useState, useCallback, useMemo } from "react";
import {
  Text, View, StyleSheet, Pressable, ActivityIndicator,
  ScrollView, Platform,
} from "react-native";
import { useFocusEffect, useRouter } from "expo-router";
import Svg, { Circle } from "react-native-svg";
import { getDb } from "@/database/db";
import { EmotionGlyph, emotionColor } from "../../components/EmotionGlyph";

const C = {
  bg: "#FAF6EF",
  ink: "#1F1B16",
  inkMute: "rgba(31,27,22,0.45)",
  inkSoft: "#7A7268",
  rule: "rgba(0,0,0,0.10)",
  ruleSoft: "rgba(0,0,0,0.06)",
  purple: "#9B82C9",
  recentRule: "#9B82C9",
};

type WeekTx = {
  amount: number;
  emotion_name: string | null;
};

type RecentTx = {
  id: string | number;
  amount: number;
  merchant_name: string | null;
  currency_code: string;
  transacted_at: string;
  type: string;
  emotion_name: string | null;
  category_name: string | null;
};

function greeting(): string {
  const h = new Date().getHours();
  if (h < 5) return "good night";
  if (h < 12) return "good morning";
  if (h < 18) return "good afternoon";
  return "good evening";
}

function formatRelative(iso: string): string {
  const date = new Date(iso);
  const now = new Date();
  const startOfDay = (d: Date) =>
    new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
  const days = Math.floor((startOfDay(now) - startOfDay(date)) / 86400000);
  const time = `${String(date.getHours()).padStart(2, "0")}:${String(date.getMinutes()).padStart(2, "0")}`;
  if (days === 0) return `Today, ${time}`;
  if (days === 1) return `Yesterday, ${time}`;
  if (days < 7) return `${days} days ago`;
  return date.toLocaleDateString([], { month: "short", day: "numeric" });
}

export default function Index() {
  const router = useRouter();

  const [weekTxs, setWeekTxs] = useState<WeekTx[]>([]);
  const [recent, setRecent] = useState<RecentTx[]>([]);
  const [monthTopEmotion, setMonthTopEmotion] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const [filter, setFilter] = useState<string | null>(null);
  const [showAll, setShowAll] = useState(false);

  const load = useCallback(async () => {
    setIsLoading(true);
    try {
      const db = await getDb();
      const userID = global.userID;

      // Anchor "past week" + "emotion of the month" to the user's most recent transaction.
      // Avoids empty hero/stats when the most recent activity is older than 7 days (e.g. seed data).
      const latest = await db.getFirstAsync<{ md: string | null }>(
        `SELECT MAX(transacted_at) as md FROM transactions
         WHERE user_id = ? AND type != 'refunded'`,
        [userID]
      );
      const anchor = latest?.md ? new Date(latest.md) : new Date();

      const sevenAgo = new Date(anchor);
      sevenAgo.setDate(anchor.getDate() - 7);

      const wk = await db.getAllAsync<WeekTx>(
        `SELECT t.amount, e.name as emotion_name
         FROM transactions t
         LEFT JOIN emotion_logs l ON l.id = t.emotion_log_id
         LEFT JOIN emotions e ON e.id = l.emotion_id
         WHERE t.user_id = ?
           AND t.transacted_at >= ?
           AND t.transacted_at <= ?
           AND t.type != 'refunded'`,
        [userID, sevenAgo.toISOString(), anchor.toISOString()]
      );
      setWeekTxs(wk);

      const rc = await db.getAllAsync<RecentTx>(
        `SELECT t.id, t.amount, t.merchant_name, t.currency_code, t.transacted_at, t.type,
                e.name as emotion_name, sc.name as category_name
         FROM transactions t
         LEFT JOIN emotion_logs l ON l.id = t.emotion_log_id
         LEFT JOIN emotions e ON e.id = l.emotion_id
         LEFT JOIN spending_categories sc ON sc.id = t.category_id
         WHERE t.user_id = ?
         ORDER BY t.transacted_at DESC
         LIMIT 12`,
        [userID]
      );
      setRecent(rc);

      const ym = `${anchor.getFullYear()}-${String(anchor.getMonth() + 1).padStart(2, "0")}`;
      const topRows = await db.getAllAsync<{ name: string; c: number }>(
        `SELECT e.name as name, COUNT(*) as c
         FROM transactions t
         LEFT JOIN emotion_logs l ON l.id = t.emotion_log_id
         LEFT JOIN emotions e ON e.id = l.emotion_id
         WHERE t.user_id = ?
           AND strftime('%Y-%m', t.transacted_at) = ?
           AND e.name IS NOT NULL
         GROUP BY e.name
         ORDER BY c DESC
         LIMIT 1`,
        [userID, ym]
      );
      setMonthTopEmotion(topRows[0]?.name ?? null);
    } catch (err) {
      console.error("home load error:", err);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  // Hero headline + stats
  const headline = useMemo(() => {
    const valid = weekTxs.filter((t) => t.emotion_name);
    if (valid.length === 0) return null;
    const byEmotion: Record<string, { sum: number; count: number }> = {};
    for (const t of valid) {
      const key = t.emotion_name!.toLowerCase();
      if (!byEmotion[key]) byEmotion[key] = { sum: 0, count: 0 };
      byEmotion[key].sum += Number(t.amount);
      byEmotion[key].count += 1;
    }
    const avgs = Object.entries(byEmotion)
      .map(([emotion, { sum, count }]) => ({ emotion, avg: sum / count }))
      .sort((a, b) => b.avg - a.avg);
    return {
      high: avgs[0],
      low: avgs.length > 1 ? avgs[avgs.length - 1] : null,
    };
  }, [weekTxs]);

  const stats = useMemo(() => {
    const spent = weekTxs.reduce((s, t) => s + Number(t.amount), 0);
    const entries = weekTxs.length;
    const emotions = new Set(
      weekTxs.filter((t) => t.emotion_name).map((t) => t.emotion_name!.toLowerCase())
    ).size;
    return { spent, entries, emotions };
  }, [weekTxs]);

  if (isLoading && recent.length === 0) {
    return (
      <View style={[s.root, { justifyContent: "center", alignItems: "center" }]}>
        <ActivityIndicator size="large" color={C.ink} />
      </View>
    );
  }

  const visibleRecent = showAll ? recent : recent.slice(0, 5);

  // ─── Render emotion span inside hero text ───
  const EmoWord = ({ emo }: { emo: string }) => {
    const active = filter === emo;
    const dim = filter !== null && !active;
    return (
      <Text
        onPress={() => setFilter(active ? null : emo)}
        style={[
          s.heroEmoWord,
          {
            color: emotionColor(emo),
            opacity: dim ? 0.4 : 1,
            textDecorationLine: active ? "underline" : "none",
            textDecorationColor: emotionColor(emo),
          },
        ]}
      >
        {emo}
      </Text>
    );
  };

  return (
    <View style={s.root}>
      {/* Header */}
      <View style={s.header}>
        <Text style={s.greeting}>{greeting()}</Text>
        <Pressable hitSlop={8} style={s.headerBtn}>
          <Svg width={22} height={22} viewBox="0 0 24 24">
            <Circle cx={5} cy={12} r={1.6} fill={C.ink} />
            <Circle cx={12} cy={12} r={1.6} fill={C.ink} />
            <Circle cx={19} cy={12} r={1.6} fill={C.ink} />
          </Svg>
        </Pressable>
      </View>

      <ScrollView
        contentContainerStyle={s.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Hero */}
        <View style={s.hero}>
          <Text style={s.kicker}>PAST WEEK</Text>
          {headline ? (
            headline.low ? (
              <Text style={s.heroHeadline}>
                Your <EmoWord emo={headline.high.emotion} />
                {"\n"}purchases{"\n"}
                averaged €{Math.round(headline.high.avg)} —{"\n"}
                your <EmoWord emo={headline.low.emotion} /> ones €{Math.round(headline.low.avg)}
              </Text>
            ) : (
              <Text style={s.heroHeadline}>
                Your <EmoWord emo={headline.high.emotion} />
                {"\n"}purchases averaged{"\n"}€{Math.round(headline.high.avg)}
              </Text>
            )
          ) : (
            <Text style={s.heroHeadline}>
              Start tracking to see{"\n"}your{" "}
              <Text style={[s.heroEmoWord, { color: emotionColor("calm") }]}>
                emotional
              </Text>{"\n"}
              patterns
            </Text>
          )}
        </View>

        {/* Stats */}
        <View style={s.statsWrap}>
          <View style={s.statsDivider} />
          <View style={s.statsRow}>
            <View style={s.statCell}>
              <Text style={s.statLabel}>SPENT</Text>
              <Text style={s.statValue}>€{Math.round(stats.spent)}</Text>
            </View>
            <View style={s.statCell}>
              <Text style={s.statLabel}>ENTRIES</Text>
              <Text style={s.statValue}>{stats.entries}</Text>
            </View>
            <View style={s.statCell}>
              <Text style={s.statLabel}>EMOTIONS</Text>
              <Text style={s.statValue}>{stats.emotions}</Text>
            </View>
          </View>
        </View>

        {/* Emotion of the month */}
        <View style={s.emoOfMonth}>
          <Text style={s.kicker}>EMOTION OF THE MONTH</Text>
          {monthTopEmotion ? (
            <View style={s.emoOfMonthRow}>
              <EmotionGlyph
                emotion={monthTopEmotion.toLowerCase()}
                color={emotionColor(monthTopEmotion)}
                size={22}
              />
              <Text style={s.emoOfMonthText}>
                you've bought most while feeling{" "}
                <Text
                  style={[
                    s.emoOfMonthEmo,
                    { color: emotionColor(monthTopEmotion) },
                  ]}
                >
                  {monthTopEmotion.toLowerCase()}
                </Text>
              </Text>
            </View>
          ) : (
            <Text style={[s.emoOfMonthText, { color: C.inkMute }]}>
              no emotion data this month yet
            </Text>
          )}
        </View>

        {/* Recent */}
        <View style={s.recentWrap}>
          <View style={s.recentHeader}>
            <Text style={s.recentTitle}>Recent</Text>
            <Pressable onPress={() => setShowAll((v) => !v)} hitSlop={8}>
              <Text style={s.recentToggle}>{showAll ? "collapse" : "See all"}</Text>
            </Pressable>
          </View>

          <View>
            {visibleRecent.length === 0 ? (
              <View style={s.emptyState}>
                <Text style={s.emptyText}>no transactions yet</Text>
              </View>
            ) : (
              visibleRecent.map((tx, i) => {
                const isRefunded = tx.type === "refunded";
                const emoName = tx.emotion_name?.toLowerCase() ?? null;
                const barColor = isRefunded
                  ? "#C4BDB7"
                  : emotionColor(tx.emotion_name);
                const dim = filter !== null && emoName !== filter;
                const amount = `${tx.currency_code === "EUR" ? "€" : tx.currency_code}${Number(tx.amount).toFixed(2)}`;
                const meta = [
                  amount,
                  formatRelative(tx.transacted_at),
                  tx.category_name,
                ].filter(Boolean).join(" · ");
                const isLast = i === visibleRecent.length - 1;

                return (
                  <View
                    key={tx.id}
                    style={[
                      { opacity: dim ? 0.32 : 1 },
                      !isLast && s.txRowBorder,
                    ]}
                  >
                    <Pressable
                      onPress={() => router.push(`/transaction/${tx.id}`)}
                      style={({ pressed }) => [
                        s.txRow,
                        pressed && s.txRowPressed,
                      ]}
                    >
                      <View style={[s.txBar, { backgroundColor: barColor }]} />
                      <View style={s.txBody}>
                        <Text
                          style={[
                            s.txMerchant,
                            isRefunded && s.strikethrough,
                          ]}
                          numberOfLines={1}
                        >
                          {tx.merchant_name || "unknown item"}
                        </Text>
                        <Text style={s.txMeta} numberOfLines={1}>
                          {meta}
                        </Text>
                      </View>
                      {isRefunded ? (
                        <View style={s.refundBadge}>
                          <Text style={s.refundText}>refund</Text>
                        </View>
                      ) : emoName ? (
                        <View style={s.emoTag}>
                          <EmotionGlyph
                            emotion={emoName}
                            color={emotionColor(emoName)}
                            size={14}
                          />
                          <Text
                            style={[
                              s.emoTagLabel,
                              { color: emotionColor(emoName) },
                            ]}
                            numberOfLines={1}
                          >
                            {emoName}
                          </Text>
                        </View>
                      ) : (
                        <View style={s.emoTag}>
                          <Text style={[s.emoTagLabel, { color: C.inkMute }]}>—</Text>
                        </View>
                      )}
                    </Pressable>
                  </View>
                );
              })
            )}
          </View>
        </View>
      </ScrollView>
    </View>
  );
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: C.bg },

  // Header
  header: {
    paddingTop: Platform.OS === "ios" ? 52 : 38,
    paddingBottom: 10,
    paddingHorizontal: 24,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  greeting: {
    fontFamily: "PlayfairDisplay_400Regular_Italic",
    fontSize: 28,
    color: C.ink,
    letterSpacing: -0.3,
  },
  headerBtn: { padding: 4 },

  scrollContent: { paddingBottom: 140 },

  // Hero
  hero: { paddingHorizontal: 24, paddingTop: 4, paddingBottom: 10 },
  kicker: {
    fontFamily: "Manrope_600SemiBold",
    fontSize: 11,
    letterSpacing: 2,
    color: C.inkMute,
    marginBottom: 10,
  },
  heroHeadline: {
    fontFamily: "PlayfairDisplay_700Bold",
    fontSize: 44,
    color: C.ink,
    lineHeight: 52,
    letterSpacing: -0.8,
  },
  heroEmoWord: {
    fontFamily: "PlayfairDisplay_700Bold_Italic",
    fontSize: 44,
  },

  // Stats
  statsWrap: { paddingHorizontal: 24, paddingTop: 10 },
  statsDivider: {
    height: 1,
    backgroundColor: C.purple,
    opacity: 0.55,
    marginTop: 16,
    marginBottom: 14,
  },
  statsRow: { flexDirection: "row", gap: 8 },
  statCell: { flex: 1 },
  statLabel: {
    fontFamily: "Manrope_600SemiBold",
    fontSize: 10.5,
    letterSpacing: 1.8,
    color: C.inkMute,
    marginBottom: 6,
  },
  statValue: {
    fontFamily: "PlayfairDisplay_400Regular",
    fontSize: 28,
    color: C.ink,
    lineHeight: 30,
    letterSpacing: -0.6,
  },

  // Emotion of month
  emoOfMonth: { paddingHorizontal: 24, paddingTop: 25, paddingBottom: 16 },
  emoOfMonthRow: { flexDirection: "row", alignItems: "center", gap: 10 },
  emoOfMonthText: {
    fontFamily: "PlayfairDisplay_400Regular",
    fontSize: 16,
    color: C.ink,
    flex: 1,
    lineHeight: 22,
  },
  emoOfMonthEmo: {
    fontFamily: "PlayfairDisplay_700Bold_Italic",
    fontSize: 18,
  },

  // Recent
  recentWrap: { paddingHorizontal: 24, paddingTop: 14 },
  recentHeader: {
    flexDirection: "row",
    alignItems: "baseline",
    justifyContent: "space-between",
    paddingBottom: 6,
    borderBottomWidth: 1,
    borderBottomColor: C.recentRule,
    marginBottom: 2,
  },
  recentTitle: {
    fontFamily: "PlayfairDisplay_700Bold_Italic",
    fontSize: 22,
    color: C.ink,
    letterSpacing: -0.3,
  },
  recentToggle: {
    fontFamily: "Manrope_400Regular",
    fontSize: 12.5,
    color: C.ink,
    borderBottomWidth: 1,
    borderBottomColor: C.purple,
    paddingBottom: 1,
  },

  txRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 12,
    gap: 12,
  },
  txRowPressed: { backgroundColor: "rgba(0,0,0,0.04)" },
  txRowBorder: { borderBottomWidth: 1, borderBottomColor: C.ruleSoft },
  txBar: {
    width: 4,
    height: 42,
    borderRadius: 2,
    flexShrink: 0,
  },
  txBody: { flex: 1, minWidth: 0 },
  txMerchant: {
    fontFamily: "Manrope_600SemiBold",
    fontSize: 14.5,
    color: C.ink,
    lineHeight: 18,
  },
  txMeta: {
    fontFamily: "Manrope_400Regular",
    fontSize: 11.5,
    color: C.inkSoft,
    marginTop: 2,
  },

  emoTag: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    flexShrink: 0,
    marginLeft: 8,
  },
  emoTagLabel: {
    fontFamily: "PlayfairDisplay_700Bold_Italic",
    fontSize: 14,
  },

  refundBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    backgroundColor: "#E5DECC",
  },
  refundText: {
    fontFamily: "Manrope_700Bold",
    fontSize: 9,
    letterSpacing: 0.8,
    color: C.inkSoft,
    textTransform: "uppercase",
  },

  strikethrough: {
    textDecorationLine: "line-through",
    color: C.inkMute,
  },

  emptyState: { paddingVertical: 36, alignItems: "center" },
  emptyText: {
    fontFamily: "PlayfairDisplay_400Regular_Italic",
    fontSize: 14,
    color: C.inkSoft,
  },
});
