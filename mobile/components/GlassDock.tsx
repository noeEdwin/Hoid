import { View, Text, Pressable } from "react-native";
import { useRouter, usePathname } from "expo-router";
import { BlurView } from "expo-blur";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { normalize, Dimens } from "../lib/dimens";
import { useNavigateOnce } from "../lib/useNavigateOnce";

const TABS = [
  { path: "/(tabs)", label: "学习", icon: "📖" },
  { path: "/(tabs)/practice", label: "练习", icon: "🎙️" },
  { path: "/(tabs)/progress", label: "进步", icon: "📊" },
] as const;

export default function GlassDock() {
  const router = useRouter();
  const pathname = usePathname();
  const insets = useSafeAreaInsets();
  const navigateOnce = useNavigateOnce();

  const isActive = (path: string) => {
    if (path === "/(tabs)") return pathname === "/" || pathname === "/(tabs)";
    return pathname.startsWith(path);
  };

  return (
    <View
      style={{
        position: "absolute",
        bottom: insets.bottom + 8,
        left: Dimens.padding,
        right: Dimens.padding,
      }}
    >
      <BlurView intensity={60} tint="light" style={{ borderRadius: Dimens.borderRadiusLarge, overflow: "hidden" }}>
        <View
          style={{
            flexDirection: "row",
            justifyContent: "space-around",
            alignItems: "center",
            paddingVertical: 12,
            paddingHorizontal: 8,
            backgroundColor: "rgba(255, 255, 255, 0.5)",
            borderRadius: Dimens.borderRadiusLarge,
            borderWidth: 1,
            borderColor: "rgba(255, 255, 255, 0.3)",
          }}
        >
          {TABS.map((tab) => {
            const active = isActive(tab.path);
            return (
              <Pressable
                key={tab.path}
                onPress={() => navigateOnce(() => router.push(tab.path))}
                style={{ alignItems: "center", flex: 1 }}
              >
                <Text style={{ fontSize: 24 }}>{tab.icon}</Text>
                <Text
                  style={{
                    fontSize: normalize(11),
                    marginTop: 2,
                    fontWeight: active ? "700" : "500",
                    color: active ? "#005bbd" : "#757575",
                  }}
                  allowFontScaling={false}
                >
                  {tab.label}
                </Text>
              </Pressable>
            );
          })}
        </View>
      </BlurView>
    </View>
  );
}
