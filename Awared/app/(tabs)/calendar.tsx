import React, { useState, useRef, useEffect, useCallback } from "react";
import { View, StyleSheet, Pressable, FlatList, Animated } from "react-native";
import { Text } from "@/components/Text";
import { Ionicons } from "@expo/vector-icons";
import MonthlyHeatmapPanel from "@/components/MonthlyHeatmapPanel";
import { getWeekHeatmapData, WeekDayData, WeekEmotionStat } from "@/database/transactions";
import { getDb } from "@/database/db";

const DAY_LABELS       = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];
const DAY_LABELS_SHORT = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
const MONTHS = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
const MONTHS_LONG = ["January","February","March","April","May","June","July","August","September","October","November","December"];

const BAR_MAX_H = 120;
const ITEM_W = 82;
const WEEKS_BACK = 7;

function getMonday(d: Date): Date {
  const day = d.getDay();
  const diff = (day === 0 ? -6 : 1 - day);
  const monday = new Date(d);
  monday.setDate(d.getDate() + diff);
  monday.setHours(0, 0, 0, 0);
  return monday;
}

function formatWeekLabel(d: Date): string {
  const end = new Date(d);
  end.setDate(d.getDate() + 6);
  return `${MONTHS[d.getMonth()]} ${d.getDate()} – ${MONTHS[end.getMonth()]} ${end.getDate()}`;
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
  const today = new Date();

  const [weekIdx,          setWeekIdx]          = useState(THIS_WEEK_IDX);
  const [weekDays,         setWeekDays]         = useState<WeekDayData[]>(Array.from({ length: 7 }, () => ({ count: 0, emotions: [] })));
  const [allEmotions,      setAllEmotions]      = useState<WeekEmotionStat[]>([]);
  const [selectedDay,      setSelectedDay]      = useState<number | null>(null);
  const [selectedEmotion,  setSelectedEmotion]  = useState<string | null>(null);
  const flatRef   = useRef<FlatList>(null);
  const pillAnim  = useRef(new Animated.Value(0)).current;
  const [activeTab, setActiveTab] = useState<0 | 1>(0);

  const [monthYear,  setMonthYear]  = useState(today.getFullYear());
  const [monthMonth, setMonthMonth] = useState(today.getMonth());

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

  const LOOPED = [...allEmotions, ...allEmotions, ...allEmotions];

  const canGoBackMonth    = !(monthYear === today.getFullYear() && monthMonth === today.getMonth() - 11);
  const canGoForwardMonth = !(monthYear === today.getFullYear() && monthMonth === today.getMonth());

  function changeMonth(dir: -1 | 1) {
    let m = monthMonth + dir, y = monthYear;
    if (m < 0)  { m = 11; y--; }
    if (m > 11) { m = 0;  y++; }
    setMonthMonth(m); setMonthYear(y);
  }

  function goMonthly() {
    setActiveTab(1);
    Animated.spring(pillAnim, { toValue: 116, useNativeDriver: true, tension: 180, friction: 22 }).start();
  }

  function goWeekly() {
    setActiveTab(0);
    Animated.spring(pillAnim, { toValue: 0, useNativeDriver: true, tension: 180, friction: 22 }).start();
  }

  const isThisWeek   = weekIdx === THIS_WEEK_IDX;
  const canGoBack    = weekIdx > 0;
  const canGoForward = weekIdx < THIS_WEEK_IDX;
  const hasFilter    = selectedEmotion !== null;

  function handleWeekChange(dir: -1 | 1) {
    setWeekIdx((p) => p + dir);
    setSelectedDay(null);
  }

  function toggleEmotion(name: string) {
    setSelectedEmotion((prev) => prev === name ? null : name);
    setSelectedDay(null);
  }

  function handleMomentumScrollEnd(e: any) {
    if (allEmotions.length === 0) return;
    const x    = e.nativeEvent.contentOffset.x;
    const setW = allEmotions.length * ITEM_W;
    if (x < setW) {
      flatRef.current?.scrollToOffset({ offset: x + setW, animated: false });
    } else if (x >= setW * 2) {
      flatRef.current?.scrollToOffset({ offset: x - setW, animated: false });
    }
  }

  const barData = weekDays.map((day) => {
    if (!hasFilter) return { count: day.count, color: "#d4d4d4" };
    const match = day.emotions.find((e) => e.name === selectedEmotion);
    const color = allEmotions.find((e) => e.name === selectedEmotion)?.color_hex ?? "#d4d4d4";
    return { count: match?.count ?? 0, color };
  });

  const maxCount     = Math.max(...barData.map((d) => d.count), 1);
  const weekEmotions = aggregateEmotions(weekDays);

  const activeEmotions = hasFilter
    ? weekEmotions.filter((e) => e.name === selectedEmotion)
    : selectedDay !== null
      ? weekDays[selectedDay].emotions
      : weekEmotions;

  const totalEmotions = hasFilter
    ? weekEmotions.reduce((s, e) => s + e.count, 0)
    : activeEmotions.reduce((s, e) => s + e.count, 0);

  const totalPurchases = weekDays.reduce((s, d) => s + d.count, 0);
  const weekLabel = isThisWeek ? "This week" : formatWeekLabel(WEEK_STARTS[weekIdx]);

  let sectionTitle = "Emotions this week";
  if (hasFilter) {
    sectionTitle = `${selectedEmotion} this week`;
  } else if (selectedDay !== null) {
    sectionTitle = `Emotions on ${DAY_LABELS[selectedDay]}`;
  }

  return (
    <View style={styles.screen}>

      {/* ── Header with underline tabs ── */}
      <View style={styles.header}>
        <View style={styles.headerTop}>
          <Text style={styles.screenTitle}>Expense Heatmap</Text>
          <View style={styles.tabRow}>
            <Pressable onPress={goWeekly} style={styles.tabItem}>
              <Text style={[styles.tabText, activeTab === 0 && styles.tabTextActive]}>Weekly</Text>
              {activeTab === 0 && <View style={styles.tabUnderline} />}
            </Pressable>
            <Pressable onPress={goMonthly} style={styles.tabItem}>
              <Text style={[styles.tabText, activeTab === 1 && styles.tabTextActive]}>Monthly</Text>
              {activeTab === 1 && <View style={styles.tabUnderline} />}
            </Pressable>
          </View>
        </View>
        <View style={styles.headerBorder} />
      </View>

      {/* ── Navigator strip ── */}
      <View style={styles.navRow}>
        {activeTab === 0 ? (
          <View style={styles.weekNav}>
            <Pressable
              style={[styles.navArrow, !canGoBack && styles.navDisabled]}
              onPress={() => canGoBack && handleWeekChange(-1)}
            >
              <Ionicons name="chevron-back" size={18} color={canGoBack ? "#6b21a8" : "#d8b4fe"} />
            </Pressable>
            <Text style={styles.navLabelText}>{weekLabel}</Text>
            <Pressable
              style={[styles.navArrow, !canGoForward && styles.navDisabled]}
              onPress={() => canGoForward && handleWeekChange(1)}
            >
              <Ionicons name="chevron-forward" size={18} color={canGoForward ? "#6b21a8" : "#d8b4fe"} />
            </Pressable>
          </View>
        ) : (
          <View style={styles.weekNav}>
            <Pressable
              style={[styles.navArrow, !canGoBackMonth && styles.navDisabled]}
              onPress={() => canGoBackMonth && changeMonth(-1)}
            >
              <Ionicons name="chevron-back" size={18} color={canGoBackMonth ? "#6b21a8" : "#d8b4fe"} />
            </Pressable>
            <Text style={styles.navLabelText}>{MONTHS_LONG[monthMonth]} {monthYear}</Text>
            <Pressable
              style={[styles.navArrow, !canGoForwardMonth && styles.navDisabled]}
              onPress={() => canGoForwardMonth && changeMonth(1)}
            >
              <Ionicons name="chevron-forward" size={18} color={canGoForwardMonth ? "#6b21a8" : "#d8b4fe"} />
            </Pressable>
          </View>
        )}
      </View>

      {/* ── Panels ── */}
      {activeTab === 0 ? (
        <View style={styles.panelContent}>

          {/* ── Emotion slider ── */}
          {allEmotions.length > 0 && (
            <View style={styles.sliderWrap}>
              <FlatList
                ref={flatRef}
                data={LOOPED}
                keyExtractor={(_, i) => String(i)}
                horizontal
                showsHorizontalScrollIndicator={false}
                snapToInterval={ITEM_W}
                decelerationRate="fast"
                initialScrollIndex={allEmotions.length}
                getItemLayout={(_, index) => ({ length: ITEM_W, offset: ITEM_W * index, index })}
                onMomentumScrollEnd={handleMomentumScrollEnd}
                renderItem={({ item }) => {
                  const isOn = selectedEmotion === item.name;
                  return (
                    <Pressable
                      style={[
                        styles.sliderItem,
                        isOn && {
                          backgroundColor: item.color_hex + "22",
                          borderColor: item.color_hex,
                          borderWidth: 1,
                        },
                      ]}
                      onPress={() => toggleEmotion(item.name)}
                    >
                      <Text style={styles.sliderEmoji}>{item.emoji}</Text>
                      <Text style={[styles.sliderLabel, isOn && { color: "#1a1a1a", fontFamily: "RobotoSerif_600SemiBold" }]}>
                        {item.name}
                      </Text>
                    </Pressable>
                  );
                }}
              />
            </View>
          )}

          {/* ── Bar chart ── */}
          <View style={styles.chartCard}>
            <View style={styles.chartHeader}>
              <Text style={styles.chartStatNum}>{totalPurchases}</Text>
              <Text style={styles.chartStatLabel}> purchases this week</Text>
            </View>
            <View style={styles.barsRow}>
              {barData.map((bar, i) => {
                const isSelected = !hasFilter && selectedDay === i;
                let barColor: string;
                if (hasFilter) {
                  barColor = bar.color;
                } else if (isSelected) {
                  barColor = "#6b21a8";
                } else {
                  barColor = "#d8b4fe";
                }
                return (
                  <Pressable
                    key={i}
                    style={styles.barColumn}
                    onPress={() => !hasFilter && setSelectedDay(isSelected ? null : i)}
                    disabled={hasFilter}
                  >
                    <Text style={[styles.barCount, isSelected && styles.barCountSelected]}>
                      {bar.count > 0 ? bar.count : ""}
                    </Text>
                    <View style={styles.barTrack}>
                      <View
                        style={[
                          styles.bar,
                          {
                            height: bar.count > 0 ? Math.max((bar.count / maxCount) * BAR_MAX_H, 6) : 0,
                            backgroundColor: barColor,
                          },
                        ]}
                      />
                    </View>
                  </Pressable>
                );
              })}
            </View>
            <View style={styles.baseline} />
            <View style={styles.dayLabelsRow}>
              {DAY_LABELS_SHORT.map((lbl, i) => (
                <View key={i} style={styles.dayLabelCell}>
                  <Text style={[styles.dayLabel, !hasFilter && selectedDay === i && styles.dayLabelSelected]}>
                    {lbl}
                  </Text>
                </View>
              ))}
            </View>
          </View>

          {/* ── Emotion breakdown ── */}
          <View style={styles.emotionCard}>
            <Text style={styles.sectionTitle}>{sectionTitle}</Text>
            {hasFilter ? (
              <View style={styles.filterCount}>
                <Text style={[styles.filterCountNumber, { color: allEmotions.find(e => e.name === selectedEmotion)?.color_hex ?? "#333" }]}>
                  {activeEmotions[0]?.count ?? 0}
                </Text>
                <Text style={styles.filterCountLabel}>purchases</Text>
              </View>
            ) : activeEmotions.length > 0 ? (
              activeEmotions.map((stat) => {
                const pct = totalEmotions > 0 ? Math.round((stat.count / totalEmotions) * 100) : 0;
                return (
                  <View key={stat.name} style={[styles.emotionRow, { borderLeftColor: stat.color_hex }]}>
                    <Text style={styles.emotionEmoji}>{stat.emoji}</Text>
                    <Text style={styles.emotionName}>{stat.name}</Text>
                    <Text style={styles.emotionPct}>{pct}%</Text>
                    <View style={[styles.emotionCountBadge, { backgroundColor: stat.color_hex + "28" }]}>
                      <Text style={[styles.emotionCountText, { color: stat.color_hex }]}>{stat.count}</Text>
                    </View>
                  </View>
                );
              })
            ) : (
              <Text style={styles.emptyText}>No emotions logged this week.</Text>
            )}
          </View>

        </View>
      ) : (
        <View style={styles.monthlyPanel}>
          <MonthlyHeatmapPanel year={monthYear} month={monthMonth} />
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: "#fdf3ff" },

  header: {
    paddingTop: 60,
    paddingHorizontal: 20,
    backgroundColor: "#fdf3ff",
  },
  headerTop: {
    flexDirection: "row",
    alignItems: "flex-end",
    justifyContent: "space-between",
    paddingBottom: 12,
  },
  screenTitle: {
    fontSize: 22,
    fontFamily: "RobotoSerif_700Bold",
    color: "#1a1a1a",
    letterSpacing: -0.3,
  },
  headerBorder: { height: 1, backgroundColor: "#ede4f7" },

  tabRow: { flexDirection: "row", gap: 18, alignItems: "flex-end" },
  tabItem: { paddingBottom: 12, position: "relative" },
  tabText: { fontSize: 13, fontFamily: "RobotoSerif_400Regular", color: "#c4a8e0" },
  tabTextActive: { color: "#6b21a8", fontFamily: "RobotoSerif_600SemiBold" },
  tabUnderline: {
    position: "absolute",
    bottom: -1,
    left: 0,
    right: 0,
    height: 2,
    backgroundColor: "#6b21a8",
    borderRadius: 1,
  },

  navRow: { paddingHorizontal: 20, paddingTop: 16, paddingBottom: 4 },
  monthlyPanel: { flex: 1 },
  panelContent: { flex: 1, paddingHorizontal: 20, paddingTop: 4 },

  weekNav: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 16,
  },
  navArrow: { width: 36, height: 36, alignItems: "center", justifyContent: "center" },
  navDisabled: { opacity: 0.35 },
  navLabelText: { fontSize: 15, fontFamily: "RobotoSerif_600SemiBold", color: "#333" },

  sliderWrap: { marginBottom: 20, marginHorizontal: -20 },
  sliderItem: {
    width: ITEM_W,
    alignItems: "center",
    paddingVertical: 8,
    paddingHorizontal: 4,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "transparent",
  },
  sliderEmoji: { fontSize: 20, marginBottom: 4 },
  sliderLabel: { fontSize: 10, color: "#bbb", textAlign: "center" },

  chartCard: {
    backgroundColor: "#fff",
    borderRadius: 16,
    padding: 16,
    paddingBottom: 12,
    marginBottom: 16,
    shadowColor: "#a78bda",
    shadowOpacity: 0.08,
    shadowRadius: 10,
    elevation: 2,
  },
  chartHeader: {
    flexDirection: "row",
    alignItems: "baseline",
    marginBottom: 12,
  },
  chartStatNum: {
    fontSize: 22,
    fontFamily: "RobotoSerif_700Bold",
    color: "#6b21a8",
  },
  chartStatLabel: {
    fontSize: 13,
    fontFamily: "RobotoSerif_400Regular",
    color: "#bbb",
  },
  barsRow: {
    flexDirection: "row",
    alignItems: "flex-end",
    justifyContent: "space-between",
    paddingTop: 4,
    paddingBottom: 0,
  },
  barColumn: { flex: 1, alignItems: "center", justifyContent: "flex-end" },
  barCount: { fontSize: 11, color: "#d8b4fe", marginBottom: 3, height: 14 },
  barCountSelected: { color: "#6b21a8", fontFamily: "RobotoSerif_600SemiBold" },
  barTrack: { width: "45%", height: BAR_MAX_H, justifyContent: "flex-end" },
  bar: {
    width: "100%",
    borderTopLeftRadius: 4,
    borderTopRightRadius: 4,
    borderBottomLeftRadius: 0,
    borderBottomRightRadius: 0,
  },
  baseline: { height: 1, backgroundColor: "#ede4f7", marginTop: 0 },
  dayLabelsRow: { flexDirection: "row", paddingTop: 8 },
  dayLabelCell: { flex: 1, alignItems: "center" },
  dayLabel: { fontSize: 11, color: "#bbb" },
  dayLabelSelected: { color: "#6b21a8", fontFamily: "RobotoSerif_600SemiBold" },

  emotionCard: {
    backgroundColor: "#fff",
    borderRadius: 16,
    padding: 16,
    marginBottom: 16,
    shadowColor: "#a78bda",
    shadowOpacity: 0.08,
    shadowRadius: 10,
    elevation: 2,
  },
  sectionTitle: {
    fontSize: 15,
    fontFamily: "RobotoSerif_600SemiBold",
    color: "#333",
    marginBottom: 12,
  },
  emotionRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 10,
    paddingHorizontal: 10,
    borderLeftWidth: 3,
    marginBottom: 7,
    backgroundColor: "#fff",
    borderTopRightRadius: 6,
    borderBottomRightRadius: 6,
  },
  emotionEmoji: { fontSize: 15, marginRight: 8 },
  emotionName: { fontSize: 13, color: "#444", fontFamily: "RobotoSerif_500Medium", flex: 1 },
  emotionPct: { fontSize: 11, color: "#bbb", marginRight: 8 },
  emotionCountBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
    minWidth: 30,
    alignItems: "center",
  },
  emotionCountText: { fontSize: 11, fontFamily: "RobotoSerif_600SemiBold" },
  emptyText: { color: "#ccc", fontSize: 14, paddingVertical: 4 },
  filterCount: { alignItems: "center", paddingVertical: 16 },
  filterCountNumber: { fontSize: 52, fontFamily: "RobotoSerif_700Bold", lineHeight: 58 },
  filterCountLabel: { fontSize: 13, color: "#999", marginTop: 2 },
});
