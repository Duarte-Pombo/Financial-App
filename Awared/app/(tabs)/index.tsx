import { Text, View, StyleSheet } from "react-native";
import Gauge from "@/components/gauge";
import React from "react";

export default function Index() {
  return (
    <View style={styles.container}>
      <Text>You Have</Text>
      <Text>MONEY$</Text>
      <Text>to spend</Text>
      <Gauge value={0.7} />
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
})
