import React, { useState, useRef } from "react";
import { View, StyleSheet, ScrollView, Pressable, FlatList } from "react-native";
import { Text } from "@/components/Text";
import { Ionicons } from "@expo/vector-icons";

const DAY_LABELS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
const MONTHS = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];

const EMOTION_NOUN: Record<string, string> = {
  Stressed: "Stress",
  Happy:    "Happiness",
  Anxious:  "Anxiety",
  Bored:    "Boredom",
  Excited:  "Excitement",
};

type EmotionStat = {
  name: string;
  emoji: string;
  color_hex: string;
  count: number;
};

type DayData = {
  count: number;
  emotions: EmotionStat[];
};

type WeekData = { days: DayData[] };


// ALL THIS DATA IS ONLY A MOCKUP aqui vao ter que entrar as cenas da DB que ACHO que é o duarte que ta a fazer, aqui é so pra ter uma ideia de como é que os dados vao ser usados e tal
const MOCK_DATA: WeekData[] = [
  // index 0 — Mar 17–23
  {
    days: [
      { count: 2, emotions: [{ name: "Stressed", emoji: "😤", color_hex: "#ffcc80", count: 2 }] },
      { count: 4, emotions: [{ name: "Anxious", emoji: "😟", color_hex: "#ef9a9a", count: 3 }, { name: "Bored", emoji: "😑", color_hex: "#b0bec5", count: 1 }] },
      { count: 3, emotions: [{ name: "Happy", emoji: "😊", color_hex: "#a5d6a7", count: 2 }, { name: "Excited", emoji: "🤩", color_hex: "#ce93d8", count: 1 }] },
      { count: 3, emotions: [{ name: "Stressed", emoji: "😤", color_hex: "#ffcc80", count: 2 }, { name: "Happy", emoji: "😊", color_hex: "#a5d6a7", count: 1 }] },
      { count: 5, emotions: [{ name: "Anxious", emoji: "😟", color_hex: "#ef9a9a", count: 3 }, { name: "Excited", emoji: "🤩", color_hex: "#ce93d8", count: 2 }] },
      { count: 2, emotions: [{ name: "Happy", emoji: "😊", color_hex: "#a5d6a7", count: 2 }] },
      { count: 0, emotions: [] },
    ],
  },
  // index 1 — Mar 24–30 (this week)
  {
    days: [
      { count: 3, emotions: [{ name: "Anxious", emoji: "😟", color_hex: "#ef9a9a", count: 2 }, { name: "Happy", emoji: "😊", color_hex: "#a5d6a7", count: 1 }] },
      { count: 2, emotions: [{ name: "Bored", emoji: "😑", color_hex: "#b0bec5", count: 1 }, { name: "Excited", emoji: "🤩", color_hex: "#ce93d8", count: 1 }] },
      { count: 5, emotions: [{ name: "Stressed", emoji: "😤", color_hex: "#ffcc80", count: 3 }, { name: "Anxious", emoji: "😟", color_hex: "#ef9a9a", count: 2 }] },
      { count: 3, emotions: [{ name: "Happy", emoji: "😊", color_hex: "#a5d6a7", count: 2 }, { name: "Excited", emoji: "🤩", color_hex: "#ce93d8", count: 1 }] },
      { count: 4, emotions: [{ name: "Stressed", emoji: "😤", color_hex: "#ffcc80", count: 2 }, { name: "Bored", emoji: "😑", color_hex: "#b0bec5", count: 1 }, { name: "Happy", emoji: "😊", color_hex: "#a5d6a7", count: 1 }] },
      { count: 6, emotions: [{ name: "Happy", emoji: "😊", color_hex: "#a5d6a7", count: 3 }, { name: "Anxious", emoji: "😟", color_hex: "#ef9a9a", count: 2 }, { name: "Excited", emoji: "🤩", color_hex: "#ce93d8", count: 1 }] },
      { count: 1, emotions: [{ name: "Stressed", emoji: "😤", color_hex: "#ffcc80", count: 1 }] },
    ],
  },
];

