import React, { useState, useMemo, useCallback } from "react"; // Added useCallback
import { View, Text, StyleSheet, ScrollView, ActivityIndicator, Pressable, Alert } from "react-native";
import { useLocalSearchParams, useRouter, useFocusEffect } from "expo-router"; // Added useFocusEffect
import Ionicons from '@expo/vector-icons/Ionicons';
import { getDb } from "@/database/db";
import { EmotionGlyph, emotionColor, hasEmotionGlyph } from "@/components/EmotionGlyph";
import { useTheme } from "@/context/ThemeContext";
import { ThemeColors } from "@/theme/theme";

// Round chrome button (back / edit)
function ChromeButton({ onClick, children, label, style }: { onClick: () => void; children: React.ReactNode; label: string; style: any }) {
  return (
    <Pressable aria-label={label} onPress={onClick} style={style}>
      {children}
    </Pressable>
  );
}

export default function TransactionDetails() {
  const { id } = useLocalSearchParams();
  const router = useRouter();
  const { colors: C } = useTheme();
  const styles = useMemo(() => makeStyles(C), [C]);

  const [transaction, setTransaction] = useState<any>(null);
  const [emotions, setEmotions] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [userCurrency, setUserCurrency] = useState("€");

  // Swapped useEffect for useFocusEffect so it runs whenever we navigate back to this screen
  useFocusEffect(
    useCallback(() => {
      async function fetchDetails() {
        try {
          const db = await getDb();

          // 1. Get the main transaction details
          const tx = await db.getFirstAsync(
            `SELECT * FROM transactions WHERE id = ?`,
            [id]
          );
          setTransaction(tx);

          // 2. Get the associated emotions
          if (tx && tx.emotion_log_id) {
            const emos = await db.getAllAsync(
              `SELECT e.* FROM emotions e
               JOIN emotion_logs l ON e.id = l.emotion_id
               WHERE l.id = ?`,
              [tx.emotion_log_id]
            );
            setEmotions(emos);
          } else {
            setEmotions([]); // Clear emotions if none exist anymore
          }

          if (global.userID) {
            const user = await db.getFirstAsync<{ currency_code: string }>(
              `SELECT currency_code FROM users WHERE id = ?`,
              [global.userID]
            );
            if (user && user.currency_code) {
              setUserCurrency(user.currency_code);
            }
          }

        } catch (error) {
          console.error("Failed to load transaction details:", error);
        } finally {
          setIsLoading(false);
        }
      }

      if (id) fetchDetails();
    }, [id])
  );

  // --- ACTIONS LOGIC ---
  const handleDelete = () => {
    Alert.alert(
      "Delete Expense",
      "Are you sure you want to delete this expense? This cannot be undone.",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete",
          style: "destructive",
          onPress: async () => {
            try {
              const db = await getDb();
              await db.runAsync(`DELETE FROM transactions WHERE id = ?`, [id]);
              router.back(); // Go back to Home/History after deleting
            } catch (e) {
              Alert.alert("Error", "Could not delete transaction.");
            }
          }
        }
      ]
    );
  };

  const handleRefund = () => {
    if (!transaction) return;
    const txDate = new Date(transaction.transacted_at);
    const now = new Date();
    const diffTime = Math.abs(now.getTime() - txDate.getTime());
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

    if (diffDays > 30) {
      Alert.alert(
        "Refund Unavailable",
        "This purchase cannot be marked as refunded because it is older than 30 days."
      );
      return;
    }

    Alert.alert(
      "Mark as Refunded",
      "Do you want to mark this purchase as refunded?",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Confirm",
          onPress: async () => {
            try {
              const db = await getDb();
              await db.runAsync(`UPDATE transactions SET type = 'refunded' WHERE id = ?`, [id]);
              setTransaction({ ...transaction, type: 'refunded' });
              Alert.alert("Success", "Expense has been marked as refunded.");
            } catch (e) {
              Alert.alert("Error", "Could not process refund.");
            }
          }
        }
      ]
    );
  };

  if (isLoading) {
    return (
      <View style={[styles.container, styles.centered]}>
        <ActivityIndicator size="large" color={C.purpleDeep} />
      </View>
    );
  }

  if (!transaction) {
    return (
      <View style={[styles.container, styles.centered]}>
        <Text style={styles.errorText}>Transaction not found.</Text>
        <Pressable onPress={() => router.back()} style={styles.backButton}>
          <Text style={styles.backButtonText}>Go Back</Text>
        </Pressable>
      </View>
    );
  }

  const txDate = new Date(transaction.transacted_at);
  const isRefunded = transaction.type === "refunded";

  const now = new Date();
  const diffTime = Math.abs(now.getTime() - txDate.getTime());
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  const canRefund = diffDays <= 30 && !isRefunded;
  const canEdit = diffDays <= 3 && !isRefunded;

  const [intPart, decPart] = String(transaction.amount).split(".");

  const dateTimeLabel = `${txDate.toLocaleDateString([], { weekday: 'long', month: 'long', day: 'numeric' })} at ${txDate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`;
  const locationValue = transaction.location || "Location not recorded";
  const hasLocation = !!transaction.location;

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.scrollContent}>

      {/* Header */}
      <View style={styles.header}>
        <ChromeButton label="back" onClick={() => router.back()} style={styles.chromeButton}>
          <Ionicons name="chevron-back" size={20} color={C.inkSoft} />
        </ChromeButton>
        <Text style={styles.headerTitle}>purchase</Text>
          {canEdit ? (
            <ChromeButton label="edit" onClick={() => router.push(`/edit/${id}`)} style={styles.chromeButton}>
              <Ionicons name="pencil" size={17} color={C.inkSoft} />
            </ChromeButton>
          ) : (
            <View style={{ width: 38 }} />
        )}
      </View>

      {/* Hero / Amount */}
      <View style={styles.heroCard}>
        <Text style={styles.heroMerchant}>
          {transaction.merchant_name || "Unknown Item"}
        </Text>
        <View style={styles.heroAmountRow}>
          <Text style={styles.heroAmount}>
            {intPart}
            {decPart ? <Text style={styles.heroDecimal}>.{decPart}</Text> : ""}
          </Text>
          <Text style={styles.currencySymbol}>{userCurrency}</Text>
        </View>
        {isRefunded && (
          <View style={styles.refundBadge}>
            <Text style={styles.refundBadgeText}>refunded</Text>
          </View>
        )}
      </View>

      {/* Info Card */}
      <View style={styles.card}>
        <View style={styles.infoRow}>
          <View style={styles.iconWrapper}>
            <Ionicons name="calendar-outline" size={18} color={C.purpleDeep} />
          </View>
          <View style={styles.infoTextContainer}>
            <Text style={styles.eyebrow}>DATE & TIME</Text>
            <Text style={styles.infoValue}>{dateTimeLabel}</Text>
          </View>
        </View>

        <View style={styles.divider} />

        <View style={styles.infoRow}>
          <View style={styles.iconWrapper}>
            <Ionicons name="location-outline" size={18} color={C.purpleDeep} />
          </View>
          <View style={styles.infoTextContainer}>
            <Text style={styles.eyebrow}>LOCATION</Text>
            <Text style={[styles.infoValue, !hasLocation && styles.infoValueMuted]}>{locationValue}</Text>
          </View>
        </View>
      </View>

      {/* Emotions Card */}
      {emotions.length > 0 ? (
        <View style={[styles.card, styles.cardPadded]}>
          <Text style={styles.cardTitle}>how you felt</Text>
          <View style={styles.emotionGrid}>
            {emotions.map((emo, idx) => {
              const lower = (emo.name || "").toLowerCase();
              const color = emotionColor(lower, emo.color_hex || C.purple);
              const showGlyph = hasEmotionGlyph(lower);
              return (
                <View key={idx} style={[styles.emotionBadge, { backgroundColor: color + "1F", borderColor: color + "55" }]}>
                  <View style={[styles.emotionGlyphCircle, { backgroundColor: color + "26" }]}>
                    {showGlyph ? (
                      <EmotionGlyph emotion={lower} color={color} size={17} />
                    ) : (
                      <Text style={styles.emotionEmoji}>{emo.emoji}</Text>
                    )}
                  </View>
                  <Text style={[styles.emotionName, { color }]}>{emo.name}</Text>
                </View>
              );
            })}
          </View>
        </View>
      ) : null}

      {/* Notes Card */}
      {transaction.note ? (
        <View style={[styles.card, styles.cardPadded]}>
          <Text style={styles.cardTitle}>notes</Text>
          <Text style={styles.noteText}>{transaction.note}</Text>
        </View>
      ) : null}

      {/* --- Action Buttons --- */}
      <View style={styles.actionsContainer}>
        {canRefund ? (
          <Pressable style={styles.actionButton} onPress={handleRefund}>
            <Ionicons name="arrow-undo-outline" size={18} color={C.ink} />
            <Text style={styles.actionButtonText}>Mark as Refunded</Text>
          </Pressable>
        ) : !isRefunded && (
           <Text style={styles.expiredText}>Past 30-day refund window</Text>
        )}

        <Pressable style={[styles.actionButton, styles.deleteButton]} onPress={handleDelete}>
          <Ionicons name="trash-outline" size={17} color={C.danger} />
          <Text style={styles.deleteButtonText}>Delete Expense</Text>
        </Pressable>
      </View>

    </ScrollView>
  );
}

