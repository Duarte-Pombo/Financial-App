import React from "react";
import { Text, View, StyleSheet } from "react-native";

export default function Calendar() {
  return (
    <View style={styles.container}>
      <Text>Calendar Page Template</Text>
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
