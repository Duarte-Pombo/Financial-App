import React, { useState, useCallback, useId } from "react";
import {
  View, Text, Pressable, ScrollView, StyleSheet, Dimensions, Platform,
} from "react-native";
import { useFocusEffect } from "expo-router";
import Svg, { Circle, G, Defs, RadialGradient, Stop } from "react-native-svg";
import {
  getWeekHeatmapData, getMonthHeatmapData,
  WeekDayData, HeatmapMonthData, HeatmapTx,
} from "../../database/transactions";
import {
  EmotionGlyph, EMOTION_NAMES, emotionColor,
} from "../../components/EmotionGlyph";

const C = {
  bg: "#FAF6EF",
  ink: "#1F1B16",
  inkMute: "rgba(31,27,22,0.45)",
  inkSoft: "#7A7268",
  rule: "rgba(0,0,0,0.10)",
  ruleSoft: "rgba(0,0,0,0.06)",
  purple: "#9B82C9",
  ringBg: "#E5DECC",
  blobBg: "#ECE5D6",
};

const MONTHS_LONG = ["january", "february", "march", "april", "may", "june",
  "july", "august", "september", "october", "november", "december"];
const MONTHS_SHORT = ["jan", "feb", "mar", "apr", "may", "jun",
  "jul", "aug", "sep", "oct", "nov", "dec"];
const DAY_LABELS_FULL = ["sunday", "monday", "tuesday", "wednesday", "thursday", "friday", "saturday"];
const WEEK_LABELS = ["m", "t", "w", "t", "f", "s", "s"];
const MONTH_WEEK_LABELS = ["s", "m", "t", "w", "t", "f", "s"];

const SCREEN_W = Dimensions.get("window").width;
const MONTH_GRID_PAD = 16;
const MONTH_CELL_W = (SCREEN_W - MONTH_GRID_PAD * 2) / 7;

// ─── Helpers ─────────────────────────────────────────────────────────────────
function getMonday(d: Date): Date {
  const day = d.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  const m = new Date(d);
  m.setDate(d.getDate() + diff);
  m.setHours(0, 0, 0, 0);
  return m;
}
function formatWeekRange(monday: Date): string {
  const end = new Date(monday);
  end.setDate(monday.getDate() + 6);
  if (monday.getMonth() === end.getMonth()) {
    return `week of ${MONTHS_SHORT[monday.getMonth()]} ${monday.getDate()} – ${end.getDate()}`;
  }
  return `${MONTHS_SHORT[monday.getMonth()]} ${monday.getDate()} – ${MONTHS_SHORT[end.getMonth()]} ${end.getDate()}`;
}
function dateKey(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}
function startOfDay(d: Date): Date {
  const n = new Date(d);
  n.setHours(0, 0, 0, 0);
  return n;
}

// ─── DayRing (weekly) ────────────────────────────────────────────────────────
type Dist = Array<[string, number]>;

