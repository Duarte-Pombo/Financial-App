import React, { useState } from "react";
import {
  Text,
  View,
  StyleSheet,
  Pressable,
  TextInput,
  TextInputProps,
} from "react-native";
import Svg, { Path } from "react-native-svg";

export const AUTH_C = {
  bg: "#FAF6EF",
  ink: "#1F1B16",
  inkSoft: "#7A7268",
  inkMute: "rgba(31,27,22,0.45)",
  rule: "rgba(0,0,0,0.08)",
  fieldRule: "rgba(31,27,22,0.18)",
  purple: "#9B82C9",
  blackBtn: "#1F1B16",
  blackBtnDim: "#3A352F",
  ivory: "#FAF6EF",
};

type FieldProps = {
  label: string;
  value: string;
  onChangeText: (v: string) => void;
  placeholder?: string;
  secureTextEntry?: boolean;
  showToggle?: boolean;
  showSecure?: boolean;
  onToggleShow?: () => void;
} & Omit<TextInputProps, "style">;

export function Field({
  label,
  value,
  onChangeText,
  placeholder,
  secureTextEntry,
  showToggle,
  showSecure,
  onToggleShow,
  ...inputProps
}: FieldProps) {
  const [focus, setFocus] = useState(false);

  return (
    <View style={styles.field}>
      <Text style={styles.fieldLabel}>{label}</Text>

      <View
        style={[
          styles.fieldRow,
          { borderBottomColor: focus ? AUTH_C.purple : AUTH_C.fieldRule },
        ]}
      >
        <TextInput
          {...inputProps}
          value={value}
          onChangeText={onChangeText}
          placeholder={placeholder}
          placeholderTextColor={AUTH_C.inkMute}
          secureTextEntry={secureTextEntry && !showSecure}
          onFocus={() => setFocus(true)}
          onBlur={() => setFocus(false)}
          style={styles.input}
        />

        {showToggle && (
          <Pressable onPress={onToggleShow} hitSlop={8}>
            <Text style={styles.eyeText}>{showSecure ? "Hide" : "Show"}</Text>
          </Pressable>
        )}
      </View>
    </View>
  );
}

type PrimaryButtonProps = {
  label: string;
  onPress: () => void;
  disabled?: boolean;
  busy?: boolean;
};

export function PrimaryButton({
  label,
  onPress,
  disabled,
  busy,
}: PrimaryButtonProps) {
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled || busy}
      style={({ pressed }) => [
        styles.primaryBtn,
        {
          backgroundColor: disabled ? AUTH_C.blackBtnDim : AUTH_C.blackBtn,
          opacity: disabled ? 0.4 : pressed ? 0.85 : 1,
        },
      ]}
    >
      <Text style={styles.primaryBtnText}>{busy ? "..." : label}</Text>
    </Pressable>
  );
}

export function OrDivider() {
  return (
    <View style={styles.divider}>
      <View style={styles.dividerLine} />
      <Text style={styles.dividerText}>or</Text>
      <View style={styles.dividerLine} />
    </View>
  );
}

function AppleGlyph() {
  return (
    <Svg width={14} height={16} viewBox="0 0 24 24">
      <Path
        d="M16.5 1.5c.1 1.1-.3 2.2-1 3-.7.8-1.8 1.4-2.9 1.3-.1-1.1.4-2.2 1.1-3 .7-.8 1.8-1.3 2.8-1.3zM20.3 17.6c-.6 1.3-1.3 2.6-2.4 3.7-.9.9-2 1.7-3.3 1.7-1.3 0-1.6-.8-3.1-.8-1.5 0-1.9.8-3.1.8-1.3 0-2.4-.9-3.2-1.8C2.4 17.5 1 12.6 3.6 9.5c1.3-1.6 3.2-2.5 4.9-2.5 1.3 0 2.6.9 3.4.9.8 0 2.3-1 4-.9.7 0 2.7.3 4 2.2-.1.1-2.4 1.4-2.4 4.2 0 3.3 2.9 4.4 2.9 4.4l-.1-.2z"
        fill={AUTH_C.ink}
      />
    </Svg>
  );
}

function GoogleGlyph() {
  return (
    <Svg width={14} height={14} viewBox="0 0 24 24">
      <Path
        d="M21.6 12.2c0-.7-.1-1.4-.2-2H12v3.8h5.4c-.2 1.3-.9 2.4-2 3.1v2.6h3.2c1.9-1.7 3-4.3 3-7.5z"
        fill="#4285F4"
      />
      <Path
        d="M12 22c2.7 0 5-.9 6.6-2.4l-3.2-2.5c-.9.6-2 1-3.4 1-2.6 0-4.8-1.8-5.6-4.1H3.1v2.6C4.7 19.8 8.1 22 12 22z"
        fill="#34A853"
      />
      <Path
        d="M6.4 14c-.2-.6-.3-1.3-.3-2s.1-1.4.3-2V7.4H3.1C2.4 8.8 2 10.4 2 12s.4 3.2 1.1 4.6L6.4 14z"
        fill="#FBBC05"
      />
      <Path
        d="M12 5.9c1.5 0 2.8.5 3.8 1.5l2.8-2.8C16.9 3 14.7 2 12 2 8.1 2 4.7 4.2 3.1 7.4L6.4 10c.8-2.3 3-4.1 5.6-4.1z"
        fill="#EA4335"
      />
    </Svg>
  );
}

