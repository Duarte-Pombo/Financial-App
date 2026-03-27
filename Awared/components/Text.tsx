import React from "react";
import { Text as RNText, TextProps, StyleSheet } from "react-native";

export function Text({ style, ...props }: TextProps) {
  return <RNText style={[styles.base, style]} {...props} />;
}

const styles = StyleSheet.create({
  base: {
    fontFamily: "RobotoSerif_400Regular",
  },
});