function DayRing({
  size, count, dist, label, sub, selected, dim, onPress,
}: {
  size: number;
  count: number;
  dist: Dist;
  label: string;
  sub: string | number;
  selected: boolean;
  dim: boolean;
  onPress: () => void;
}) {
  const stroke = 3.4;
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const total = dist.reduce((sum, [, w]) => sum + w, 0) || 1;
  let offset = 0;
  const segments = dist.map(([e, w], i) => {
    const len = (w / total) * c;
    const seg = {
      i,
      color: emotionColor(e),
      dasharray: `${len} ${c - len}`,
      dashoffset: -offset,
    };
    offset += len;
    return seg;
  });

  return (
    <Pressable
      onPress={onPress}
      style={{ alignItems: "center", opacity: dim ? 0.45 : 1, paddingVertical: 2 }}
    >
      <View style={{ width: size, height: size, justifyContent: "center", alignItems: "center" }}>
        <Svg width={size} height={size} style={StyleSheet.absoluteFill}>
          <G rotation={-90} origin={`${size / 2}, ${size / 2}`}>
            <Circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={C.ringBg} strokeWidth={stroke} />
            {dist.length === 0 && (
              <Circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="#D8D0BF" strokeWidth={stroke} />
            )}
            {segments.map((s) => (
              <Circle
                key={s.i} cx={size / 2} cy={size / 2} r={r}
                fill="none" stroke={s.color} strokeWidth={stroke}
                strokeDasharray={s.dasharray} strokeDashoffset={s.dashoffset}
                strokeLinecap="butt"
              />
            ))}
          </G>
        </Svg>
        <Text style={{ fontSize: 13.5, fontWeight: "600", color: C.ink, fontFamily: "Manrope_600SemiBold" }}>
          {count}
        </Text>
        {selected && (
          <View style={{
            position: "absolute", top: -4, left: -4, right: -4, bottom: -4,
            borderRadius: (size + 8) / 2, borderWidth: 1.5, borderColor: C.purple,
          }} />
        )}
      </View>
      <Text style={{
        fontSize: 12, fontFamily: "PlayfairDisplay_400Regular_Italic",
        color: selected ? C.ink : C.inkSoft, marginTop: 4,
      }}>{label}</Text>
      <Text style={{
        fontSize: 11, fontFamily: "PlayfairDisplay_400Regular_Italic",
        color: C.inkMute, marginTop: 1,
      }}>{sub}</Text>
    </Pressable>
  );
}

// ─── MonthBlob (monthly grid cell) ───────────────────────────────────────────
function MonthBlob({
  size, num, emotions, selected, today, onPress,
}: {
  size: number;
  num: number;
  emotions: string[];
  selected: boolean;
  today: boolean;
  onPress: () => void;
}) {
  const id = useId().replace(/:/g, "");
  const has = emotions.length > 0;

  return (
    <Pressable onPress={onPress} style={{
      width: size, height: size,
      alignItems: "center", justifyContent: "center",
    }}>
      <Svg width={size} height={size} style={StyleSheet.absoluteFill}>
        <Defs>
          {emotions.length === 1 ? (
            <RadialGradient
              id={`b${id}-0`} cx="0.5" cy="0.5" rx="0.5" ry="0.5"
              gradientUnits="objectBoundingBox"
            >
              <Stop offset="0%" stopColor={emotionColor(emotions[0])} stopOpacity="0.8" />
              <Stop offset="55%" stopColor={emotionColor(emotions[0])} stopOpacity="0.4" />
              <Stop offset="100%" stopColor={emotionColor(emotions[0])} stopOpacity="0.06" />
            </RadialGradient>
          ) : emotions.map((e, i) => {
            const cx = ((30 + i * 40) / 100).toFixed(2);
            const cy = ((35 + (i % 2) * 30) / 100).toFixed(2);
            return (
              <RadialGradient
                key={i} id={`b${id}-${i}`} cx={cx} cy={cy} rx="0.7" ry="0.7"
                gradientUnits="objectBoundingBox"
              >
                <Stop offset="0%" stopColor={emotionColor(e)} stopOpacity="0.67" />
                <Stop offset="35%" stopColor={emotionColor(e)} stopOpacity="0.27" />
                <Stop offset="70%" stopColor={emotionColor(e)} stopOpacity="0" />
              </RadialGradient>
            );
          })}
        </Defs>
        {has && <Circle cx={size / 2} cy={size / 2} r={size / 2} fill={C.blobBg} />}
        {has && emotions.map((_, i) => (
          <Circle key={i} cx={size / 2} cy={size / 2} r={size / 2} fill={`url(#b${id}-${i})`} />
        ))}
      </Svg>
      <Text style={{
        fontSize: 12, color: has ? C.ink : C.inkSoft,
        fontFamily: today ? "Manrope_700Bold" : "Manrope_400Regular",
      }}>{num}</Text>
      {selected && (
        <View style={{
          position: "absolute", top: -3, left: -3, right: -3, bottom: -3,
          borderRadius: (size + 6) / 2, borderWidth: 1.5, borderColor: C.purple,
        }} />
      )}
    </Pressable>
  );
}

