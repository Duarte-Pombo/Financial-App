import React, { useState, useRef, useEffect, useCallback } from "react";
import {
  View,
  StyleSheet,
  Pressable,
  Modal,
  Animated,
  TouchableWithoutFeedback,
  ScrollView,
  Platform,
  Dimensions,
} from "react-native";
import { Text } from "@/components/Text";
import { Ionicons } from "@expo/vector-icons";
import { getMonthHeatmapData, HeatmapMonthData } from "@/database/transactions";

// ─── Constants ─────────────────────────────────────────────────────────────────
const MONTHS_LONG  = ["January","February","March","April","May","June","July","August","September","October","November","December"];
const MONTHS_SHORT = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
const DAY_LABELS   = ["Mo","Tu","We","Th","Fr","Sa","Su"];
const WEEKDAYS     = ["Sunday","Monday","Tuesday","Wednesday","Thursday","Friday","Saturday"];
const HEAT_COLORS  = ["#f0f0f0", "#c8e6c9", "#fff176", "#ffb74d", "#ef5350"] as const;

const { width: SCREEN_WIDTH } = Dimensions.get("window");
const CELL_SIZE   = Math.floor((SCREEN_WIDTH - 64 - 24) / 7); // 16*2 container + 16*2 card = 64
const CELL_GAP    = 4;
const SHEET_MAX_H = 500;

// ─── Helpers ───────────────────────────────────────────────────────────────────
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
  if (r <= 0.10) return 1;
  if (r <= 0.30) return 2;
  if (r <= 0.65) return 3;
  return 4;
}
function fmtAmount(n: number) { return `€${n.toFixed(2)}`; }
function fmtDayHeading(year: number, month: number, day: number) {
  const d = new Date(year, month, day);
  return `${WEEKDAYS[d.getDay()]}, ${MONTHS_SHORT[month]} ${day}`;
}

// ─── Component ─────────────────────────────────────────────────────────────────
type Props = { year: number; month: number };