const WEEK_STARTS = [new Date(2026, 2, 17), new Date(2026, 2, 24)];
const THIS_WEEK_IDX = 1;
const BAR_MAX_H = 120;
const ITEM_W = 82;

const ALL_EMOTIONS: EmotionStat[] = (() => {
  const map = new Map<string, EmotionStat>();
  for (const week of MOCK_DATA)
    for (const day of week.days)
      for (const e of day.emotions)
        if (!map.has(e.name)) map.set(e.name, { ...e, count: 0 });
  return Array.from(map.values());
})();

// Triple the list for infinite loop effect
const LOOPED = [...ALL_EMOTIONS, ...ALL_EMOTIONS, ...ALL_EMOTIONS];

function formatWeekLabel(d: Date) {
  const end = new Date(d);
  end.setDate(d.getDate() + 6);
  return `${MONTHS[d.getMonth()]} ${d.getDate()} – ${MONTHS[end.getMonth()]} ${end.getDate()}`;
}

function aggregateEmotions(days: DayData[]): EmotionStat[] {
  const map = new Map<string, EmotionStat>();
  for (const day of days)
    for (const e of day.emotions) {
      if (map.has(e.name)) map.get(e.name)!.count += e.count;
      else map.set(e.name, { ...e });
    }
  return Array.from(map.values()).sort((a, b) => b.count - a.count);
}