// ─── DonutChart ──────────────────────────────────────────────────────────────
function DonutChart({
  data, size, thickness, children,
}: {
  data: Dist;
  size: number;
  thickness: number;
  children?: React.ReactNode;
}) {
  const r = (size - thickness) / 2;
  const c = 2 * Math.PI * r;
  const total = data.reduce((s, [, v]) => s + v, 0) || 1;
  let offset = 0;

  return (
    <View style={{ width: size, height: size, justifyContent: "center", alignItems: "center" }}>
      <Svg width={size} height={size} style={StyleSheet.absoluteFill}>
        <G rotation={-90} origin={`${size / 2}, ${size / 2}`}>
          <Circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={C.blobBg} strokeWidth={thickness} />
          {data.map(([e, v], i) => {
            const len = (v / total) * c;
            const node = (
              <Circle
                key={i} cx={size / 2} cy={size / 2} r={r} fill="none"
                stroke={emotionColor(e)} strokeWidth={thickness}
                strokeDasharray={`${len} ${c - len}`} strokeDashoffset={-offset}
                strokeLinecap="butt"
              />
            );
            offset += len;
            return node;
          })}
        </G>
      </Svg>
      <View style={{ alignItems: "center", justifyContent: "center" }}>
        {children}
      </View>
    </View>
  );
}

// ─── LegendItem ──────────────────────────────────────────────────────────────
function LegendItem({
  emo, small, large, active, dim, onPress,
}: {
  emo: string;
  small?: boolean;
  large?: boolean;
  active?: boolean;
  dim?: boolean;
  onPress?: () => void;
}) {
  const color = active ? emotionColor(emo) : C.inkSoft;
  const Wrap: any = onPress ? Pressable : View;
  const glyphSize = large ? 34 : small ? 18 : 30;
  const labelSize = large ? 18 : small ? 13 : 22;
  const gap = large ? 8 : small ? 4 : 6;
  return (
    <Wrap onPress={onPress} style={{
      alignItems: "center", opacity: dim ? 0.4 : 1,
      paddingHorizontal: large ? 8 : 2,
    }}>
      <EmotionGlyph emotion={emo} color={emotionColor(emo)} size={glyphSize} />
      <Text style={{
        fontSize: labelSize, marginTop: gap,
        fontFamily: active ? "PlayfairDisplay_700Bold_Italic" : "PlayfairDisplay_400Regular_Italic",
        color,
        borderBottomWidth: active ? 1.5 : 0,
        borderBottomColor: active ? emotionColor(emo) : "transparent",
        paddingBottom: active ? 1 : 0,
      }}>{emo}</Text>
    </Wrap>
  );
}

// ─── DayPurchases — list of purchases for selected day ──────────────────────
function DayPurchases({ transactions }: { transactions: HeatmapTx[] }) {
  return (
    <View style={{ paddingHorizontal: 24, paddingTop: 16 }}>
      <Text style={{
        fontSize: 13, color: C.inkSoft, letterSpacing: 1.4,
        fontFamily: "Manrope_600SemiBold",
        textTransform: "uppercase", marginBottom: 10,
      }}>purchases</Text>
      {transactions.length === 0 ? (
        <Text style={{
          color: C.inkMute, fontSize: 13,
          fontFamily: "PlayfairDisplay_400Regular_Italic",
          paddingVertical: 8,
        }}>no purchases on this day</Text>
      ) : transactions.map((tx, i) => (
        <View key={i} style={{
          flexDirection: "row", alignItems: "center", gap: 8, paddingVertical: 10,
          borderTopWidth: i ? 1 : 0, borderTopColor: C.ruleSoft,
        }}>
          <View style={{ flex: 1 }}>
            <Text style={{
              fontFamily: "Manrope_600SemiBold", fontSize: 14, color: C.ink,
            }} numberOfLines={1}>{tx.merchant_name}</Text>
            <Text style={{
              fontSize: 12, color: C.inkSoft, fontFamily: "Manrope_400Regular", marginTop: 2,
            }} numberOfLines={1}>
              €{tx.amount.toFixed(2)}
              {tx.category_name ? ` · ${tx.category_name.toLowerCase()}` : ""}
            </Text>
          </View>
          {tx.emotion_name && (
            <View style={{ flexDirection: "row", alignItems: "center", gap: 4 }}>
              <EmotionGlyph
                emotion={tx.emotion_name.toLowerCase()}
                color={emotionColor(tx.emotion_name)} size={14}
              />
              <Text style={{
                fontSize: 13, fontFamily: "PlayfairDisplay_400Regular_Italic",
                color: emotionColor(tx.emotion_name),
              }}>{tx.emotion_name.toLowerCase()}</Text>
            </View>
          )}
        </View>
      ))}
    </View>
  );
}

