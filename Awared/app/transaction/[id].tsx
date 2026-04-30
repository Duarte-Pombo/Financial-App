import React, { useState, useEffect } from "react";
import { View, Text, StyleSheet, ScrollView, ActivityIndicator, Pressable, Alert } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import Ionicons from '@expo/vector-icons/Ionicons';
import { getDb } from "@/database/db";

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
    const txDate = new Date(transaction.transacted_at);
    const now = new Date();
    const diffTime = Math.abs(now.getTime() - txDate.getTime());
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

    // 2. Check the 30-day constraint before doing anything
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
              // Updating the type to 'refunded' (or you could add an is_refunded boolean to your schema)
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
        <ActivityIndicator size="large" color="#9b72cf" />
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
          <Ionicons name="chevron-back" size={24} color="#1a1a1a" />
        </Pressable>
        <Text style={styles.headerTitle}>Purchase Details</Text>
        <View style={{ width: 24 }} />
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
          {transaction.amount} <Text style={styles.currencySymbol}>{transaction.currency_code === "EUR" ? "€" : transaction.currency_code}</Text>
        </Text>
      </View>

      {/* Info Card */}
      <View style={styles.card}>
        <View style={styles.infoRow}>
          <View style={styles.iconWrapper}>
            <Ionicons name="calendar-outline" size={20} color="#9b72cf" />
          </View>
          <View style={styles.infoTextContainer}>
            <Text style={styles.infoLabel}>Date & Time</Text>
            <Text style={styles.infoValue}>
              {txDate.toLocaleDateString([], { weekday: 'long', month: 'long', day: 'numeric' })} at {txDate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
            </Text>
          </View>
        </View>

        <View style={styles.divider} />

        <View style={styles.infoRow}>
          <View style={styles.iconWrapper}>
            <Ionicons name="location-outline" size={20} color="#9b72cf" />
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
              <View key={idx} style={[styles.emotionBadge, { backgroundColor: emo.color_hex || "#fdf3ff" }]}>
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
        {/* Only show Refund button if applicable */}
        {canRefund ? (
          <Pressable style={styles.actionButton} onPress={handleRefund}>
            <Ionicons name="arrow-undo-outline" size={20} color="#1a1a1a" />
            <Text style={styles.actionButtonText}>Mark as Refunded</Text>
          </Pressable>
        ) : !isRefunded && (
           <Text style={styles.expiredText}>Past 60-day refund window</Text>
        )}

        <Pressable style={[styles.actionButton, styles.deleteButton]} onPress={handleDelete}>
          <Ionicons name="trash-outline" size={20} color="#d32f2f" />
          <Text style={styles.deleteButtonText}>Delete Expense</Text>
        </Pressable>
      </View>

    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#fdf3ff",
  },
  centered: {
    justifyContent: "center",
    alignItems: "center",
  },
  scrollContent: {
    padding: 20,
    paddingTop: 60,
    paddingBottom: 40,
  },
  
  // Header
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 30,
  },
  iconButton: {
    padding: 8,
    backgroundColor: "#fff",
    borderRadius: 12,
    shadowColor: "#000", shadowOpacity: 0.05, shadowRadius: 5, elevation: 2,
  },
  headerTitle: {
    fontSize: 18,
    fontFamily: "RobotoSerif_700Bold",
    color: "#1a1a1a",
  },

  // Hero Card
  heroCard: {
    alignItems: "center",
    marginBottom: 30,
  },
  refundBadge: {
    backgroundColor: "#e0f2f1",
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 12,
    marginBottom: 8,
  },
  refundBadgeText: {
    color: "#00796b",
    fontSize: 12,
    fontFamily: "RobotoSerif_700Bold",
  },
  strikethrough: {
    textDecorationLine: 'line-through',
    color: "#aaa",
  },
  heroMerchant: {
    fontSize: 18,
    color: "#666",
    fontFamily: "RobotoSerif_500Medium",
    marginBottom: 8,
  },
  heroAmount: {
    fontSize: 56,
    color: "#1a1a1a",
    fontFamily: "RobotoSerif_700Bold",
    letterSpacing: -1,
  },
  currencySymbol: {
    fontSize: 32,
    color: "#888",
  },

  // Cards
  card: {
    backgroundColor: "#fff",
    borderRadius: 20,
    padding: 20,
    marginBottom: 20,
    shadowColor: "#000",
    shadowOpacity: 0.04,
    shadowRadius: 10,
    elevation: 3,
  },
  cardTitle: {
    fontSize: 16,
    fontFamily: "RobotoSerif_700Bold",
    color: "#1a1a1a",
    marginBottom: 16,
  },

  // Info Rows inside Info Card
  infoRow: {
    flexDirection: "row",
    alignItems: "center",
  },
  iconWrapper: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "#f4ebfc",
    justifyContent: "center",
    alignItems: "center",
    marginRight: 16,
  },
  infoTextContainer: {
    flex: 1,
  },
  infoLabel: {
    fontSize: 13,
    color: "#888",
    fontFamily: "RobotoSerif_500Medium",
    marginBottom: 2,
  },
  infoValue: {
    fontSize: 15,
    color: "#333",
    fontFamily: "RobotoSerif_600SemiBold",
  },
  divider: {
    height: 1,
    backgroundColor: "#f0f0f0",
    marginVertical: 16,
    marginLeft: 56, 
  },

  // Emotions
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
    borderRadius: 20,
  },
  emotionEmoji: {
    fontSize: 18,
    marginRight: 6,
  },
  emotionName: {
    fontSize: 14,
    color: "#333",
    fontFamily: "RobotoSerif_600SemiBold",
  },

  // Notes
  noteText: {
    fontSize: 15,
    color: "#444",
    lineHeight: 22,
    fontFamily: "RobotoSerif_400Regular",
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
    backgroundColor: "#e0d4ea",
    paddingVertical: 14,
    borderRadius: 16,
    gap: 8,
  },
  actionButtonText: {
    fontSize: 15,
    fontFamily: "RobotoSerif_600SemiBold",
    color: "#1a1a1a",
  },
  expiredText: {
    textAlign: "center",
    fontSize: 12,
    color: "#aaa",
    fontFamily: "RobotoSerif_400Regular",
  },
  deleteButton: {
    backgroundColor: "#ffebee",
  },
  deleteButtonText: {
    fontSize: 15,
    fontFamily: "RobotoSerif_600SemiBold",
    color: "#d32f2f",
  },

  // Error State
  errorText: {
    fontSize: 16,
    color: "#666",
    fontFamily: "RobotoSerif_500Medium",
    marginBottom: 20,
  },
  backButton: {
    backgroundColor: "#9b72cf",
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 12,
  },
  backButtonText: {
    color: "#fff",
    fontFamily: "RobotoSerif_600SemiBold",
    fontSize: 16,
  },
});