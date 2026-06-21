import { View, Text, Image } from "react-native";
import { normalize, Dimens } from "../lib/dimens";

interface UserHeaderProps {
  username?: string;
  totalCards?: number;
  streak?: number;
}

export default function UserHeader({
  username = "Edwin",
  totalCards = 0,
  streak = 0,
}: UserHeaderProps) {
  return (
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
      <View className="bg-surfaceContainerHigh px-3.5 py-2 rounded-full">
        <Text className="text-xs font-medium text-neutral-900" allowFontScaling={false}>
          🔥 {streak} Day Streak
        </Text>
      </View>
    </View>
  );
}
