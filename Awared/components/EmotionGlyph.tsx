import React from "react";
import Svg, { Path } from "react-native-svg";

export const EMOTION_COLORS: Record<string, string> = {
  sadness: "#6E8DB5",
  stress: "#C24A3A",
  happy: "#D4A24C",
  anxiety: "#B97A5C",
  boredom: "#8A8A82",
  excited: "#D88AA8",
  calm: "#5F7A4F",
  anger: "#9B3A2F",
};

export const EMOTION_NAMES = Object.keys(EMOTION_COLORS);

export function emotionColor(
  name: string | null | undefined,
  fallback = "#7A7268",
): string {
  const key = name?.toLowerCase();
  return (key && EMOTION_COLORS[key]) || fallback;
}

export function hasEmotionGlyph(name: string | null | undefined): boolean {
  const key = name?.toLowerCase();
  return !!(key && key in EMOTION_COLORS);
}

type Props = {
  emotion: string;
  color: string;
  size?: number;
};

export function EmotionGlyph({ emotion, color, size = 22 }: Props) {
  const stroke = {
    stroke: color,
    strokeWidth: 2,
    fill: "none",
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
  };

  switch (emotion.toLowerCase()) {
    case "sadness":
      return (
        <Svg width={size} height={size} viewBox="0 0 24 24">
          <Path d="M5 11 Q12 18 19 11" {...stroke} />
        </Svg>
      );
    case "stress":
      return (
        <Svg width={size} height={size} viewBox="0 0 24 24">
          <Path d="M10 4 Q15 7 9 10 Q3 13 12 16 Q18 18 11 21" {...stroke} />
        </Svg>
      );
    case "happy":
      return (
        <Svg width={size} height={size} viewBox="0 0 24 24">
          <Path
            d="M12 3 L13.6 10.4 L21 12 L13.6 13.6 L12 21 L10.4 13.6 L3 12 L10.4 10.4 Z"
            fill={color}
          />
        </Svg>
      );
    case "anxiety":
      return (
        <Svg width={size} height={size} viewBox="0 0 24 24">
          <Path d="M3 9 Q7 5 12 9 T21 9" {...stroke} />
          <Path d="M3 15 Q7 11 12 15 T21 15" {...stroke} />
        </Svg>
      );
    case "boredom":
      return (
        <Svg width={size} height={size} viewBox="0 0 24 24">
          <Path d="M4 12 L20 12" {...stroke} />
        </Svg>
      );
    case "excited":
      return (
        <Svg width={size} height={size} viewBox="0 0 24 24">
          <Path d="M8 19 L14 5 M12 19 L18 5 M4 19 L10 5" {...stroke} />
        </Svg>
      );
    case "calm":
      return (
        <Svg width={size} height={size} viewBox="0 0 24 24">
          <Path d="M3 13 Q8 7 12 13 T21 11" {...stroke} />
        </Svg>
      );
    case "anger":
      return (
        <Svg width={size} height={size} viewBox="0 0 24 24">
          <Path d="M5 17 L12 6 L19 17" {...stroke} />
        </Svg>
      );
    default:
      return null;
  }
}
