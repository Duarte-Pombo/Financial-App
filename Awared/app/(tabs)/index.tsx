import React, { useState, useCallback, useMemo, useEffect, useRef } from "react";
import {
  Text,
  View,
  StyleSheet,
  Pressable,
  ActivityIndicator,
  ScrollView,
  Platform,
  Animated,
} from "react-native";
import { useFocusEffect, useRouter, useLocalSearchParams } from "expo-router";
import Svg, { Circle } from "react-native-svg";
import { getDb } from "@/database/db";
import { EmotionGlyph, emotionColor } from "../../components/EmotionGlyph";

const C = {
  bg: "#FAF6EF",
  ink: "#1F1B16",
  inkMute: "rgba(31,27,22,0.45)",
  inkSoft: "#7A7268",
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
  const time = `${String(date.getHours()).padStart(2, "0")}:${String(
    date.getMinutes()
  ).padStart(2, "0")}`;

  if (days === 0) return `Today, ${time}`;
  if (days === 1) return `Yesterday, ${time}`;
  if (days < 7) return `${days} days ago`;

  return date.toLocaleDateString([], { month: "short", day: "numeric" });
}

function emotionSymbol(emotion: string | null): string {
  switch (emotion?.toLowerCase()) {
    case "calm":
      return "~";
    case "anxiety":
      return "≈";
    case "happy":
      return "+";
    case "boredom":
      return "—";
    default:
      return "—";
  }
}

