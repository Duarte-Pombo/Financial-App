import React, { useState, useCallback } from "react";
import { View, Text, StyleSheet, Pressable, ActivityIndicator, FlatList } from "react-native";
import { useFocusEffect, useRouter } from "expo-router";
import Ionicons from '@expo/vector-icons/Ionicons';
import { getDb } from "@/database/db";

export default function History() {
  const router = useRouter();
  const [history, setHistory] = useState<any[] | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [userCurrency, setUserCurrency] = useState("€");

  const getHistory = useCallback(async () => {
    setIsLoading(true);
    try {
      const db = await getDb();
      const userID = global.userID;

      const user = await db.getFirstAsync<{ currency_code: string }>(
        `SELECT currency_code FROM users WHERE id = ?`,
        [userID]
      );
      if (user && user.currency_code) {
        setUserCurrency(user.currency_code);
      }
      
      // Added t.type to the SELECT statement
      const transactions = await db.getAllAsync(
        `SELECT t.id, t.amount, t.merchant_name, t.currency_code, t.transacted_at, t.type, e.emoji 
         FROM transactions as t
         JOIN emotion_logs l ON t.emotion_log_id = l.id
         JOIN emotions e on l.emotion_id = e.id
         WHERE t.user_id = ? ORDER BY t.transacted_at DESC`,
        [userID]
      );
      setHistory(transactions);
    } catch (error) {
      console.error("Failed to fetch history:", error);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      getHistory();
    }, [getHistory])
  );

  const renderItem = ({ item, index }: { item: any; index: number }) => {
    const isLastItem = index === (history?.length ?? 0) - 1;
    const isRefunded = item.type === "refunded";

    return (
      <Pressable 
        style={({ pressed }) => [
          styles.transactionRow, 
          isLastItem && { borderBottomWidth: 0 },
          pressed && { opacity: 0.6 }
        ]}
        onPress={() => router.push(`/transaction/${item.id}`)}
      >
        <View style={[styles.emojiCircle, isRefunded && { backgroundColor: "#f0f0f0" }]}>
          <Text style={[styles.emojiSize, isRefunded && { opacity: 0.5 }]}>{item.emoji}</Text>
        </View>
        
        <View style={styles.transactionDetails}>
          <View style={{ flexDirection: 'row', alignItems: 'center' }}>
            <Text style={[styles.merchantName, isRefunded && styles.strikethrough]}>
              {item.merchant_name || "Unknown Item"}
            </Text>
            {isRefunded && (
              <View style={styles.refundBadgeMini}>
                <Text style={styles.refundBadgeTextMini}>REFUND</Text>
              </View>
            )}
          </View>
          <Text style={styles.transactionDate}>
            {new Date(item.transacted_at).toLocaleDateString([], { 
              year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' 
            })}
          </Text>
        </View>
        
        <Text style={[styles.transactionAmount, isRefunded && styles.strikethroughAmount]}>
          {item.amount} {userCurrency}
        </Text>
      </Pressable>
    );
  };

  if (isLoading && !history) {
    return (
      <View style={[styles.container, styles.centered]}>
        <ActivityIndicator size="large" color="#9b72cf" />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} style={styles.iconButton}>
          <Ionicons name="chevron-back" size={24} color="#1a1a1a" />
        </Pressable>
        <Text style={styles.headerTitle}>All Transactions</Text>
        <View style={{ width: 40 }} />
      </View>

      <View style={{ flex: 1, paddingHorizontal: 20 }}>
        <View style={styles.card}>
          {!history || history.length === 0 ? (
            <View style={styles.emptyState}>
              <Ionicons name="receipt-outline" size={40} color="#ccc" style={{ marginBottom: 10 }} />
              <Text style={styles.emptyStateText}>No transactions registered yet!</Text>
            </View>
          ) : (
            <FlatList
              data={history}
              keyExtractor={(item) => item.id.toString()}
              renderItem={renderItem}
              showsVerticalScrollIndicator={false}
              contentContainerStyle={{ paddingBottom: 20 }}
            />
          )}
        </View>
      </View>
    </View>
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
  
  // Header
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 20,
    paddingTop: 60,
    paddingBottom: 20,
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

  // Card & List Styles
  card: {
    flex: 1, 
    backgroundColor: "#fff",
    borderRadius: 20,
    padding: 16,
    marginBottom: 40,
    shadowColor: "#000", 
    shadowOpacity: 0.06, 
    shadowRadius: 10, 
    elevation: 3,
  },
  emptyState: { 
    alignItems: "center", 
    justifyContent: "center",
    flex: 1,
    paddingVertical: 30 
  },
  emptyStateText: { 
    color: "#888", 
    fontFamily: "RobotoSerif_400Regular", 
    fontSize: 15 
  },

  // Transaction Rows
  transactionRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: "#f0f0f0",
  },
  emojiCircle: {
    width: 46, height: 46,
    borderRadius: 23,
    backgroundColor: "#fdf3ff",
    alignItems: "center", justifyContent: "center",
    marginRight: 14,
  },
  emojiSize: { fontSize: 22 },
  
  transactionDetails: { flex: 1, justifyContent: "center" },
  merchantName: { fontSize: 16, fontFamily: "RobotoSerif_600SemiBold", color: "#333", marginBottom: 4 },
  transactionDate: { fontSize: 12, fontFamily: "RobotoSerif_400Regular", color: "#888" },
  transactionAmount: { fontSize: 16, fontFamily: "RobotoSerif_700Bold", color: "#1a1a1a" },

  // --- New Refund Styles ---
  strikethrough: {
    textDecorationLine: 'line-through',
    color: "#aaa",
  },
  strikethroughAmount: {
    textDecorationLine: 'line-through',
    color: "#aaa",
    fontFamily: "RobotoSerif_500Medium",
  },
  refundBadgeMini: {
    backgroundColor: "#e0f2f1",
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
    marginLeft: 8,
  },
  refundBadgeTextMini: {
    color: "#00796b",
    fontSize: 10,
    fontFamily: "RobotoSerif_700Bold",
  },
});