import { useCallback, useRef } from "react";
import { useFocusEffect } from "expo-router";

export function useNavigateOnce() {
  const isNavigating = useRef(false);

  useFocusEffect(
    useCallback(() => {
      isNavigating.current = false;
    }, [])
  );

  return useCallback((navigate: () => void) => {
    if (isNavigating.current) return;
    isNavigating.current = true;
    navigate();
  }, []);
}
