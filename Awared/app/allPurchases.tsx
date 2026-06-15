import React, { useState, useCallback, useMemo } from "react";
import {
  Text,
  View,
  StyleSheet,
  Pressable,
  ActivityIndicator,
  SectionList,
  Platform,
} from "react-native";
import { useFocusEffect, useRouter } from "expo-router";
import Svg, { Path } from "react-native-svg";
import { getDb } from "@/database/db";
import { emotionColor } from "../components/EmotionGlyph";
import { useTheme } from "@/context/ThemeContext";
import { ThemeColors } from "@/theme/theme";


type Tx = {
  id: string | number;
  amount: number;
  merchant_name: string | null;
  currency_code: string;
  transacted_at: string;
  type: string;
  emotion_name: string | null;
  category_name: string | null;
};

type Section = {
  key: string;
  title: string;
  total: number;
  count: number;
  data: Tx[];
};

function formatRelative(iso: string): string {
  const date = new Date(iso);
  const now = new Date();
  const startOfDay = (d: Date) =>
    new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();

  const days = Math.floor((startOfDay(now) - startOfDay(date)) / 86400000);
  const time = `${String(date.getHours()).padStart(2, "0")}:${String(
    date.getMinutes()
  ).padStart(2, "0")}`;

  if (days === 0) return `Today, ${time}`;
  if (days === 1) return `Yesterday, ${time}`;
  if (days < 7) return `${days} days ago`;

  return date.toLocaleDateString([], { month: "short", day: "numeric" });
}

function emotionSymbol(emotion: string | null): string {
  switch (emotion?.toLowerCase()) {
    case "calm":
      return "~";
    case "anxiety":
      return "≈";
    case "happy":
      return "+";
    case "boredom":
      return "—";
    default:
      return "—";
  }
}

function monthLabel(date: Date): string {
  return date.toLocaleDateString([], { month: "long", year: "numeric" });
}

