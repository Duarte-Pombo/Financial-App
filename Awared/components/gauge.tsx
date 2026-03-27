import { Image } from 'expo-image';
import React from 'react';
import { StyleSheet, Text, View } from 'react-native';

type Props =
  {
    value: number
  };

export default function Gauge({ value }: Props) {
  const maxWidth = 300
  const valueWidth = maxWidth * value
  const height = 20
  const border = 20
  return (
    <View style={{ position: "relative", width: maxWidth, height: height, borderRadius: border }}>
      <View style={{ borderRadius: border, width: maxWidth, backgroundColor: "#C4FFD8", height: height, position: "absolute", alignSelf: "center" }}></View>
      <View style={{ borderRadius: border, width: valueWidth, backgroundColor: "#81dd9e", height: height }}></View>
    </View>
  );
}

const styles = StyleSheet.create({
  bar: {
    width: 600,
    height: 10,
    borderRadius: 18,
    backgroundColor: "#56786f",
  },
});