export function AltSignInRow() {
  return (
    <View style={styles.altRow}>
      <Pressable style={styles.altBtn}>
        <AppleGlyph />
        <Text style={styles.altText}>Apple</Text>
      </Pressable>
      <Pressable style={styles.altBtn}>
        <GoogleGlyph />
        <Text style={styles.altText}>Google</Text>
      </Pressable>
    </View>
  );
}

type SwitchModeProps = {
  prompt: string;
  ctaLabel: string;
  onPress: () => void;
};

export function SwitchMode({ prompt, ctaLabel, onPress }: SwitchModeProps) {
  return (
    <View style={styles.switchWrap}>
      <Text style={styles.switchPrompt}>
        {prompt}{" "}
        <Text style={styles.switchCta} onPress={onPress}>
          {ctaLabel}
        </Text>
      </Text>
    </View>
  );
}

type HeadlineProps = {
  kicker: string;
  line1: string;
  line2: string;
};

export function Headline({ kicker, line1, line2 }: HeadlineProps) {
  return (
    <View style={styles.headline}>
      <Text style={styles.kicker}>{kicker}</Text>
      <Text style={styles.title}>{line1}</Text>
      <Text style={styles.titlePurple}>{line2}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  field: {
    paddingTop: 10,
    paddingBottom: 2,
  },
  fieldLabel: {
    fontFamily: "Manrope_500Medium",
    fontSize: 13,
    color: AUTH_C.inkSoft,
    marginBottom: 4,
  },
  fieldRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    borderBottomWidth: 1.5,
    paddingTop: 4,
    paddingBottom: 8,
  },
  input: {
    flex: 1,
    minWidth: 0,
    fontFamily: "Manrope_400Regular",
    fontSize: 16,
    color: AUTH_C.ink,
    padding: 0,
  },
  eyeText: {
    fontFamily: "PlayfairDisplay_400Regular_Italic",
    fontSize: 13,
    color: AUTH_C.inkSoft,
  },

  primaryBtn: {
    width: "100%",
    paddingVertical: 16,
    borderRadius: 4,
    alignItems: "center",
    justifyContent: "center",
    marginTop: 18,
  },
  primaryBtnText: {
    fontFamily: "Manrope_600SemiBold",
    fontSize: 14,
    letterSpacing: 2.5,
    color: "#FAF6EF",
  },

  divider: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    marginTop: 12,
    marginBottom: 8,
  },
  dividerLine: {
    flex: 1,
    height: 1,
    backgroundColor: AUTH_C.rule,
  },
  dividerText: {
    fontFamily: "PlayfairDisplay_400Regular_Italic",
    fontSize: 12,
    color: AUTH_C.inkMute,
  },

  altRow: {
    flexDirection: "row",
    gap: 8,
  },
  altBtn: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: AUTH_C.rule,
    backgroundColor: "transparent",
    alignItems: "center",
    justifyContent: "center",
    flexDirection: "row",
    gap: 6,
  },
  altText: {
    fontFamily: "Manrope_500Medium",
    fontSize: 12.5,
    color: AUTH_C.ink,
    letterSpacing: 0.2,
  },

  switchWrap: {
    paddingTop: 12,
    paddingBottom: 4,
    alignItems: "center",
  },
  switchPrompt: {
    fontFamily: "PlayfairDisplay_400Regular_Italic",
    fontSize: 14,
    color: AUTH_C.inkSoft,
    lineHeight: 20,
    textAlign: "center",
  },
  switchCta: {
    fontFamily: "PlayfairDisplay_700Bold_Italic",
    fontSize: 14,
    color: AUTH_C.purple,
    textDecorationLine: "underline",
    textDecorationColor: AUTH_C.purple,
  },

  headline: {
    paddingBottom: 4,
  },
  kicker: {
    fontFamily: "Manrope_500Medium",
    fontSize: 10.5,
    letterSpacing: 2,
    color: AUTH_C.inkMute,
    marginBottom: 8,
  },
  title: {
    fontFamily: "PlayfairDisplay_700Bold_Italic",
    fontSize: 34,
    color: AUTH_C.ink,
    lineHeight: 38,
    letterSpacing: -0.8,
    marginBottom: 2,
  },
  titlePurple: {
    fontFamily: "PlayfairDisplay_700Bold_Italic",
    fontSize: 38,
    color: AUTH_C.purple,
    lineHeight: 42,
    letterSpacing: -0.8,
  },
});
