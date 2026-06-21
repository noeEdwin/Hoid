import { View, Text } from "react-native";
import { normalize, Dimens } from "../lib/dimens";
import type { FailingToken } from "../stores/useVocabularyStore";

interface FailingTokenRowProps {
  token: FailingToken;
}

function getStatusLabel(score: number): string {
  if (score >= 0.8) return "Critical Level";
  if (score >= 0.5) return "Needs Practice";
  return "Review Soon";
}

export default function FailingTokenRow({ token }: FailingTokenRowProps) {
  const barWidth = Math.min(token.difficultyScore * 100, 100);

  return (
    <View
      style={{
        flexDirection: "row",
        alignItems: "center",
        padding: Dimens.padding,
        paddingLeft: Dimens.padding,
        gap: Dimens.gutter,
        borderLeftWidth: 4,
        borderLeftColor: "rgba(186, 26, 26, 0.4)",
      }}
    >
      <View
        style={{
          backgroundColor: "#e7eeff",
          paddingHorizontal: normalize(12),
          paddingVertical: normalize(8),
          borderRadius: normalize(8),
          maxWidth: normalize(100),
        }}
      >
        <Text
          style={{ fontSize: normalize(14) }}
          className="text-neutral-900"
          numberOfLines={2}
        >
          {token.answer}
        </Text>
      </View>

      <View style={{ flex: 1, gap: 4 }}>
        <View className="flex-row justify-between items-center">
          <Text
            style={{ fontSize: normalize(13) }}
            className="text-neutral-600"
            numberOfLines={1}
          >
            {token.sentence}
          </Text>
          <Text
            style={{ fontSize: normalize(12) }}
            className="text-error font-bold"
          >
            {Math.round(token.difficultyScore * 100)}% Fail
          </Text>
        </View>

        <View
          style={{
            height: normalize(8),
            backgroundColor: "#e7eeff",
            borderRadius: normalize(4),
            overflow: "hidden",
            marginVertical: 4,
          }}
        >
          <View
            style={{
              height: "100%",
              width: `${barWidth}%`,
              backgroundColor: "#ba1a1a",
              borderRadius: normalize(4),
            }}
          />
        </View>

        <Text style={{ fontSize: normalize(12) }} className="text-neutral-600">
          {getStatusLabel(token.difficultyScore)}
        </Text>
      </View>
    </View>
  );
}
