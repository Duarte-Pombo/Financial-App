import { StyleSheet } from "react-native";

export const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#fdf3ff",
    paddingVertical: 20,
  },

  inner: {
    width: "100%",
    maxWidth: 400,
    alignSelf: "center",
    paddingHorizontal: 20,
  },

  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 10,
  },

  headerText: {
    fontSize: 16,
  },

  headerTime: {
    fontSize: 14,
  },

  label: {
    marginTop: 18,
    fontSize: 14,
    textAlign: "center",
  },

  amountInput: {
    fontSize: 48,
    textAlign: "center",
    fontWeight: "bold",
    borderBottomWidth: 1,
    marginTop: 5,
    alignSelf: "center",
    width: "70%",
  },

  itemInput: {
    fontSize: 24,
    textAlign: "center",
    borderBottomWidth: 1,
    marginTop: 5,
    alignSelf: "center",
    width: "70%",
  },

  feelingsRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginTop: 10,
  },

  feelingBox: {
    borderWidth: 1,
    padding: 10,
    borderRadius: 10,
    backgroundColor: "#e0f0ff",
  },

  feelingBoxPurple: {
    padding: 10,
    borderRadius: 10,
    backgroundColor: "#7a2a8c",
  },

  feelingBoxYellow: {
    padding: 10,
    borderRadius: 10,
    backgroundColor: "#f5e642",
  },

  selected: {
    borderWidth: 2,
    borderColor: "#000",
  },

  locationInput: {
    borderWidth: 1,
    borderRadius: 10,
    padding: 10,
    marginTop: 10,
    textAlign: "center",
  },

  autoDetect: {
    textAlign: "center",
    marginTop: 5,
    fontSize: 12,
    color: "green",
  },

  input: {
    borderWidth: 1,
    borderRadius: 10,
    padding: 10,
    marginTop: 10,
    height: 80,
  },

  button: {
    backgroundColor: "#000",
    padding: 15,
    borderRadius: 12,
    alignItems: "center",
    marginTop: 25,
  },

  buttonText: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "bold",
  },
});