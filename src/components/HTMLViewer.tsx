import { X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { useState, useRef, useEffect } from "react";
import { useIsMobile } from "@/hooks/use-mobile";

interface HTMLViewerProps {
  html: string;
  onClose: () => void;
  onWidthChange?: (width: number) => void;
}

export function HTMLViewer({ html, onClose, onWidthChange }: HTMLViewerProps) {
  const [width, setWidth] = useState(500);
  const [isDragging, setIsDragging] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const isMobile = useIsMobile();

  useEffect(() => {
    onWidthChange?.(width);
  }, [width, onWidthChange]);

  // Handle resizing
  useEffect(() => {
    if (!isDragging) return;
    const handleMouseMove = (e: MouseEvent) => {
      const viewportWidth = window.innerWidth;
      const newWidth = Math.max(300, Math.min(viewportWidth - e.clientX, viewportWidth * 0.9));
      setWidth(newWidth);
    };
    const handleMouseUp = () => setIsDragging(false);
    document.addEventListener("mousemove", handleMouseMove);
    document.addEventListener("mouseup", handleMouseUp);
    return () => {
      document.removeEventListener("mousemove", handleMouseMove);
      document.removeEventListener("mouseup", handleMouseUp);
    };
  }, [isDragging]);

  // Use document.write to update iframe content, which allows scripts to run
  useEffect(() => {
    if (!iframeRef.current) return;
    const doc = iframeRef.current.contentDocument;
    if (!doc) return;

    const fallback = `<!DOCTYPE html><html lang="ja"><head><meta charset="utf-8" /><style>
      body { 
        font-family: "Inter", "Hiragino Sans", "Noto Sans JP", sans-serif; 
        padding: 2rem; 
        background: #ffffff; 
        color: #1f2937; 
        margin: 0;
        line-height: 1.6;
      }
    </style></head><body><p>現在表示できるHTML資料がありません。</p></body></html>`;

    doc.open();
    doc.write(html?.trim() ? html : fallback);
    doc.close();
  }, [html]);

  return (
    <div
      ref={containerRef}
      className="fixed right-0 top-0 h-screen bg-background border-l border-border shadow-2xl z-50 animate-slide-in-right flex
        max-md:left-0 max-md:right-0 max-md:w-full"
      style={{ width: isMobile ? '100%' : `${width}px` }}
    >
      {/* Resize Handle - Hidden on mobile */}
      <div
        className="w-2 h-full cursor-col-resize hover:bg-primary/20 transition-colors flex items-center justify-center group max-md:hidden"
        onMouseDown={() => setIsDragging(true)}
      >
        <div className="h-12 w-1 bg-border group-hover:bg-primary rounded-full transition-colors" />
      </div>

      <Card className="flex-1 flex flex-col rounded-none border-0">
        <div className="flex items-center justify-between p-4 border-b border-border bg-card">
          <h3 className="text-sm font-semibold text-foreground truncate flex-1 mr-2">
            資料プレビュー
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
        <div className="flex-1 overflow-auto bg-white">
          <iframe
            ref={iframeRef}
            className="w-full h-full border-0 bg-white"
            title="HTML Preview"
            sandbox="allow-scripts allow-same-origin"
            style={{ minHeight: '100%', backgroundColor: '#ffffff' }}
          />
        </div>
      </Card>
    </div>
  );
}
