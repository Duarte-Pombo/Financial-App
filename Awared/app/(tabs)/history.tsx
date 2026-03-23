import { Text, View, StyleSheet } from "react-native";

export default function History() {
  return (
    <View style={styles.container}>
      <Text>History Page Template</Text>
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
