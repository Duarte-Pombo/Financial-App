import { Text, View, StyleSheet, Pressable } from "react-native";
import Gauge from "@/components/gauge";
import Button from "@/components/button";
import React, { useCallback } from "react";
import Ionicons from '@expo/vector-icons/Ionicons';
import { getDb } from "@/database/db";

async function getUserActivity() {
  let db = await getDb();
  let userID = global.userID;
  let transactions = await db.getAllAsync(
    "SELECT * FROM transactions WHERE user_id = ?",
    [userID]
  );
  return [transactions[0], transactions[1], transactions[2]];
}

export default function Index() {

  const [activity, setActivity] = React.useState(null);

  React.useEffect(() => {
    async function getActivity() {
      const db = await getDb();
      const userID = global.userID;
      const transactions = await db.getAllAsync(
        `SELECT * FROM transactions as t
        JOIN spending_categories as s
        on t.category_id = s.id
        WHERE t.user_id = ? ORDER BY t.created_at DESC LIMIT 3`,
        [userID]
      );
      setActivity(transactions);
    }
    getActivity();
  }, []);

  let recents = [];
  if (activity != null) {
    for (let i = 0; i < activity.length; i++) {
      recents.push(
        <View style={styles.entry} key={i}>
          <Text style={{ fontSize: 30 }}>😟</Text>
          <View>
            <Text style={{ fontSize: 18 }}>{activity[i].icon} {activity[i].name}</Text>
            <Text style={{ fontSize: 16 }}>{activity[i].merchant_name}</Text>
            <Text>{activity[i].created_at}</Text>
          </View>
          <Text>{activity[i].amount} {activity[i].currency_code}</Text>
        </View>
      );
    }
  }

  return (
    <View style={styles.container}>
      <View style={styles.budget}>
        <Text style={{ fontSize: 28 }}>You Have</Text>
        <View style={{ paddingLeft: 20, flexDirection: "row", gap: 10 }}>
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
      {activity ? (
        <View style={styles.activityContainer}>
          <Text style={{ alignSelf: 'center', fontSize: 30, padding: 5 }}>Activity</Text>
          <Text style={{ alignSelf: 'center', fontSize: 18, padding: 6 }}>Emotion of the day:😟</Text>
          {recents}
          <Pressable style={{ width: '100%', padding: 8, marginTop: 2 }} onPress={() => alert("View History")}>
            <Text style={{ alignSelf: 'center', fontSize: 18 }}>View More</Text>
          </Pressable>
        </View>
      ) : (
        <Text>Loading</Text>
      )}
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
  Buttons: {
    flex: 1,
    flexDirection: "row",
    alignItems: 'center',
    justifyContent: "space-evenly",
  },
  activityContainer: {
    flex: 1 / 2,
    width: "100%",
    paddingLeft: 20,
    paddingRight: 20,
    flexDirection: "column",
    marginBottom: 60,
  },
  entry: {
    flex: 1,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 10,
    borderBottomWidth: 1,
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
})
