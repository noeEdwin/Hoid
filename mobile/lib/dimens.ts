import { Dimensions, PixelRatio, Platform } from "react-native";

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get("window");

const baseWidth = 400;

const scale = SCREEN_WIDTH / baseWidth;

export function normalize(size: number): number {
  const newSize = size * scale;
  if (Platform.OS === "ios") {
    return Math.round(PixelRatio.roundToNearestPixel(newSize));
  }
  return Math.round(PixelRatio.roundToNearestPixel(newSize)) - 2;
}

export const Dimens = {
  width: SCREEN_WIDTH,
  height: SCREEN_HEIGHT,
  isTablet: SCREEN_WIDTH > 550,
  padding: normalize(24),
  gutter: normalize(16),
  gap: normalize(12),
  unit: normalize(8),
  borderRadius: normalize(16),
  borderRadiusLarge: normalize(32),
};
