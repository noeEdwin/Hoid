import { View } from "react-native";
import { LinearGradient } from "expo-linear-gradient";

interface ProgressBarProps {
  current: number;
  total: number;
}

export default function ProgressBar({ current, total }: ProgressBarProps) {
  const progress = total > 0 ? current / total : 0;

  return (
    <View className="mx-6 mt-14 mb-4">
      <View className="h-2 bg-neutral-200 rounded-full overflow-hidden">
        <LinearGradient
          colors={["#005bbd", "#7622e5", "#895100"]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 0 }}
          style={{ width: `${progress * 100}%`, height: "100%" }}
          className="rounded-full"
        />
      </View>
    </View>
  );
}
