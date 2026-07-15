let mockFocusEffect: (() => void) | undefined;

jest.mock("expo-router", () => ({
  useFocusEffect: (effect: () => void) => {
    mockFocusEffect = effect;
  },
}));

import { renderHook, act } from "@testing-library/react-native";
import { useNavigateOnce } from "../useNavigateOnce";

describe("useNavigateOnce", () => {
  beforeEach(() => {
    mockFocusEffect = undefined;
  });

  it("ignores repeated navigation until the screen regains focus", () => {
    const { result } = renderHook(() => useNavigateOnce());
    const navigate = jest.fn();

    act(() => {
      result.current(navigate);
      result.current(navigate);
    });

    expect(navigate).toHaveBeenCalledTimes(1);

    act(() => {
      mockFocusEffect?.();
      result.current(navigate);
    });

    expect(navigate).toHaveBeenCalledTimes(2);
  });
});
