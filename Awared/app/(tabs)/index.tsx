import React, { useState, useCallback } from "react";
import {
  Text,
  View,
  StyleSheet,
  Pressable,
  ActivityIndicator,
  StatusBar,
} from "react-native";
import { useFocusEffect, useRouter } from "expo-router";
import Ionicons from "@expo/vector-icons/Ionicons";
import { getDb } from "@/database/db";
import Svg, { Defs, RadialGradient, Stop, Rect } from "react-native-svg";

const BUDGET_LIMIT = 2200;

export default function Index() {
  const router = useRouter();
  const [activity, setActivity] = useState<any[] | null>(null);
  const [monthlySpent, setMonthlySpent] = useState<number>(0);
  const [isLoading, setIsLoading] = useState(true);
  const [emotionCardSize, setEmotionCardSize] = useState({ width: 0, height: 0 });

  const getActivity = useCallback(async () => {
    setIsLoading(true);
    try {
      const db = await getDb();
      const userID = global.userID;

      const transactions = await db.getAllAsync(
        `SELECT t.id, t.amount, t.merchant_name, t.currency_code, t.transacted_at, t.type, e.emoji, e.name as emotion_name
         FROM transactions as t
         JOIN emotion_logs l ON t.emotion_log_id = l.id
         JOIN emotions e on l.emotion_id = e.id
         WHERE t.user_id = ? ORDER BY t.transacted_at DESC LIMIT 3`,
        [userID]
      );
      setActivity(transactions);

      const now = new Date();
      const yearMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;

      const row = await db.getFirstAsync<{ total: number }>(
        `SELECT COALESCE(SUM(amount), 0) as total
         FROM transactions
         WHERE user_id = ?
           AND strftime('%Y-%m', transacted_at) = ?
           AND type != 'refunded'`,
        [userID, yearMonth]
      );

      setMonthlySpent(row?.total ?? 0);
    } catch (error) {
      console.error("Failed to fetch activity:", error);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      getActivity();
    }, [getActivity])
  );

  if (isLoading && !activity) {
    return (
      <View style={[styles.root, { justifyContent: "center", alignItems: "center" }]}>
        <ActivityIndicator size="large" color="#8B4B5C" />
      </View>
    );
  }

  const progressPct = Math.min((monthlySpent / BUDGET_LIMIT) * 100, 100);
  const todayEmotion = activity && activity.length > 0 ? activity[0] : null;

  return (
    <View style={styles.root}>
      <StatusBar barStyle="dark-content" backgroundColor="#F5F0E6" />

      {/* ── Header ── */}
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <View style={styles.avatarCircle}>
            <Ionicons name="person" size={20} color="#8B4B5C" />
          </View>
          <Text style={styles.headerTitle}>Awared</Text>
        </View>
        <Pressable style={styles.notifButton} hitSlop={8}>
          <Ionicons name="notifications-outline" size={24} color="#F9A8BB" />
        </Pressable>
      </View>

      <View style={styles.content}>
        {/* ── Spent this month ── */}
        <View style={styles.heroCard}>
          <Text style={styles.cardLabel}>Spent this month</Text>
          <Text style={styles.heroAmount}>€{monthlySpent.toFixed(2)}</Text>
          <View style={styles.progressTrack}>
            <View style={[styles.progressFill, { width: `${progressPct}%` as any }]} />
          </View>
          <Text style={styles.budgetLimit}>€{BUDGET_LIMIT} limit</Text>
        </View>

        {/* ── Emotion of the Day ── */}
        <View
          style={styles.emotionCard}
          onLayout={(e) =>
            setEmotionCardSize({
              width: e.nativeEvent.layout.width,
              height: e.nativeEvent.layout.height,
            })
          }
        >
          <Svg
            style={StyleSheet.absoluteFill}
            width={emotionCardSize.width}
            height={emotionCardSize.height}
            pointerEvents="none"
          >
            <Defs>
              <RadialGradient
                id="rg"
                cx="1"
                cy="0.5"
                rx="0.9"
                ry="1.2"
                gradientUnits="objectBoundingBox"
              >
                <Stop offset="0%" stopColor="#F9A8BB" stopOpacity="0.6" />
                <Stop offset="50%" stopColor="#F9A8BB" stopOpacity="0.2" />
                <Stop offset="100%" stopColor="#F9A8BB" stopOpacity="0" />
              </RadialGradient>
            </Defs>
            <Rect
              x="0"
              y="0"
              width={emotionCardSize.width}
              height={emotionCardSize.height}
              fill="url(#rg)"
            />
          </Svg>

          <View style={styles.emotionCardTop}>
            <View style={{ marginLeft: 15 }}>
              <Text style={styles.cardLabel}>Emotion of the Day</Text>
              {todayEmotion ? (
                <Text style={styles.emotionName}>
                  {todayEmotion.emotion_name ?? "—"}
                </Text>
              ) : (
                <Text style={styles.emotionName}>No data yet</Text>
              )}
            </View>
            {todayEmotion ? (
              <Text style={styles.emotionEmoji}>{todayEmotion.emoji}</Text>
            ) : (
              <Ionicons name="leaf-outline" size={28} color="#8B4B5C" />
            )}
          </View>
        </View>

        {/* ── Recent Transactions ── */}
        <View style={styles.transactionsSection}>
          <View style={styles.sectionRow}>
            <Text style={styles.sectionTitle}>Recent Transactions</Text>
            <Pressable onPress={() => router.push("/history")} hitSlop={8}>
              <Text style={styles.viewAllText}>View All</Text>
            </Pressable>
          </View>

          <View style={styles.transactionsCard}>
          {activity && activity.length === 0 ? (
            <View style={styles.emptyState}>
              <Ionicons name="receipt-outline" size={40} color="#ECDFE1" style={{ marginBottom: 10 }} />
              <Text style={styles.emptyStateText}>No transactions registered yet!</Text>
            </View>
          ) : (
            activity?.map((item, index) => {
              const isRefunded = item.type === "refunded";
              const isLast = index === (activity?.length ?? 0) - 1;

              return (
                <React.Fragment key={item.id}>
                  <Pressable
                    style={({ pressed }) => [
                      styles.transactionRow,
                      pressed && styles.transactionRowPressed,
                    ]}
                    onPress={() => router.push(`/transaction/${item.id}`)}
                  >
                    <View style={[styles.txIcon, isRefunded && styles.txIconRefunded]}>
                      <Text style={[styles.txEmoji, isRefunded && { opacity: 0.5 }]}>
                        {item.emoji}
                      </Text>
                    </View>

                    <View style={styles.txDetails}>
                      <View style={styles.txNameRow}>
                        <Text
                          style={[styles.txMerchant, isRefunded && styles.strikethrough]}
                          numberOfLines={1}
                        >
                          {item.merchant_name || "Unknown Item"}
                        </Text>
                        {isRefunded && (
                          <View style={styles.refundBadge}>
                            <Text style={styles.refundBadgeText}>REFUND</Text>
                          </View>
                        )}
                      </View>
                      <Text style={styles.txDate}>
                        {new Date(item.transacted_at).toLocaleDateString([], {
                          month: "short",
                          day: "numeric",
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                      </Text>
                    </View>

                    <Text style={[styles.txAmount, isRefunded && styles.strikethroughAmount]}>
                      {item.amount}{" "}
                      {item.currency_code === "EUR" ? "€" : item.currency_code}
                    </Text>
                  </Pressable>

                  {!isLast && <View style={styles.divider} />}
                </React.Fragment>
              );
            })
          )}
          </View>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: "#FFF8F7",
  },

  // ── Header ──
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: "#F5F0E6",
    paddingHorizontal: 20,
    paddingTop: 52,
    paddingBottom: 16,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.04,
    shadowRadius: 12,
    elevation: 4,
  },
  headerLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  avatarCircle: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "#ECDFE1",
    alignItems: "center",
    justifyContent: "center",
  },
  headerTitle: {
    fontSize: 20,
    fontFamily: "Manrope_700Bold",
    color: "#201A1B",
    letterSpacing: -0.4,
  },
  notifButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
  },

  // ── Content ──
  content: {
    flex: 1,
    padding: 20,
    paddingBottom: 16,
    gap: 16,
  },

  // ── Hero Card ──
  heroCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 20,
    padding: 24,
    shadowColor: "#8B4B5C",
    shadowOpacity: 0.05,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 4 },
    elevation: 3,
  },
  cardLabel: {
    fontSize: 12,
    fontFamily: "Manrope_600SemiBold",
    color: "#524346",
    letterSpacing: 0.4,
    marginBottom: 6,
  },
  heroAmount: {
    fontSize: 40,
    fontFamily: "Manrope_700Bold",
    color: "#201A1B",
    letterSpacing: -1,
    marginBottom: 20,
  },
  progressTrack: {
    width: "100%",
    height: 10,
    backgroundColor: "#ECDFE1",
    borderRadius: 9999,
    overflow: "hidden",
  },
  progressFill: {
    height: "100%",
    backgroundColor: "#F9A8BB",
    borderRadius: 9999,
  },
  budgetLimit: {
    fontSize: 12,
    fontFamily: "Manrope_500Medium",
    color: "#524346",
    marginTop: 8,
    textAlign: "right",
  },

  // ── Emotion Card ──
  emotionCard: {
    backgroundColor: "#F8EBEC",
    borderRadius: 20,
    paddingHorizontal: 24,
    paddingTop: 24,
    paddingBottom: 48,
    shadowColor: "#8B4B5C",
    shadowOpacity: 0.05,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 4 },
    elevation: 3,
    overflow: "hidden",
  },
  emotionCardTop: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  emotionEmoji: {
    fontSize: 36,
  },
  emotionName: {
    fontSize: 22,
    fontFamily: "Manrope_700Bold",
    color: "#201A1B",
    marginTop: 6,
    letterSpacing: -0.3,
  },

  // ── Section Header ──
  sectionRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 4,
  },
  sectionTitle: {
    fontSize: 20,
    fontFamily: "Manrope_700Bold",
    color: "#201A1B",
  },
  viewAllText: {
    fontSize: 13,
    fontFamily: "Manrope_600SemiBold",
    color: "#8B4B5C",
  },

  // ── Transactions Section ──
  transactionsSection: {
    flex: 1,
    gap: 12,
    marginTop: 12,
  },

  // ── Transactions Card ──
  transactionsCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 16,
    overflow: "hidden",
    shadowColor: "#8B4B5C",
    shadowOpacity: 0.04,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 },
    elevation: 2,
  },

  emptyState: { alignItems: "center", paddingVertical: 36, paddingHorizontal: 20 },
  emptyStateText: {
    color: "#524346",
    fontFamily: "Manrope_400Regular",
    fontSize: 14,
    marginTop: 4,
  },

  transactionRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 20,
    paddingHorizontal: 16,
  },
  transactionRowPressed: {
    backgroundColor: "#FEF0F2",
  },

  txIcon: {
    width: 52,
    height: 52,
    borderRadius: 14,
    backgroundColor: "#ECDFE1",
    alignItems: "center",
    justifyContent: "center",
    marginRight: 14,
    flexShrink: 0,
  },
  txIconRefunded: {
    backgroundColor: "#F2F2F2",
  },
  txEmoji: { fontSize: 26 },

  txDetails: { flex: 1, justifyContent: "center" },
  txNameRow: { flexDirection: "row", alignItems: "center", gap: 6 },
  txMerchant: {
    fontSize: 16,
    fontFamily: "Manrope_600SemiBold",
    color: "#201A1B",
    marginBottom: 3,
    flexShrink: 1,
  },
  txDate: {
    fontSize: 13,
    fontFamily: "Manrope_400Regular",
    color: "#524346",
  },
  txAmount: {
    fontSize: 15,
    fontFamily: "Manrope_700Bold",
    color: "#201A1B",
    marginLeft: 8,
  },

  divider: {
    height: 1,
    backgroundColor: "rgba(236, 223, 225, 0.5)",
    marginHorizontal: 16,
  },

  strikethrough: {
    textDecorationLine: "line-through",
    color: "#9CA3AF",
  },
  strikethroughAmount: {
    textDecorationLine: "line-through",
    color: "#9CA3AF",
    fontFamily: "Manrope_500Medium",
  },
  refundBadge: {
    backgroundColor: "#E0F2F1",
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
  },
  refundBadgeText: {
    color: "#00796B",
    fontSize: 9,
    fontFamily: "Manrope_700Bold",
    letterSpacing: 0.5,
  },
});