export default function Index() {
  const router = useRouter();
  const params = useLocalSearchParams();

  const [weekTxs, setWeekTxs] = useState<WeekTx[]>([]);
  const [recent, setRecent] = useState<RecentTx[]>([]);
  const [monthTopEmotion, setMonthTopEmotion] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const [userCurrency, setUserCurrency] = useState<string>("€");
  const [monthlySpent, setMonthlySpent] = useState<number>(0);
  const [budgetGoal, setBudgetGoal] = useState<number | null>(null);

  const [filter, setFilter] = useState<string | null>(null);

  // --- Success toast (triggered after adding a purchase) ---
  const [showToast, setShowToast] = useState(false);
  const toastAnim = useRef(new Animated.Value(-100)).current;

  useEffect(() => {
    if (params.added === "true") {
      setShowToast(true);
      Animated.spring(toastAnim, {
        toValue: 20,
        useNativeDriver: true,
      }).start();

      const timer = setTimeout(() => {
        Animated.timing(toastAnim, {
          toValue: -100,
          duration: 300,
          useNativeDriver: true,
        }).start(() => {
          setShowToast(false);
          router.setParams({ added: "", timestamp: "" });
        });
      }, 3000);

      return () => clearTimeout(timer);
    }
  }, [params.added, params.timestamp]);

  const load = useCallback(async () => {
    setIsLoading(true);

    try {
      const db = await getDb();
      const userID = global.userID;

      const user = await db.getFirstAsync<{ currency_code: string }>(
        `SELECT currency_code FROM users WHERE id = ?`,
        [userID]
      );
      if (user && user.currency_code) {
        setUserCurrency(user.currency_code);
      }

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

      const ym = `${anchor.getFullYear()}-${String(
        anchor.getMonth() + 1
      ).padStart(2, "0")}`;

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

      const now = new Date();
      const currentYm = `${now.getFullYear()}-${String(
        now.getMonth() + 1
      ).padStart(2, "0")}`;

      const monthRow = await db.getFirstAsync<{ total: number }>(
        `SELECT COALESCE(SUM(amount), 0) as total
         FROM transactions
         WHERE user_id = ?
           AND strftime('%Y-%m', transacted_at) = ?
           AND type != 'refunded'`,
        [userID, currentYm]
      );
      setMonthlySpent(monthRow?.total ?? 0);

      await db.runAsync(
        `CREATE TABLE IF NOT EXISTS user_settings (
          user_id TEXT PRIMARY KEY,
          monthly_budget REAL
        )`
      );
      const settings = await db.getFirstAsync<{ monthly_budget: number }>(
        `SELECT monthly_budget FROM user_settings WHERE user_id = ?`,
        [userID]
      );
      setBudgetGoal(settings?.monthly_budget || null);
    } catch (err) {
      console.error("home load error:", err);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

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
    const spent = weekTxs.reduce((sum, tx) => sum + Number(tx.amount), 0);
    const entries = weekTxs.length;
    const emotions = new Set(
      weekTxs
        .filter((tx) => tx.emotion_name)
        .map((tx) => tx.emotion_name!.toLowerCase())
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

  const visibleRecent = recent.slice(0, 5);

  const progressPercentage =
    budgetGoal && budgetGoal > 0
      ? Math.min((monthlySpent / budgetGoal) * 100, 100)
      : 0;
  const isOverBudget = !!budgetGoal && monthlySpent > budgetGoal;

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
      {showToast && (
        <Animated.View
          style={[s.toastContainer, { transform: [{ translateY: toastAnim }] }]}
        >
          <Text style={s.toastCheck}>✓</Text>
          <Text style={s.toastText}>Purchase added successfully</Text>
        </Animated.View>
      )}

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
        <View style={s.hero}>
          <Text style={s.kicker}>PAST WEEK</Text>

          {headline ? (
            headline.low ? (
              <Text style={s.heroHeadline}>
                Your <EmoWord emo={headline.high.emotion} />
                {"\n"}purchases{"\n"}
                averaged{" "}
                <Text style={s.heroAmount}>
                  {userCurrency}{Math.round(headline.high.avg)}
                </Text>{" "}
                —{"\n"}
                your <EmoWord emo={headline.low.emotion} /> ones{" "}
                <Text style={s.heroAmount}>
                  {userCurrency}{Math.round(headline.low.avg)}
                </Text>
              </Text>
            ) : (
              <Text style={s.heroHeadline}>
                Your <EmoWord emo={headline.high.emotion} />
                {"\n"}purchases averaged{"\n"}
                <Text style={s.heroAmount}>
                  {userCurrency}{Math.round(headline.high.avg)}
                </Text>
              </Text>
            )
          ) : (
            <Text style={s.heroHeadline}>
              Start tracking to see{"\n"}your{" "}
              <Text style={[s.heroEmoWord, { color: emotionColor("calm") }]}>
                emotional
              </Text>
              {"\n"}patterns
            </Text>
          )}
        </View>

        <View style={s.statsWrap}>
          <View style={s.statsDivider} />

          <View style={s.statsRow}>
            <View style={s.statCell}>
              <Text style={s.statLabel}>SPENT</Text>
              <Text style={s.statValue}>{userCurrency}{Math.round(stats.spent)}</Text>
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

        <Pressable
          style={({ pressed }) => [s.budgetWrap, pressed && { opacity: 0.7 }]}
          onPress={() => router.push("/budget")}
        >
          <View style={s.budgetHeader}>
            <Text style={s.kicker}>THIS MONTH</Text>
            <Text style={s.budgetEdit}>
              {budgetGoal ? "edit goal" : "set goal"}
            </Text>
          </View>

          <Text style={s.budgetAmount}>
            {userCurrency}{monthlySpent.toFixed(2)}
          </Text>

          {budgetGoal ? (
            <View style={s.progressContainer}>
              <View style={s.progressBarBackground}>
                <View
                  style={[
                    s.progressBarFill,
                    { width: `${progressPercentage}%` },
                    isOverBudget && { backgroundColor: "#C25B5B" },
                  ]}
                />
              </View>
              <Text style={s.progressText}>
                {isOverBudget ? "over budget by " : "out of "}
                {userCurrency}{budgetGoal.toFixed(2)} this month
              </Text>
            </View>
          ) : (
            <Text style={s.budgetHint}>tap to set a monthly budget goal</Text>
          )}
        </Pressable>

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

        <View style={s.recentWrap}>
          <View style={s.recentHeader}>
            <Text style={s.recentTitle}>Recent</Text>

            <Pressable onPress={() => router.push("/allPurchases")} hitSlop={8}>
              <Text style={s.recentToggle}>See all</Text>
            </Pressable>
          </View>

          <View>
            {visibleRecent.length === 0 ? (
              <View style={s.emptyState}>
                <Text style={s.emptyText}>no transactions yet</Text>
              </View>
            ) : (
              visibleRecent.map((tx, index) => {
                const isRefunded = tx.type === "refunded";
                const emoName = tx.emotion_name?.toLowerCase() ?? null;
                const emoColor = emoName ? emotionColor(emoName) : C.inkMute;
                const barColor = isRefunded ? "#C4BDB7" : emoColor;
                const dim = filter !== null && emoName !== filter;

                const amount = `${tx.currency_code === "EUR" ? "€" : tx.currency_code}${Number(tx.amount).toFixed(2)}`;

                const meta = [
                  amount,
                  formatRelative(tx.transacted_at),
                  tx.category_name,
                ]
                  .filter(Boolean)
                  .join(" · ");

                const isLast = index === visibleRecent.length - 1;

                return (
                  <Pressable
                    key={tx.id}
                    onPress={() => router.push(`/transaction/${tx.id}`)}
                    style={({ pressed }) => [
                    s.recentItem,
                    !isLast && s.recentItemBorder,
                    dim && s.recentItemDim,
                    pressed && s.recentItemPressed,
                  ]}

                  >
                    <View style={s.recentLine}>
                      <View style={s.recentLeft}>
                        <View style={[s.recentBar, { backgroundColor: barColor }]} />

                        <View style={s.recentTextBlock}>
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
                      </View>

                      <View style={s.recentEmotionBox}>
                        {isRefunded ? (
                          <View style={s.refundBadge}>
                            <Text style={s.refundText}>refund</Text>
                          </View>
                        ) : (
                          <Text
                            style={[s.txEmotion, { color: emoColor }]}
                            numberOfLines={1}
                          >
                            {emoName ? `${emotionSymbol(emoName)} ${emoName}` : "—"}
                          </Text>
                        )}
                      </View>
                    </View>
                  </Pressable>
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
  root: {
    flex: 1,
    backgroundColor: C.bg,
  },

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
  headerBtn: {
    padding: 4,
  },

  scrollContent: {
    paddingBottom: 28,
  },

  toastContainer: {
    position: "absolute",
    top: 0,
    left: 24,
    right: 24,
    backgroundColor: C.ink,
    borderRadius: 14,
    paddingVertical: 14,
    paddingHorizontal: 16,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
    zIndex: 100,
    shadowColor: "#000",
    shadowOpacity: 0.18,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
    elevation: 6,
  },
  toastCheck: {
    color: "#fff",
    fontFamily: "Manrope_700Bold",
    fontSize: 16,
  },
  toastText: {
    color: "#fff",
    fontSize: 15,
    fontFamily: "Manrope_600SemiBold",
  },

  budgetWrap: {
    paddingHorizontal: 24,
    paddingTop: 22,
    paddingBottom: 4,
  },
  budgetHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  budgetEdit: {
    fontFamily: "Manrope_600SemiBold",
    fontSize: 11,
    letterSpacing: 1,
    color: C.purple,
    marginBottom: 10,
  },
  budgetAmount: {
    fontFamily: "LibreCaslonText_700Bold",
    fontSize: 36,
    color: C.ink,
    letterSpacing: -0.6,
    marginBottom: 12,
  },
  budgetHint: {
    fontFamily: "PlayfairDisplay_400Regular_Italic",
    fontSize: 14,
    color: C.inkSoft,
  },
  progressContainer: {
    width: "100%",
  },
  progressBarBackground: {
    width: "100%",
    height: 8,
    backgroundColor: "rgba(0,0,0,0.08)",
    borderRadius: 4,
    overflow: "hidden",
    marginBottom: 8,
  },
  progressBarFill: {
    height: "100%",
    backgroundColor: C.purple,
    borderRadius: 4,
  },
  progressText: {
    fontFamily: "Manrope_400Regular",
    fontSize: 13,
    color: C.inkSoft,
  },

  hero: {
    paddingHorizontal: 24,
    paddingTop: 4,
    paddingBottom: 10,
  },
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
  heroAmount: {
    fontFamily: "LibreCaslonText_700Bold",
    fontSize: 44,
  },

  statsWrap: {
    paddingHorizontal: 24,
    paddingTop: 10,
  },
  statsDivider: {
    height: 1,
    backgroundColor: C.purple,
    opacity: 0.55,
    marginTop: 16,
    marginBottom: 14,
  },
  statsRow: {
    flexDirection: "row",
    justifyContent: "space-between",
  },
  statCell: {
    alignItems: "center",
  },
  statLabel: {
    fontFamily: "Manrope_600SemiBold",
    fontSize: 10.5,
    letterSpacing: 1.8,
    color: C.inkMute,
    marginBottom: 6,
  },
  statValue: {
    fontFamily: "LibreCaslonText_400Regular",
    fontSize: 28,
    color: C.ink,
    lineHeight: 30,
    letterSpacing: -0.6,
  },

  emoOfMonth: {
    paddingHorizontal: 24,
    paddingTop: 25,
    paddingBottom: 16,
  },
  emoOfMonthRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
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

  recentWrap: {
    paddingHorizontal: 24,
    paddingTop: 14,
  },
  recentHeader: {
    flexDirection: "row",
    alignItems: "flex-end",
    justifyContent: "space-between",
    paddingBottom: 4,
    borderBottomWidth: 1,
    borderBottomColor: C.recentRule,
    marginBottom: 2,
  },
  recentTitle: {
    fontFamily: "PlayfairDisplay_700Bold_Italic",
    fontSize: 28,
    color: C.ink,
    letterSpacing: -0.3,
  },
  recentToggle: {
    fontFamily: "Manrope_400Regular",
    fontSize: 15,
    color: C.ink,
    borderBottomWidth: 1,
    borderBottomColor: C.purple,
    paddingBottom: 1,
  },


recentItem: {
  minHeight: 82,
  paddingTop: 12,
  paddingBottom: 14,
},


recentItemBorder: {
  borderBottomWidth: 1,
  borderBottomColor: C.ruleSoft,
},

recentItemDim: {
  opacity: 0.32,
},

recentItemPressed: {
  backgroundColor: "rgba(0,0,0,0.04)",
},




recentLine: {
  width: "100%",
  flexDirection: "row",
  alignItems: "center",
  justifyContent: "space-between",
  minHeight: 50,
},


recentLeft: {
  flex: 1,
  minWidth: 0,
  flexDirection: "row",
  alignItems: "center",
},

recentBar: {
  width: 4,
  height: 42,
  borderRadius: 2,
  marginRight: 12,
  flexShrink: 0,
},

recentTextBlock: {
  flex: 1,
  minWidth: 0,
  paddingRight: 10,
},

recentEmotionBox: {
  width: 104,
  flexShrink: 0,
  alignItems: "flex-end",
  justifyContent: "center",
},

txEmotion: {
  fontFamily: "PlayfairDisplay_700Bold_Italic",
  fontSize: 16,
  lineHeight: 20,
  textAlign: "right",
},

  txRow: {
    minHeight: 66,
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 8,
  },
  txRowPressed: {
    backgroundColor: "rgba(0,0,0,0.04)",
  },
  txRowBorder: {
    borderBottomWidth: 1,
    borderBottomColor: C.ruleSoft,
  },
  txBar: {
    width: 4,
    height: 42,
    borderRadius: 2,
    marginRight: 12,
    flexShrink: 0,
  },
  txBody: {
    flex: 1,
    minWidth: 0,
    paddingRight: 10,
  },
  txMerchant: {
    fontFamily: "Manrope_700Bold",
    fontSize: 18,
    color: C.ink,
    lineHeight: 22,
  },
  txMeta: {
    fontFamily: "Manrope_400Regular",
    fontSize: 14,
    color: C.inkSoft,
    lineHeight: 19,
    marginTop: 2,
  },
  txRight: {
    width: 104,
    flexShrink: 0,
    alignItems: "flex-end",
    justifyContent: "center",
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

  emptyState: {
    paddingVertical: 36,
    alignItems: "center",
  },
  emptyText: {
    fontFamily: "PlayfairDisplay_400Regular_Italic",
    fontSize: 14,
    color: C.inkSoft,
  },
});
