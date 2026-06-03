import { StyleSheet } from "react-native";

export const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#fdf3ff",
  },
  scrollContent: {
    width: "100%",
    maxWidth: 400,
    alignSelf: "center",
    paddingHorizontal: 22,
    paddingTop: 56,
    paddingBottom: 110,
  },

  // Header
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 28,
  },
  backButton: {
    width: 34,
    height: 34,
    borderRadius: 17,
    borderWidth: 1,
    borderColor: "#d0c4dc",
    alignItems: "center",
    justifyContent: "center",
  },
  headerText: {
    fontSize: 14,
    fontFamily: "RobotoSerif_500Medium",
    color: "#333",
  },
  headerTime: {
    fontSize: 14,
    color: "#666",
  },

  // Shared
  label: {
    fontSize: 13,
    color: "#777",
    textAlign: "center",
    marginBottom: 8,
  },
  centeredSection: {
    alignItems: "center",
    marginBottom: 24,
  },

  // Amount
  amountRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
  },
  amountInput: {
    fontSize: 56,
    fontFamily: "RobotoSerif_700Bold",
    color: "#111",
    letterSpacing: -2,
    textAlign: "center",
    padding: 0,
    minWidth: 60,
    maxWidth: 220,
  },
  currencySymbol: {
    fontSize: 20,
    color: "#888",
    fontFamily: "RobotoSerif_400Regular",
    marginLeft: 2,
    marginTop: 8,
  },
  amountUnderline: {
    width: "55%",
    height: 2,
    backgroundColor: "#c9b8d8",
    borderRadius: 2,
    marginTop: 6,
  },

  // Item
  itemInput: {
    fontSize: 22,
    fontFamily: "RobotoSerif_600SemiBold",
    color: "#111",
    textAlign: "center",
    textDecorationLine: "underline",
    textDecorationColor: "#c9b8d8",
    padding: 0,
    minWidth: 80,
    maxWidth: 260,
  },

  // Feelings
  feelingsScroll: {
    marginBottom: 24,
  },
  feelingsScrollContent: {
    flexDirection: "row",
    gap: 8,
    paddingVertical: 4,
  },
  feelingChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    borderRadius: 20,
    paddingVertical: 7,
    paddingHorizontal: 12,
  },
  feelingEmoji: {
    fontSize: 13,
  },
  feelingChipText: {
    fontSize: 13,
    fontFamily: "RobotoSerif_500Medium",
  },
  selectedFeeling: {
    borderWidth: 2,
    borderColor: "#333",
  },

  // Location
  locationInputRow: {
    flexDirection: "row",
    alignItems: "center",
    borderWidth: 1,
    borderColor: "#d0c4dc",
    borderRadius: 24,
    paddingHorizontal: 14,
    paddingVertical: 9,
    backgroundColor: "#fff",
    marginBottom: 6,
  },
  locationInput: {
    flex: 1,
    fontSize: 14,
    color: "#333",
    fontFamily: "RobotoSerif_500Medium",
    padding: 0,
    marginLeft: 8,
  },

  // Auto-detect badge
  autoDetectWrapper: {
    alignItems: "center",
    marginTop: 8,
    marginBottom: 24,
  },
  autoDetectBadge: {
    backgroundColor: "#d4f4d4",
    borderRadius: 20,
    paddingVertical: 4,
    paddingHorizontal: 14,
  },
  autoDetectText: {
    fontSize: 11,
    fontFamily: "RobotoSerif_500Medium",
    color: "#2a7a2a",
  },

  // Note
  noteInput: {
    borderWidth: 1,
    borderColor: "#d0c4dc",
    borderRadius: 14,
    padding: 12,
    height: 90,
    fontSize: 13,
    color: "#333",
    lineHeight: 20,
    backgroundColor: "#fff",
    textAlignVertical: "top",
    marginBottom: 28,
  },

  // Button
  button: {
    backgroundColor: "#1a1a1a",
    paddingVertical: 15,
    borderRadius: 14,
    alignItems: "center",
  },
  buttonText: {
    color: "#fff",
    fontSize: 15,
    fontFamily: "RobotoSerif_600SemiBold",
    letterSpacing: 0.3,
  },
});