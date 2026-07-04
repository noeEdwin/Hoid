import { interpolate, Extrapolation } from "react-native-reanimated";
import type { ViewStyle } from "react-native";

interface ParallaxConfig {
  size: number;
  parallaxScrollingOffset?: number;
  parallaxScrollingScale?: number;
  parallaxAdjacentItemScale?: number;
}

export function parallaxLayout(baseConfig: ParallaxConfig) {
  const {
    size,
    parallaxScrollingOffset = -50,
    parallaxScrollingScale = 0.9,
    parallaxAdjacentItemScale = 0.5,
  } = baseConfig;

  return (value: number): ViewStyle => {
    "worklet";

    const translateY = interpolate(
      value,
      [-1, 0, 1],
      [-size + parallaxScrollingOffset, 0, size - parallaxScrollingOffset]
    );

    const translateX = interpolate(
      value,
      [-1, 0, 1, 2],
      [-size * 0.05, 0, 0, -size * 0.05]
    );

    const zIndex = interpolate(
      value,
      [-1, 0, 1, 2],
      [0, size, size, 0],
      Extrapolation.CLAMP
    );

    const scale = interpolate(
      value,
      [-1, 0, 1, 2],
      [parallaxAdjacentItemScale, parallaxScrollingScale, parallaxScrollingScale, parallaxAdjacentItemScale],
      Extrapolation.CLAMP
    );

    const rotateX = interpolate(
      value,
      [-1, 0, 1, 2],
      [20, 0, 0, 20],
      Extrapolation.CLAMP
    );

    return {
      transform: [
        { translateY },
        { translateX },
        { perspective: 200 },
        { rotateX: `${rotateX}deg` },
        { scale },
      ],
      zIndex,
    } as ViewStyle;
  };
}
