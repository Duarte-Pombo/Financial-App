import { Platform, StyleSheet, Dimensions } from "react-native";

export const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#fdf3ff",
  },
  scrollContent: {
    paddingHorizontal: 24,
    paddingTop: 40,
    flexGrow: 1, 
  },

  // Header
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 16,
    backgroundColor: "#fff",
    padding: 14,
    borderRadius: 20,
    shadowColor: "#000",
    shadowOpacity: 0.04,
    shadowRadius: 8,
    elevation: 2,
  },
  headerText: { 
    fontSize: 15, 
    fontFamily: "RobotoSerif_500Medium", 
    color: "#333" 
  },
  headerTime: { 
    fontSize: 15, 
    color: "#666", 
    fontFamily: "RobotoSerif_400Regular" 
  },
  headerTextEditing: { 
    color: "#6b21a8", 
    fontFamily: "RobotoSerif_700Bold" 
  },
  dateTimeBtn: { 
    flexDirection: "row", 
    alignItems: "center" 
  },
  pickerContainer: { 
    backgroundColor: '#fff', 
    borderRadius: 20, 
    padding: 6, 
    marginBottom: 12 
  },

  // Shared
  label: { 
    fontSize: 14, 
    color: "#666", 
    textAlign: "center", 
    marginBottom: 6, 
    fontFamily: "RobotoSerif_500Medium" 
  },
  centeredSection: { 
    alignItems: "center", 
    marginBottom: 16 
  },

  // Amount & Item
  amountRow: { 
    flexDirection: "row", 
    alignItems: "flex-end", 
    justifyContent: "center" 
  },
  amountInput: {
    fontSize: 60, 
    fontFamily: "RobotoSerif_700Bold", 
    color: "#1a1a1a",
    letterSpacing: -1, 
    textAlign: "center", 
    padding: 0, 
    minWidth: 60, 
    maxWidth: 240,
  },
  currencySymbol: { 
    fontSize: 26, 
    color: "#888", 
    fontFamily: "RobotoSerif_400Regular", 
    marginLeft: 4, 
    marginBottom: 6 
  },
  itemInput: {
    fontSize: 24, 
    fontFamily: "RobotoSerif_600SemiBold", 
    color: "#1a1a1a",
    textAlign: "center", 
    padding: 0, 
    minWidth: 80, 
    maxWidth: 280,
  },
  inputUnderline: { 
    width: "40%", 
    height: 3, 
    backgroundColor: "#e0d4ea", 
    borderRadius: 2, 
    marginTop: 4 
  },

  // Emotions
  emotionGrid: { 
    flexDirection: "row", 
    justifyContent: "center", 
    gap: 8, 
    marginBottom: 16 
  },
  emotionSquare: {
    width: 76, 
    height: 76, 
    borderRadius: 18, 
    justifyContent: "center", 
    alignItems: "center",
    padding: 6, 
    overflow: 'hidden', 
    shadowColor: "#000", 
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05, 
    shadowRadius: 4, 
    elevation: 2, 
    position: 'relative',
  },
  selectedSquare: { 
    borderWidth: 3, 
    borderColor: "#1a1a1a" 
  },
  unselectedSquare: { 
    borderWidth: 3, 
    borderColor: 'transparent' 
  },
  squareEmoji: { 
    fontSize: 24, 
    marginBottom: 4
  },
  squareText: { 
    fontSize: 11, 
    fontFamily: "RobotoSerif_600SemiBold", 
    textAlign: "center" 
  },
  plusSquare: {
    width: 76, 
    height: 76, 
    borderRadius: 18, 
    borderWidth: 2, 
    borderColor: "#d0c4dc",
    borderStyle: "dashed", 
    justifyContent: "center", 
    alignItems: "center", 
    backgroundColor: "#faf5ff",
  },

  // Modal Overlay
  modalOverlay: { 
    ...StyleSheet.absoluteFillObject, 
    backgroundColor: "rgba(0,0,0,0.4)" 
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
    maxHeight: "85%",
  },
  modalHeader: { 
    flexDirection: "row", 
    justifyContent: "space-between", 
    alignItems: "center", 
    marginBottom: 24 
  },
  modalTitle: { 
    fontSize: 20, 
    fontFamily: "RobotoSerif_700Bold", 
    color: "#1a1a1a" 
  },
  modalScroll: { 
    flexDirection: "row", 
    flexWrap: "wrap", 
    gap: 12, 
    justifyContent: "center", 
    paddingBottom: 40 
  },

  // Location
  locationInputRow: {
    flexDirection: "row", 
    alignItems: "center", 
    borderWidth: 1, 
    borderColor: "#e0e0e0",
    borderRadius: 14, 
    paddingHorizontal: 14, 
    paddingVertical: 9, 
    backgroundColor: "#fff", 
    marginBottom: 8,
  },
  locationInput: { 
    flex: 1, 
    fontSize: 14, 
    color: "#333", 
    fontFamily: "RobotoSerif_400Regular", 
    marginLeft: 10 
  },
  autoDetectWrapper: { 
    flexDirection: "row", 
    justifyContent: "center", 
    alignItems: "center", 
    gap: 12, 
    marginBottom: 16 
  },
  autoDetectBadge: {
    flexDirection: "row", 
    alignItems: "center", 
    gap: 6, 
    backgroundColor: "#e8f5e9",
    borderRadius: 20, 
    paddingVertical: 7, 
    paddingHorizontal: 14, 
    minWidth: 120, 
    justifyContent: "center"
  },
  autoDetectText: { 
    fontSize: 12, 
    fontFamily: "RobotoSerif_600SemiBold", 
    color: "#2a7a2a" 
  },

  // Note
  noteInput: {
    borderWidth: 1, 
    borderColor: "#e0e0e0", 
    borderRadius: 16, 
    padding: 16, 
    height: 100,
    fontSize: 15, 
    color: "#333", 
    backgroundColor: "#fff", 
    textAlignVertical: "top", 
    marginBottom: 20,
    fontFamily: "RobotoSerif_400Regular"
  },

  // Map
  mapHeader: { 
    flexDirection: 'row', 
    alignItems: 'center', 
    justifyContent: 'center', 
    padding: 16, 
    backgroundColor: '#fff', 
    borderBottomWidth: 1, 
    borderBottomColor: '#f0f0f0' 
  },
  mapHeaderText: { 
    fontSize: 18, 
    fontFamily: "RobotoSerif_700Bold", 
    color: '#1a1a1a' 
  },
  mapHeaderClose: { 
    position: 'absolute', 
    right: 16, 
    padding: 4 
  },
  mapCenterPin: { 
    position: 'absolute', 
    top: '50%', 
    left: '50%', 
    transform: [{ translateX: -22 }, { translateY: -44 }], 
    justifyContent: 'center', 
    alignItems: 'center' 
  },
  mapOverlayControls: { 
    position: 'absolute', 
    bottom: 40, 
    left: 24, 
    right: 24 
  },
  mapConfirmBtn: { 
    backgroundColor: '#1a1a1a', 
    padding: 18, 
    borderRadius: 16, 
    alignItems: 'center', 
    shadowColor: "#000", 
    shadowOpacity: 0.1, 
    shadowRadius: 10, 
    elevation: 4 
  },
  mapConfirmBtnText: { 
    color: '#fff', 
    fontFamily: "RobotoSerif_700Bold", 
    fontSize: 16 
  },

  // Button
  button: { 
    backgroundColor: "#9b72cf", 
    paddingVertical: 14, 
    borderRadius: 16, 
    alignItems: "center", 
    shadowColor: "#9b72cf", 
    shadowOpacity: 0.3, 
    shadowRadius: 8, 
    elevation: 4 
  },
  buttonText: { 
    color: "#fff", 
    fontSize: 16, 
    fontFamily: "RobotoSerif_700Bold" 
  },
});