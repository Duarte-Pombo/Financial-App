import React, { useState, useCallback } from "react";
import { View, StyleSheet, Pressable, ScrollView, ActivityIndicator } from "react-native";
import { Text } from "@/components/Text";
import { useFocusEffect, useRouter } from "expo-router";
import { MaterialIcons } from "@expo/vector-icons";
import { getDb } from "@/database/db";
import { TopAppBar, TOP_APP_BAR_HEIGHT } from "@/components/TopAppBar";
import { colors, fonts, radii, spacing, glassCard } from "@/constants/theme";

export default function Index() {
  const router = useRouter();
  const [activity, setActivity] = useState<any[] | null>(null);
  const [monthlySpent, setMonthlySpent] = useState<number>(0);
  const [username, setUsername] = useState<string>("?");
  const [avatarUri, setAvatarUri] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const getActivity = useCallback(async () => {
    setIsLoading(true);
    try {
      const db = await getDb();
      const userID = global.userID;

      // FIX 1: Added t.type to the SELECT statement so we know if it's refunded
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

      // FIX 2: refunded money drops from the total spent
      const row = await db.getFirstAsync<{ total: number }>(
        `SELECT COALESCE(SUM(amount), 0) as total
         FROM transactions
         WHERE user_id = ?
           AND strftime('%Y-%m', transacted_at) = ?
           AND type != 'refunded'`,
        [userID, yearMonth]
      );

      setMonthlySpent(row?.total ?? 0);

      const user = await db.getFirstAsync<{ username: string; avatar_url: string | null }>(
        "SELECT username, avatar_url FROM users WHERE id = ?",
        [userID]
      );
      if (user) {
        setUsername(user.username);
        setAvatarUri(user.avatar_url ?? null);
      }
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

  const todayEmotion = activity && activity.length > 0 ? activity[0] : null;

  if (isLoading && !activity) {
    return (
      <View style={[styles.container, { justifyContent: "center", alignItems: "center" }]}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <TopAppBar
        avatarUri={avatarUri}
        initials={username.slice(0, 2)}
        onAvatarPress={() => router.push("/(tabs)/profile")}
      />

      <ScrollView style={{ flex: 1 }} contentContainerStyle={styles.scrollContent}>
        {/* ── This Month card (full-width) ── */}
        <View style={[styles.fullCard, glassCard]}>
          <View style={styles.cardHeader}>
            <Text style={styles.cardEyebrow}>THIS MONTH</Text>
            <MaterialIcons name="account-balance-wallet" size={22} color={colors.primary} />
          </View>
          <Text style={styles.bigAmount}>€ {monthlySpent.toFixed(2).replace(".", ",")}</Text>
          <View style={styles.deltaRow}>
            <MaterialIcons name="trending-up" size={14} color={colors.secondaryContainer} />
            <Text style={styles.deltaText}>+2.4% vs last month</Text>
          </View>
        </View>

        {/* ── Emotion of the Day card (full-width) ── */}
        <View style={[styles.fullCard, glassCard, { overflow: "hidden" }]}>
          <View style={styles.decorativeBlob} />
          <View style={styles.cardHeader}>
            <Text style={styles.cardEyebrow}>EMOTION OF THE DAY</Text>
            <MaterialIcons name="self-improvement" size={22} color={colors.tertiary} />
          </View>
          <View style={styles.emotionRow}>
            <View style={{ flex: 1 }}>
              <Text style={styles.emotionTitle}>{todayEmotion?.emotion_name ?? "Balanced"}</Text>
              <Text style={styles.emotionSub}>Steady financial flow, clear mind.</Text>
            </View>
            <View style={styles.emotionEmojiCircle}>
              <Text style={{ fontSize: 32 }}>{todayEmotion?.emoji ?? "💧"}</Text>
            </View>
          </View>
        </View>

        {/* ── Recent Activity Section ── */}
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Recent Activity</Text>
          <Pressable onPress={() => router.push("/history")}>
            <Text style={styles.viewAll}>View All</Text>
          </Pressable>
        </View>

        {activity && activity.length === 0 ? (
          <View style={[styles.emptyCard, glassCard]}>
            <MaterialIcons name="receipt-long" size={36} color={colors.outlineVariant} />
            <Text style={styles.emptyText}>No transactions yet</Text>
          </View>
        ) : (
          <View style={{ gap: spacing.sm }}>
            {activity?.map((item) => {
              const isRefunded = item.type === "refunded";
              return (
                <Pressable
                  key={item.id}
                  style={({ pressed }) => [
                    styles.activityItem,
                    glassCard,
                    pressed && { opacity: 0.7 },
                  ]}
                  onPress={() => router.push(`/transaction/${item.id}`)}
                >
                  <View style={styles.activityLeft}>
                    <View
                      style={[
                        styles.iconBubble,
                        isRefunded && { backgroundColor: colors.surfaceContainerHigh },
                      ]}
                    >
                      <Text style={{ fontSize: 22, opacity: isRefunded ? 0.5 : 1 }}>
                        {item.emoji}
                      </Text>
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text
                        style={[styles.merchantName, isRefunded && styles.strikethrough]}
                        numberOfLines={1}
                      >
                        {item.merchant_name || "Unknown Item"}
                      </Text>
                      <View style={styles.metaRow}>
                        <View style={styles.categoryChip}>
                          <Text style={styles.categoryChipText}>
                            {item.emotion_name ?? "Logged"}
                          </Text>
                        </View>
                        {isRefunded && (
                          <View
                            style={[styles.categoryChip, { backgroundColor: colors.errorContainer }]}
                          >
                            <Text style={[styles.categoryChipText, { color: colors.error }]}>
                              REFUND
                            </Text>
                          </View>
                        )}
                      </View>
                    </View>
                  </View>
                  <Text style={[styles.amount, isRefunded && styles.strikethrough]}>
                    -€{item.amount.toFixed(2)}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        )}

        <View style={{ height: 110 }} />
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  scrollContent: {
    paddingTop: TOP_APP_BAR_HEIGHT + spacing.md,
    paddingHorizontal: spacing.containerMargin,
    paddingBottom: 40,
  },

  // Full-width stacked card (matches Stitch home layout)
  fullCard: {
    borderRadius: radii.base,
    padding: spacing.md,
    marginBottom: spacing.gutter,
    overflow: "hidden",
  },
  cardHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: spacing.sm,
  },
  cardEyebrow: {
    fontFamily: fonts.semibold,
    fontSize: 12,
    color: colors.onSurfaceVariant,
    letterSpacing: 1.6,
  },
  bigAmount: {
    fontFamily: fonts.extrabold,
    fontSize: 44,
    color: colors.onSurface,
    letterSpacing: -1.2,
    lineHeight: 52,
    marginTop: 6,
  },
  deltaRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    marginTop: spacing.sm,
  },
  deltaText: {
    fontFamily: fonts.medium,
    fontSize: 12,
    color: colors.secondaryContainer,
  },

  decorativeBlob: {
    position: "absolute",
    right: -40,
    bottom: -40,
    width: 160,
    height: 160,
    borderRadius: 80,
    backgroundColor: colors.tertiaryFixedDim,
    opacity: 0.25,
  },
  emotionRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginTop: 4,
  },
  emotionTitle: {
    fontFamily: fonts.extrabold,
    fontSize: 36,
    color: colors.tertiaryContainer,
    letterSpacing: -0.8,
    lineHeight: 42,
  },
  emotionSub: {
    fontFamily: fonts.regular,
    fontSize: 14,
    color: colors.onSurfaceVariant,
    marginTop: 6,
    maxWidth: 200,
  },
  emotionEmojiCircle: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: colors.tertiaryFixed,
    alignItems: "center",
    justifyContent: "center",
  },

  sectionHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: spacing.md,
  },
  sectionTitle: {
    fontFamily: fonts.semibold,
    fontSize: 20,
    color: colors.onSurface,
  },
  viewAll: {
    fontFamily: fonts.semibold,
    fontSize: 14,
    color: colors.primary,
    letterSpacing: 0.14,
  },

  activityItem: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    borderRadius: radii.base,
    padding: spacing.sm,
    paddingRight: spacing.md,
  },
  activityLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
    flex: 1,
  },
  iconBubble: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: colors.primaryFixed,
    alignItems: "center",
    justifyContent: "center",
  },
  merchantName: {
    fontFamily: fonts.semibold,
    fontSize: 16,
    color: colors.onSurface,
    marginBottom: 4,
  },
  metaRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  categoryChip: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: radii.pill,
    backgroundColor: colors.surfaceVariant,
  },
  categoryChipText: {
    fontFamily: fonts.medium,
    fontSize: 11,
    color: colors.onSurfaceVariant,
  },
  amount: {
    fontFamily: fonts.semibold,
    fontSize: 18,
    color: colors.onSurface,
  },
  strikethrough: {
    textDecorationLine: "line-through",
    color: colors.outline,
  },

  emptyCard: {
    borderRadius: radii.base,
    padding: spacing.lg,
    alignItems: "center",
    gap: spacing.sm,
  },
  emptyText: {
    fontFamily: fonts.medium,
    fontSize: 14,
    color: colors.onSurfaceVariant,
  },
});
