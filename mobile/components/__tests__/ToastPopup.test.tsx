import React from "react";
import { render } from "@testing-library/react-native";
import ToastPopup from "../ToastPopup";

describe("ToastPopup", () => {
  it("renders success message when visible", () => {
    const { getByText, getByTestId } = render(
      <ToastPopup visible status="success" message="同步完成" />
    );

    expect(getByTestId("sync-toast")).toBeTruthy();
    expect(getByText("同步完成")).toBeTruthy();
  });

  it("does not render when message is empty", () => {
    const { queryByTestId } = render(
      <ToastPopup visible status="failure" message="" />
    );

    expect(queryByTestId("sync-toast")).toBeNull();
  });
});
