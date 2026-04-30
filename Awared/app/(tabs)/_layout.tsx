import { Tabs } from "expo-router";
import { MaterialIcons } from "@expo/vector-icons";
import { View, StyleSheet, Platform } from "react-native";
import React from "react";
import { Text } from "@/components/Text";
import { colors, fonts, radii, elevation } from "@/constants/theme";

type IconProps = {
  focused: boolean;
  name: keyof typeof MaterialIcons.glyphMap;
  label: string;
  size?: number;
};

function TabIcon({ focused, name, label, size = 24 }: IconProps) {
  return (
    <View style={[styles.itemWrap, focused && styles.itemWrapActive]}>
      <MaterialIcons
        name={name}
        color={focused ? colors.indigoActiveText : colors.navInactive}
        size={size}
      />
      <Text style={[styles.label, focused && styles.labelActive]}>{label}</Text>
    </View>
  );
}

export default function TabsLayout() {
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarShowLabel: false,
        tabBarStyle: {
          position: "absolute",
          bottom: 0,
          left: 0,
          right: 0,
          height: Platform.OS === "ios" ? 96 : 78,
          backgroundColor: "#ffffff",
          borderTopWidth: 1,
          borderTopColor: "#eef2ff",
          borderTopLeftRadius: 24,
          borderTopRightRadius: 24,
          paddingBottom: Platform.OS === "ios" ? 28 : 12,
          paddingTop: 12,
          paddingHorizontal: 8,
          ...elevation.navTop,
        },
        tabBarItemStyle: {
          height: "100%",
          paddingHorizontal: 4,
        },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          tabBarIcon: ({ focused }) => <TabIcon focused={focused} name="home" label="Home" />,
        }}
      />
      <Tabs.Screen
        name="calendar"
        options={{
          tabBarIcon: ({ focused }) => (
            <TabIcon focused={focused} name="table-chart" label="Pulse" />
          ),
        }}
      />
      <Tabs.Screen
        name="addPurchase"
        options={{
          tabBarIcon: ({ focused }) => (
            <TabIcon focused={focused} name="add-circle" label="Add" size={28} />
          ),
        }}
      />
      <Tabs.Screen
        name="insights"
        options={{
          tabBarIcon: ({ focused }) => (
            <TabIcon focused={focused} name="insights" label="Insights" />
          ),
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          tabBarIcon: ({ focused }) => (
            <TabIcon focused={focused} name="person" label="Profile" />
          ),
        }}
      />
    </Tabs>
  );
}

const styles = StyleSheet.create({
  itemWrap: {
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: radii.base,
    minWidth: 64,
  },
  itemWrapActive: {
    backgroundColor: colors.indigoActiveBg,
  },
  label: {
    fontFamily: fonts.semibold,
    fontSize: 10,
    color: colors.navInactive,
    marginTop: 2,
    letterSpacing: 0.6,
    textTransform: "uppercase",
  },
  labelActive: {
    color: colors.indigoActiveText,
  },
});
