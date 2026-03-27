import { Text, View, StyleSheet } from "react-native";
import Gauge from "@/components/gauge";
import Button from "@/components/button";
import React from "react";
import Ionicons from '@expo/vector-icons/Ionicons';

export default function Index() {
  return (
    <View style={styles.container}>
      <View style={styles.budget}>
        <Text style={{ fontSize: 28, padding: 4 }}>You Have</Text>
        <Text style={{ fontSize: 48 }}>202,30€</Text>
        <Text style={{ fontSize: 28, padding: 4, paddingLeft: 50 }}>to spend</Text>
        <View style={{ alignSelf: 'center', marginTop: 10, marginBottom: 50 }}>
          <Gauge value={0.7} />
        </View>
        <View style={styles.Buttons}>
          <Button label="Edit Budget" />
          <Button label="See History" />
          <Button label="See profile" />
        </View>
      </View>
      <View style={styles.activityContainer}>
        <Text style={{ fontSize: 28, padding: 5 }}>Activity</Text>
        <Text>Emotion of the day:😟</Text>
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
    marginBottom: 50,
  }
})
