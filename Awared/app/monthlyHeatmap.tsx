import React, { useState, useRef, useEffect, useCallback } from "react";
import {
  View,
  StyleSheet,
  ScrollView,
  Pressable,
  Modal,
  Animated,
  TouchableWithoutFeedback,
  Platform,
  Dimensions,
} from "react-native";
import { Text } from "@/components/Text";
import { MaterialIcons } from "@expo/vector-icons";
import { router } from "expo-router";
import { TopAppBar, TOP_APP_BAR_HEIGHT } from "@/components/TopAppBar";
import { getMonthHeatmapData, HeatmapMonthData } from "@/database/transactions";
import { colors, fonts, radii, spacing, glassCard } from "@/constants/theme";

const MONTHS_LONG = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
];
const MONTHS_SHORT = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const DAY_LABELS = ["MON", "TUE", "WED", "THU", "FRI", "SAT", "SUN"];
const WEEKDAYS = [
  "Sunday",
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
];

const { width: SCREEN_WIDTH } = Dimensions.get("window");
const SCREEN_PAD = 24;
const CARD_PAD = 24;
const CELL_GAP = 8;
const CELL_SIZE = Math.floor((SCREEN_WIDTH - SCREEN_PAD * 2 - CARD_PAD * 2 - CELL_GAP * 6) / 7);
const SHEET_MAX_H = 500;

// Primary opacity ramp: levels 0..5
function levelStyle(level: number) {
  switch (level) {
    case 0:
      return { backgroundColor: colors.surfaceContainer, textColor: colors.onSurfaceVariant };
    case 1:
      return { backgroundColor: "rgba(99,14,212,0.10)", textColor: colors.onSurface };
    case 2:
      return { backgroundColor: "rgba(99,14,212,0.20)", textColor: colors.onSurface };
    case 3:
      return { backgroundColor: "rgba(99,14,212,0.40)", textColor: colors.onSurface };
    case 4:
      return { backgroundColor: "rgba(99,14,212,0.60)", textColor: colors.onPrimary };
    case 5:
      return { backgroundColor: "rgba(99,14,212,0.80)", textColor: colors.onPrimary };
    default:
      return { backgroundColor: colors.primary, textColor: colors.onPrimary };
  }
}