// ─── Summary ─────────────────────────────────────────────────────────────────
function Summary({
  title, totalSpent, purchases, topEmotion, emotionAgg,
}: {
  title: string;
  totalSpent: number;
  purchases: number;
  topEmotion: string | null;
  emotionAgg: Array<{ emotion: string; count: number; pct: number }>;
}) {
  return (
    <View style={{ paddingHorizontal: 24, paddingTop: 18 }}>
      <Text style={{
        fontSize: 22, textAlign: "center", marginBottom: 14,
        fontFamily: "PlayfairDisplay_400Regular_Italic", color: C.ink,
      }}>{title}</Text>
      <View style={{
        flexDirection: "row", justifyContent: "space-between", marginBottom: 16,
      }}>
        <View style={{ alignItems: "flex-start" }}>
          <Text style={{ fontSize: 22, fontFamily: "Manrope_700Bold", color: C.ink }}>
            €{Math.round(totalSpent)}
          </Text>
          <Text style={st.smallLabel}>total spent</Text>
        </View>
        <View style={{ alignItems: "flex-start" }}>
          <Text style={{ fontSize: 22, fontFamily: "Manrope_700Bold", color: C.ink }}>
            {purchases}
          </Text>
          <Text style={st.smallLabel}>purchases</Text>
        </View>
        <View style={{ alignItems: "flex-start" }}>
          {topEmotion ? (
            <EmotionGlyph emotion={topEmotion} color={emotionColor(topEmotion)} size={22} />
          ) : (
            <Text style={{ fontSize: 22, color: C.inkMute }}>—</Text>
          )}
          <Text style={st.smallLabel}>top emotion</Text>
        </View>
      </View>
      <View style={{ flexDirection: "row", alignItems: "center", gap: 14 }}>
        <DonutChart
          data={emotionAgg.map(e => [e.emotion, e.count] as [string, number])}
          size={110} thickness={14}
        >
          <Text style={{
            fontSize: 13, fontFamily: "PlayfairDisplay_400Regular_Italic", color: C.inkSoft,
          }}>emotions</Text>
        </DonutChart>
        <View style={{ flex: 1, gap: 6 }}>
          {emotionAgg.slice(0, 4).map((e) => (
            <View key={e.emotion} style={{
              flexDirection: "row", alignItems: "center", gap: 8,
            }}>
              <EmotionGlyph emotion={e.emotion} color={emotionColor(e.emotion)} size={14} />
              <Text style={{
                flex: 1, fontFamily: "PlayfairDisplay_400Regular_Italic",
                fontSize: 13, color: C.ink,
              }}>{e.emotion}</Text>
              <Text style={{
                fontSize: 13, color: C.inkSoft, fontFamily: "Manrope_400Regular",
              }}>{Math.round(e.pct * 100)}%</Text>
            </View>
          ))}
          {emotionAgg.length === 0 && (
            <Text style={{
              fontFamily: "PlayfairDisplay_400Regular_Italic",
              fontSize: 13, color: C.inkMute,
            }}>no emotion data yet</Text>
          )}
        </View>
      </View>
    </View>
  );
}