export default function AllPurchases() {
  const { colors: C } = useTheme();
  const s = useMemo(() => makeStyles(C), [C]);
  const router = useRouter();
  const [txs, setTxs] = useState<Tx[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const load = useCallback(async () => {
    setIsLoading(true);
    try {
      const db = await getDb();
      const userID = global.userID;

      const rows = await db.getAllAsync<Tx>(
        `SELECT t.id, t.amount, t.merchant_name, t.currency_code, t.transacted_at, t.type,
                e.name as emotion_name, sc.name as category_name
         FROM transactions t
         LEFT JOIN emotion_logs l ON l.id = t.emotion_log_id
         LEFT JOIN emotions e ON e.id = l.emotion_id
         LEFT JOIN spending_categories sc ON sc.id = t.category_id
         WHERE t.user_id = ?
         ORDER BY t.transacted_at DESC`,
        [userID]
      );

      setTxs(rows);
    } catch (err) {
      console.error("allPurchases load error:", err);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  const sections = useMemo<Section[]>(() => {
    const groups: Record<string, Section> = {};

    for (const tx of txs) {
      const d = new Date(tx.transacted_at);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;

      if (!groups[key]) {
        groups[key] = {
          key,
          title: monthLabel(d),
          total: 0,
          count: 0,
          data: [],
        };
      }

      if (tx.type !== "refunded") {
        groups[key].total += Number(tx.amount);
      }
      groups[key].count += 1;
      groups[key].data.push(tx);
    }

    return Object.values(groups).sort((a, b) => b.key.localeCompare(a.key));
  }, [txs]);

  if (isLoading && txs.length === 0) {
    return (
      <View style={[s.root, { justifyContent: "center", alignItems: "center" }]}>
        <ActivityIndicator size="large" color={C.ink} />
      </View>
    );
  }

  const renderItem = ({
    item,
    index,
    section,
  }: {
    item: Tx;
    index: number;
    section: Section;
  }) => {
    const isRefunded = item.type === "refunded";
    const emoName = item.emotion_name?.toLowerCase() ?? null;
    const emoColor = emoName ? emotionColor(emoName) : C.inkMute;
    const barColor = isRefunded ? "#C4BDB7" : emoColor;

    const amount = `${item.currency_code === "EUR" ? "€" : item.currency_code}${Number(item.amount).toFixed(2)}`;

    const meta = [amount, formatRelative(item.transacted_at), item.category_name]
      .filter(Boolean)
      .join(" · ");

    const isLast = index === section.data.length - 1;

    return (
      <Pressable
        onPress={() => router.push(`/transaction/${item.id}`)}
        style={({ pressed }) => [
          s.row,
          !isLast && s.rowBorder,
          pressed && s.rowPressed,
        ]}
      >
        <View style={s.rowLine}>
          <View style={s.rowLeft}>
            <View style={[s.rowBar, { backgroundColor: barColor }]} />

            <View style={s.rowTextBlock}>
              <Text
                style={[s.txMerchant, isRefunded && s.strikethrough]}
                numberOfLines={1}
              >
                {item.merchant_name || "unknown item"}
              </Text>

              <Text style={s.txMeta} numberOfLines={1}>
                {meta}
              </Text>
            </View>
          </View>

          <View style={s.rowEmotionBox}>
            {isRefunded ? (
              <View style={s.refundBadge}>
                <Text style={s.refundText}>refund</Text>
              </View>
            ) : (
              <Text style={[s.txEmotion, { color: emoColor }]} numberOfLines={1}>
                {emoName ? `${emotionSymbol(emoName)} ${emoName}` : "—"}
              </Text>
            )}
          </View>
        </View>
      </Pressable>
    );
  };

  const renderSectionHeader = ({ section }: { section: Section }) => (
    <View style={s.sectionHeader}>
      <View style={s.sectionHeaderRow}>
        <Text style={s.sectionTitle}>{section.title}</Text>
        <Text style={s.sectionTotal}>€{Math.round(section.total)}</Text>
      </View>
      <Text style={s.sectionMeta}>
        {section.count} {section.count === 1 ? "entry" : "entries"}
      </Text>
    </View>
  );

  return (
    <View style={s.root}>
      <View style={s.header}>
        <Pressable onPress={() => router.back()} hitSlop={10} style={s.backBtn}>
          <Svg width={22} height={22} viewBox="0 0 24 24" fill="none">
            <Path
              d="M15 6l-6 6 6 6"
              stroke={C.ink}
              strokeWidth={1.6}
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </Svg>
        </Pressable>
        <Text style={s.headerTitle}>all purchases</Text>
        <View style={{ width: 22 }} />
      </View>

      {sections.length === 0 ? (
        <View style={s.emptyState}>
          <Text style={s.emptyText}>no transactions yet</Text>
        </View>
      ) : (
        <SectionList
          sections={sections}
          keyExtractor={(item) => String(item.id)}
          renderItem={renderItem}
          renderSectionHeader={renderSectionHeader}
          stickySectionHeadersEnabled={false}
          contentContainerStyle={s.listContent}
          showsVerticalScrollIndicator={false}
        />
      )}
    </View>
  );
}

const makeStyles = (C: ThemeColors) => StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: C.bg,
  },

  header: {
    paddingTop: 56,
    paddingBottom: 6,
    paddingHorizontal: 24,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  greeting: {
    fontFamily: "PlayfairDisplay_700Bold_Italic",
    fontSize: 28,
    color: C.ink,
    letterSpacing: -0.3,
  },
  headerBtn: {
    padding: 4,
  },

  scrollContent: {
    paddingBottom: 28,
  },

  toastContainer: {
    position: "absolute",
    top: 0,
    left: 24,
    right: 24,
    backgroundColor: C.ink,
    borderRadius: 14,
    paddingVertical: 14,
    paddingHorizontal: 16,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
    zIndex: 100,
    shadowColor: "#000",
    shadowOpacity: 0.18,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
    elevation: 6,
  },
  toastCheck: {
    color: C.bg,
    fontFamily: "Manrope_700Bold",
    fontSize: 16,
  },
  toastText: {
    color: C.bg,
    fontSize: 15,
    fontFamily: "Manrope_600SemiBold",
  },


  hero: {
    paddingHorizontal: 24,
    paddingTop: 4,
    paddingBottom: 10,
  },
  kicker: {
    fontFamily: "Manrope_600SemiBold",
    fontSize: 11,
    letterSpacing: 2,
    color: C.inkMute,
    marginBottom: 10,
  },
  heroHeadline: {
    fontFamily: "PlayfairDisplay_700Bold",
    fontSize: 44,
    color: C.ink,
    lineHeight: 52,
    letterSpacing: -0.8,
  },
  heroEmoWord: {
    fontFamily: "PlayfairDisplay_700Bold_Italic",
    fontSize: 44,
  },
  heroAmount: {
    fontFamily: "LibreCaslonText_700Bold",
    fontSize: 44,
  },

  statsWrap: {
    paddingHorizontal: 24,
    paddingTop: 10,
  },
  statsDivider: {
    height: 1,
    backgroundColor: C.purple,
    opacity: 0.55,
    marginTop: 16,
    marginBottom: 14,
  },
  statsRow: {
    flexDirection: "row",
    justifyContent: "space-between",
  },
  statCell: {
    alignItems: "center",
  },
  statLabel: {
    fontFamily: "Manrope_600SemiBold",
    fontSize: 10.5,
    letterSpacing: 1.8,
    color: C.inkMute,
    marginBottom: 6,
  },
  statValue: {
    fontFamily: "LibreCaslonText_400Regular",
    fontSize: 28,
    color: C.ink,
    lineHeight: 30,
    letterSpacing: -0.6,
  },

  emoOfMonth: {
    paddingHorizontal: 24,
    paddingTop: 25,
    paddingBottom: 16,
  },
  emoOfMonthRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  emoOfMonthText: {
    fontFamily: "PlayfairDisplay_400Regular",
    fontSize: 16,
    color: C.ink,
    flex: 1,
    lineHeight: 22,
  },
  emoOfMonthEmo: {
    fontFamily: "PlayfairDisplay_700Bold_Italic",
    fontSize: 18,
  },

  recentWrap: {
    paddingHorizontal: 24,
    paddingTop: 14,
    marginTop: -19,
  },
  recentHeader: {
    flexDirection: "row",
    alignItems: "flex-end",
    justifyContent: "space-between",
    paddingBottom: 4,
    borderBottomWidth: 1,
    borderBottomColor: C.recentRule,
    marginBottom: 2,
  },
  recentTitle: {
    fontFamily: "PlayfairDisplay_700Bold_Italic",
    fontSize: 28,
    color: C.ink,
    letterSpacing: -0.3,
  },
  recentToggle: {
    fontFamily: "Manrope_400Regular",
    fontSize: 15,
    color: C.ink,
    borderBottomWidth: 1,
    borderBottomColor: C.purple,
    paddingBottom: 1,
  },

  recentItem: {
    minHeight: 82,
    paddingTop: 12,
    paddingBottom: 14,
  },

  recentItemBorder: {
    borderBottomWidth: 1,
    borderBottomColor: C.ruleSoft,
  },

  recentItemDim: {
    opacity: 0.32,
  },

  recentItemPressed: {
    backgroundColor: "rgba(0,0,0,0.04)",
  },

  recentLine: {
    width: "100%",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    minHeight: 50,
  },

  recentLeft: {
    flex: 1,
    minWidth: 0,
    flexDirection: "row",
    alignItems: "center",
  },

  recentBar: {
    width: 4,
    height: 42,
    borderRadius: 2,
    marginRight: 12,
    flexShrink: 0,
  },

  recentTextBlock: {
    flex: 1,
    minWidth: 0,
    paddingRight: 10,
  },

  recentEmotionBox: {
    width: 104,
    flexShrink: 0,
    alignItems: "flex-end",
    justifyContent: "center",
  },

  txEmotion: {
    fontFamily: "PlayfairDisplay_700Bold_Italic",
    fontSize: 16,
    lineHeight: 20,
    textAlign: "right",
  },

  txRow: {
    minHeight: 66,
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 8,
  },
  txRowPressed: {
    backgroundColor: "rgba(0,0,0,0.04)",
  },
  txRowBorder: {
    borderBottomWidth: 1,
    borderBottomColor: C.ruleSoft,
  },
  txBar: {
    width: 4,
    height: 42,
    borderRadius: 2,
    marginRight: 12,
    flexShrink: 0,
  },
  txBody: {
    flex: 1,
    minWidth: 0,
    paddingRight: 10,
  },
  txMerchant: {
    fontFamily: "Manrope_700Bold",
    fontSize: 18,
    color: C.ink,
    lineHeight: 22,
  },
  txMeta: {
    fontFamily: "Manrope_400Regular",
    fontSize: 14,
    color: C.inkSoft,
    lineHeight: 19,
    marginTop: 2,
  },
  txRight: {
    width: 104,
    flexShrink: 0,
    alignItems: "flex-end",
    justifyContent: "center",
  },

  refundBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    backgroundColor: C.ringBg,
  },
  refundText: {
    fontFamily: "Manrope_700Bold",
    fontSize: 9,
    letterSpacing: 0.8,
    color: C.inkSoft,
    textTransform: "uppercase",
  },

  strikethrough: {
    textDecorationLine: "line-through",
    color: C.inkMute,
  },

  emptyState: {
    paddingVertical: 36,
    alignItems: "center",
  },
  emptyText: {
    fontFamily: "PlayfairDisplay_400Regular_Italic",
    fontSize: 14,
    color: C.inkSoft,
  },
  backBtn: {
    padding: 4,
  },
  headerTitle: {
    fontFamily: "PlayfairDisplay_400Regular_Italic",
    fontSize: 22,
    color: C.ink,
    letterSpacing: -0.3,
  },

  listContent: {
    paddingHorizontal: 24,
    paddingBottom: 40,
  },

  sectionHeader: {
    paddingTop: 22,
    paddingBottom: 6,
    borderBottomWidth: 1,
    borderBottomColor: C.recentRule,
    marginBottom: 2,
  },
  sectionHeaderRow: {
    flexDirection: "row",
    alignItems: "flex-end",
    justifyContent: "space-between",
  },
  sectionTitle: {
    fontFamily: "PlayfairDisplay_700Bold_Italic",
    fontSize: 26,
    color: C.ink,
    letterSpacing: -0.3,
    textTransform: "lowercase",
  },
  sectionTotal: {
    fontFamily: "LibreCaslonText_400Regular",
    fontSize: 18,
    color: C.ink,
    letterSpacing: -0.4,
  },
  sectionMeta: {
    fontFamily: "Manrope_400Regular",
    fontSize: 12,
    color: C.inkMute,
    marginTop: 2,
    letterSpacing: 0.4,
  },

  row: {
    minHeight: 82,
    paddingTop: 12,
    paddingBottom: 14,
  },
  rowBorder: {
    borderBottomWidth: 1,
    borderBottomColor: C.ruleSoft,
  },
  rowPressed: {
    backgroundColor: "rgba(0,0,0,0.04)",
  },
  rowLine: {
    width: "100%",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    minHeight: 50,
  },
  rowLeft: {
    flex: 1,
    minWidth: 0,
    flexDirection: "row",
    alignItems: "center",
  },
  rowBar: {
    width: 4,
    height: 42,
    borderRadius: 2,
    marginRight: 12,
    flexShrink: 0,
  },
  rowTextBlock: {
    flex: 1,
    minWidth: 0,
    paddingRight: 10,
  },
  rowEmotionBox: {
    width: 104,
    flexShrink: 0,
    alignItems: "flex-end",
    justifyContent: "center",
  },
});