export default function MonthlyHeatmapPanel({ year, month }: Props) {
  const today = new Date();
  const TODAY = { year: today.getFullYear(), month: today.getMonth(), day: today.getDate() };

  const [monthData,    setMonthData]    = useState<HeatmapMonthData>({});
  const [sheetDay,     setSheetDay]     = useState<number | null>(null);
  const [sheetVisible, setSheetVisible] = useState(false);
  const sheetAnim = useRef(new Animated.Value(SHEET_MAX_H)).current;

  const loadData = useCallback(async () => {
    const data = await getMonthHeatmapData(global.userID, year, month);
    setMonthData(data);
  }, [year, month]);

  useEffect(() => {
    closeSheet();
    loadData();
  }, [loadData]);

  const numDays    = daysInMonth(year, month);
  const firstWd    = firstWeekday(year, month);
  const maxAmount  = Object.values(monthData).reduce((m, d) => Math.max(m, d.totalAmount), 0);
  const totalSpent = Object.values(monthData).reduce((s, d) => s + d.totalAmount, 0);
  const activeDays = Object.keys(monthData).length;

  const cells: (number | null)[] = [
    ...Array(firstWd).fill(null),
    ...Array.from({ length: numDays }, (_, i) => i + 1),
  ];
  while (cells.length % 7 !== 0) cells.push(null);

  const isCurrentMonth = year === TODAY.year && month === TODAY.month;

  function openSheet(day: number) {
    const key = dateKey(year, month, day);
    if (!monthData[key]) return;
    setSheetDay(day);
    setSheetVisible(true);
    sheetAnim.setValue(SHEET_MAX_H);
    Animated.spring(sheetAnim, { toValue: 0, useNativeDriver: true, bounciness: 3 }).start();
  }

  function closeSheet() {
    Animated.timing(sheetAnim, { toValue: SHEET_MAX_H, duration: 220, useNativeDriver: true })
      .start(() => { setSheetVisible(false); setSheetDay(null); });
  }

  const selectedKey  = sheetDay ? dateKey(year, month, sheetDay) : null;
  const selectedData = selectedKey ? monthData[selectedKey] : null;

  return (
    <>
      <View style={styles.container}>

        {/* ── Calendar Grid ── */}
        <View style={styles.card}>
          <View style={styles.dayHeaderRow}>
            {DAY_LABELS.map((lbl) => (
              <View key={lbl} style={{ width: CELL_SIZE, alignItems: "center" }}>
                <Text style={styles.dayHeaderText}>{lbl}</Text>
              </View>
            ))}
          </View>
          {Array.from({ length: cells.length / 7 }, (_, wi) => (
            <View key={wi} style={styles.weekRow}>
              {cells.slice(wi * 7, wi * 7 + 7).map((day, ci) => {
                if (day === null) return <View key={ci} style={{ width: CELL_SIZE, height: CELL_SIZE }} />;
                const key      = dateKey(year, month, day);
                const data     = monthData[key];
                const amount   = data?.totalAmount ?? 0;
                const level    = intensityLevel(amount, maxAmount);
                const bgColor  = data ? HEAT_COLORS[level] : "#f5f5f5";
                const textDark = level >= 3;
                const isToday  = year === TODAY.year && month === TODAY.month && day === TODAY.day;
                return (
                  <Pressable
                    key={ci}
                    style={[styles.cell, { width: CELL_SIZE, height: CELL_SIZE, backgroundColor: bgColor }, isToday && styles.todayCell]}
                    onPress={() => data && openSheet(day)}
                    disabled={!data}
                  >
                    <Text style={[styles.cellNum, textDark && styles.cellNumLight, isToday && styles.todayNum]}>{day}</Text>
                    {amount > 0 && <Text style={[styles.cellAmt, textDark && styles.cellAmtLight]}>€{Math.round(amount)}</Text>}
                  </Pressable>
                );
              })}
            </View>
          ))}
        </View>

        {/* ── Legend ── */}
        <View style={styles.legendRow}>
          <Text style={styles.legendLabel}>Less</Text>
          {HEAT_COLORS.map((color, i) => (
            <View key={i} style={[styles.legendDot, { backgroundColor: color }]} />
          ))}
          <Text style={styles.legendLabel}>More</Text>
        </View>

        {/* ── Summary Card ── */}
        <View style={styles.card}>
          <Text style={styles.sectionTitle}>
            {isCurrentMonth ? "This month so far" : MONTHS_LONG[month]}
          </Text>
          <View style={styles.summaryRow}>
            <View style={styles.summaryItem}>
              <Text style={styles.summaryValue}>{fmtAmount(totalSpent)}</Text>
              <Text style={styles.summaryLabel}>Total spent</Text>
            </View>
            <View style={styles.summaryDivider} />
            <View style={styles.summaryItem}>
              <Text style={styles.summaryValue}>{activeDays}</Text>
              <Text style={styles.summaryLabel}>Active days</Text>
            </View>
            <View style={styles.summaryDivider} />
            <View style={styles.summaryItem}>
              <Text style={styles.summaryValue}>{activeDays > 0 ? fmtAmount(totalSpent / activeDays) : "€0"}</Text>
              <Text style={styles.summaryLabel}>Avg / day</Text>
            </View>
          </View>
        </View>

      </View>

      {/* ── Bottom Sheet ── */}
      <Modal visible={sheetVisible} transparent animationType="none" onRequestClose={closeSheet} statusBarTranslucent>
        <TouchableWithoutFeedback onPress={closeSheet}>
          <View style={styles.overlay} />
        </TouchableWithoutFeedback>
        <Animated.View style={[styles.sheet, { transform: [{ translateY: sheetAnim }] }]}>
          <View style={styles.sheetHandle} />
          {sheetDay !== null && selectedData && (
            <>
              <View style={styles.sheetHeader}>
                <View>
                  <Text style={styles.sheetHeading}>{fmtDayHeading(year, month, sheetDay)}</Text>
                  <Text style={styles.sheetSubheading}>
                    {fmtAmount(selectedData.totalAmount)} spent · {selectedData.transactions.length} purchase{selectedData.transactions.length !== 1 ? "s" : ""}
                  </Text>
                </View>
                <Pressable style={styles.closeBtn} onPress={closeSheet}>
                  <Ionicons name="close" size={18} color="#888" />
                </Pressable>
              </View>
              <ScrollView style={styles.txList} showsVerticalScrollIndicator={false} bounces={false}>
                {selectedData.transactions.map((tx, i) => (
                  <View key={i} style={[styles.txRow, i === selectedData.transactions.length - 1 && { borderBottomWidth: 0 }]}>
                    <View style={styles.txIconWrap}>
                      <Text style={styles.txIcon}>{tx.category_icon ?? "💳"}</Text>
                    </View>
                    <View style={styles.txInfo}>
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
  container: { flex: 1, backgroundColor: "#fdf3ff", padding: 16 },

  card: {
    backgroundColor: "#fff", borderRadius: 16, padding: 16, marginBottom: 16,
    shadowColor: "#000", shadowOpacity: 0.06, shadowRadius: 8, elevation: 2,
  },

  dayHeaderRow: { flexDirection: "row", justifyContent: "center", gap: CELL_GAP, marginBottom: 8 },
  dayHeaderText: { fontSize: 11, color: "#bbb", fontFamily: "RobotoSerif_500Medium" },
  weekRow: { flexDirection: "row", justifyContent: "center", gap: CELL_GAP, marginBottom: CELL_GAP },
  cell: { borderRadius: 8, alignItems: "center", justifyContent: "center" },
  todayCell: { borderWidth: 2, borderColor: "#6b21a8" },
  cellNum:      { fontSize: 11, color: "#555", fontFamily: "RobotoSerif_500Medium" },
  cellNumLight: { color: "#fff" },
  todayNum:     { color: "#6b21a8", fontFamily: "RobotoSerif_700Bold" },
  cellAmt:      { fontSize: 8, color: "#777", marginTop: 1 },
  cellAmtLight: { color: "rgba(255,255,255,0.9)" },

  legendRow: { flexDirection: "row", alignItems: "center", justifyContent: "center", marginBottom: 16, gap: 6 },
  legendDot:   { width: 20, height: 20, borderRadius: 5 },
  legendLabel: { fontSize: 11, color: "#aaa" },

  sectionTitle:   { fontSize: 15, fontFamily: "RobotoSerif_600SemiBold", color: "#444", marginBottom: 14 },
  summaryRow:     { flexDirection: "row", alignItems: "center" },
  summaryItem:    { flex: 1, alignItems: "center" },
  summaryValue:   { fontSize: 18, fontFamily: "RobotoSerif_700Bold", color: "#333" },
  summaryLabel:   { fontSize: 11, color: "#aaa", marginTop: 2 },
  summaryDivider: { width: 1, height: 40, backgroundColor: "#f0f0f0" },

  overlay: { ...StyleSheet.absoluteFillObject, backgroundColor: "rgba(0,0,0,0.35)" },
  sheet: {
    position: "absolute", bottom: 0, left: 0, right: 0,
    backgroundColor: "#fff", borderTopLeftRadius: 24, borderTopRightRadius: 24,
    paddingTop: 12, paddingBottom: Platform.OS === "ios" ? 40 : 24, maxHeight: SHEET_MAX_H,
    shadowColor: "#000", shadowOpacity: 0.15, shadowRadius: 24, elevation: 20,
  },
  sheetHandle: { width: 40, height: 4, backgroundColor: "#ddd", borderRadius: 2, alignSelf: "center", marginBottom: 16 },
  sheetHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start", paddingHorizontal: 20, marginBottom: 12 },
  sheetHeading:    { fontSize: 17, fontFamily: "RobotoSerif_600SemiBold", color: "#333" },
  sheetSubheading: { fontSize: 13, color: "#999", marginTop: 3 },
  closeBtn: { width: 32, height: 32, alignItems: "center", justifyContent: "center", backgroundColor: "#f5f5f5", borderRadius: 16 },

  txList: { paddingHorizontal: 20 },
  txRow: { flexDirection: "row", alignItems: "center", paddingVertical: 11, borderBottomWidth: 1, borderBottomColor: "#f5f5f5" },
  txIconWrap: { width: 40, height: 40, borderRadius: 11, backgroundColor: "#f3e8ff", alignItems: "center", justifyContent: "center", marginRight: 12 },
  txIcon:     { fontSize: 18 },
  txInfo:     { flex: 1 },
  txName:     { fontSize: 14, fontFamily: "RobotoSerif_600SemiBold", color: "#333" },
  txCategory: { fontSize: 12, color: "#aaa", marginTop: 2 },
  txRight:    { alignItems: "flex-end", gap: 2 },
  txEmotion:  { fontSize: 14 },
  txAmount:   { fontSize: 14, fontFamily: "RobotoSerif_600SemiBold", color: "#333" },
});
