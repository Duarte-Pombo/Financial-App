import React from "react";
import { Text as RNText, TextProps, StyleSheet } from "react-native";
import { colors, fonts } from "@/constants/theme";

export function Text({ style, ...props }: TextProps) {
  return <RNText style={[styles.base, style]} {...props} />;
}

const styles = StyleSheet.create({
  base: {
    fontFamily: fonts.regular,
    color: colors.onSurface,
  },
});
