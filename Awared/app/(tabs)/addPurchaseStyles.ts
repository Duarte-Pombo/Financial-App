import { StyleSheet } from "react-native";
import { colors, fonts, radii, spacing, glassCard, elevation } from "@/constants/theme";

export const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },

  // Header (Close + title)
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: spacing.containerMargin,
    paddingTop: 52,
    paddingBottom: spacing.base,
    backgroundColor: colors.navBg,
    borderBottomWidth: 1,
    borderBottomColor: colors.outlineVariant,
  },
  closeBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.surfaceContainerHighest,
    alignItems: "center",
    justifyContent: "center",
  },
  headerTitle: {
    fontFamily: fonts.extrabold,
    fontSize: 22,
    color: colors.indigoText,
    letterSpacing: -0.4,
  },
  headerSpacer: { width: 40 },

  dateTimeRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: spacing.sm,
    marginTop: spacing.md,
  },
  dateTimeBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: spacing.sm,
    paddingVertical: 6,
    borderRadius: radii.pill,
    backgroundColor: colors.surfaceContainerLow,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.6)",
  },
  dateTimeBtnActive: {
    backgroundColor: colors.primaryFixed,
    borderColor: colors.primary,
  },
  dateTimeText: {
    fontFamily: fonts.medium,
    fontSize: 13,
    color: colors.onSurfaceVariant,
  },
  dateTimeTextActive: {
    color: colors.primary,
    fontFamily: fonts.semibold,
  },
  pickerWrap: {
    backgroundColor: colors.surfaceContainerLow,
    borderRadius: radii.base,
    marginHorizontal: spacing.containerMargin,
    marginTop: spacing.sm,
    padding: 6,
  },

  formContent: {
    flex: 1,
    paddingHorizontal: spacing.containerMargin,
    paddingTop: spacing.md,
    paddingBottom: 96, // leave room for the pinned Done button
  },
  doneBtnWrap: {
    position: "absolute",
    left: spacing.containerMargin,
    right: spacing.containerMargin,
    bottom: spacing.md,
  },
  displayAmountWrap: {
    alignItems: "center",
  },
  displayAmountRow: {
    flexDirection: "row",
    alignItems: "flex-start",
  },
  displayAmount: {
    fontFamily: fonts.extrabold,
    fontSize: 56,
    color: colors.primary,
    letterSpacing: -1.4,
    lineHeight: 64,
    minWidth: 140,
    textAlign: "center",
  },
  displayCurrency: {
    fontFamily: fonts.semibold,
    fontSize: 22,
    color: "rgba(99,14,212,0.6)",
    marginLeft: 4,
    marginTop: spacing.sm,
  },

  fieldsBlock: {
    flex: 1,
    paddingHorizontal: 0,
    justifyContent: "space-evenly",
    paddingVertical: spacing.sm,
  },

  field: {
    gap: spacing.base,
  },

  // Subtle inline date/time link under the amount
  dateTimeInlineRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    marginTop: spacing.sm,
  },
  dateTimeInlineText: {
    fontFamily: fonts.medium,
    fontSize: 12,
    color: colors.outline,
  },

  // Picker mini-switch (Date | Time)
  pickerSwitch: {
    flexDirection: "row",
    backgroundColor: colors.surfaceContainer,
    borderRadius: radii.pill,
    padding: 3,
    alignSelf: "center",
    marginBottom: spacing.sm,
  },
  pickerSwitchBtn: {
    paddingHorizontal: spacing.md,
    paddingVertical: 6,
    borderRadius: radii.pill,
  },
  pickerSwitchBtnActive: {
    backgroundColor: colors.surface,
    ...elevation.card,
  },
  pickerSwitchText: {
    fontFamily: fonts.medium,
    fontSize: 12,
    color: colors.onSurfaceVariant,
  },
  pickerSwitchTextActive: {
    color: colors.primary,
    fontFamily: fonts.semibold,
  },
  fieldLabel: {
    fontFamily: fonts.semibold,
    fontSize: 14,
    color: colors.onSurface,
    letterSpacing: 0.14,
  },

  pillInputWrap: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: colors.surfaceContainerLow,
    borderRadius: radii.pill,
    paddingHorizontal: spacing.sm,
    height: 46,
    borderWidth: 1,
    borderColor: "transparent",
  },
  pillInputIcon: {
    marginRight: spacing.sm,
  },
  pillInput: {
    flex: 1,
    fontFamily: fonts.regular,
    fontSize: 16,
    color: colors.onSurface,
    height: "100%",
  },

  moodRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.sm,
  },
  moodPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.xs,
    paddingHorizontal: spacing.sm,
    paddingVertical: 6,
    borderRadius: radii.pill,
    borderWidth: 1,
  },
  moodPillEmoji: { fontSize: 16 },
  moodPillLabel: { fontFamily: fonts.medium, fontSize: 12 },
  moodPillSelected: {
    borderWidth: 2,
    borderColor: colors.primary,
  },
  moodPlusBtn: {
    width: 38,
    height: 38,
    borderRadius: 19,
    borderWidth: 1,
    borderStyle: "dashed",
    borderColor: "rgba(99,14,212,0.4)",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(99,14,212,0.04)",
  },

  locationRow: {
    flexDirection: "row",
    gap: spacing.sm,
  },
  locationBtn: {
    flex: 1,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.xs,
    borderRadius: radii.base,
    alignItems: "center",
    justifyContent: "center",
    gap: spacing.xs,
    backgroundColor: colors.surfaceContainerLow,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.6)",
    ...elevation.card,
  },
  locationBtnLabel: {
    fontFamily: fonts.medium,
    fontSize: 12,
    color: colors.onSurfaceVariant,
  },

  noteWrap: {
    flexDirection: "row",
    backgroundColor: colors.surfaceContainerLow,
    borderRadius: radii.base,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.sm,
    minHeight: 72,
    borderWidth: 1,
    borderColor: "transparent",
  },
  noteIcon: {
    marginRight: spacing.sm,
    marginTop: 2,
  },
  noteInput: {
    flex: 1,
    fontFamily: fonts.regular,
    fontSize: 16,
    color: colors.onSurface,
    minHeight: 56,
    textAlignVertical: "top",
  },

  doneBtn: {
    height: 56,
    borderRadius: radii.pill,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: spacing.xs,
    ...elevation.raised,
  },
  doneBtnText: {
    fontFamily: fonts.bold,
    fontSize: 18,
    color: colors.onPrimary,
    letterSpacing: 0.2,
  },

  modalOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(21,28,39,0.45)",
  },
  modalContent: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: colors.surface,
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    padding: spacing.lg,
    maxHeight: "85%",
  },
  modalHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: spacing.lg,
  },
  modalTitle: {
    fontFamily: fonts.extrabold,
    fontSize: 22,
    color: colors.onSurface,
    letterSpacing: -0.4,
  },
  modalScroll: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 12,
    justifyContent: "center",
    paddingBottom: 40,
  },
  emotionSquare: {
    width: 92,
    height: 92,
    borderRadius: radii.base,
    justifyContent: "center",
    alignItems: "center",
    padding: 6,
    overflow: "hidden",
    ...elevation.card,
  },
  selectedSquare: {
    borderWidth: 2,
    borderColor: colors.primary,
  },
  unselectedSquare: {
    borderWidth: 2,
    borderColor: "transparent",
  },
  squareEmoji: { fontSize: 26, marginBottom: 4 },
  squareText: {
    fontFamily: fonts.semibold,
    fontSize: 12,
    textAlign: "center",
  },

  mapHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    padding: 16,
    backgroundColor: colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: colors.outlineVariant,
  },
  mapHeaderText: {
    fontFamily: fonts.extrabold,
    fontSize: 20,
    color: colors.onSurface,
  },
  mapHeaderClose: {
    position: "absolute",
    right: 16,
    padding: 4,
  },
  mapCenterPin: {
    position: "absolute",
    top: "50%",
    left: "50%",
    transform: [{ translateX: -22 }, { translateY: -44 }],
    justifyContent: "center",
    alignItems: "center",
  },
  mapOverlayControls: {
    position: "absolute",
    bottom: 40,
    left: 24,
    right: 24,
  },
  mapConfirmBtn: {
    backgroundColor: colors.primary,
    padding: 18,
    borderRadius: radii.pill,
    alignItems: "center",
    ...elevation.raised,
  },
  mapConfirmBtnText: {
    color: colors.onPrimary,
    fontFamily: fonts.bold,
    fontSize: 16,
  },
});
