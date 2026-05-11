import React from "react";
import { View, Text, Platform, StyleSheet, Pressable } from "react-native";
import { BlurView } from "expo-blur";
import { Ionicons } from "@expo/vector-icons";
import { withLayoutContext } from "expo-router";
import {
  createMaterialTopTabNavigator,
  MaterialTopTabNavigationOptions,
  MaterialTopTabNavigationEventMap,
} from "@react-navigation/material-top-tabs";
import {
  ParamListBase,
  TabNavigationState,
} from "@react-navigation/native";

const { Navigator } = createMaterialTopTabNavigator();

const MaterialTopTabs = withLayoutContext<
  MaterialTopTabNavigationOptions,
  typeof Navigator,
  TabNavigationState<ParamListBase>,
  MaterialTopTabNavigationEventMap
>(Navigator);

type IconName = React.ComponentProps<typeof Ionicons>["name"];

const TAB_ORDER = ["index", "calendar", "addPurchase", "insights", "profile"] as const;
const TAB_META: Record<string, { idle: IconName; active: IconName; label: string; size?: number }> = {
  index: { idle: "home-outline", active: "home-sharp", label: "Home" },
  calendar: { idle: "calendar-outline", active: "calendar", label: "Calendar" },
  addPurchase: { idle: "add-circle-outline", active: "add-circle", label: "Add", size: 24 },
  insights: { idle: "stats-chart-outline", active: "stats-chart", label: "Insights" },
  profile: { idle: "person-outline", active: "person", label: "Profile" },
};

function CustomTabBar({ state, navigation }: any) {
  return (
    <View style={styles.barWrap} pointerEvents="box-none">
      <View style={styles.pill}>
        <BlurView
          intensity={Platform.OS === "ios" ? 60 : 80}
          tint="light"
          style={StyleSheet.absoluteFill}
        />
        <View style={styles.glassTint} pointerEvents="none" />
        <View style={styles.glassHighlight} pointerEvents="none" />
        <View style={styles.glassBorder} pointerEvents="none" />

        <View style={styles.row}>
          {state.routes.map((route: any, index: number) => {
            const focused = state.index === index;
            const meta = TAB_META[route.name];
            if (!meta) return null;

            const onPress = () => {
              const event = navigation.emit({
                type: "tabPress",
                target: route.key,
                canPreventDefault: true,
              });
              if (!focused && !event.defaultPrevented) {
                navigation.navigate(route.name);
              }
            };

            return (
              <Pressable
                key={route.key}
                onPress={onPress}
                style={styles.item}
                android_ripple={null}
              >
                <View style={[styles.iconWrap, focused && styles.iconWrapActive]}>
                  <Ionicons
                    name={focused ? meta.active : meta.idle}
                    color={focused ? "#F9A8BB" : "rgba(31,27,22,0.55)"}
                    size={meta.size ?? 22}
                  />
                </View>
                <Text
                  style={[
                    styles.label,
                    { color: focused ? "#F9A8BB" : "rgba(31,27,22,0.55)" },
                  ]}
                >
                  {meta.label}
                </Text>
              </Pressable>
            );
          })}
        </View>
      </View>
    </View>
  );
}

export default function TabsLayout() {
  return (
    <MaterialTopTabs
      tabBarPosition="bottom"
      tabBar={(props) => <CustomTabBar {...props} />}
      screenOptions={{
        swipeEnabled: true,
        animationEnabled: true,
        lazy: false,
      }}
    >
      {TAB_ORDER.map((name) => (
        <MaterialTopTabs.Screen key={name} name={name} />
      ))}
    </MaterialTopTabs>
  );
}

const PILL_HEIGHT = 64;
const PILL_RADIUS = PILL_HEIGHT / 2;

const styles = StyleSheet.create({
  barWrap: {
    height: Platform.OS === "ios" ? 96 : 84,
    paddingHorizontal: 18,
    paddingTop: 8,
    paddingBottom: Platform.OS === "ios" ? 24 : 12,
    backgroundColor: "transparent",
    alignItems: "stretch",
    justifyContent: "flex-end",
  },
  pill: {
    height: PILL_HEIGHT,
    borderRadius: PILL_RADIUS,
    overflow: "hidden",
    backgroundColor:
      Platform.OS === "android"
        ? "rgba(255,255,255,0.55)"
        : "rgba(255,255,255,0.28)",
    shadowColor: "#1F1B16",
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.12,
    shadowRadius: 24,
    elevation: 18,
  },
  glassTint: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(255,255,255,0.18)",
  },
  glassHighlight: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    height: PILL_HEIGHT / 2,
    borderTopLeftRadius: PILL_RADIUS,
    borderTopRightRadius: PILL_RADIUS,
    backgroundColor: "rgba(255,255,255,0.22)",
  },
  glassBorder: {
    ...StyleSheet.absoluteFillObject,
    borderRadius: PILL_RADIUS,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: "rgba(255,255,255,0.55)",
  },
  row: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 6,
  },
  item: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 6,
  },
  iconWrap: {
    width: 44,
    height: 28,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 9999,
  },
  iconWrapActive: {
    backgroundColor: "rgba(249, 168, 187, 0.22)",
    paddingHorizontal: 12,
    width: "auto",
  },
  label: {
    fontSize: 10,
    fontFamily: "Manrope_600SemiBold",
    marginTop: 1,
  },
});