// ─── Screen ──────────────────────────────────────────────────────────────────
export default function Calendar() {
  const today = new Date();
  const todayMonday = getMonday(today);

  const [viewMode, setViewMode] = useState<"weekly" | "monthly">("weekly");
  const [weekStart, setWeekStart] = useState<Date>(todayMonday);
  const [monthYear, setMonthYear] = useState(today.getFullYear());
  const [monthMonth, setMonthMonth] = useState(today.getMonth());
  const [selectedDay, setSelectedDay] = useState<number | null>(null);
  const [filter, setFilter] = useState<string | null>(null);

  const [weekDays, setWeekDays] = useState<WeekDayData[]>(
    Array.from({ length: 7 }, () => ({ count: 0, emotions: [] }))
  );
  const [monthData, setMonthData] = useState<HeatmapMonthData>({});

  const loadWeek = useCallback(async () => {
    const days = await getWeekHeatmapData(global.userID, weekStart);
    setWeekDays(days);
  }, [weekStart]);

  const dataYear = viewMode === "monthly" ? monthYear : weekStart.getFullYear();
  const dataMonth = viewMode === "monthly" ? monthMonth : weekStart.getMonth();

  const loadMonth = useCallback(async () => {
    const m = await getMonthHeatmapData(global.userID, dataYear, dataMonth);
    setMonthData(m);
  }, [dataYear, dataMonth]);

  useFocusEffect(useCallback(() => {
    loadWeek();
    loadMonth();
  }, [loadWeek, loadMonth]));

  // Weekly grid helpers
  const weekDayCount = (i: number) => filter
    ? (weekDays[i].emotions.find(e => e.name.toLowerCase() === filter)?.count ?? 0)
    : weekDays[i].count;
  const weekDayDist = (i: number): Dist =>
    weekDays[i].emotions.map(e => [e.name.toLowerCase(), e.count]);
  const weekDayDistFiltered = (i: number): Dist => {
    const raw = weekDayDist(i);
    return filter ? raw.filter(([e]) => e === filter) : raw;
  };

  // Weekly summary
  const weekTotalSpent = (() => {
    let sum = 0;
    for (let i = 0; i < 7; i++) {
      const d = new Date(weekStart);
      d.setDate(weekStart.getDate() + i);
      sum += monthData[dateKey(d)]?.totalAmount ?? 0;
    }
    return sum;
  })();
  const weekTotalPurchases = weekDays.reduce((s, d) => s + d.count, 0);
  const weekEmotionAgg = (() => {
    const map = new Map<string, number>();
    weekDays.forEach(d => d.emotions.forEach(e => {
      const k = e.name.toLowerCase();
      map.set(k, (map.get(k) ?? 0) + e.count);
    }));
    const total = Array.from(map.values()).reduce((a, b) => a + b, 0) || 1;
    return Array.from(map.entries())
      .map(([emotion, count]) => ({ emotion, count, pct: count / total }))
      .sort((a, b) => b.count - a.count);
  })();
  const weekTopEmotion = weekEmotionAgg[0]?.emotion ?? null;

  // Monthly grid helpers
  function emotionsForMonthDay(dayNum: number): string[] {
    const d = new Date(monthYear, monthMonth, dayNum);
    const entry = monthData[dateKey(d)];
    if (!entry) return [];
    const set = new Set<string>();
    entry.transactions.forEach(t => {
      if (t.emotion_name) set.add(t.emotion_name.toLowerCase());
    });
    return Array.from(set).slice(0, 3);
  }

  // Monthly summary
  const monthDayKeys = Object.keys(monthData);
  const monthTotalSpent = monthDayKeys.reduce((s, k) => s + monthData[k].totalAmount, 0);
  const monthTotalPurchases = monthDayKeys.reduce((s, k) => s + monthData[k].transactions.length, 0);
  const monthEmotionAgg = (() => {
    const map = new Map<string, number>();
    monthDayKeys.forEach(k => monthData[k].transactions.forEach(t => {
      if (t.emotion_name) {
        const lk = t.emotion_name.toLowerCase();
        map.set(lk, (map.get(lk) ?? 0) + 1);
      }
    }));
    const total = Array.from(map.values()).reduce((a, b) => a + b, 0) || 1;
    return Array.from(map.entries())
      .map(([emotion, count]) => ({ emotion, count, pct: count / total }))
      .sort((a, b) => b.count - a.count);
  })();
  const monthTopEmotion = monthEmotionAgg[0]?.emotion ?? null;

  // Day detail
  function getDayDetail() {
    if (selectedDay === null) return null;
    let date: Date;
    let emotionDist: Dist;
    if (viewMode === "weekly") {
      date = new Date(weekStart);
      date.setDate(weekStart.getDate() + selectedDay);
      emotionDist = weekDayDist(selectedDay);
    } else {
      date = new Date(monthYear, monthMonth, selectedDay);
      const map = new Map<string, number>();
      (monthData[dateKey(date)]?.transactions ?? []).forEach(t => {
        if (t.emotion_name) {
          const lk = t.emotion_name.toLowerCase();
          map.set(lk, (map.get(lk) ?? 0) + 1);
        }
      });
      emotionDist = Array.from(map.entries());
    }
    const dayData = monthData[dateKey(date)];
    return {
      date,
      dateLabel: `${DAY_LABELS_FULL[date.getDay()]}, ${MONTHS_SHORT[date.getMonth()]} ${date.getDate()}`,
      emotionDist,
      transactions: dayData?.transactions ?? [],
    };
  }
  const dayDetail = getDayDetail();

  // Day-specific summary (same shape as week/month summary, but scoped to the day)
  const daySummary = (() => {
    if (!dayDetail) return null;
    const total = dayDetail.emotionDist.reduce((s, [, v]) => s + v, 0) || 1;
    const emotionAgg = dayDetail.emotionDist
      .map(([emotion, count]) => ({ emotion, count, pct: count / total }))
      .sort((a, b) => b.count - a.count);
    const purchasesCount = viewMode === "weekly" && selectedDay !== null
      ? weekDays[selectedDay].count
      : dayDetail.transactions.length;
    const totalSpent = dayDetail.transactions.reduce((s, t) => s + t.amount, 0);
    return {
      totalSpent,
      purchases: purchasesCount,
      topEmotion: emotionAgg[0]?.emotion ?? null,
      emotionAgg,
    };
  })();

  // Navigation
  const canWeekForward = startOfDay(weekStart).getTime() < startOfDay(todayMonday).getTime();
  const canMonthForward =
    monthYear < today.getFullYear() ||
    (monthYear === today.getFullYear() && monthMonth < today.getMonth());

  function changeWeek(dir: -1 | 1) {
    if (dir === 1 && !canWeekForward) return;
    const next = new Date(weekStart);
    next.setDate(weekStart.getDate() + dir * 7);
    setWeekStart(next);
    setSelectedDay(null);
  }
  function changeMonth(dir: -1 | 1) {
    if (dir === 1 && !canMonthForward) return;
    let m = monthMonth + dir, y = monthYear;
    if (m < 0) { m = 11; y--; }
    if (m > 11) { m = 0; y++; }
    setMonthMonth(m); setMonthYear(y);
    setSelectedDay(null);
  }

  // Render
  return (
    <View style={st.root}>
      <View style={st.header}>
        <Text style={st.title}>expense heatmap</Text>
      </View>

      <View style={st.tabs}>
        <Pressable onPress={() => { setViewMode("weekly"); setSelectedDay(null); }} style={st.tabBtn}>
          <Text style={[st.tabText, viewMode === "weekly" && st.tabTextActive]}>weekly</Text>
          {viewMode === "weekly" && <View style={st.tabUnderline} />}
        </Pressable>
        <Text style={st.tabSep}>·</Text>
        <Pressable onPress={() => { setViewMode("monthly"); setSelectedDay(null); }} style={st.tabBtn}>
          <Text style={[st.tabText, viewMode === "monthly" && st.tabTextActive]}>monthly</Text>
          {viewMode === "monthly" && <View style={st.tabUnderline} />}
        </Pressable>
      </View>

      <ScrollView
        contentContainerStyle={{ paddingBottom: 140 }}
        showsVerticalScrollIndicator={false}
      >
        {viewMode === "weekly" ? (
          <>
            {/* Week stepper */}
            <View style={st.navRow}>
              <Pressable onPress={() => changeWeek(-1)} style={st.navBtn}>
                <Text style={st.navArrow}>‹</Text>
              </Pressable>
              <Text style={st.navLabel}>{formatWeekRange(weekStart)}</Text>
              <Pressable
                onPress={() => changeWeek(1)}
                style={[st.navBtn, !canWeekForward && { opacity: 0.3 }]}
                disabled={!canWeekForward}
              >
                <Text style={st.navArrow}>›</Text>
              </Pressable>
            </View>

            {/* Filter strip */}
            <ScrollView
              horizontal showsHorizontalScrollIndicator={false}
              contentContainerStyle={st.legendStrip}
            >
              {EMOTION_NAMES.map((emo) => (
                <LegendItem
                  key={emo} emo={emo} large
                  active={filter === emo}
                  dim={filter !== null && filter !== emo}
                  onPress={() => { setFilter(filter === emo ? null : emo); setSelectedDay(null); }}
                />
              ))}
            </ScrollView>

            {/* Day rings */}
            <View style={st.daysGrid}>
              {[0, 1, 2, 3, 4, 5, 6].map((i) => {
                const d = new Date(weekStart);
                d.setDate(weekStart.getDate() + i);
                return (
                  <DayRing
                    key={i} size={42}
                    count={weekDayCount(i)}
                    dist={weekDayDistFiltered(i)}
                    label={WEEK_LABELS[i]}
                    sub={d.getDate()}
                    selected={selectedDay === i}
                    dim={selectedDay !== null && selectedDay !== i}
                    onPress={() => setSelectedDay(selectedDay === i ? null : i)}
                  />
                );
              })}
            </View>

            <View style={st.sectionRule} />

            {dayDetail && daySummary ? (
              <>
                <Summary
                  title={dayDetail.dateLabel}
                  totalSpent={daySummary.totalSpent}
                  purchases={daySummary.purchases}
                  topEmotion={daySummary.topEmotion}
                  emotionAgg={daySummary.emotionAgg}
                />
                <DayPurchases transactions={dayDetail.transactions} />
              </>
            ) : (
              <Summary
                title="weekly summary"
                totalSpent={weekTotalSpent}
                purchases={weekTotalPurchases}
                topEmotion={weekTopEmotion}
                emotionAgg={weekEmotionAgg}
              />
            )}
          </>
        ) : (
          <>
            {/* Month stepper */}
            <View style={st.navRow}>
              <Pressable onPress={() => changeMonth(-1)} style={st.navBtn}>
                <Text style={st.navArrow}>‹</Text>
              </Pressable>
              <Text style={st.navLabel}>{MONTHS_LONG[monthMonth]} {monthYear}</Text>
              <Pressable
                onPress={() => changeMonth(1)}
                style={[st.navBtn, !canMonthForward && { opacity: 0.3 }]}
                disabled={!canMonthForward}
              >
                <Text style={st.navArrow}>›</Text>
              </Pressable>
            </View>

            {/* Weekday header */}
            <View style={st.monthWeekHeader}>
              {MONTH_WEEK_LABELS.map((w, i) => (
                <View key={i} style={{ width: MONTH_CELL_W, alignItems: "center" }}>
                  <Text style={st.weekHeaderLabel}>{w}</Text>
                </View>
              ))}
            </View>

            {/* Blob grid */}
            <View style={st.monthGrid}>
              {(() => {
                const firstWd = new Date(monthYear, monthMonth, 1).getDay();
                const numDays = new Date(monthYear, monthMonth + 1, 0).getDate();
                const cells: (number | null)[] = [
                  ...Array(firstWd).fill(null),
                  ...Array.from({ length: numDays }, (_, i) => i + 1),
                ];
                while (cells.length % 7 !== 0) cells.push(null);
                return cells.map((d, i) => (
                  <View key={i} style={{
                    width: MONTH_CELL_W, height: MONTH_CELL_W,
                    alignItems: "center", justifyContent: "center",
                  }}>
                    {d !== null && (
                      <MonthBlob
                        size={34} num={d}
                        emotions={emotionsForMonthDay(d)}
                        selected={selectedDay === d}
                        today={
                          today.getFullYear() === monthYear &&
                          today.getMonth() === monthMonth &&
                          today.getDate() === d
                        }
                        onPress={() => setSelectedDay(selectedDay === d ? null : d)}
                      />
                    )}
                  </View>
                ));
              })()}
            </View>

            {/* Full legend */}
            <View style={st.monthLegend}>
              {EMOTION_NAMES.map((emo) => (
                <View key={emo} style={st.monthLegendCell}>
                  <LegendItem emo={emo} small active />
                </View>
              ))}
            </View>

            <View style={st.sectionRule} />

            {dayDetail && daySummary ? (
              <>
                <Summary
                  title={dayDetail.dateLabel}
                  totalSpent={daySummary.totalSpent}
                  purchases={daySummary.purchases}
                  topEmotion={daySummary.topEmotion}
                  emotionAgg={daySummary.emotionAgg}
                />
                <DayPurchases transactions={dayDetail.transactions} />
              </>
            ) : (
              <Summary
                title="monthly summary"
                totalSpent={monthTotalSpent}
                purchases={monthTotalPurchases}
                topEmotion={monthTopEmotion}
                emotionAgg={monthEmotionAgg}
              />
            )}
          </>
        )}
      </ScrollView>
    </View>
  );
}

