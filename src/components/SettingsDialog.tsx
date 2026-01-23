import { Settings, RotateCcw } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { useToolSettings } from "@/contexts/ToolSettingsContext";
import { TOOL_DEFINITIONS } from "@/types/toolSettings";

interface SettingsDialogProps {
  trigger?: React.ReactNode;
}

export function SettingsDialog({ trigger }: SettingsDialogProps) {
  const { isToolEnabled, toggleTool, resetToDefaults } = useToolSettings();

  // Filter out DeepDive-only tools from settings (they are context-dependent)
  const configurableTools = TOOL_DEFINITIONS.filter(t => !t.isDeepDiveOnly);

  return (
    <Dialog>
      <DialogTrigger asChild>
        {trigger || (
          <Button variant="ghost" size="sm" className="gap-2">
            <Settings className="w-4 h-4" />
            <span>設定</span>
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Settings className="w-5 h-5" />
            設定
          </DialogTitle>
          <DialogDescription>
            利用するツールを選択してください
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-medium">利用ツール</h3>
            <Button
              variant="ghost"
              size="sm"
              className="h-7 gap-1.5 text-xs text-muted-foreground"
              onClick={resetToDefaults}
            >
              <RotateCcw className="w-3 h-3" />
              デフォルトに戻す
            </Button>
          </div>
          
          <Separator />

          <div className="space-y-3">
            {configurableTools.map((tool) => (
              <div
                key={tool.id}
                className="flex items-start space-x-3 p-3 rounded-lg border border-border hover:bg-accent/50 transition-colors"
              >
                <Checkbox
                  id={tool.id}
                  checked={isToolEnabled(tool.id)}
                  onCheckedChange={() => toggleTool(tool.id)}
                  className="mt-0.5"
                />
                <div className="flex-1 space-y-1">
                  <Label
                    htmlFor={tool.id}
                    className="text-sm font-medium cursor-pointer"
                  >
                    {tool.name}
                  </Label>
                  <p className="text-xs text-muted-foreground">
                    {tool.description}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
