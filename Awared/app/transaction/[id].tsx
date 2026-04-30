import React, { useState, useEffect } from "react";
import { View, StyleSheet, ScrollView, ActivityIndicator, Pressable, Alert } from "react-native";
import { Text } from "@/components/Text";
import { useLocalSearchParams, useRouter } from "expo-router";
import Ionicons from "@expo/vector-icons/Ionicons";
import { getDb } from "@/database/db";
import { colors, fonts, radii, spacing, elevation } from "@/constants/theme";

export default function TransactionDetails() {
  const { id } = useLocalSearchParams();
  const router = useRouter();

  const [transaction, setTransaction] = useState<any>(null);
  const [emotions, setEmotions] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
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
        }
      } catch (error) {
        console.error("Failed to load transaction details:", error);
      } finally {
        setIsLoading(false);
      }
    }

    if (id) fetchDetails();
  }, [id]);

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
              router.back();
            } catch (e) {
              Alert.alert("Error", "Could not delete transaction.");
            }
          },
        },
      ]
    );
  };

  const handleRefund = () => {
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
              setTransaction({ ...transaction, type: "refunded" });
              Alert.alert("Success", "Expense has been marked as refunded.");
            } catch (e) {
              Alert.alert("Error", "Could not process refund.");
            }
          },
        },
      ]
    );
  };

  if (isLoading) {
    return (
      <View style={[styles.container, styles.centered]}>
        <ActivityIndicator size="large" color={colors.primary} />
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

  // Check if less than 60 days have passed (BR05)
  const now = new Date();
  const diffTime = Math.abs(now.getTime() - txDate.getTime());
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  const canRefund = diffDays <= 60 && !isRefunded;

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.scrollContent}>
      {/* Header */}
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} style={styles.iconButton}>
          <Ionicons name="chevron-back" size={22} color={colors.onSurface} />
        </Pressable>
        <Text style={styles.headerTitle}>Purchase details</Text>
        <Pressable
          onPress={() => router.push(`/edit/${id}`)}
          style={styles.iconButton}
        >
          <Ionicons name="pencil" size={18} color={colors.onSurface} />
        </Pressable>
      </View>

      {/* Hero / Amount */}
      <View style={styles.heroCard}>
        {isRefunded && (
          <View style={styles.refundBadge}>
            <Text style={styles.refundBadgeText}>REFUNDED</Text>
          </View>
        )}
        <Text style={[styles.heroMerchant, isRefunded && styles.strikethrough]}>
          {transaction.merchant_name || "Unknown Item"}
        </Text>
        <Text style={[styles.heroAmount, isRefunded && styles.strikethrough]}>
          {transaction.amount}{" "}
          <Text style={styles.currencySymbol}>{transaction.currency_code === "EUR" ? "€" : transaction.currency_code}</Text>
        </Text>
      </View>

      {/* Info Card */}
      <View style={styles.card}>
        <View style={styles.infoRow}>
          <View style={styles.iconWrapper}>
            <Ionicons name="calendar-outline" size={18} color={colors.primary} />
          </View>
          <View style={styles.infoTextContainer}>
            <Text style={styles.infoLabel}>Date & time</Text>
            <Text style={styles.infoValue}>
              {txDate.toLocaleDateString([], { weekday: "long", month: "long", day: "numeric" })} at{" "}
              {txDate.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
            </Text>
          </View>
        </View>

        <View style={styles.divider} />

        <View style={styles.infoRow}>
          <View style={styles.iconWrapper}>
            <Ionicons name="location-outline" size={18} color={colors.tertiary} />
          </View>
          <View style={styles.infoTextContainer}>
            <Text style={styles.infoLabel}>Location</Text>
            <Text style={styles.infoValue}>{transaction.location || "Location not recorded"}</Text>
          </View>
        </View>
      </View>

      {/* Emotions Card */}
      {emotions.length > 0 ? (
        <View style={styles.card}>
          <Text style={styles.cardTitle}>How you felt</Text>
          <View style={styles.emotionGrid}>
            {emotions.map((emo, idx) => (
              <View key={idx} style={[styles.emotionBadge, { backgroundColor: emo.color_hex || colors.surfaceContainer }]}>
                <Text style={styles.emotionEmoji}>{emo.emoji}</Text>
                <Text style={styles.emotionName}>{emo.name}</Text>
              </View>
            ))}
          </View>
        </View>
      ) : null}

      {/* Notes Card */}
      {transaction.note ? (
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Notes</Text>
          <Text style={styles.noteText}>{transaction.note}</Text>
        </View>
      ) : null}

      {/* --- Action Buttons --- */}
      <View style={styles.actionsContainer}>
        {canRefund ? (
          <Pressable style={styles.actionButton} onPress={handleRefund}>
            <Ionicons name="arrow-undo-outline" size={18} color={colors.primary} />
            <Text style={styles.actionButtonText}>Mark as refunded</Text>
          </Pressable>
        ) : !isRefunded && (
          <Text style={styles.expiredText}>Past 30-day refund window</Text>
        )}

        <Pressable style={[styles.actionButton, styles.deleteButton]} onPress={handleDelete}>
          <Ionicons name="trash-outline" size={18} color={colors.error} />
          <Text style={styles.deleteButtonText}>Delete expense</Text>
        </Pressable>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  centered: {
    justifyContent: "center",
    alignItems: "center",
  },
  scrollContent: {
    padding: spacing.gutter,
    paddingTop: 60,
    paddingBottom: 40,
  },

  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: spacing.lg,
  },
  iconButton: {
    width: 40, height: 40,
    backgroundColor: colors.surface,
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: colors.outlineVariant,
  },
  headerTitle: {
    fontSize: 17,
    fontFamily: fonts.bold,
    color: colors.onSurface,
    letterSpacing: -0.3,
  },

  heroCard: {
    alignItems: "center",
    marginBottom: spacing.lg,
  },
  refundBadge: {
    backgroundColor: colors.tertiaryFixed,
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: radii.md,
    marginBottom: 8,
  },
  refundBadgeText: {
    color: colors.tertiary,
    fontSize: 11,
    fontFamily: fonts.bold,
    letterSpacing: 0.4,
  },
  strikethrough: {
    textDecorationLine: "line-through",
    color: colors.outline,
  },
  heroMerchant: {
    fontSize: 16,
    color: colors.outline,
    fontFamily: fonts.medium,
    marginBottom: 8,
  },
  heroAmount: {
    fontSize: 56,
    color: colors.onSurface,
    fontFamily: fonts.bold,
    letterSpacing: -1.5,
  },
  currencySymbol: {
    fontSize: 28,
    color: colors.outline,
    fontFamily: fonts.medium,
  },

  card: {
    backgroundColor: colors.surface,
    borderRadius: radii.xl,
    padding: spacing.lg,
    marginBottom: spacing.base,
    ...elevation.card,
  },
  cardTitle: {
    fontSize: 14,
    fontFamily: fonts.semibold,
    color: colors.onSurface,
    marginBottom: spacing.base,
  },

  infoRow: {
    flexDirection: "row",
    alignItems: "center",
  },
  iconWrapper: {
    width: 40, height: 40,
    borderRadius: 20,
    backgroundColor: colors.surfaceContainer,
    justifyContent: "center",
    alignItems: "center",
    marginRight: spacing.base,
  },
  infoTextContainer: { flex: 1 },
  infoLabel: {
    fontSize: 11,
    color: colors.outline,
    fontFamily: fonts.medium,
    letterSpacing: 0.6,
    marginBottom: 2,
    textTransform: "uppercase",
  },
  infoValue: {
    fontSize: 14,
    color: colors.onSurface,
    fontFamily: fonts.semibold,
  },
  divider: {
    height: 1,
    backgroundColor: colors.surfaceContainer,
    marginVertical: spacing.base,
    marginLeft: 56,
  },

  emotionGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
  },
  emotionBadge: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderRadius: radii.pill,
  },
  emotionEmoji: {
    fontSize: 16,
    marginRight: 6,
  },
  emotionName: {
    fontSize: 13,
    color: colors.onSurface,
    fontFamily: fonts.semibold,
  },

  noteText: {
    fontSize: 14,
    color: colors.onSurfaceVariant,
    lineHeight: 22,
    fontFamily: fonts.regular,
  },

  actionsContainer: {
    marginTop: 10,
    gap: 12,
  },
  actionButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.surfaceContainer,
    paddingVertical: 14,
    borderRadius: radii.xl,
    gap: 8,
  },
  actionButtonText: {
    fontSize: 14,
    fontFamily: fonts.semibold,
    color: colors.primary,
  },
  expiredText: {
    textAlign: "center",
    fontSize: 12,
    color: colors.outline,
    fontFamily: fonts.regular,
  },
  deleteButton: {
    backgroundColor: colors.errorContainer,
  },
  deleteButtonText: {
    fontSize: 14,
    fontFamily: fonts.semibold,
    color: colors.error,
  },

  errorText: {
    fontSize: 16,
    color: colors.onSurfaceVariant,
    fontFamily: fonts.medium,
    marginBottom: 20,
  },
  backButton: {
    backgroundColor: colors.primary,
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: radii.lg,
  },
  backButtonText: {
    color: colors.onPrimary,
    fontFamily: fonts.bold,
    fontSize: 15,
  },
});