export default function Calendar() {
  const [weekIdx, setWeekIdx]             = useState(THIS_WEEK_IDX);
  const [selectedDay, setSelectedDay]     = useState<number | null>(null);
  const [selectedEmotion, setSelectedEmotion] = useState<string | null>(null);
  const flatRef = useRef<FlatList>(null);

  const currentWeek  = MOCK_DATA[weekIdx];
  const isThisWeek   = weekIdx === THIS_WEEK_IDX;
  const canGoBack    = weekIdx > 0;
  const canGoForward = weekIdx < MOCK_DATA.length - 1;
  const hasFilter    = selectedEmotion !== null;

  function handleWeekChange(dir: -1 | 1) {
    setWeekIdx((p) => p + dir);
    setSelectedDay(null);
  }

  function toggleEmotion(name: string) {
    setSelectedEmotion((prev) => prev === name ? null : name);
    setSelectedDay(null);
  }

  // Nice try of scrolling,, not working correctly tho ahaha
  function handleMomentumScrollEnd(e: any) {
    const x     = e.nativeEvent.contentOffset.x;
    const setW  = ALL_EMOTIONS.length * ITEM_W;
    if (x < setW) {
      flatRef.current?.scrollToOffset({ offset: x + setW, animated: false });
    } else if (x >= setW * 2) {
      flatRef.current?.scrollToOffset({ offset: x - setW, animated: false });
    }
  }

  // Bar values
  const barData = currentWeek.days.map((day) => {
    if (!hasFilter) return { count: day.count, color: "#d4d4d4" };
    const match = day.emotions.find((e) => e.name === selectedEmotion);
    const color = ALL_EMOTIONS.find((e) => e.name === selectedEmotion)?.color_hex ?? "#d4d4d4";
    return { count: match?.count ?? 0, color };
  });

  const maxCount     = Math.max(...barData.map((d) => d.count), 1);
  const weekEmotions = aggregateEmotions(currentWeek.days);

  const activeEmotions = hasFilter
    ? weekEmotions.filter((e) => e.name === selectedEmotion)
    : selectedDay !== null
      ? currentWeek.days[selectedDay].emotions
      : weekEmotions;

  const totalEmotions = hasFilter
    ? weekEmotions.reduce((s, e) => s + e.count, 0)
    : activeEmotions.reduce((s, e) => s + e.count, 0);

  const weekLabel = isThisWeek ? "This week" : formatWeekLabel(WEEK_STARTS[weekIdx]);

  let sectionTitle = "Emotions this week";
  if (hasFilter) {
    const noun = EMOTION_NOUN[selectedEmotion!] ?? selectedEmotion!;
    sectionTitle = `${noun} this week`;
  } else if (selectedDay !== null) {
    sectionTitle = `Emotions on ${DAY_LABELS[selectedDay]}`;
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Text style={styles.title}>Weekly Heatmap</Text>

      {/* ── Emotion slider ── */}
      <View style={styles.sliderCard}>
        <FlatList
          ref={flatRef}
          data={LOOPED}
          keyExtractor={(_, i) => String(i)}
          horizontal
          showsHorizontalScrollIndicator={false}
          snapToInterval={ITEM_W}
          decelerationRate="fast"
          initialScrollIndex={ALL_EMOTIONS.length}
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

      {/* ── Week navigator ── */}
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

      {/* ── Emotion breakdown ── */}
      <View style={styles.card}>
        <Text style={styles.sectionTitle}>{sectionTitle}</Text>
        {hasFilter ? (
          <View style={styles.filterCount}>
            <Text style={[styles.filterCountNumber, { color: ALL_EMOTIONS.find(e => e.name === selectedEmotion)?.color_hex ?? "#333" }]}>
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
          <Text style={styles.emptyText}>No emotions logged.</Text>
        )}
      </View>

      {/* ── Monthly heatmap button ── */}
      <Pressable style={styles.monthlyBtn}>
        <Ionicons name="calendar-outline" size={15} color="#555" style={{ marginRight: 7 }} />
        <Text style={styles.monthlyBtnText}>Monthly heatmap</Text>
      </Pressable>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#fdf3ff" },
  content:   { padding: 20, paddingTop: 60, paddingBottom: 40 },
  title:     { fontSize: 26, fontFamily: "RobotoSerif_600SemiBold", marginBottom: 16, color: "#333" },

  // ── slider ──
  sliderCard: {
    backgroundColor: "#fff",
    borderRadius: 14,
    paddingVertical: 8,
    marginBottom: 16,
    shadowColor: "#000",
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 2,
  },
  sliderItem: {
    width: ITEM_W,
    alignItems: "center",
    paddingVertical: 2,
    borderRadius: 10,
  },
  sliderEmojiWrap: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 4,
  },
  sliderEmoji: { fontSize: 18 },
  sliderLabel: { fontSize: 10, color: "#888", textAlign: "center" },

  // ── bar chart ──
  card: {
    backgroundColor: "#fff",
    borderRadius: 16,
    padding: 16,
    marginBottom: 16,
    shadowColor: "#000",
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 2,
  },
  barsRow:    { flexDirection: "row", alignItems: "flex-end", justifyContent: "space-between", height: BAR_MAX_H + 44, paddingTop: 20 },
  barColumn:  { flex: 1, alignItems: "center", justifyContent: "flex-end" },
  barCount:   { fontSize: 11, color: "#999", marginBottom: 2, height: 14 },
  barTrack:   { width: "55%", height: BAR_MAX_H, justifyContent: "flex-end" },
  bar:        { width: "100%", borderRadius: 5 },
  dayLabel:   { fontSize: 12, color: "#999", marginTop: 6 },
  dayLabelSelected: { color: "#1a1a1a", fontFamily: "RobotoSerif_600SemiBold" },

  // ── week nav ──
  weekNav: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#fff",
    borderRadius: 16,
    marginBottom: 16,
    shadowColor: "#000",
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 2,
    overflow: "hidden",
  },
  navArrow:   { width: 44, height: 48, alignItems: "center", justifyContent: "center" },
  navDisabled: { opacity: 0.4 },
  navLabel:   { flex: 1, height: 48, alignItems: "center", justifyContent: "center", borderLeftWidth: 1, borderRightWidth: 1, borderColor: "#f0f0f0" },
  navLabelText: { fontSize: 14, fontFamily: "RobotoSerif_600SemiBold", color: "#333" },

  // ── emotions ──
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

  // ── monthly button ──
  monthlyBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#fff",
    borderRadius: 16,
    height: 48,
    shadowColor: "#000",
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 2,
  },
  monthlyBtnText: { fontSize: 14, fontFamily: "RobotoSerif_600SemiBold", color: "#555" },
});