// ─── Styles ──────────────────────────────────────────────────────────────────
const st = StyleSheet.create({
  root: { flex: 1, backgroundColor: C.bg },

  header: {
    paddingTop: Platform.OS === "ios" ? 56 : 40,
    paddingBottom: 14, paddingHorizontal: 24, alignItems: "center",
  },
  title: {
    fontFamily: "PlayfairDisplay_400Regular_Italic",
    fontSize: 30, color: C.ink, letterSpacing: -0.3,
  },

  tabs: {
    flexDirection: "row", justifyContent: "center", alignItems: "baseline",
    gap: 14, paddingBottom: 22,
  },
  tabBtn: { paddingVertical: 2, alignItems: "center" },
  tabText: {
    fontSize: 19, fontFamily: "PlayfairDisplay_400Regular_Italic",
    color: C.inkMute,
  },
  tabTextActive: {
    fontFamily: "PlayfairDisplay_700Bold_Italic", color: C.ink,
  },
  tabUnderline: {
    height: 1.5, backgroundColor: C.purple, width: "100%", marginTop: 2,
  },
  tabSep: { color: C.inkMute, fontSize: 14 },

  navRow: {
    flexDirection: "row", alignItems: "center", justifyContent: "center",
    gap: 18, paddingHorizontal: 24, paddingTop: 16, paddingBottom: 14,
  },
  navBtn: { paddingHorizontal: 4, paddingVertical: 2 },
  navArrow: { fontSize: 22, color: C.inkSoft, lineHeight: 24 },
  navLabel: {
    fontFamily: "PlayfairDisplay_400Regular_Italic",
    fontSize: 20, color: C.ink,
  },

  legendStrip: {
    paddingHorizontal: 16, paddingTop: 6, paddingBottom: 22, gap: 6,
    flexDirection: "row", alignItems: "flex-start",
  },

  daysGrid: {
    flexDirection: "row", justifyContent: "space-between",
    paddingHorizontal: 12, paddingBottom: 18,
  },

  sectionRule: {
    height: 1, backgroundColor: C.rule, marginHorizontal: 24, marginTop: 4,
  },

  monthWeekHeader: {
    flexDirection: "row", paddingHorizontal: MONTH_GRID_PAD, paddingBottom: 4,
  },
  weekHeaderLabel: {
    fontFamily: "PlayfairDisplay_400Regular_Italic",
    fontSize: 11.5, color: C.inkMute,
  },
  monthGrid: {
    flexDirection: "row", flexWrap: "wrap",
    paddingHorizontal: MONTH_GRID_PAD, paddingBottom: 8,
  },   

  monthLegend: {
    flexDirection: "row", flexWrap: "wrap",
    paddingHorizontal: 22, paddingTop: 14, paddingBottom: 18,
  },
  monthLegendCell: {
    width: "25%", alignItems: "center", marginBottom: 12,
  },

  smallLabel: {
    fontSize: 12, color: C.inkSoft,
    fontFamily: "PlayfairDisplay_400Regular_Italic",
    marginTop: 2,
  },
});
