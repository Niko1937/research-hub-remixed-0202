import React, { createContext, useContext, useState, useEffect, ReactNode } from "react";
import { ToolId, TOOL_DEFINITIONS } from "@/types/toolSettings";

const STORAGE_KEY = "research-hub-tool-settings";

interface ToolSettingsContextType {
  enabledTools: Set<ToolId>;
  toggleTool: (toolId: ToolId) => void;
  isToolEnabled: (toolId: ToolId) => boolean;
  resetToDefaults: () => void;
}

const ToolSettingsContext = createContext<ToolSettingsContextType | undefined>(undefined);

function getDefaultEnabledTools(): Set<ToolId> {
  return new Set(
    TOOL_DEFINITIONS.filter(t => t.defaultEnabled).map(t => t.id)
  );
}

function loadFromStorage(): Set<ToolId> {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
      const parsed = JSON.parse(stored) as ToolId[];
      return new Set(parsed);
    }
  } catch (e) {
    console.error("Failed to load tool settings:", e);
  }
  return getDefaultEnabledTools();
}

function saveToStorage(enabledTools: Set<ToolId>): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(Array.from(enabledTools)));
  } catch (e) {
    console.error("Failed to save tool settings:", e);
  }
}

export function ToolSettingsProvider({ children }: { children: ReactNode }) {
  const [enabledTools, setEnabledTools] = useState<Set<ToolId>>(() => loadFromStorage());

  useEffect(() => {
    saveToStorage(enabledTools);
  }, [enabledTools]);

  const toggleTool = (toolId: ToolId) => {
    setEnabledTools(prev => {
      const next = new Set(prev);
      if (next.has(toolId)) {
        next.delete(toolId);
      } else {
        next.add(toolId);
      }
      return next;
    });
  };

  const isToolEnabled = (toolId: ToolId) => enabledTools.has(toolId);

  const resetToDefaults = () => {
    setEnabledTools(getDefaultEnabledTools());
  };

  return (
    <ToolSettingsContext.Provider value={{ enabledTools, toggleTool, isToolEnabled, resetToDefaults }}>
      {children}
    </ToolSettingsContext.Provider>
  );
}

export function useToolSettings() {
  const context = useContext(ToolSettingsContext);
  if (context === undefined) {
    throw new Error("useToolSettings must be used within a ToolSettingsProvider");
  }
  return context;
}
