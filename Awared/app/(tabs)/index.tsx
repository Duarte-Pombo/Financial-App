import { Text, View, StyleSheet, Pressable } from "react-native";
import Gauge from "@/components/gauge";
import Button from "@/components/button";
import React from "react";
import Ionicons from '@expo/vector-icons/Ionicons';

export default function Index() {
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
      <View style={styles.activityContainer}>
        <Text style={{ alignSelf: 'center', fontSize: 30, padding: 5 }}>Activity</Text>
        <Text style={{ alignSelf: 'center', fontSize: 18, padding: 5 }}>Emotion of the day:😟</Text>
        <View style={styles.entry}>
          <Text style={{ fontSize: 30 }}>😟</Text>
          <View>
            <Text>Coffe - Anxious</Text>
            <Text>3 hours ago</Text>
          </View>
          <Text>-1,20€</Text>
        </View>
        <View style={styles.entry}>
          <Text style={{ fontSize: 30 }}>😟</Text>
          <View>
            <Text>Coffe - Anxious</Text>
            <Text>3 hours ago</Text>
          </View>
          <Text>-1,20€</Text>
        </View>
        <View style={styles.entry}>
          <Text style={{ fontSize: 30 }}>😟</Text>
          <View>
            <Text>Coffe - Anxious</Text>
            <Text>3 hours ago</Text>
          </View>
          <Text>-1,20€</Text>
        </View>
        <Pressable style={{ width: '100%', padding: 10, marginTop: 5 }} onPress={() => alert("View History")}>
          <Text style={{ alignSelf: 'center', fontSize: 18 }}>View More</Text>
        </Pressable>
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
    borderBottomWidth: 2,
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
