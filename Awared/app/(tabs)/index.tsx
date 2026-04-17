import { Text, View, StyleSheet, Pressable } from "react-native";
import React, { useCallback } from "react";
import Ionicons from '@expo/vector-icons/Ionicons';
import { getDb } from "@/database/db";
import { useFocusEffect } from "expo-router";

async function getUserActivity() {
  let db = await getDb();
  let userID = global.userID;
  let transactions = await db.getAllAsync(
    "SELECT * FROM transactions WHERE user_id = ?",
    [userID]
  );
  return [transactions[0], transactions[1], transactions[2]];
}

const MONTHS_LONG = ["January","February","March","April","May","June","July","August","September","October","November","December"];

export default function Index() {

  const [activity, setActivity] = React.useState(null);
  const [monthlySpent, setMonthlySpent] = React.useState<number>(0);

  const getActivity = async () => {
    const db = await getDb();
    const userID = global.userID;
    const transactions = await db.getAllAsync(
      `SELECT * FROM transactions as t
       JOIN emotion_logs l ON t.emotion_log_id = l.id
       JOIN emotions e on l.emotion_id = e.id
        WHERE t.user_id = ? ORDER BY t.created_at DESC LIMIT 3`,
      [userID]
    );
    setActivity(transactions);

    const now = new Date();
    const yearMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
    const row = await db.getFirstAsync<{ total: number }>(
      `SELECT COALESCE(SUM(amount), 0) as total
       FROM transactions
       WHERE user_id = ?
         AND strftime('%Y-%m', transacted_at) = ?`,
      [userID, yearMonth]
    );
    setMonthlySpent(row?.total ?? 0);
  }

  useFocusEffect(
    useCallback(() => {
      getActivity();
    }, [getActivity])
  );

  let recents = [];
  if (activity != null) {
    if (activity.length == 0) {
      recents.push(
        <View style={styles.entry} key={1}>
          <Text style={{ fontSize: 18, textAlign: "center" }}>It seems you have not registered any transactions yet!</Text>
        </View>
      )
    } else {
      recents.push(
        <Text style={{ alignSelf: 'center', fontSize: 18, padding: 6 }} key={"Emotion"}>Emotion of the day:😟</Text>
      )
      for (let i = 0; i < activity.length; i++) {
        let margin = 20 * i ** 1.2;
        console.log(margin);
        recents.push(
          <View style={[styles.entry, { marginLeft: margin, marginRight: margin }]} key={i}>
            <Text style={{ fontSize: 30 - i * 2 }}>{activity[i].emoji}</Text>
            <View>
              <Text style={{ fontSize: 22 - i * 4 }}>{activity[i].merchant_name}</Text>
              <Text>{new Date(activity[i].created_at).toLocaleString()}</Text>
            </View>
            <Text>{activity[i].amount} {activity[i].currency_code}</Text>
          </View>
        );
      }
      recents.push(
        <Pressable key={"History"} style={{ alignSelf: "center", width: '50%', padding: 8, marginTop: 20, borderRadius: 20, backgroundColor: '#FFBAE0', }} onPress={() => alert("View History")}>
          <Text style={{ alignSelf: 'center', fontSize: 18, color: '#AB2156' }}>View More</Text>
        </Pressable>
      );
    }
  }
  return (
    <View style={styles.container}>
      <View style={styles.budget}>
        <Text style={{ fontSize: 28, paddingLeft: 20 }}>You have spent</Text>
        <Text style={{ fontSize: 48, paddingLeft: 90 }}>€{monthlySpent.toFixed(2)}</Text>
        <Text style={{ fontSize: 28, paddingLeft: 198 }}>This Month</Text>
      </View>
      {activity ? (
        <View style={styles.activityContainer}>
          <Text style={{ alignSelf: 'center', fontSize: 30, padding: 5 }}>Activity</Text>
          {recents}
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
    marginBottom: 20,
  },
  entry: {
    flex: 1,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 10,
    borderBottomWidth: 0.8,
    borderColor: '#AB2156',
    borderRadius: 10,
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
