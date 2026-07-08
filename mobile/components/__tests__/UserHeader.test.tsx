import React from "react";
import { render } from "@testing-library/react-native";
import UserHeader from "../UserHeader";

jest.mock("expo-router", () => ({
  useRouter: () => ({
    push: jest.fn(),
  }),
}));

jest.mock("../../lib/dimens", () => ({
  normalize: (value: number) => value,
}));

describe("UserHeader", () => {
  it("renders syncing state message", () => {
    const { getAllByText } = render(
      <UserHeader
        totalCards={1200}
        streak={4}
        isSyncing
        syncStatus="syncing"
        syncMessage="正在同步..."
      />
    );

    expect(getAllByText("正在同步...").length).toBeGreaterThan(0);
  });

  it("renders success state message", () => {
    const { getByText } = render(
      <UserHeader
        totalCards={1200}
        streak={4}
        syncStatus="success"
        syncMessage="同步完成"
      />
    );

    expect(getByText("同步完成")).toBeTruthy();
  });
});
