import { Text, View, StyleSheet } from "react-native";

export default function AddPurchase() {
  return (
    <View style={styles.container}>
      <Text>Add Purchase Template</Text>
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
