import { X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { useState, useRef, useEffect } from "react";
import * as pdfjsLib from "pdfjs-dist";
import "pdfjs-dist/web/pdf_viewer.css";

// Configure PDF.js worker
pdfjsLib.GlobalWorkerOptions.workerSrc = `//unpkg.com/pdfjs-dist@4.0.379/build/pdf.worker.min.js`;

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
  const [currentPage, setCurrentPage] = useState(1);
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
        const res = await fetch(url);
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

  // Render current page
  useEffect(() => {
    if (!pdfDoc || !pdfContainerRef.current) return;

    (async () => {
      try {
        const page = await pdfDoc.getPage(currentPage);
        const viewport = page.getViewport({ scale: 1.5 });

        // Create canvas
        const canvas = document.createElement("canvas");
        const ctx = canvas.getContext("2d");
        if (!ctx) return;

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

        const container = pdfContainerRef.current;
        if (!container) return;

        container.innerHTML = "";
        container.style.position = "relative";
        container.appendChild(canvas);
        container.appendChild(textLayerDiv);

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
      } catch (error) {
        console.error("Page rendering error:", error);
      }
    })();
  }, [pdfDoc, currentPage]);

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

  const handlePrevPage = () => {
    if (currentPage > 1) {
      setCurrentPage(currentPage - 1);
    }
  };

  const handleNextPage = () => {
    if (currentPage < totalPages) {
      setCurrentPage(currentPage + 1);
    }
  };

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
            <div className="text-muted-foreground">Loading PDF...</div>
          </div>
        ) : (
          <>
            <div className="flex-1 overflow-auto p-4 bg-muted/30">
              <div ref={pdfContainerRef} className="mx-auto" />
            </div>

            {/* Pagination Controls */}
            {totalPages > 1 && (
              <div className="flex items-center justify-between p-4 border-t border-border bg-card">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handlePrevPage}
                  disabled={currentPage === 1}
                >
                  前へ
                </Button>
                <span className="text-sm text-muted-foreground">
                  {currentPage} / {totalPages}
                </span>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleNextPage}
                  disabled={currentPage === totalPages}
                >
                  次へ
                </Button>
              </div>
            )}
          </>
        )}
      </Card>
    </div>
  );
}
