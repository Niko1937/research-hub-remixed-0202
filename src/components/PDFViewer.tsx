import { X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { useState, useRef, useEffect } from "react";
import * as pdfjsLib from "pdfjs-dist";
import "pdfjs-dist/web/pdf_viewer.css";

// Configure PDF.js worker - use a more reliable approach
// Instead of dynamic import, we'll initialize the worker inline
if (!pdfjsLib.GlobalWorkerOptions.workerSrc) {
  pdfjsLib.GlobalWorkerOptions.workerSrc = new URL(
    'pdfjs-dist/build/pdf.worker.min.mjs',
    import.meta.url
  ).toString();
}

interface PDFViewerProps {
  url: string;
  title: string;
  onClose: () => void;
  onWidthChange?: (width: number) => void;
  onTextSelect?: (text: string) => void;
  onPdfLoaded?: (fullText: string) => void;
}

export function PDFViewer({ 
  url, 
  title, 
  onClose, 
  onWidthChange,
  onTextSelect,
  onPdfLoaded 
}: PDFViewerProps) {
  const [width, setWidth] = useState(500);
  const [isDragging, setIsDragging] = useState(false);
  const [pdfDoc, setPdfDoc] = useState<any>(null);
  const [totalPages, setTotalPages] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const containerRef = useRef<HTMLDivElement>(null);
  const pdfContainerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    onWidthChange?.(width);
  }, [width, onWidthChange]);

  useEffect(() => {
    if (!isDragging) return;

    const handleMouseMove = (e: MouseEvent) => {
      const viewportWidth = window.innerWidth;
      const newWidth = Math.max(300, Math.min(viewportWidth - e.clientX, viewportWidth * 0.9));
      setWidth(newWidth);
    };

    const handleMouseUp = () => {
      setIsDragging(false);
    };

    document.addEventListener("mousemove", handleMouseMove);
    document.addEventListener("mouseup", handleMouseUp);

    return () => {
      document.removeEventListener("mousemove", handleMouseMove);
      document.removeEventListener("mouseup", handleMouseUp);
    };
  }, [isDragging]);

  // Load PDF and extract all text
  useEffect(() => {
    let cancelled = false;

    (async () => {
      try {
        setIsLoading(true);
        // Use proxy to fetch PDF to avoid CORS issues
        const proxyUrl = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/pdf-proxy?url=${encodeURIComponent(url)}`;
        const res = await fetch(proxyUrl);
        
        if (!res.ok) {
          throw new Error(`Failed to load PDF: ${res.status} ${res.statusText}`);
        }
        
        const data = await res.arrayBuffer();
        const pdf = await pdfjsLib.getDocument({ data }).promise;

        if (cancelled) return;

        setPdfDoc(pdf);
        setTotalPages(pdf.numPages);

        // Extract text from all pages
        const texts: string[] = [];
        for (let i = 1; i <= pdf.numPages; i++) {
          const page = await pdf.getPage(i);
          const textContent = await page.getTextContent();
          const pageText = textContent.items
            .map((item: any) => item.str)
            .join(" ");
          texts.push(pageText);
        }

        const fullText = texts.join("\n\n");
        onPdfLoaded?.(fullText);
        setIsLoading(false);
      } catch (error) {
        console.error("PDF loading error:", error);
        setIsLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [url, onPdfLoaded]);

  // Render all pages at once for scrolling
  useEffect(() => {
    if (isLoading || !pdfDoc || !pdfContainerRef.current || totalPages === 0) return;

    const container = pdfContainerRef.current;
    container.innerHTML = "";

    (async () => {
      try {
        for (let pageNum = 1; pageNum <= totalPages; pageNum++) {
          const page = await pdfDoc.getPage(pageNum);
          const viewport = page.getViewport({ scale: 1.5 });

          // Create page wrapper
          const pageWrapper = document.createElement("div");
          pageWrapper.className = "pdf-page-wrapper";
          pageWrapper.style.cssText = `
            position: relative;
            margin-bottom: 16px;
            background: white;
            box-shadow: 0 2px 8px rgba(0,0,0,0.1);
          `;

          // Create canvas
          const canvas = document.createElement("canvas");
          const ctx = canvas.getContext("2d");
          if (!ctx) continue;

          canvas.width = viewport.width;
          canvas.height = viewport.height;

          // Create text layer
          const textLayerDiv = document.createElement("div");
          textLayerDiv.className = "textLayer";
          textLayerDiv.style.cssText = `
            position: absolute;
            left: 0;
            top: 0;
            height: ${viewport.height}px;
            width: ${viewport.width}px;
            line-height: 1.0;
          `;

          pageWrapper.appendChild(canvas);
          pageWrapper.appendChild(textLayerDiv);
          container.appendChild(pageWrapper);

          // Render PDF page
          await page.render({ canvasContext: ctx, viewport }).promise;

          // Render text layer
          const textContent = await page.getTextContent();
          await pdfjsLib.renderTextLayer({
            textContentSource: textContent,
            container: textLayerDiv,
            viewport,
            textDivs: [],
          });

        }
      } catch (error) {
        console.error("Page rendering error:", error);
      }
    })();
  }, [pdfDoc, totalPages, isLoading]);

  // Text selection detection
  useEffect(() => {
    const handleMouseUp = () => {
      const selection = window.getSelection();
      const text = selection?.toString().trim();
      if (text && text.length > 0) {
        onTextSelect?.(text);
      }
    };

    document.addEventListener("mouseup", handleMouseUp);
    return () => document.removeEventListener("mouseup", handleMouseUp);
  }, [onTextSelect]);


  return (
    <div
      ref={containerRef}
      className="fixed right-0 top-0 h-screen bg-background border-l border-border shadow-2xl z-50 animate-slide-in-right flex"
      style={{ width: `${width}px` }}
    >
      {/* Resize Handle */}
      <div
        className="w-2 h-full cursor-col-resize hover:bg-primary/20 transition-colors flex items-center justify-center group"
        onMouseDown={() => setIsDragging(true)}
      >
        <div className="h-12 w-1 bg-border group-hover:bg-primary rounded-full transition-colors" />
      </div>

      <Card className="flex-1 flex flex-col rounded-none border-0">
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

        {isLoading ? (
          <div className="flex-1 flex items-center justify-center">
            <div className="text-muted-foreground">PDFを読み込み中...</div>
          </div>
        ) : (
          <div className="flex-1 overflow-auto p-4 bg-muted/30">
            <div ref={pdfContainerRef} className="mx-auto flex flex-col items-center" />
            {totalPages > 0 && (
              <div className="text-center text-sm text-muted-foreground mt-4 pb-4">
                全 {totalPages} ページ
              </div>
            )}
          </div>
        )}
      </Card>
    </div>
  );
}
