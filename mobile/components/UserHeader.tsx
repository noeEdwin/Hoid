import { useEffect, useRef } from "react";
import { View, Text, Pressable, Animated, Easing } from "react-native";
import { useRouter } from "expo-router";
import { normalize } from "../lib/dimens";

type SyncBannerStatus = "idle" | "syncing" | "success" | "partial" | "failure";

interface UserHeaderProps {
  username?: string;
  totalCards?: number;
  streak?: number;
  isSyncing?: boolean;
  onSync?: () => void;
  syncStatus?: SyncBannerStatus;
  syncMessage?: string;
}

function SyncStatusBar({
  status,
  message,
}: {
  status: SyncBannerStatus;
  message: string;
}) {
  const progress = useRef(new Animated.Value(-0.55)).current;

  useEffect(() => {
    if (status !== "syncing") {
      progress.stopAnimation();
      progress.setValue(-0.55);
      return;
    }

    const loop = Animated.loop(
      Animated.timing(progress, {
        toValue: 1,
        duration: 1100,
        easing: Easing.inOut(Easing.ease),
        useNativeDriver: true,
      })
    );
    loop.start();

    return () => {
      loop.stop();
      progress.stopAnimation();
    };
  }, [progress, status]);

  const animatedStyle = {
    transform: [
      {
        translateX: progress.interpolate({
          inputRange: [-0.55, 1],
          outputRange: [-140, 260],
        }),
      },
    ],
  };

  const colors: Record<
    Exclude<SyncBannerStatus, "idle">,
    { bar: string; track: string; text: string }
  > = {
    syncing: { bar: "#0ea5e9", track: "#dbeafe", text: "#0f172a" },
    success: { bar: "#22c55e", track: "#dcfce7", text: "#166534" },
    partial: { bar: "#f59e0b", track: "#fef3c7", text: "#92400e" },
    failure: { bar: "#ef4444", track: "#fee2e2", text: "#991b1b" },
  };

  if (status === "idle") {
    return <View style={{ height: 28 }} />;
  }

  const palette = colors[status];

  return (
    <View style={{ height: 28, justifyContent: "center" }}>
      <View className="px-6">
        <Text
          style={{ color: palette.text, fontSize: normalize(11), marginBottom: 6 }}
          allowFontScaling={false}
          numberOfLines={1}
        >
          {message}
        </Text>
        <View
          style={{
            height: 4,
            width: "100%",
            borderRadius: 999,
            backgroundColor: palette.track,
            overflow: "hidden",
          }}
        >
          {status === "syncing" ? (
            <Animated.View
              style={[
                {
                  width: "45%",
                  height: "100%",
                  borderRadius: 999,
                  backgroundColor: palette.bar,
                },
                animatedStyle,
              ]}
            />
          ) : (
            <View
              style={{
                width: "100%",
                height: "100%",
                borderRadius: 999,
                backgroundColor: palette.bar,
              }}
            />
          )}
        </View>
      </View>
    </View>
  );
}

export default function UserHeader({
  username = "Edwin",
  totalCards = 0,
  streak = 0,
  isSyncing = false,
  onSync,
  syncStatus = "idle",
  syncMessage = "",
}: UserHeaderProps) {
  const router = useRouter();

  return (
    <View>
      <View className="flex-row items-center justify-between px-6 pt-14 pb-4">
        <View className="flex-row items-center gap-3">
          <View className="relative">
            <View className="w-12 h-12 rounded-full bg-primary items-center justify-center">
              <Text className="text-white text-lg font-bold">
                {username[0]}
              </Text>
            </View>
            <View className="absolute -bottom-1 -right-1 bg-secondary px-1.5 py-0.5 rounded-full">
              <Text className="text-white text-[10px] font-bold" allowFontScaling={false}>
                B2+
              </Text>
            </View>
          </View>
          <View>
            <Text className="text-2xl font-bold text-primary">{username}</Text>
            <Text className="text-xs text-neutral-600 tracking-wider" allowFontScaling={false}>
              HZ: {(totalCards / 1000).toFixed(1)}k{" │ "}STRK: {streak}
            </Text>
          </View>
        </View>
        <View className="flex-row items-center gap-2">
          <Pressable
            onPress={onSync}
            disabled={!onSync || isSyncing}
            className="bg-surfaceContainerHigh w-9 h-9 rounded-full items-center justify-center"
          >
            <Text style={{ fontSize: normalize(16), opacity: isSyncing ? 0.5 : 1 }}>
              ↻
            </Text>
          </Pressable>
          <View className="bg-surfaceContainerHigh px-3.5 py-2 rounded-full">
            <Text className="text-xs font-medium text-neutral-900" allowFontScaling={false}>
              {isSyncing ? "正在同步..." : `🔥 ${streak} Day Streak`}
            </Text>
          </View>
          <Pressable
            onPress={() => router.push("/(tabs)/settings")}
            className="bg-surfaceContainerHigh w-9 h-9 rounded-full items-center justify-center"
          >
            <Text style={{ fontSize: normalize(16) }}>⚙️</Text>
          </Pressable>
        </View>
      </View>
      <SyncStatusBar status={syncStatus} message={syncMessage} />
    </View>
  );
}
