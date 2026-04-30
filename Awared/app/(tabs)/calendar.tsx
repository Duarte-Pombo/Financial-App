import React, { useState, useRef, useEffect, useCallback } from "react";
import { View, StyleSheet, Pressable, FlatList, ScrollView } from "react-native";
import { Text } from "@/components/Text";
import { MaterialIcons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { router } from "expo-router";
import { TopAppBar, TOP_APP_BAR_HEIGHT } from "@/components/TopAppBar";
import {
  getWeekHeatmapData,
  WeekDayData,
  WeekEmotionStat,
} from "@/database/transactions";
import { getDb } from "@/database/db";
import { colors, fonts, radii, spacing, glassCard } from "@/constants/theme";

const DAY_LABELS_SHORT = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

const BAR_MAX_H = 192; // h-48
const ITEM_W = 88;
const WEEKS_BACK = 7;

function getMonday(d: Date): Date {
  const day = d.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  const monday = new Date(d);
  monday.setDate(d.getDate() + diff);
  monday.setHours(0, 0, 0, 0);
  return monday;
}

function formatWeekLabel(d: Date): string {
  const end = new Date(d);
  end.setDate(d.getDate() + 6);
  return `${MONTHS[d.getMonth()]} ${d.getDate()} - ${MONTHS[end.getMonth()]} ${end.getDate()}`;
}

function aggregateEmotions(days: WeekDayData[]): WeekEmotionStat[] {
  const map = new Map<string, WeekEmotionStat>();
  for (const day of days)
    for (const e of day.emotions) {
      if (map.has(e.name)) map.get(e.name)!.count += e.count;
      else map.set(e.name, { ...e });
    }
  return Array.from(map.values()).sort((a, b) => b.count - a.count);
}

function buildWeekStarts(): Date[] {
  const thisMonday = getMonday(new Date());
  return Array.from({ length: WEEKS_BACK + 1 }, (_, i) => {
    const d = new Date(thisMonday);
    d.setDate(thisMonday.getDate() - (WEEKS_BACK - i) * 7);
    return d;
  });
}

const WEEK_STARTS = buildWeekStarts();
const THIS_WEEK_IDX = WEEK_STARTS.length - 1;

export default function Calendar() {
  const [weekIdx, setWeekIdx] = useState(THIS_WEEK_IDX);
  const [weekDays, setWeekDays] = useState<WeekDayData[]>(
    Array.from({ length: 7 }, () => ({ count: 0, emotions: [] }))
  );
  const [allEmotions, setAllEmotions] = useState<WeekEmotionStat[]>([]);
  const [selectedDay, setSelectedDay] = useState<number | null>(null);
  const [selectedEmotion, setSelectedEmotion] = useState<string | null>(null);
  const flatRef = useRef<FlatList>(null);

  useEffect(() => {
    (async () => {
      const db = await getDb();
      const rows = await db.getAllAsync<{ name: string; emoji: string; color_hex: string }>(
        "SELECT name, emoji, color_hex FROM emotions ORDER BY id"
      );
      setAllEmotions(rows.map((r) => ({ ...r, count: 0 })));
    })();
  }, []);

  const loadWeek = useCallback(async () => {
    const days = await getWeekHeatmapData(global.userID, WEEK_STARTS[weekIdx]);
    setWeekDays(days);
  }, [weekIdx]);

  useEffect(() => {
    setSelectedDay(null);
    loadWeek();
  }, [loadWeek]);

  const isThisWeek = weekIdx === THIS_WEEK_IDX;
  const canGoBack = weekIdx > 0;
  const canGoForward = weekIdx < THIS_WEEK_IDX;
  const hasFilter = selectedEmotion !== null;

  function handleWeekChange(dir: -1 | 1) {
    setWeekIdx((p) => p + dir);
    setSelectedDay(null);
  }

  function toggleEmotion(name: string) {
    setSelectedEmotion((prev) => (prev === name ? null : name));
    setSelectedDay(null);
  }

  const barData = weekDays.map((day) => {
    if (!hasFilter) return { count: day.count, color: colors.primary };
    const match = day.emotions.find((e) => e.name === selectedEmotion);
    const color =
      allEmotions.find((e) => e.name === selectedEmotion)?.color_hex ?? colors.primary;
    return { count: match?.count ?? 0, color };
  });

  const maxCount = Math.max(...barData.map((d) => d.count), 1);
  const weekEmotions = aggregateEmotions(weekDays);

  const totalEmotions = weekEmotions.reduce((s, e) => s + e.count, 0);
  const totalPurchases = weekDays.reduce((s, d) => s + d.count, 0);
  const weekLabel = isThisWeek ? "This week" : formatWeekLabel(WEEK_STARTS[weekIdx]);

  // Pick top 5 emotions for the highlights row
  const moodHighlights = allEmotions.slice(0, 5);

  return (
    <View style={styles.screen}>
      <TopAppBar />

      <ScrollView style={{ flex: 1 }} contentContainerStyle={styles.content}>
        {/* Segmented control (Weekly | Monthly) */}
        <View style={styles.segmentWrap}>
          <View style={[styles.segment, glassCard]}>
            <View style={[styles.segmentItem, styles.segmentItemActive]}>
              <Text style={[styles.segmentText, styles.segmentTextActive]}>Weekly</Text>
            </View>
            <Pressable style={styles.segmentItem} onPress={() => router.push("/monthlyHeatmap")}>
              <Text style={styles.segmentText}>Monthly</Text>
            </Pressable>
          </View>
        </View>

        {/* Date navigation */}
        <View style={[styles.dateNav, glassCard]}>
          <Pressable
            style={[styles.navArrow, !canGoBack && styles.navDisabled]}
            onPress={() => canGoBack && handleWeekChange(-1)}
          >
            <MaterialIcons
              name="chevron-left"
              size={22}
              color={canGoBack ? colors.primary : colors.outlineVariant}
            />
          </Pressable>
          <Text style={styles.dateNavText}>{weekLabel}</Text>
          <Pressable
            style={[styles.navArrow, !canGoForward && styles.navDisabled]}
            onPress={() => canGoForward && handleWeekChange(1)}
          >
            <MaterialIcons
              name="chevron-right"
              size={22}
              color={canGoForward ? colors.primary : colors.outlineVariant}
            />
          </Pressable>
        </View>

        {/* Mood highlights */}
        {moodHighlights.length > 0 && (
          <View style={[styles.card, glassCard]}>
            <Text style={styles.cardLabel}>Mood Highlights</Text>
            <View style={styles.moodRow}>
              {moodHighlights.map((emotion) => {
                const isOn = selectedEmotion === emotion.name;
                const baseColor = emotion.color_hex ?? colors.primaryFixed;
                return (
                  <Pressable
                    key={emotion.name}
                    style={styles.moodCol}
                    onPress={() => toggleEmotion(emotion.name)}
                  >
                    <View
                      style={[
                        styles.moodCircle,
                        {
                          backgroundColor: isOn ? baseColor : `${baseColor}55`,
                          borderColor: isOn ? colors.primary : "transparent",
                        },
                      ]}
                    >
                      <Text style={{ fontSize: 22 }}>{emotion.emoji}</Text>
                    </View>
                    <Text style={[styles.moodLabel, isOn && styles.moodLabelActive]}>
                      {emotion.name}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
          </View>
        )}

        {/* Main visualization (bars chart) */}
        <View style={[styles.card, glassCard]}>
          <View>
            <Text style={styles.chartHeadline}>{totalPurchases} purchases</Text>
            <Text style={styles.chartSub}>{isThisWeek ? "this week" : "that week"}</Text>
          </View>

          <View style={styles.chartArea}>
            {/* Grid lines */}
            <View style={styles.gridLines} pointerEvents="none">
              <View style={styles.gridLine} />
              <View style={styles.gridLine} />
              <View style={styles.gridLine} />
            </View>

            {/* Bars */}
            <View style={styles.barsRow}>
              {barData.map((bar, i) => {
                const isSelected = !hasFilter && selectedDay === i;
                const heightPct = bar.count > 0 ? Math.max(bar.count / maxCount, 0.04) : 0;
                const barColor = bar.count === 0 ? colors.surfaceContainerHighest : bar.color;
                return (
                  <Pressable
                    key={i}
                    style={styles.barCol}
                    onPress={() => !hasFilter && setSelectedDay(isSelected ? null : i)}
                    disabled={hasFilter}
                  >
                    <View style={[styles.barTrack, { height: BAR_MAX_H }]}>
                      <View
                        style={[
                          styles.bar,
                          {
                            height: heightPct * BAR_MAX_H,
                            backgroundColor: isSelected ? colors.primaryContainer : barColor,
                          },
                        ]}
                      />
                    </View>
                    <Text
                      style={[
                        styles.barLabel,
                        { color: bar.count === 0 ? colors.outline : colors.onSurfaceVariant },
                      ]}
                    >
                      {DAY_LABELS_SHORT[i]}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
          </View>
        </View>

        {/* Emotions breakdown with gradient progress bars */}
        <View style={[styles.card, glassCard]}>
          <Text style={styles.sectionTitle}>Emotions this week</Text>
          {weekEmotions.length === 0 ? (
            <Text style={styles.emptyText}>No emotions logged this week.</Text>
          ) : (
            <View style={{ gap: spacing.md }}>
              {weekEmotions.map((stat) => {
                const pct = totalEmotions > 0 ? Math.round((stat.count / totalEmotions) * 100) : 0;
                return (
                  <View key={stat.name} style={{ gap: 6 }}>
                    <View style={styles.emotionRow}>
                      <View style={styles.emotionLeft}>
                        <Text style={{ fontSize: 22 }}>{stat.emoji}</Text>
                        <Text style={styles.emotionName}>{stat.name}</Text>
                      </View>
                      <Text style={styles.emotionPct}>
                        {pct}% — {stat.count}
                      </Text>
                    </View>
                    <View style={styles.progressTrack}>
                      <LinearGradient
                        colors={[colors.primary, colors.secondary]}
                        start={{ x: 0, y: 0 }}
                        end={{ x: 1, y: 0 }}
                        style={[styles.progressFill, { width: `${pct}%` }]}
                      />
                    </View>
                  </View>
                );
              })}
            </View>
          )}
        </View>

        <View style={{ height: 110 }} />
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  content: {
    paddingTop: TOP_APP_BAR_HEIGHT + spacing.md,
    paddingHorizontal: spacing.containerMargin,
    paddingBottom: 40,
    gap: spacing.lg,
  },

  segmentWrap: { alignItems: "center" },
  segment: {
    flexDirection: "row",
    padding: 4,
    borderRadius: radii.pill,
    minWidth: 220,
  },
  segmentItem: {
    flex: 1,
    paddingVertical: 8,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: radii.pill,
  },
  segmentItemActive: {
    backgroundColor: colors.surface,
  },
  segmentText: {
    fontFamily: fonts.semibold,
    fontSize: 14,
    color: colors.onSurfaceVariant,
    letterSpacing: 0.14,
  },
  segmentTextActive: { color: colors.onSurface },

  dateNav: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: spacing.gutter,
    paddingVertical: 8,
    borderRadius: radii.pill,
  },
  navArrow: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
  },
  navDisabled: { opacity: 0.4 },
  dateNavText: {
    fontFamily: fonts.semibold,
    fontSize: 16,
    color: colors.onSurface,
  },

  card: {
    borderRadius: radii.lg,
    padding: spacing.md,
  },
  cardLabel: {
    fontFamily: fonts.semibold,
    fontSize: 14,
    color: colors.onSurfaceVariant,
    marginBottom: spacing.sm,
  },

  moodRow: {
    flexDirection: "row",
    justifyContent: "space-between",
  },
  moodCol: {
    alignItems: "center",
    gap: 6,
    flex: 1,
  },
  moodCircle: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 2,
  },
  moodLabel: {
    fontFamily: fonts.medium,
    fontSize: 11,
    color: colors.onSurfaceVariant,
  },
  moodLabelActive: {
    color: colors.primary,
    fontFamily: fonts.semibold,
  },

  chartHeadline: {
    fontFamily: fonts.semibold,
    fontSize: 24,
    color: colors.onSurface,
  },
  chartSub: {
    fontFamily: fonts.regular,
    fontSize: 14,
    color: colors.onSurfaceVariant,
  },
  chartArea: {
    marginTop: spacing.md,
    height: BAR_MAX_H + 32,
    position: "relative",
  },
  gridLines: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 32,
    justifyContent: "space-between",
  },
  gridLine: {
    height: 1,
    backgroundColor: colors.outlineVariant,
    opacity: 0.3,
  },
  barsRow: {
    flexDirection: "row",
    alignItems: "flex-end",
    justifyContent: "space-between",
    height: BAR_MAX_H + 32,
    paddingTop: 8,
    paddingBottom: 0,
  },
  barCol: {
    alignItems: "center",
    flex: 1,
    height: "100%",
    justifyContent: "flex-end",
  },
  barTrack: {
    width: "60%",
    maxWidth: 32,
    justifyContent: "flex-end",
  },
  bar: {
    width: "100%",
    borderTopLeftRadius: radii.md,
    borderTopRightRadius: radii.md,
    minHeight: 6,
  },
  barLabel: {
    fontFamily: fonts.medium,
    fontSize: 12,
    marginTop: 8,
  },

  sectionTitle: {
    fontFamily: fonts.semibold,
    fontSize: 22,
    color: colors.onSurface,
    marginBottom: spacing.md,
  },
  emotionRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  emotionLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  emotionName: {
    fontFamily: fonts.semibold,
    fontSize: 14,
    color: colors.onSurface,
    letterSpacing: 0.14,
  },
  emotionPct: {
    fontFamily: fonts.regular,
    fontSize: 14,
    color: colors.onSurfaceVariant,
  },
  progressTrack: {
    height: 12,
    borderRadius: 6,
    backgroundColor: colors.surfaceContainerHighest,
    overflow: "hidden",
  },
  progressFill: {
    height: "100%",
    borderRadius: 6,
  },
  emptyText: {
    fontFamily: fonts.regular,
    fontSize: 14,
    color: colors.outline,
    paddingVertical: spacing.md,
  },
});