function daysInMonth(year: number, month: number) {
  return new Date(year, month + 1, 0).getDate();
}
function firstWeekday(year: number, month: number) {
  return (new Date(year, month, 1).getDay() + 6) % 7;
}
function dateKey(year: number, month: number, day: number) {
  return `${year}-${String(month + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}
function intensityLevel(amount: number, max: number) {
  if (amount <= 0 || max <= 0) return 0;
  const r = amount / max;
  if (r <= 0.08) return 1;
  if (r <= 0.2) return 2;
  if (r <= 0.4) return 3;
  if (r <= 0.7) return 4;
  return 5;
}
function fmtAmount(n: number) {
  return `€${n.toFixed(2)}`;
}
function fmtDayHeading(year: number, month: number, day: number) {
  const d = new Date(year, month, day);
  return `${WEEKDAYS[d.getDay()]}, ${MONTHS_SHORT[month]} ${day}`;
}

export default function MonthlyHeatmap() {
  const today = new Date();
  const TODAY = {
    year: today.getFullYear(),
    month: today.getMonth(),
    day: today.getDate(),
  };

  const [year, setYear] = useState(TODAY.year);
  const [month, setMonth] = useState(TODAY.month);
  const [monthData, setMonthData] = useState<HeatmapMonthData>({});
  const [sheetDay, setSheetDay] = useState<number | null>(null);
  const [sheetVisible, setSheetVisible] = useState(false);
  const sheetAnim = useRef(new Animated.Value(SHEET_MAX_H)).current;

  const loadData = useCallback(async () => {
    const data = await getMonthHeatmapData(global.userID, year, month);
    setMonthData(data);
  }, [year, month]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const numDays = daysInMonth(year, month);
  const firstWd = firstWeekday(year, month);
  const maxAmount = Object.values(monthData).reduce((m, d) => Math.max(m, d.totalAmount), 0);
  const totalSpent = Object.values(monthData).reduce((s, d) => s + d.totalAmount, 0);
  const activeDays = Object.keys(monthData).length;

  const cells: (number | null)[] = [
    ...Array(firstWd).fill(null),
    ...Array.from({ length: numDays }, (_, i) => i + 1),
  ];
  while (cells.length % 7 !== 0) cells.push(null);

  const minDate = new Date(TODAY.year, TODAY.month - 12, 1);
  const canGoBack = new Date(year, month - 1, 1) >= minDate;
  const canGoForward = !(year === TODAY.year && month === TODAY.month);

  function changeMonth(dir: -1 | 1) {
    closeSheet();
    let m = month + dir,
      y = year;
    if (m < 0) {
      m = 11;
      y--;
    }
    if (m > 11) {
      m = 0;
      y++;
    }
    setMonth(m);
    setYear(y);
  }

  function openSheet(day: number) {
    const key = dateKey(year, month, day);
    if (!monthData[key]) return;
    setSheetDay(day);
    setSheetVisible(true);
    sheetAnim.setValue(SHEET_MAX_H);
    Animated.spring(sheetAnim, { toValue: 0, useNativeDriver: true, bounciness: 3 }).start();
  }

  function closeSheet() {
    Animated.timing(sheetAnim, {
      toValue: SHEET_MAX_H,
      duration: 220,
      useNativeDriver: true,
    }).start(() => {
      setSheetVisible(false);
      setSheetDay(null);
    });
  }

  const selectedKey = sheetDay ? dateKey(year, month, sheetDay) : null;
  const selectedData = selectedKey ? monthData[selectedKey] : null;
  const isCurrentMonth = year === TODAY.year && month === TODAY.month;
  const avgPerDay = activeDays > 0 ? totalSpent / activeDays : 0;

  return (
    <>
      <View style={styles.container}>
        <TopAppBar />

        <ScrollView style={{ flex: 1 }} contentContainerStyle={styles.scrollContent}>
          {/* Page header */}
          <View>
            <Text style={styles.pageTitle}>Expense Heatmap</Text>
            <Text style={styles.pageSub}>
              Visualize your spending intensity. Darker = higher spend.
            </Text>
          </View>

          {/* Segmented control */}
          <View style={[styles.segment, glassCard]}>
            <Pressable style={styles.segmentItem} onPress={() => router.back()}>
              <Text style={styles.segmentText}>Weekly</Text>
            </Pressable>
            <View style={[styles.segmentItem, styles.segmentItemActive]}>
              <Text style={[styles.segmentText, styles.segmentTextActive]}>Monthly</Text>
            </View>
          </View>

          {/* Heatmap calendar card */}
          <View style={[styles.calendarCard, glassCard]}>
            {/* Decorative gradient blob */}
            <View style={styles.calendarBlob} />

            <View style={styles.monthRow}>
              <Text style={styles.monthTitle}>
                {MONTHS_LONG[month]} {year !== TODAY.year ? year : ""}
              </Text>
              <View style={{ flexDirection: "row", gap: spacing.sm }}>
                <Pressable
                  style={[styles.monthArrow, !canGoBack && styles.navDisabled]}
                  onPress={() => canGoBack && changeMonth(-1)}
                >
                  <MaterialIcons
                    name="chevron-left"
                    size={20}
                    color={canGoBack ? colors.onSurfaceVariant : colors.outlineVariant}
                  />
                </Pressable>
                <Pressable
                  style={[styles.monthArrow, !canGoForward && styles.navDisabled]}
                  onPress={() => canGoForward && changeMonth(1)}
                >
                  <MaterialIcons
                    name="chevron-right"
                    size={20}
                    color={canGoForward ? colors.onSurfaceVariant : colors.outlineVariant}
                  />
                </Pressable>
              </View>
            </View>

            {/* Day labels row */}
            <View style={styles.dayHeaderRow}>
              {DAY_LABELS.map((lbl) => (
                <View key={lbl} style={styles.dayHeaderCell}>
                  <Text style={styles.dayHeaderText}>{lbl}</Text>
                </View>
              ))}
            </View>

            {/* Grid */}
            <View style={styles.grid}>
              {Array.from({ length: cells.length / 7 }, (_, wi) => (
                <View key={wi} style={styles.weekRow}>
                  {cells.slice(wi * 7, wi * 7 + 7).map((day, ci) => {
                    if (day === null) {
                      return (
                        <View
                          key={ci}
                          style={[styles.cell, { backgroundColor: "transparent" }]}
                        />
                      );
                    }
                    const key = dateKey(year, month, day);
                    const data = monthData[key];
                    const amount = data?.totalAmount ?? 0;
                    const level = intensityLevel(amount, maxAmount);
                    const lvl = levelStyle(level);
                    const isToday =
                      year === TODAY.year &&
                      month === TODAY.month &&
                      day === TODAY.day;
                    return (
                      <Pressable
                        key={ci}
                        style={[
                          styles.cell,
                          {
                            backgroundColor: data ? lvl.backgroundColor : colors.surfaceContainer,
                          },
                          isToday && styles.todayCell,
                        ]}
                        onPress={() => data && openSheet(day)}
                        disabled={!data}
                      >
                        <Text
                          style={[
                            styles.cellNum,
                            {
                              color: data
                                ? lvl.textColor
                                : colors.onSurfaceVariant,
                            },
                          ]}
                        >
                          {day}
                        </Text>
                      </Pressable>
                    );
                  })}
                </View>
              ))}
            </View>

            {/* Legend */}
            <View style={styles.legendRow}>
              <Text style={styles.legendLabel}>Low</Text>
              <View style={styles.legendBar}>
                {[0, 1, 2, 3, 4, 5].map((lvl) => (
                  <View
                    key={lvl}
                    style={[styles.legendSeg, { backgroundColor: levelStyle(lvl).backgroundColor }]}
                  />
                ))}
              </View>
              <Text style={styles.legendLabel}>High</Text>
            </View>
          </View>

          {/* 3-card stats bento */}
          <View style={styles.statsBento}>
            <View style={[styles.statCard, glassCard]}>
              <View style={[styles.statIconCircle, { backgroundColor: "rgba(124,58,237,0.10)" }]}>
                <MaterialIcons
                  name="account-balance-wallet"
                  size={20}
                  color={colors.primary}
                />
              </View>
              <Text style={styles.statLabel}>Total Spent</Text>
              <Text style={styles.statValue}>{fmtAmount(totalSpent)}</Text>
              <Text style={styles.statHint}>{isCurrentMonth ? "This month" : MONTHS_LONG[month]}</Text>
            </View>

            <View style={[styles.statCard, glassCard]}>
              <View style={[styles.statIconCircle, { backgroundColor: "rgba(180,19,109,0.10)" }]}>
                <MaterialIcons name="event-available" size={20} color={colors.secondary} />
              </View>
              <Text style={styles.statLabel}>Active Days</Text>
              <View style={{ flexDirection: "row", alignItems: "baseline", gap: 4 }}>
                <Text style={styles.statValue}>{activeDays}</Text>
                <Text style={styles.statHint}>/ {numDays}</Text>
              </View>
              <Text style={styles.statHint}>Days with spending</Text>
            </View>

            <View style={[styles.statCard, glassCard]}>
              <View style={[styles.statIconCircle, { backgroundColor: "rgba(95,65,129,0.10)" }]}>
                <MaterialIcons name="insert-chart" size={20} color={colors.tertiary} />
              </View>
              <Text style={styles.statLabel}>Avg / Day</Text>
              <Text style={styles.statValue}>{fmtAmount(avgPerDay)}</Text>
              <Text style={styles.statHint}>Calculated on active days</Text>
            </View>
          </View>

          <View style={{ height: 40 }} />
        </ScrollView>
      </View>

      {/* Bottom sheet */}
      <Modal
        visible={sheetVisible}
        transparent
        animationType="none"
        onRequestClose={closeSheet}
        statusBarTranslucent
      >
        <TouchableWithoutFeedback onPress={closeSheet}>
          <View style={styles.overlay} />
        </TouchableWithoutFeedback>
        <Animated.View style={[styles.sheet, { transform: [{ translateY: sheetAnim }] }]}>
          <View style={styles.sheetHandle} />
          {sheetDay !== null && selectedData && (
            <>
              <View style={styles.sheetHeader}>
                <View>
                  <Text style={styles.sheetHeading}>
                    {fmtDayHeading(year, month, sheetDay)}
                  </Text>
                  <Text style={styles.sheetSubheading}>
                    {fmtAmount(selectedData.totalAmount)} spent ·{" "}
                    {selectedData.transactions.length} purchase
                    {selectedData.transactions.length !== 1 ? "s" : ""}
                  </Text>
                </View>
                <Pressable style={styles.closeBtn} onPress={closeSheet}>
                  <MaterialIcons name="close" size={18} color={colors.onSurfaceVariant} />
                </Pressable>
              </View>
              <ScrollView style={styles.txList} showsVerticalScrollIndicator={false}>
                {selectedData.transactions.map((tx, i) => (
                  <View
                    key={i}
                    style={[
                      styles.txRow,
                      i === selectedData.transactions.length - 1 && { borderBottomWidth: 0 },
                    ]}
                  >
                    <View style={styles.txIconWrap}>
                      <Text style={styles.txIcon}>{tx.category_icon ?? "💳"}</Text>
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.txName}>{tx.merchant_name}</Text>
                      <Text style={styles.txCategory}>{tx.category_name ?? "Other"}</Text>
                    </View>
                    <View style={styles.txRight}>
                      {tx.emotion_emoji !== null && <Text style={styles.txEmotion}>{tx.emotion_emoji}</Text>}
                      <Text style={styles.txAmount}>{fmtAmount(tx.amount)}</Text>
                    </View>
                  </View>
                ))}
                <View style={{ height: 8 }} />
              </ScrollView>
            </>
          )}
        </Animated.View>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  scrollContent: {
    paddingTop: TOP_APP_BAR_HEIGHT + spacing.md,
    paddingHorizontal: spacing.containerMargin,
    paddingBottom: 40,
    gap: spacing.lg,
  },

  pageTitle: {
    fontFamily: fonts.bold,
    fontSize: 32,
    color: colors.onSurface,
    letterSpacing: -0.32,
  },
  pageSub: {
    fontFamily: fonts.regular,
    fontSize: 14,
    color: colors.onSurfaceVariant,
    marginTop: 4,
    lineHeight: 20,
  },

  segment: {
    flexDirection: "row",
    padding: 4,
    borderRadius: radii.pill,
    minWidth: 220,
    alignSelf: "center",
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

  calendarCard: {
    borderRadius: radii.base,
    padding: CARD_PAD,
    overflow: "hidden",
  },
  calendarBlob: {
    position: "absolute",
    top: -50,
    right: -50,
    width: 200,
    height: 200,
    borderRadius: 100,
    backgroundColor: colors.primaryFixed,
    opacity: 0.3,
  },
  monthRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: spacing.md,
  },
  monthTitle: {
    fontFamily: fonts.semibold,
    fontSize: 22,
    color: colors.onSurface,
  },
  monthArrow: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: colors.surface,
    alignItems: "center",
    justifyContent: "center",
  },
  navDisabled: { opacity: 0.4 },

  dayHeaderRow: {
    flexDirection: "row",
    gap: CELL_GAP,
    marginBottom: 4,
  },
  dayHeaderCell: {
    width: CELL_SIZE,
    alignItems: "center",
  },
  dayHeaderText: {
    fontFamily: fonts.medium,
    fontSize: 11,
    color: colors.onSurfaceVariant,
    letterSpacing: 0.6,
  },
  grid: {
    gap: CELL_GAP,
  },
  weekRow: {
    flexDirection: "row",
    gap: CELL_GAP,
  },
  cell: {
    width: CELL_SIZE,
    height: CELL_SIZE,
    borderRadius: radii.base,
    padding: 6,
    alignItems: "flex-start",
    justifyContent: "flex-start",
  },
  todayCell: {
    borderWidth: 2,
    borderColor: colors.primary,
  },
  cellNum: {
    fontFamily: fonts.medium,
    fontSize: 11,
  },

  legendRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "flex-end",
    gap: spacing.sm,
    marginTop: spacing.md,
  },
  legendLabel: {
    fontFamily: fonts.medium,
    fontSize: 11,
    color: colors.onSurfaceVariant,
  },
  legendBar: {
    flexDirection: "row",
    height: 8,
    borderRadius: 4,
    overflow: "hidden",
    width: 96,
  },
  legendSeg: { flex: 1 },

  // 3-card stats
  statsBento: {
    gap: spacing.md,
  },
  statCard: {
    borderRadius: radii.lg,
    padding: spacing.md,
    gap: 4,
  },
  statIconCircle: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: spacing.xs,
  },
  statLabel: {
    fontFamily: fonts.semibold,
    fontSize: 14,
    color: colors.onSurfaceVariant,
  },
  statValue: {
    fontFamily: fonts.extrabold,
    fontSize: 36,
    color: colors.onSurface,
    letterSpacing: -0.6,
    lineHeight: 42,
  },
  statHint: {
    fontFamily: fonts.regular,
    fontSize: 12,
    color: colors.outline,
  },

  // Bottom sheet
  overlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(21,28,39,0.4)",
  },
  sheet: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: colors.surface,
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    paddingTop: 12,
    paddingBottom: Platform.OS === "ios" ? 40 : 24,
    maxHeight: SHEET_MAX_H,
  },
  sheetHandle: {
    width: 40,
    height: 4,
    backgroundColor: colors.outlineVariant,
    borderRadius: 2,
    alignSelf: "center",
    marginBottom: spacing.base,
  },
  sheetHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    paddingHorizontal: spacing.containerMargin,
    marginBottom: spacing.md,
  },
  sheetHeading: {
    fontFamily: fonts.bold,
    fontSize: 20,
    color: colors.onSurface,
  },
  sheetSubheading: {
    fontFamily: fonts.regular,
    fontSize: 14,
    color: colors.onSurfaceVariant,
    marginTop: 4,
  },
  closeBtn: {
    width: 32,
    height: 32,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.surfaceContainerHighest,
    borderRadius: 16,
  },
  txList: { paddingHorizontal: spacing.containerMargin },
  txRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: colors.outlineVariant,
    gap: spacing.sm,
  },
  txIconWrap: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: colors.primaryFixed,
    alignItems: "center",
    justifyContent: "center",
  },
  txIcon: { fontSize: 20 },
  txName: {
    fontFamily: fonts.semibold,
    fontSize: 15,
    color: colors.onSurface,
  },
  txCategory: {
    fontFamily: fonts.regular,
    fontSize: 12,
    color: colors.outline,
    marginTop: 2,
  },
  txRight: { alignItems: "flex-end", gap: 2 },
  txEmotion: { fontSize: 14 },
  txAmount: {
    fontFamily: fonts.semibold,
    fontSize: 15,
    color: colors.onSurface,
  },
});
