import { test, expect, afterEach } from "vitest";
import { render, screen, cleanup } from "@testing-library/react";
import { ToolInvocationBadge } from "../ToolInvocationBadge";
import type { ToolInvocation } from "ai";

afterEach(() => {
  cleanup();
});

test("shows a friendly label for str_replace_editor instead of the raw tool name", () => {
  const toolInvocation: ToolInvocation = {
    toolCallId: "call_1",
    toolName: "str_replace_editor",
    args: {},
    state: "call",
  };

  render(<ToolInvocationBadge toolInvocation={toolInvocation} />);

  expect(screen.getByText("Editing code")).toBeDefined();
  expect(screen.queryByText("str_replace_editor")).toBeNull();
});

test("shows a friendly label for file_manager instead of the raw tool name", () => {
  const toolInvocation: ToolInvocation = {
    toolCallId: "call_2",
    toolName: "file_manager",
    args: {},
    state: "call",
  };

  render(<ToolInvocationBadge toolInvocation={toolInvocation} />);

  expect(screen.getByText("Managing files")).toBeDefined();
  expect(screen.queryByText("file_manager")).toBeNull();
});

test("falls back to the raw tool name for unknown tools", () => {
  const toolInvocation: ToolInvocation = {
    toolCallId: "call_3",
    toolName: "some_future_tool",
    args: {},
    state: "call",
  };

  render(<ToolInvocationBadge toolInvocation={toolInvocation} />);

  expect(screen.getByText("some_future_tool")).toBeDefined();
});

test("shows a spinner while the tool call is in progress", () => {
  const toolInvocation: ToolInvocation = {
    toolCallId: "call_4",
    toolName: "str_replace_editor",
    args: {},
    state: "call",
  };

  const { container } = render(
    <ToolInvocationBadge toolInvocation={toolInvocation} />
  );

  expect(container.querySelector(".animate-spin")).not.toBeNull();
  expect(container.querySelector(".bg-emerald-500")).toBeNull();
});

test("shows a success indicator once the tool call has a result", () => {
  const toolInvocation: ToolInvocation = {
    toolCallId: "call_5",
    toolName: "str_replace_editor",
    args: {},
    state: "result",
    result: "File created: /App.jsx",
  };

  const { container } = render(
    <ToolInvocationBadge toolInvocation={toolInvocation} />
  );

  expect(container.querySelector(".bg-emerald-500")).not.toBeNull();
  expect(container.querySelector(".animate-spin")).toBeNull();
});

test("shows a spinner when the tool result is empty even though state is result", () => {
  const toolInvocation: ToolInvocation = {
    toolCallId: "call_6",
    toolName: "str_replace_editor",
    args: {},
    state: "result",
    result: "",
  };

  const { container } = render(
    <ToolInvocationBadge toolInvocation={toolInvocation} />
  );

  expect(container.querySelector(".animate-spin")).not.toBeNull();
});
