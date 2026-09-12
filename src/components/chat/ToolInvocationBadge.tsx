"use client";

import { Loader2 } from "lucide-react";
import type { ToolInvocation } from "ai";

const TOOL_LABELS: Record<string, string> = {
  str_replace_editor: "Editing code",
  file_manager: "Managing files",
};

function getToolLabel(toolName: string): string {
  return TOOL_LABELS[toolName] ?? toolName;
}

interface ToolInvocationBadgeProps {
  toolInvocation: ToolInvocation;
}

export function ToolInvocationBadge({
  toolInvocation,
}: ToolInvocationBadgeProps) {
  const label = getToolLabel(toolInvocation.toolName);
  const isComplete =
    toolInvocation.state === "result" && !!toolInvocation.result;

  return (
    <div className="inline-flex items-center gap-2 mt-2 px-3 py-1.5 bg-neutral-50 rounded-lg text-xs font-mono border border-neutral-200">
      {isComplete ? (
        <div className="w-2 h-2 rounded-full bg-emerald-500" />
      ) : (
        <Loader2 className="w-3 h-3 animate-spin text-blue-600" />
      )}
      <span className="text-neutral-700">{label}</span>
    </div>
  );
}
