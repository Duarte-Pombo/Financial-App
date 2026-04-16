import { Text, View, StyleSheet, Pressable, ActivityIndicator } from "react-native";
import Gauge from "@/components/gauge";
import React, { useCallback, useEffect, useState } from "react";
import Ionicons from '@expo/vector-icons/Ionicons';
import { getDb } from "@/database/db";
import { useAuth } from "../../context/AuthContext";

type ActivityItem = {
  id: string;
  merchant_name: string | null;
  amount: number;
  currency_code: string;
  created_at: string;
  category_name: string | null;
  category_icon: string | null;
  emotion_emoji: string | null;
};

export default function Index() {
  const { user } = useAuth();
  const [activity, setActivity] = useState<ActivityItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadActivity() {
      if (!user) return;
      try {
        const db = await getDb();
        const result = await db.getAllAsync<ActivityItem>(
          `SELECT 
            t.id,
            t.merchant_name,
            t.amount,
            t.currency_code,
            t.created_at,
            sc.name AS category_name,
            sc.icon AS category_icon,
            e.emoji AS emotion_emoji
          FROM transactions t
          LEFT JOIN spending_categories sc ON t.category_id = sc.id
          LEFT JOIN emotion_logs el ON t.emotion_log_id = el.id
          LEFT JOIN emotions e ON el.emotion_id = e.id
          WHERE t.user_id = ?
          ORDER BY t.created_at DESC
          LIMIT 3`,
          [user.id]
        );
        setActivity(result);
      } catch (error) {
        console.error("Failed to load activity:", error);
      } finally {
        setLoading(false);
      }
    }
    loadActivity();
  }, [user]);

  const renderRecentItem = (item: ActivityItem) => (
    <View style={styles.entry} key={item.id}>
      <Text style={{ fontSize: 30 }}>{item.emotion_emoji || "😟"}</Text>
      <View style={{ flex: 1, marginLeft: 12 }}>
        <View style={{ flexDirection: "row", alignItems: "center" }}>
          {item.category_icon && (
            <Ionicons name={item.category_icon as any} size={18} color="#6b21a8" style={{ marginRight: 4 }} />
          )}
          <Text style={{ fontSize: 18 }}>{item.category_name || "Uncategorized"}</Text>
        </View>
        <Text style={{ fontSize: 16 }}>{item.merchant_name || "Unknown merchant"}</Text>
        <Text style={{ fontSize: 14, color: "#666" }}>
          {new Date(item.created_at).toLocaleDateString()}
        </Text>
      </View>
      <Text style={{ fontSize: 18, fontWeight: "500" }}>
        {item.amount.toFixed(2)} {item.currency_code}
      </Text>
    </View>
  );

  if (!user) {
    return (
      <View style={styles.container}>
        <ActivityIndicator size="large" color="#9b72cf" />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.budget}>
        <Text style={{ fontSize: 28 }}>You Have</Text>
        <View style={{ paddingLeft: 20, flexDirection: "row", gap: 10, alignItems: "center" }}>
          <Text style={{ fontSize: 48 }}>202,30€</Text>
          <Pressable onPress={() => alert("Edit Budget")}>
            <Ionicons name="pencil" size={24} color="#555" />
          </Pressable>
        </View>
        <Text style={{ fontSize: 28, paddingLeft: 50 }}>to spend</Text>
        <View style={{ alignSelf: 'center', marginTop: 20, marginBottom: 30 }}>
          <Gauge value={0.7} />
        </View>
      </View>

      <View style={styles.activityContainer}>
        <Text style={{ alignSelf: 'center', fontSize: 30, padding: 5 }}>Activity</Text>
        <Text style={{ alignSelf: 'center', fontSize: 18, padding: 6 }}>Emotion of the day:😟</Text>
        {loading ? (
          <ActivityIndicator style={{ marginTop: 20 }} color="#9b72cf" />
        ) : activity.length > 0 ? (
          <>
            {activity.map(renderRecentItem)}
            <Pressable
              style={{ width: '100%', padding: 8, marginTop: 2 }}
              onPress={() => alert("View History")}
            >
              <Text style={{ alignSelf: 'center', fontSize: 18 }}>View More</Text>
            </Pressable>
          </>
        ) : (
          <Text style={{ alignSelf: 'center', marginTop: 20, fontSize: 16, color: "#888" }}>
            No recent transactions
          </Text>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#fdf3ff",
    alignItems: 'center',
    justifyContent: 'center',
  },
  activityContainer: {
    flex: 1,
    width: "100%",
    paddingLeft: 20,
    paddingRight: 20,
    flexDirection: "column",
    marginBottom: 60,
  },
  entry: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 10,
    borderBottomWidth: 1,
    borderBottomColor: "#e0c8f8",
  },
  budget: {
    width: '100%',
    paddingLeft: 20,
    paddingRight: 20,
    flex: 1 / 3,
    flexDirection: 'column',
    justifyContent: 'center',
    gap: 8,
  }
});
