import React, { useState, useRef, useEffect, useCallback } from "react";
import { View, StyleSheet, Pressable, FlatList, Animated } from "react-native";
import { Text } from "@/components/Text";
import { Ionicons } from "@expo/vector-icons";
import MonthlyHeatmapPanel from "@/components/MonthlyHeatmapPanel";
import { getWeekHeatmapData, WeekDayData, WeekEmotionStat } from "@/database/transactions";
import { getDb } from "@/database/db";

const DAY_LABELS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
const MONTHS = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
const MONTHS_LONG = ["January","February","March","April","May","June","July","August","September","October","November","December"];

const BAR_MAX_H = 120;
const ITEM_W = 82;
const WEEKS_BACK = 7; // how many past weeks to allow navigation

// ─── Helpers ───────────────────────────────────────────────────────────────────
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

// Build array of week-start Mondays: index 0 = WEEKS_BACK ago, last = this week
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

// ─── Component ─────────────────────────────────────────────────────────────────
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

  // Monthly state
  const [monthYear,  setMonthYear]  = useState(today.getFullYear());
  const [monthMonth, setMonthMonth] = useState(today.getMonth());

  // Load all emotions once (for the filter slider)
  useEffect(() => {
    (async () => {
      const db = await getDb();
      const rows = await db.getAllAsync<{ name: string; emoji: string; color_hex: string }>(
        "SELECT name, emoji, color_hex FROM emotions ORDER BY id"
      );
      setAllEmotions(rows.map((r) => ({ ...r, count: 0 })));
    })();
  }, []);

  // Load week data whenever weekIdx changes
  const loadWeek = useCallback(async () => {
    const days = await getWeekHeatmapData(global.userID, WEEK_STARTS[weekIdx]);
    setWeekDays(days);
  }, [weekIdx]);

  useEffect(() => {
    setSelectedDay(null);
    loadWeek();
  }, [loadWeek]);

  // Infinite scroll list (triple for loop effect)
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

  const weekLabel = isThisWeek ? "This week" : formatWeekLabel(WEEK_STARTS[weekIdx]);

  let sectionTitle = "Emotions this week";
  if (hasFilter) {
    sectionTitle = `${selectedEmotion} this week`;
  } else if (selectedDay !== null) {
    sectionTitle = `Emotions on ${DAY_LABELS[selectedDay]}`;
  }

  return (
    <View style={styles.screen}>
      {/* ── Fixed toggle header ── */}
      <View style={styles.header}>
        <Text style={styles.screenTitle}>Expense Heatmap</Text>
        <View style={styles.togglePill}>
          <Animated.View style={[styles.toggleActive, { transform: [{ translateX: pillAnim }] }]} />
          <Pressable style={styles.toggleOption} onPress={goWeekly}>
            <Text style={[styles.toggleText, activeTab === 0 && styles.toggleTextActive]}>Weekly</Text>
          </Pressable>
          <Pressable style={styles.toggleOption} onPress={goMonthly}>
            <Text style={[styles.toggleText, activeTab === 1 && styles.toggleTextActive]}>Monthly</Text>
          </Pressable>
        </View>
      </View>

      {/* ── Navigator strip ── */}
      <View style={styles.navRow}>
        {activeTab === 0 ? (
          <View style={styles.weekNav}>
            <Pressable style={[styles.navArrow, !canGoBack && styles.navDisabled]} onPress={() => canGoBack && handleWeekChange(-1)}>
              <Ionicons name="chevron-back" size={18} color={canGoBack ? "#444" : "#ccc"} />
            </Pressable>
            <View style={styles.navLabel}>
              <Text style={styles.navLabelText}>{weekLabel}</Text>
            </View>
            <Pressable style={[styles.navArrow, !canGoForward && styles.navDisabled]} onPress={() => canGoForward && handleWeekChange(1)}>
              <Ionicons name="chevron-forward" size={18} color={canGoForward ? "#444" : "#ccc"} />
            </Pressable>
          </View>
        ) : (
          <View style={styles.weekNav}>
            <Pressable style={[styles.navArrow, !canGoBackMonth && styles.navDisabled]} onPress={() => canGoBackMonth && changeMonth(-1)}>
              <Ionicons name="chevron-back" size={18} color={canGoBackMonth ? "#444" : "#ccc"} />
            </Pressable>
            <View style={styles.navLabel}>
              <Text style={styles.navLabelText}>{MONTHS_LONG[monthMonth]} {monthYear}</Text>
            </View>
            <Pressable style={[styles.navArrow, !canGoForwardMonth && styles.navDisabled]} onPress={() => canGoForwardMonth && changeMonth(1)}>
              <Ionicons name="chevron-forward" size={18} color={canGoForwardMonth ? "#444" : "#ccc"} />
            </Pressable>
          </View>
        )}
      </View>

      {/* ── Panels ── */}
      {activeTab === 0 ? (
        <View style={styles.panelContent}>

          {/* ── Emotion slider ── */}
          {allEmotions.length > 0 && (
            <View style={styles.sliderCard}>
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
                      style={[styles.sliderItem, isOn && { borderColor: item.color_hex, borderWidth: 2 }]}
                      onPress={() => toggleEmotion(item.name)}
                    >
                      <View style={[styles.sliderEmojiWrap, { backgroundColor: item.color_hex + (isOn ? "55" : "22") }]}>
                        <Text style={styles.sliderEmoji}>{item.emoji}</Text>
                      </View>
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
          <View style={styles.card}>
            <View style={styles.barsRow}>
              {barData.map((bar, i) => {
                const isSelected = !hasFilter && selectedDay === i;
                const color = hasFilter ? bar.color : isSelected ? "#1a1a1a" : "#d4d4d4";
                return (
                  <Pressable
                    key={i}
                    style={styles.barColumn}
                    onPress={() => !hasFilter && setSelectedDay(isSelected ? null : i)}
                    disabled={hasFilter}
                  >
                    <Text style={styles.barCount}>{bar.count > 0 ? bar.count : ""}</Text>
                    <View style={styles.barTrack}>
                      <View
                        style={[
                          styles.bar,
                          {
                            height: bar.count > 0 ? Math.max((bar.count / maxCount) * BAR_MAX_H, 6) : 0,
                            backgroundColor: color,
                          },
                        ]}
                      />
                    </View>
                    <Text style={[styles.dayLabel, isSelected && styles.dayLabelSelected]}>
                      {DAY_LABELS[i]}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
          </View>

          {/* ── Emotion breakdown ── */}
          <View style={styles.card}>
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
                  <View key={stat.name} style={styles.emotionRow}>
                    <View style={styles.emotionLeft}>
                      <Text style={styles.emotionEmoji}>{stat.emoji}</Text>
                      <Text style={styles.emotionName}>{stat.name}</Text>
                    </View>
                    <View style={styles.emotionTrack}>
                      <View style={[styles.emotionFill, { width: `${pct}%`, backgroundColor: stat.color_hex }]} />
                    </View>
                    <Text style={styles.emotionPct}>{pct}%</Text>
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
  screen:  { flex: 1, backgroundColor: "#fdf3ff" },
  header:  { paddingTop: 60, paddingBottom: 12, alignItems: "center", backgroundColor: "#fdf3ff" },
  screenTitle: { fontSize: 26, fontFamily: "RobotoSerif_600SemiBold", color: "#000", marginBottom: 12, marginTop: 8 },

  navRow: { paddingHorizontal: 16, paddingBottom: 10 },
  monthlyPanel: { flex: 1 },
  panelContent: { flex: 1, padding: 16 },

  togglePill: {
    flexDirection: "row", backgroundColor: "#ede4f7", borderRadius: 20,
    padding: 4, position: "relative", width: 240,
  },
  toggleActive: {
    position: "absolute", top: 4, left: 4, width: 116, height: 36,
    backgroundColor: "#fff", borderRadius: 16,
    shadowColor: "#000", shadowOpacity: 0.08, shadowRadius: 4, elevation: 2,
  },
  toggleOption: { flex: 1, height: 36, alignItems: "center", justifyContent: "center" },
  toggleText: { fontSize: 14, fontFamily: "RobotoSerif_600SemiBold", color: "#888" },
  toggleTextActive: { color: "#5c2d91" },

  sliderCard: {
    backgroundColor: "#fff", borderRadius: 14, paddingVertical: 8, marginBottom: 16,
    shadowColor: "#000", shadowOpacity: 0.06, shadowRadius: 8, elevation: 2,
  },
  sliderItem: { width: ITEM_W, alignItems: "center", paddingVertical: 2, borderRadius: 10 },
  sliderEmojiWrap: { width: 36, height: 36, borderRadius: 18, alignItems: "center", justifyContent: "center", marginBottom: 4 },
  sliderEmoji: { fontSize: 18 },
  sliderLabel: { fontSize: 10, color: "#888", textAlign: "center" },

  card: {
    backgroundColor: "#fff", borderRadius: 16, padding: 16, marginBottom: 16,
    shadowColor: "#000", shadowOpacity: 0.06, shadowRadius: 8, elevation: 2,
  },
  barsRow:    { flexDirection: "row", alignItems: "flex-end", justifyContent: "space-between", height: BAR_MAX_H + 44, paddingTop: 20 },
  barColumn:  { flex: 1, alignItems: "center", justifyContent: "flex-end" },
  barCount:   { fontSize: 11, color: "#999", marginBottom: 2, height: 14 },
  barTrack:   { width: "55%", height: BAR_MAX_H, justifyContent: "flex-end" },
  bar:        { width: "100%", borderRadius: 5 },
  dayLabel:   { fontSize: 12, color: "#999", marginTop: 6 },
  dayLabelSelected: { color: "#1a1a1a", fontFamily: "RobotoSerif_600SemiBold" },

  weekNav: {
    flexDirection: "row", alignItems: "center", backgroundColor: "#fff",
    borderRadius: 16, marginBottom: 16,
    shadowColor: "#000", shadowOpacity: 0.06, shadowRadius: 8, elevation: 2, overflow: "hidden",
  },
  navArrow:   { width: 44, height: 48, alignItems: "center", justifyContent: "center" },
  navDisabled: { opacity: 0.4 },
  navLabel:   { flex: 1, height: 48, alignItems: "center", justifyContent: "center", borderLeftWidth: 1, borderRightWidth: 1, borderColor: "#f0f0f0" },
  navLabelText: { fontSize: 14, fontFamily: "RobotoSerif_600SemiBold", color: "#333" },

  sectionTitle: { fontSize: 15, fontFamily: "RobotoSerif_600SemiBold", color: "#444", marginBottom: 14 },
  emotionRow:   { flexDirection: "row", alignItems: "center", marginBottom: 10 },
  emotionLeft:  { flexDirection: "row", alignItems: "center", width: 110 },
  emotionEmoji: { fontSize: 16, marginRight: 6 },
  emotionName:  { fontSize: 13, color: "#555", flexShrink: 1 },
  emotionTrack: { flex: 1, height: 10, backgroundColor: "#eee", borderRadius: 5, marginHorizontal: 8, overflow: "hidden" },
  emotionFill:  { height: "100%", borderRadius: 5 },
  emotionPct:   { fontSize: 13, color: "#777", width: 36, textAlign: "right" },
  emptyText:    { color: "#bbb", fontSize: 14, paddingVertical: 4 },
  filterCount:  { alignItems: "center", paddingVertical: 8 },
  filterCountNumber: { fontSize: 52, fontFamily: "RobotoSerif_700Bold", lineHeight: 58 },
  filterCountLabel:  { fontSize: 13, color: "#999", marginTop: 2 },
});
