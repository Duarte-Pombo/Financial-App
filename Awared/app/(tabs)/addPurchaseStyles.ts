import { Platform, StyleSheet, Dimensions } from "react-native";

export const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#fdf3ff",
  },
  scrollContent: {
    width: "100%",
    maxWidth: 420,
    alignSelf: "center",
    paddingHorizontal: 24,
    paddingTop: 64,
    paddingBottom: 100,
  },

  // Header
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 32,
  },
  headerText: {
    fontSize: 16,
    fontFamily: "RobotoSerif_500Medium",
    color: "#333",
  },
  headerTime: {
    fontSize: 16,
    color: "#666",
  },
  headerTextEditing: {
    color: "#6b21a8",
    fontFamily: "RobotoSerif_600SemiBold",
  },
  dateTimeBtn: {
    flexDirection: "row",
    alignItems: "center",
  },

  // Shared
  label: {
    fontSize: 14,
    color: "#777",
    textAlign: "center",
    marginBottom: 10,
  },
  centeredSection: {
    alignItems: "center",
    marginBottom: 26,
  },

  // Amount
  amountRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
  },
  amountInput: {
    fontSize: 64,
    fontFamily: "RobotoSerif_700Bold",
    color: "#111",
    letterSpacing: -2,
    textAlign: "center",
    padding: 0,
    minWidth: 60,
    maxWidth: 240,
    textDecorationLine: "underline",
    textDecorationColor: "#c9b8d8",
  },
  currencySymbol: {
    fontSize: 24,
    color: "#888",
    fontFamily: "RobotoSerif_400Regular",
    marginLeft: 4,
    marginTop: 10,
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
    fontSize: 24,
    fontFamily: "RobotoSerif_600SemiBold",
    color: "#111",
    textAlign: "center",
    textDecorationLine: "underline",
    textDecorationColor: "#c9b8d8",
    padding: 0,
    minWidth: 80,
    maxWidth: 280,
  },

  // Emotions (New Square Grid)
  emotionGrid: {
    flexDirection: "row",
    justifyContent: "center",
    gap: 8,
    marginBottom: 26,
    flexWrap: "nowrap",
  },
  emotionSquare: {
    width: 76,
    height: 76,
    borderRadius: 16,
    justifyContent: "center",
    alignItems: "center",
    padding: 8,
    // Add overflow hidden to prevent ripple from going outside the border
    overflow: 'hidden', 
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
    // Add position relative for selected border layering
    position: 'relative',
  },
  selectedSquare: {
    borderWidth: 3,
    borderColor: "#1a1a1a",
  },

  unselectedSquare: {
    borderWidth: 3,
    borderColor: 'transparent',
  },

  squareEmoji: {
    fontSize: 22,
    marginBottom: 3,
  },
  squareText: {
    fontSize: 11,
    fontFamily: "RobotoSerif_600SemiBold",
    textAlign: "center",
  },
  plusSquare: {
    width: 76,
    height: 76,
    borderRadius: 16,
    borderWidth: 2,
    borderColor: "#d0c4dc",
    borderStyle: "dashed",
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "transparent",
  },

  // Modal Overlay
  modalOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(0,0,0,0.4)",
  },
  modalContent: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: "#fff",
    borderTopLeftRadius: 32,
    borderTopRightRadius: 32,
    padding: 24,
    maxHeight: "80%",
  },
  modalHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 20,
  },
  modalTitle: {
    fontSize: 18,
    fontFamily: "RobotoSerif_700Bold",
  },
  modalScroll: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 12,
    justifyContent: "center",
    paddingBottom: 40,
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
    fontSize: 15,
    color: "#333",
    fontFamily: "RobotoSerif_500Medium",
    padding: 0,
    marginLeft: 8,
  },
  autoDetectWrapper: {
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    gap: 12,
    marginTop: 8,
    marginBottom: 24,
    width: "100%",
  },

  mapCenterPin: {
    position: 'absolute',
    top: '50%',
    left: '50%',
    transform: [{ translateX: -20 }, { translateY: -40 }],
    justifyContent: 'center',
    alignItems: 'center',
  },
  mapOverlayControls: {
    position: 'absolute',
    bottom: 40,
    left: 20,
    right: 20,
    gap: 12,
  },
  mapConfirmBtn: {
    backgroundColor: '#1a1a1a',
    padding: 18,
    borderRadius: 16,
    alignItems: 'center',
  },
  mapConfirmBtnText: {
    color: '#fff',
    fontWeight: '700',
    fontSize: 16,
  },
  mapCancelBtn: {
    backgroundColor: '#fff',
    padding: 12,
    borderRadius: 14,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#eee',
  },
  mapCancelBtnText: {
    color: '#999',
    fontWeight: '600'
  },

  autoDetectBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: "#d4f4d4",
    borderRadius: 20,
    paddingVertical: 6,
    paddingHorizontal: 16,
    alignSelf: "center",
    minWidth: 120,
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
    height: 96,
    fontSize: 14,
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
    fontSize: 16,
    fontFamily: "RobotoSerif_600SemiBold",
    letterSpacing: 0.3,
  },
});