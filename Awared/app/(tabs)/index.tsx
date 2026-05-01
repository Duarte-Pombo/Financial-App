import React, { useState, useCallback, useEffect, useRef } from "react";
import { Text, View, StyleSheet, Pressable, ScrollView, ActivityIndicator, Animated } from "react-native";
import { useFocusEffect, useRouter, useLocalSearchParams } from "expo-router"; 
import Ionicons from '@expo/vector-icons/Ionicons';
import { getDb } from "@/database/db";

const MONTHS_LONG = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];

export default function Index() {
  const router = useRouter(); 
  const params = useLocalSearchParams(); // ✅ Added to catch URL parameters
  
  const [activity, setActivity] = useState<any[] | null>(null);
  const [monthlySpent, setMonthlySpent] = useState<number>(0);
  const [budgetGoal, setBudgetGoal] = useState<number | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // --- Toast Animation State ---
  const [showToast, setShowToast] = useState(false);
  const toastAnim = useRef(new Animated.Value(-100)).current;

  // ✅ Trigger Toast when "added=true" is detected
  useEffect(() => {
    if (params.added === "true") {
      setShowToast(true);
      // Slide down
      Animated.spring(toastAnim, {
        toValue: 20, // Distance from top
        useNativeDriver: true,
      }).start();

      // Hide after 3 seconds
      const timer = setTimeout(() => {
        Animated.timing(toastAnim, {
          toValue: -100, // Slide back up
          duration: 300,
          useNativeDriver: true,
        }).start(() => {
          setShowToast(false);
          // Clear params so it doesn't re-trigger on un-related re-renders
          router.setParams({ added: "", timestamp: "" }); 
        });
      }, 3000);

      return () => clearTimeout(timer);
    }
  }, [params.added, params.timestamp]);

  const getActivity = useCallback(async () => {
    setIsLoading(true);
    try {
      const db = await getDb();
      const userID = global.userID;
      
      const transactions = await db.getAllAsync(
        `SELECT t.id, t.amount, t.merchant_name, t.currency_code, t.transacted_at, t.type, e.emoji 
         FROM transactions as t
         JOIN emotion_logs l ON t.emotion_log_id = l.id
         JOIN emotions e on l.emotion_id = e.id
         WHERE t.user_id = ? ORDER BY t.transacted_at DESC LIMIT 3`,
        [userID]
      );
      setActivity(transactions);

      const now = new Date();
      const yearMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
      
      const row = await db.getFirstAsync<{ total: number }>(
        `SELECT COALESCE(SUM(amount), 0) as total
         FROM transactions
         WHERE user_id = ?
           AND strftime('%Y-%m', transacted_at) = ?
           AND type != 'refunded'`, 
        [userID, yearMonth]
      );
      setMonthlySpent(row?.total ?? 0);

      await db.runAsync(
        `CREATE TABLE IF NOT EXISTS user_settings (
          user_id TEXT PRIMARY KEY, 
          monthly_budget REAL
        )`
      );
      
      const settings = await db.getFirstAsync<{ monthly_budget: number }>(
        `SELECT monthly_budget FROM user_settings WHERE user_id = ?`,
        [userID]
      );
      setBudgetGoal(settings?.monthly_budget || null);

    } catch (error) {
      console.error("Failed to fetch activity:", error);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      getActivity();
    }, [getActivity])
  );

  if (isLoading && !activity) {
    return (
      <View style={[styles.container, { justifyContent: "center", alignItems: "center" }]}>
        <ActivityIndicator size="large" color="#9b72cf" />
      </View>
    );
  }

  const progressPercentage = budgetGoal && budgetGoal > 0 
    ? Math.min((monthlySpent / budgetGoal) * 100, 100) 
    : 0;
  const isOverBudget = budgetGoal && monthlySpent > budgetGoal;

  return (
    <View style={styles.container}>
      {/* ── Success Toast Notification ── */}
      {showToast && (
        <Animated.View style={[styles.toastContainer, { transform: [{ translateY: toastAnim }] }]}>
          <Ionicons name="checkmark-circle" size={24} color="#fff" />
          <Text style={styles.toastText}>Purchase added successfully!</Text>
        </Animated.View>
      )}

      <ScrollView contentContainerStyle={styles.scrollContent}>
        
        {/* ── Budget Hero Card ── */}
        <Pressable 
          style={({ pressed }) => [styles.heroCard, pressed && { opacity: 0.85 }]}
          onPress={() => router.push("/budget")}
        >
          <View style={styles.heroHeader}>
            <Text style={styles.heroSubtitle}>You have spent</Text>
            <Ionicons name="pencil" size={16} color="#e0c8f8" />
          </View>
          
          <Text style={styles.heroAmount}>€{monthlySpent.toFixed(2)}</Text>
          
          {budgetGoal ? (
            <View style={styles.progressContainer}>
              <View style={styles.progressBarBackground}>
                <View 
                  style={[
                    styles.progressBarFill, 
                    { width: `${progressPercentage}%` },
                    isOverBudget && { backgroundColor: "#ff7675" }
                  ]} 
                />
              </View>
              <Text style={styles.progressText}>
                {isOverBudget ? "Over budget by" : "Out of"} €{budgetGoal.toFixed(2)} this month
              </Text>
            </View>
          ) : (
            <Text style={styles.heroSubtitleBottom}>Tap to set a monthly budget goal</Text>
          )}
        </Pressable>

        {/* ── Emotion of the Day ── */}
        {activity && activity.length > 0 && (
          <View style={styles.emotionPill}>
            <Text style={styles.emotionText}>
              Emotion of the day: <Text style={{ fontSize: 20 }}>{activity[0].emoji}</Text>
            </Text>
          </View>
        )}

        {/* ── Recent Activity Section ── */}
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Recent Activity</Text>
        </View>

        <View style={styles.card}>
          {activity && activity.length === 0 ? (
            <View style={styles.emptyState}>
              <Ionicons name="receipt-outline" size={40} color="#ccc" style={{ marginBottom: 10 }} />
              <Text style={styles.emptyStateText}>No transactions registered yet!</Text>
            </View>
          ) : (
            <>
              {activity?.map((item, index) => {
                const isRefunded = item.type === "refunded"; 
                
                return (
                  <Pressable 
                    key={item.id} 
                    style={({ pressed }) => [
                      styles.transactionRow, 
                      index === activity.length - 1 && { borderBottomWidth: 0 },
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
                        {new Date(item.transacted_at).toLocaleDateString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                      </Text>
                    </View>
                    
                    <Text style={[styles.transactionAmount, isRefunded && styles.strikethroughAmount]}>
                      {item.amount} {item.currency_code === "EUR" ? "€" : item.currency_code}
                    </Text>
                  </Pressable>
                );
              })}

              <Pressable style={styles.viewMoreButton} onPress={() => router.push("/history")}>
                <Text style={styles.viewMoreText}>View History</Text>
              </Pressable>
            </>
          )}
        </View>

      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#fdf3ff" },
  scrollContent: { padding: 20, paddingTop: 60, paddingBottom: 40 },

  // --- Toast Styles ---
  toastContainer: {
    position: "absolute",
    top: 0,
    left: 20,
    right: 20,
    backgroundColor: "#4caf50", // Success green
    borderRadius: 16,
    padding: 16,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
    zIndex: 100, // Make sure it sits above everything
    shadowColor: "#000",
    shadowOpacity: 0.15,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
    elevation: 6,
  },
  toastText: {
    color: "#fff",
    fontSize: 15,
    fontFamily: "RobotoSerif_600SemiBold",
  },

  // --- Hero Card Updates ---
  heroCard: {
    backgroundColor: "#9b72cf",
    borderRadius: 24,
    padding: 30,
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#9b72cf",
    shadowOpacity: 0.3,
    shadowRadius: 15,
    shadowOffset: { width: 0, height: 8 },
    elevation: 8,
    marginBottom: 20,
  },
  heroHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginBottom: 8,
  },
  heroSubtitle: { color: "#f3e8ff", fontSize: 16, fontFamily: "RobotoSerif_500Medium" },
  heroAmount: { color: "#ffffff", fontSize: 48, fontFamily: "RobotoSerif_700Bold", marginVertical: 4 },
  heroSubtitleBottom: { color: "#e0c8f8", fontSize: 15, fontFamily: "RobotoSerif_500Medium", marginTop: 8 },
  
  // Progress Bar
  progressContainer: { width: "100%", marginTop: 16, alignItems: "center" },
  progressBarBackground: {
    width: "100%",
    height: 8,
    backgroundColor: "rgba(255, 255, 255, 0.2)",
    borderRadius: 4,
    overflow: "hidden",
    marginBottom: 8,
  },
  progressBarFill: {
    height: "100%",
    backgroundColor: "#fff",
    borderRadius: 4,
  },
  progressText: { color: "#f3e8ff", fontSize: 13, fontFamily: "RobotoSerif_400Regular" },

  emotionPill: {
    backgroundColor: "#fff",
    borderRadius: 20,
    paddingVertical: 12,
    paddingHorizontal: 20,
    alignSelf: "center",
    marginBottom: 30,
    shadowColor: "#000", shadowOpacity: 0.05, shadowRadius: 8, elevation: 2,
    borderWidth: 1, borderColor: "#f3e8ff"
  },
  emotionText: { color: "#444", fontSize: 15, fontFamily: "RobotoSerif_600SemiBold", alignItems: "center" },

  sectionHeader: { marginBottom: 12, paddingLeft: 4 },
  sectionTitle: { fontSize: 20, fontFamily: "RobotoSerif_700Bold", color: "#1a1a1a" },

  card: {
    backgroundColor: "#fff",
    borderRadius: 20,
    padding: 16,
    shadowColor: "#000", shadowOpacity: 0.06, shadowRadius: 10, elevation: 3,
  },

  emptyState: { alignItems: "center", paddingVertical: 30 },
  emptyStateText: { color: "#888", fontFamily: "RobotoSerif_400Regular", fontSize: 15 },

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

  strikethrough: { textDecorationLine: 'line-through', color: "#aaa" },
  strikethroughAmount: { textDecorationLine: 'line-through', color: "#aaa", fontFamily: "RobotoSerif_500Medium" },
  refundBadgeMini: {
    backgroundColor: "#e0f2f1", paddingHorizontal: 6, paddingVertical: 2, borderRadius: 6, marginLeft: 8,
  },
  refundBadgeTextMini: { color: "#00796b", fontSize: 10, fontFamily: "RobotoSerif_700Bold" },

  viewMoreButton: {
    height: 44, width: "100%", backgroundColor: "#e0c8f8", borderRadius: 12,
    justifyContent: "center", alignItems: "center", marginTop: 16,
  },
  viewMoreText: { color: "#6b21a8", fontFamily: "RobotoSerif_600SemiBold", fontSize: 15 },
});