const makeStyles = (C: ThemeColors) => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: C.bg,
  },
  centered: {
    justifyContent: "center",
    alignItems: "center",
  },
  scrollContent: {
    paddingHorizontal: 24,
    paddingTop: 60,
    paddingBottom: 40,
  },

  // Header
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 6,
  },
  chromeButton: {
    width: 38,
    height: 38,
    borderRadius: 19,
    borderWidth: 1,
    borderColor: C.rule,
    backgroundColor: C.panel,
    alignItems: "center",
    justifyContent: "center",
  },
  headerTitle: {
    fontSize: 24,
    fontFamily: "PlayfairDisplay_700Bold_Italic",
    color: C.ink,
    letterSpacing: -0.3,
  },

  // Hero Card
  heroCard: {
    alignItems: "center",
    paddingTop: 22,
    marginBottom: 26,
  },
  heroMerchant: {
    fontSize: 16,
    color: C.inkSoft,
    fontFamily: "PlayfairDisplay_400Regular_Italic",
    marginBottom: 14,
  },
  heroAmountRow: {
    flexDirection: "row",
    alignItems: "baseline",
  },
  heroAmount: {
    fontSize: 68,
    lineHeight: 72,
    color: C.ink,
    fontFamily: "PlayfairDisplay_700Bold",
    letterSpacing: -1.5,
  },
  heroDecimal: {
    color: C.inkSoft,
  },
  currencySymbol: {
    fontSize: 26,
    color: C.inkMute,
    fontFamily: "PlayfairDisplay_400Regular_Italic",
    marginLeft: 8,
  },
  refundBadge: {
    backgroundColor: "rgba(95,122,79,0.12)",
    borderWidth: 1,
    borderColor: "rgba(95,122,79,0.30)",
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: 999,
    marginTop: 14,
  },
  refundBadgeText: {
    color: C.green,
    fontSize: 10,
    letterSpacing: 0.6,
    textTransform: "uppercase",
    fontFamily: "Manrope_500Medium",
  },

  // Cards
  card: {
    backgroundColor: C.panel,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: C.rule,
    overflow: "hidden",
    marginBottom: 14,
  },
  cardPadded: {
    padding: 18,
  },
  cardTitle: {
    fontSize: 16,
    fontFamily: "PlayfairDisplay_400Regular_Italic",
    color: C.ink,
    marginBottom: 12,
  },

  // Info Rows inside Info Card
  infoRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 15,
    paddingHorizontal: 18,
  },
  iconWrapper: {
    width: 38,
    height: 38,
    borderRadius: 11,
    backgroundColor: "rgba(126,100,179,0.10)",
    borderWidth: 1,
    borderColor: "rgba(126,100,179,0.22)",
    justifyContent: "center",
    alignItems: "center",
    marginRight: 14,
  },
  infoTextContainer: {
    flex: 1,
  },
  eyebrow: {
    fontSize: 10.5,
    letterSpacing: 1.8,
    color: C.inkMute,
    textTransform: "uppercase",
    fontFamily: "Manrope_500Medium",
    marginBottom: 3,
  },
  infoValue: {
    fontSize: 15,
    color: C.ink,
    fontFamily: "Manrope_600SemiBold",
  },
  infoValueMuted: {
    color: C.inkMute,
  },
  divider: {
    height: 1,
    backgroundColor: C.ruleSoft,
  },

  // Emotions
  emotionGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  emotionBadge: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 7,
    paddingLeft: 8,
    paddingRight: 14,
    borderRadius: 999,
    borderWidth: 1,
    gap: 8,
  },
  emotionGlyphCircle: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
  },
  emotionEmoji: {
    fontSize: 16,
  },
  emotionName: {
    fontSize: 16,
    fontFamily: "PlayfairDisplay_700Bold_Italic",
    textTransform: "capitalize",
  },

  // Notes
  noteText: {
    fontSize: 15,
    color: C.inkSoft,
    lineHeight: 22,
    fontFamily: "Manrope_400Regular",
  },

  // Actions Container
  actionsContainer: {
    marginTop: 10,
    gap: 12,
  },
  actionButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: C.purpleSoft,
    borderWidth: 1,
    borderColor: "rgba(126,100,179,0.26)",
    paddingVertical: 15,
    borderRadius: 14,
    gap: 9,
  },
  actionButtonText: {
    fontSize: 15.5,
    fontFamily: "PlayfairDisplay_700Bold_Italic",
    color: C.ink,
  },
  expiredText: {
    textAlign: "center",
    fontSize: 12,
    color: C.inkMute,
    fontFamily: "PlayfairDisplay_400Regular_Italic",
  },
  deleteButton: {
    backgroundColor: "rgba(194,74,58,0.07)",
    borderColor: "rgba(194,74,58,0.22)",
  },
  deleteButtonText: {
    fontSize: 15.5,
    fontFamily: "PlayfairDisplay_700Bold_Italic",
    color: C.danger,
  },

  // Error State
  errorText: {
    fontSize: 16,
    color: C.inkSoft,
    fontFamily: "PlayfairDisplay_400Regular_Italic",
    marginBottom: 20,
  },
  backButton: {
    backgroundColor: C.blackBtn,
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 4,
  },
  backButtonText: {
    color: "#FAF6EF",
    fontFamily: "Manrope_600SemiBold",
    fontSize: 13,
    letterSpacing: 1.5,
    textTransform: "uppercase",
  },
});
