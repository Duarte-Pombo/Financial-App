import React, { useState, useCallback, useMemo } from "react";
import {
  View,
  StyleSheet,
  Pressable,
  ActivityIndicator,
  ScrollView,
  TextInput,
} from "react-native";
import { Text } from "@/components/Text";
import { useFocusEffect, useRouter } from "expo-router";
import { MaterialIcons } from "@expo/vector-icons";
import { getDb } from "@/database/db";
import { TopAppBar, TOP_APP_BAR_HEIGHT } from "@/components/TopAppBar";
import { colors, fonts, radii, spacing, glassCard } from "@/constants/theme";

type HistoryItem = {
  id: string;
  amount: number;
  merchant_name: string | null;
  currency_code: string;
  transacted_at: string;
  type: string;
  emoji: string;
  emotion_name: string;
  emotion_color: string | null;
};

function formatGroupLabel(date: Date): string {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const yesterday = new Date(today);
  yesterday.setDate(today.getDate() - 1);
  const target = new Date(date);
  target.setHours(0, 0, 0, 0);

  if (target.getTime() === today.getTime()) {
    return `Today, ${["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"][date.getMonth()]} ${date.getDate()}`;
  }
  if (target.getTime() === yesterday.getTime()) {
    return `Yesterday, ${["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"][date.getMonth()]} ${date.getDate()}`;
  }
  const weekday = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"][date.getDay()];
  const month = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"][date.getMonth()];
  return `${weekday}, ${month} ${date.getDate()}`;
}

function formatTime(date: Date): string {
  let h = date.getHours();
  const m = date.getMinutes().toString().padStart(2, "0");
  const ampm = h >= 12 ? "PM" : "AM";
  h = h % 12 || 12;
  return `${h}:${m} ${ampm}`;
}

