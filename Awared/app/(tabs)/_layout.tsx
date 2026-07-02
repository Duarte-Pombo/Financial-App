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

const APP_BG = "#F5F1EA";
const ACTIVE = "#7E64B3";
const INACTIVE = "rgba(31,27,22,0.40)";

const { Navigator } = createMaterialTopTabNavigator();

const MaterialTopTabs = withLayoutContext<
  MaterialTopTabNavigationOptions,
  typeof Navigator,
  TabNavigationState<ParamListBase>,
  MaterialTopTabNavigationEventMap
>(Navigator);

type IconName = React.ComponentProps<typeof Ionicons>["name"];

const TAB_ORDER = ["index", "calendar", "addPurchase", "insights", "profile"] as const;
const TAB_META: Record<string, { idle: IconName; active: IconName; label: string; size?: number; add?: boolean }> = {
  index: { idle: "home-outline", active: "home", label: "home" },
  calendar: { idle: "calendar-outline", active: "calendar", label: "calendar" },
  addPurchase: { idle: "add", active: "add", label: "log", size: 22, add: true },
  insights: { idle: "bar-chart-outline", active: "bar-chart", label: "insights" },
  profile: { idle: "person-outline", active: "person", label: "profile" },
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
                {meta.add ? (
                  // ── Centre "log" button — filled circle ──
                  <View style={[styles.iconWrap, styles.addBtn]}>
                    <Ionicons name="add" color="#fff" size={24} />
                  </View>
                ) : (
                  <View style={[styles.iconWrap, focused && styles.iconWrapActive]}>
                    <Ionicons
                      name={focused ? meta.active : meta.idle}
                      color={focused ? ACTIVE : INACTIVE}
                      size={meta.size ?? 21}
                    />
                  </View>
                )}
                <Text style={[styles.label, { color: meta.add ? ACTIVE : focused ? ACTIVE : INACTIVE }]}>
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
      style={{ backgroundColor: APP_BG }}
      sceneContainerStyle={{ backgroundColor: APP_BG }}
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
    width: 40,
    height: 40,
    alignSelf: "center",
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 20,
    overflow: "hidden",
  },
  iconWrapActive: {
    backgroundColor: "rgba(126,100,179,0.13)",
  },
  addBtn: {
    backgroundColor: ACTIVE,
    width: 44,
    height: 44,
    borderRadius: 22,
    shadowColor: ACTIVE,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.35,
    shadowRadius: 8,
    elevation: 6,
  },
  label: {
    fontSize: 10,
    fontFamily: "Manrope_600SemiBold",
    marginTop: 1,
  },
});
