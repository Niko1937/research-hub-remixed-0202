import { X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";

interface PDFViewerProps {
  url: string;
  title: string;
  onClose: () => void;
}

export function PDFViewer({ url, title, onClose }: PDFViewerProps) {
  return (
    <div className="fixed right-0 top-0 h-screen w-[500px] bg-background border-l border-border shadow-2xl z-50 animate-slide-in-right">
      <Card className="h-full flex flex-col rounded-none border-0">
        <div className="flex items-center justify-between p-4 border-b border-border bg-card">
          <h3 className="text-sm font-semibold text-foreground truncate flex-1 mr-2">
            {title}
          </h3>
          <Button
            variant="ghost"
            size="icon"
            onClick={onClose}
            className="shrink-0 hover:bg-muted"
          >
            <X className="w-4 h-4" />
          </Button>
        </div>
        <div className="flex-1 overflow-hidden">
          <iframe
            src={url}
            className="w-full h-full border-0"
            title={title}
          />
        </div>
      </Card>
    </div>
  );
}
