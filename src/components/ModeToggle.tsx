import { Search, MessageSquare } from "lucide-react";
import { cn } from "@/lib/utils";

type Mode = "search" | "assistant";

interface ModeToggleProps {
  mode: Mode;
  onModeChange: (mode: Mode) => void;
}

export function ModeToggle({ mode, onModeChange }: ModeToggleProps) {
  return (
    <div className="inline-flex items-center bg-secondary rounded-lg p-1">
      <button
        onClick={() => onModeChange("search")}
        className={cn(
          "flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-all",
          mode === "search"
            ? "bg-primary text-primary-foreground shadow-sm"
            : "text-muted-foreground hover:text-foreground"
        )}
      >
        <Search className="w-4 h-4" />
        Search
      </button>
      <button
        onClick={() => onModeChange("assistant")}
        className={cn(
          "flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-all",
          mode === "assistant"
            ? "bg-primary text-primary-foreground shadow-sm"
            : "text-muted-foreground hover:text-foreground"
        )}
      >
        <MessageSquare className="w-4 h-4" />
        Assistant
      </button>
    </div>
  );
}
