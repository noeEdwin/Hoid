import { View, Text, Pressable } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { normalize, Dimens } from "../lib/dimens";

interface ReviewStackCardProps {
  count: number;
  onPress: () => void;
}

export default function ReviewStackCard({ count, onPress }: ReviewStackCardProps) {
  return (
    <Pressable onPress={onPress} className="mx-6 mb-6">
      <LinearGradient
        colors={["#005bbd", "#7622e5"]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={{
          padding: Dimens.padding * 1.5,
          borderRadius: Dimens.borderRadius,
          alignItems: "center",
        }}
      >
        <Text
          style={{ fontSize: normalize(24) }}
          className="text-white font-semibold mb-1"
        >
          {count} Cards Pending Review
        </Text>
        <Text
          style={{ fontSize: normalize(14) }}
          className="text-white/80 text-center mb-6"
        >
          Your daily focus stack is ready for refinement.
        </Text>
        <View className="bg-white rounded-full px-6 py-3">
          <Text className="text-primary font-bold text-sm">
            Tap to Clear Stack
          </Text>
        </View>
      </LinearGradient>
    </Pressable>
  );
}