export default function History() {
  const router = useRouter();
  const [history, setHistory] = useState<HistoryItem[] | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [activeFilter, setActiveFilter] = useState<"all" | "category" | "emotion" | "date">("all");

  const getHistory = useCallback(async () => {
    setIsLoading(true);
    try {
      const db = await getDb();
      const userID = global.userID;

      const transactions = await db.getAllAsync<HistoryItem>(
        `SELECT t.id, t.amount, t.merchant_name, t.currency_code, t.transacted_at, t.type,
                e.emoji, e.name as emotion_name, e.color_hex as emotion_color
         FROM transactions as t
         JOIN emotion_logs l ON t.emotion_log_id = l.id
         JOIN emotions e on l.emotion_id = e.id
         WHERE t.user_id = ? ORDER BY t.transacted_at DESC`,
        [userID]
      );
      setHistory(transactions);
    } catch (error) {
      console.error("Failed to fetch history:", error);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      getHistory();
    }, [getHistory])
  );

  // Filter by search
  const filtered = useMemo(() => {
    if (!history) return [];
    const q = search.trim().toLowerCase();
    if (!q) return history;
    return history.filter(
      (h) =>
        (h.merchant_name ?? "").toLowerCase().includes(q) ||
        (h.emotion_name ?? "").toLowerCase().includes(q)
    );
  }, [history, search]);

  // Group by day
  const grouped = useMemo(() => {
    const map = new Map<string, HistoryItem[]>();
    filtered.forEach((item) => {
      const d = new Date(item.transacted_at);
      const key = d.toDateString();
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(item);
    });
    return Array.from(map.entries()).map(([key, items]) => ({
      label: formatGroupLabel(new Date(key)),
      items,
    }));
  }, [filtered]);

  if (isLoading && !history) {
    return (
      <View style={[styles.container, styles.centered]}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <TopAppBar
        rightIcon="chevron-back"
        onRightPress={() => router.back()}
      />

      <ScrollView style={{ flex: 1 }} contentContainerStyle={styles.content}>
        {/* Header section */}
        <View>
          <Text style={styles.pageTitle}>Transaction History</Text>
          <Text style={styles.pageSub}>Review your spending and associated moods.</Text>
        </View>

        {/* Search bar */}
        <View style={[styles.searchBar, glassCard]}>
          <MaterialIcons
            name="search"
            size={22}
            color={colors.outline}
            style={{ marginRight: spacing.sm }}
          />
          <TextInput
            style={styles.searchInput}
            value={search}
            onChangeText={setSearch}
            placeholder="Search transactions..."
            placeholderTextColor={colors.outline}
          />
        </View>

        {/* Filter chips */}
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.filterRow}
        >
          {[
            { key: "all", label: "All", icon: "tune" as const },
            { key: "category", label: "Category", icon: "expand-more" as const },
            { key: "emotion", label: "Emotion", icon: "expand-more" as const },
            { key: "date", label: "Date", icon: "expand-more" as const },
          ].map((chip) => {
            const active = activeFilter === chip.key;
            return (
              <Pressable
                key={chip.key}
                onPress={() => setActiveFilter(chip.key as typeof activeFilter)}
                style={[
                  styles.filterChip,
                  active ? styles.filterChipActive : styles.filterChipInactive,
                ]}
              >
                <MaterialIcons
                  name={chip.icon}
                  size={16}
                  color={active ? colors.onPrimaryContainer : colors.onSurface}
                />
                <Text
                  style={[
                    styles.filterChipText,
                    active && styles.filterChipTextActive,
                  ]}
                >
                  {chip.label}
                </Text>
              </Pressable>
            );
          })}
        </ScrollView>

        {/* Grouped transactions */}
        {grouped.length === 0 ? (
          <View style={[styles.emptyCard, glassCard]}>
            <MaterialIcons name="receipt-long" size={36} color={colors.outlineVariant} />
            <Text style={styles.emptyText}>
              {search ? "No matches found." : "No transactions registered yet!"}
            </Text>
          </View>
        ) : (
          grouped.map((group) => (
            <View key={group.label} style={styles.group}>
              <Text style={styles.groupLabel}>{group.label.toUpperCase()}</Text>
              <View style={{ gap: spacing.xs }}>
                {group.items.map((item) => {
                  const isRefunded = item.type === "refunded";
                  return (
                    <Pressable
                      key={item.id}
                      style={({ pressed }) => [
                        styles.txCard,
                        glassCard,
                        pressed && { opacity: 0.7 },
                      ]}
                      onPress={() => router.push(`/transaction/${item.id}`)}
                    >
                      <View style={styles.txLeft}>
                        <View
                          style={[
                            styles.txIconCircle,
                            {
                              backgroundColor: item.emotion_color
                                ? `${item.emotion_color}33`
                                : colors.primaryFixed,
                            },
                          ]}
                        >
                          <Text style={{ fontSize: 22, opacity: isRefunded ? 0.5 : 1 }}>
                            {item.emoji}
                          </Text>
                        </View>
                        <View style={{ flex: 1 }}>
                          <Text
                            style={[
                              styles.merchantName,
                              isRefunded && styles.strikethrough,
                            ]}
                            numberOfLines={1}
                          >
                            {item.merchant_name || "Unknown Item"}
                          </Text>
                          <View style={styles.metaRow}>
                            <Text style={styles.timeText}>
                              {formatTime(new Date(item.transacted_at))}
                            </Text>
                            <Text style={styles.dotSep}>•</Text>
                            <View
                              style={[
                                styles.emotionChip,
                                {
                                  backgroundColor: item.emotion_color
                                    ? `${item.emotion_color}55`
                                    : colors.surfaceVariant,
                                },
                              ]}
                            >
                              <Text style={styles.emotionChipText}>{item.emotion_name}</Text>
                            </View>
                            {isRefunded && (
                              <View
                                style={[
                                  styles.emotionChip,
                                  { backgroundColor: colors.errorContainer },
                                ]}
                              >
                                <Text
                                  style={[styles.emotionChipText, { color: colors.error }]}
                                >
                                  REFUND
                                </Text>
                              </View>
                            )}
                          </View>
                        </View>
                      </View>
                      <Text
                        style={[styles.amount, isRefunded && styles.strikethrough]}
                      >
                        -€{item.amount.toFixed(2)}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>
            </View>
          ))
        )}

        <View style={{ height: 60 }} />
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  centered: { justifyContent: "center", alignItems: "center" },
  content: {
    paddingTop: TOP_APP_BAR_HEIGHT + spacing.md,
    paddingHorizontal: spacing.containerMargin,
    paddingBottom: 40,
    gap: spacing.md,
  },

  pageTitle: {
    fontFamily: fonts.bold,
    fontSize: 32,
    color: colors.onBackground,
    letterSpacing: -0.32,
  },
  pageSub: {
    fontFamily: fonts.regular,
    fontSize: 14,
    color: colors.onSurfaceVariant,
    marginTop: 4,
    lineHeight: 20,
  },

  searchBar: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: spacing.sm,
    height: 48,
    borderRadius: radii.pill,
    borderWidth: 1,
    borderColor: colors.outlineVariant,
  },
  searchInput: {
    flex: 1,
    fontFamily: fonts.regular,
    fontSize: 16,
    color: colors.onSurface,
    paddingVertical: 0,
  },

  filterRow: {
    gap: spacing.sm,
    paddingRight: spacing.lg,
    paddingBottom: 4,
  },
  filterChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: spacing.sm,
    paddingVertical: 8,
    borderRadius: radii.pill,
    borderWidth: 1,
  },
  filterChipActive: {
    backgroundColor: colors.primaryContainer,
    borderColor: colors.primaryContainer,
  },
  filterChipInactive: {
    backgroundColor: colors.surfaceContainer,
    borderColor: colors.outlineVariant,
  },
  filterChipText: {
    fontFamily: fonts.medium,
    fontSize: 12,
    color: colors.onSurface,
  },
  filterChipTextActive: {
    color: colors.onPrimaryContainer,
    fontFamily: fonts.semibold,
  },

  group: { gap: spacing.sm },
  groupLabel: {
    fontFamily: fonts.medium,
    fontSize: 11,
    color: colors.outline,
    letterSpacing: 1.4,
    marginLeft: spacing.sm,
  },

  txCard: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    padding: spacing.sm,
    paddingRight: spacing.md,
    borderRadius: radii.base,
  },
  txLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    flex: 1,
  },
  txIconCircle: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: "center",
    justifyContent: "center",
  },
  merchantName: {
    fontFamily: fonts.semibold,
    fontSize: 14,
    color: colors.onSurface,
    letterSpacing: 0.14,
  },
  metaRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginTop: 4,
    flexWrap: "wrap",
  },
  timeText: {
    fontFamily: fonts.regular,
    fontSize: 12,
    color: colors.onSurfaceVariant,
  },
  dotSep: {
    fontFamily: fonts.regular,
    fontSize: 12,
    color: colors.onSurfaceVariant,
  },
  emotionChip: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: radii.pill,
  },
  emotionChipText: {
    fontFamily: fonts.medium,
    fontSize: 10,
    color: colors.onSecondaryFixedVariant,
    letterSpacing: 0.4,
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
    alignItems: "center",
    justifyContent: "center",
    padding: spacing.xl,
    borderRadius: radii.base,
    gap: spacing.sm,
  },
  emptyText: {
    fontFamily: fonts.medium,
    fontSize: 14,
    color: colors.onSurfaceVariant,
    textAlign: "center",
  },
});
