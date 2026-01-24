import { X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useState, useRef, useEffect, useCallback } from "react";
import { useIsMobile } from "@/hooks/use-mobile";
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
  authors?: string[];
  source?: string;
  onClose: () => void;
  onWidthChange?: (width: number) => void;
  onTextSelect?: (text: string) => void;
  onPdfLoaded?: (fullText: string) => void;
  clearHighlightSignal?: number;
}

type HighlightRect = {
  topRatio: number;
  leftRatio: number;
  widthRatio: number;
  heightRatio: number;
};

interface HighlightData {
  pageNumber: number;
  rects: HighlightRect[];
}

const clamp = (value: number, min = 0, max = 1) => Math.min(Math.max(value, min), max);
const DEBUG_PDF_HIGHLIGHT = Boolean(import.meta.env.DEV);

function ensureHighlightLayer(pageWrapper: HTMLElement) {
  const textLayer = pageWrapper.querySelector<HTMLElement>(".textLayer");
  if (!textLayer) return null;

  let highlightLayer = textLayer.querySelector<HTMLDivElement>(".pdf-highlight-layer");
  if (!highlightLayer) {
    highlightLayer = document.createElement("div");
    highlightLayer.className = "pdf-highlight-layer";
    highlightLayer.style.cssText = `
      position: absolute;
      inset: 0;
      pointer-events: none;
      z-index: 5;
      mix-blend-mode: multiply;
    `;
    textLayer.appendChild(highlightLayer);
  }
  highlightLayer.style.transform = textLayer.style.transform;
  highlightLayer.style.transformOrigin = textLayer.style.transformOrigin;

  return highlightLayer;
}

export function PDFViewer({ 
  url, 
  title, 
  authors,
  source,
  onClose, 
  onWidthChange,
  onTextSelect,
  onPdfLoaded,
  clearHighlightSignal
}: PDFViewerProps) {
  const getInitialWidth = () => Math.min(500, window.innerWidth * 0.5);
  const [width, setWidth] = useState(getInitialWidth);
  const [isDragging, setIsDragging] = useState(false);
  const [pdfDoc, setPdfDoc] = useState<any>(null);
  const [totalPages, setTotalPages] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const containerRef = useRef<HTMLDivElement>(null);
  const pdfContainerRef = useRef<HTMLDivElement>(null);
  const highlightDataRef = useRef<HighlightData | null>(null);
  const isMobile = useIsMobile();

  // Dynamic resize on window resize
  useEffect(() => {
    if (isMobile) return;
    
    const handleResize = () => {
      setWidth(prev => Math.min(prev, window.innerWidth * 0.9));
    };
    
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, [isMobile]);

  const clearHighlightOverlays = useCallback(() => {
    if (!pdfContainerRef.current) return;
    const layers = pdfContainerRef.current.querySelectorAll<HTMLElement>(".pdf-highlight-layer");
    layers.forEach((layer) => {
      layer.innerHTML = "";
    });
  }, []);

  const renderHighlightOverlay = useCallback(() => {
    const container = pdfContainerRef.current;
    if (!container) return;
    clearHighlightOverlays();
    const highlightData = highlightDataRef.current;
    if (!highlightData) return;

    const pageWrapper = container.querySelector<HTMLElement>(
      `[data-page-number="${highlightData.pageNumber}"]`
    );
    if (!pageWrapper) return;

    const highlightLayer = ensureHighlightLayer(pageWrapper);
    if (!highlightLayer) return;
    const padX = 2;
    const padY = 1;

    const toPercent = (value: number) => `${(value * 100).toFixed(4)}%`;

    highlightData.rects.forEach((rect, idx) => {
      const startX = clamp(rect.leftRatio);
      const endX = clamp(rect.leftRatio + rect.widthRatio);
      const startY = clamp(rect.topRatio);
      const endY = clamp(rect.topRatio + rect.heightRatio);

      const widthPercent = Math.max(endX - startX, 0);
      const heightPercent = Math.max(endY - startY, 0);

      const highlight = document.createElement("div");
      highlight.className = "pdf-highlight-block";
      highlight.style.cssText = `
        position: absolute;
        pointer-events: none;
        background: rgba(250, 204, 21, 0.35);
        border-radius: 4px;
        left: max(0px, calc(${toPercent(startX)} - ${padX}px));
        top: max(0px, calc(${toPercent(startY)} - ${padY}px));
        width: calc(${toPercent(widthPercent)} + ${padX * 2}px);
        height: calc(${toPercent(heightPercent)} + ${padY * 2}px);
      `;
      highlightLayer.appendChild(highlight);

      if (DEBUG_PDF_HIGHLIGHT && idx === 0) {
        const { width, height } = highlightLayer.getBoundingClientRect();
        console.debug("[PDF][Highlight][render]", {
          page: highlightData.pageNumber,
          layerSize: { width, height },
          rect: highlight.style.cssText,
        });
      }
    });
  }, [clearHighlightOverlays]);

  const persistSelectionHighlight = useCallback(
    (selection: Selection) => {
      if (!selection.rangeCount) return false;
      const range = selection.getRangeAt(0);
      if (range.collapsed) return false;
      const text = selection.toString().trim();
      if (!text) return false;

      const commonContainer = range.commonAncestorContainer;
      const element =
        commonContainer.nodeType === Node.ELEMENT_NODE
          ? (commonContainer as HTMLElement)
          : commonContainer.parentElement;
      if (!element) return false;

      const pageWrapper = element.closest<HTMLElement>(".pdf-page-wrapper");
      if (!pageWrapper || !pageWrapper.dataset.pageNumber) return false;

      const textLayer = pageWrapper.querySelector<HTMLElement>(".textLayer");
      const baseRect = textLayer?.getBoundingClientRect() ?? pageWrapper.getBoundingClientRect();
      if (baseRect.width === 0 || baseRect.height === 0) return false;

      const rects = Array.from(range.getClientRects())
        .map((rect) => ({
          topRatio: clamp((rect.top - baseRect.top) / baseRect.height),
          leftRatio: clamp((rect.left - baseRect.left) / baseRect.width),
          widthRatio: clamp(rect.width / baseRect.width),
          heightRatio: clamp(rect.height / baseRect.height),
        }))
        .filter((rect) => rect.widthRatio > 0 && rect.heightRatio > 0);

      if (!rects.length) return false;

      if (DEBUG_PDF_HIGHLIGHT) {
        console.debug("[PDF][Highlight][selection]", {
          page: pageWrapper.dataset.pageNumber,
          baseRect: {
            top: baseRect.top,
            left: baseRect.left,
            width: baseRect.width,
            height: baseRect.height,
          },
          firstClientRect: {
            top: range.getClientRects()[0]?.top,
            left: range.getClientRects()[0]?.left,
            width: range.getClientRects()[0]?.width,
            height: range.getClientRects()[0]?.height,
          },
          ratios: rects[0],
        });
      }

      highlightDataRef.current = {
        pageNumber: Number(pageWrapper.dataset.pageNumber),
        rects,
      };
      renderHighlightOverlay();
      return true;
    },
    [renderHighlightOverlay]
  );

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
        setPdfDoc(null);
        setTotalPages(0);
        highlightDataRef.current = null;
        clearHighlightOverlays();
        if (pdfContainerRef.current) {
          pdfContainerRef.current.innerHTML = "";
        }
        // Use proxy to fetch PDF to avoid CORS issues
        const apiBaseUrl = import.meta.env.VITE_API_URL || "http://localhost:8000";
        const proxyUrl = `${apiBaseUrl}/api/pdf-proxy?url=${encodeURIComponent(url)}`;
        const res = await fetch(proxyUrl);
        
        if (!res.ok) {
          throw new Error(`Failed to load PDF: ${res.status} ${res.statusText}`);
        }
        
        const data = await res.arrayBuffer();
        const pdf = await pdfjsLib.getDocument({ 
          data,
          cMapUrl: 'https://unpkg.com/pdfjs-dist@4.0.379/cmaps/',
          cMapPacked: true,
        }).promise;

        if (cancelled) return;

        setPdfDoc(pdf);
        setTotalPages(pdf.numPages);

        // Extract text from all pages
        const texts: string[] = [];
        for (let i = 1; i <= pdf.numPages; i++) {
          if (cancelled) return;
          const page = await pdf.getPage(i);
          const textContent = await page.getTextContent();
          const pageText = textContent.items
            .map((item: any) => item.str)
            .join(" ");
          texts.push(pageText);
        }

        if (cancelled) return;
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
  }, [url, clearHighlightOverlays]); // Remove onPdfLoaded from dependencies to prevent infinite loops

  // Render all pages at once for scrolling
  useEffect(() => {
    if (isLoading || !pdfDoc || !pdfContainerRef.current || totalPages === 0) return;

    let cancelled = false;
    const container = pdfContainerRef.current;
    container.innerHTML = "";
    const availableWidth =
      container.clientWidth ||
      container.getBoundingClientRect().width ||
      width ||
      container.parentElement?.clientWidth ||
      600;
    const targetContentWidth = Math.max(availableWidth - 32, 320);
    const MIN_SCALE = 0.6;
    const MAX_SCALE = 3;

    (async () => {
      try {
        for (let pageNum = 1; pageNum <= totalPages; pageNum++) {
          if (cancelled) return;

          const page = await pdfDoc.getPage(pageNum);
          const baseViewport = page.getViewport({ scale: 1 });
          const scale = Math.min(
            Math.max(targetContentWidth / baseViewport.width, MIN_SCALE),
            MAX_SCALE
          );
          const viewport = page.getViewport({ scale });

          // Create page wrapper
          const pageWrapper = document.createElement("div");
          pageWrapper.className = "pdf-page-wrapper";
          pageWrapper.dataset.pageNumber = pageNum.toString();
          pageWrapper.style.cssText = `
            position: relative;
            margin-bottom: 16px;
            background: white;
            box-shadow: 0 2px 8px rgba(0,0,0,0.1);
            overflow: hidden;
            max-width: 100%;
            width: ${viewport.width}px;
          `;

          // Create canvas
          const canvas = document.createElement("canvas");
          const ctx = canvas.getContext("2d");
          if (!ctx) continue;

          canvas.width = viewport.width;
          canvas.height = viewport.height;
          canvas.style.width = "100%";
          canvas.style.height = "auto";

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
            max-width: 100%;
          `;

          pageWrapper.appendChild(canvas);
          pageWrapper.appendChild(textLayerDiv);
          ensureHighlightLayer(pageWrapper);
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
        if (!cancelled) {
          renderHighlightOverlay();
        }
      } catch (error) {
      console.error("Page rendering error:", error);
    }
  })();

  return () => {
    cancelled = true;
  };
  }, [pdfDoc, totalPages, isLoading, width, renderHighlightOverlay]);

  // React to external highlight clearing (e.g., user hits the X button)
  useEffect(() => {
    if (typeof clearHighlightSignal === "undefined") return;
    highlightDataRef.current = null;
    clearHighlightOverlays();
    const selection = window.getSelection();
    selection?.removeAllRanges();
  }, [clearHighlightSignal, clearHighlightOverlays]);

  // Text selection detection
  useEffect(() => {
    const handleMouseUp = () => {
      const selection = window.getSelection();
      const text = selection?.toString().trim();
      if (selection && text && text.length > 0) {
        const highlighted = persistSelectionHighlight(selection);
        if (highlighted) {
          onTextSelect?.(text);
        }
      }
    };

    document.addEventListener("mouseup", handleMouseUp);
    return () => document.removeEventListener("mouseup", handleMouseUp);
  }, [onTextSelect, persistSelectionHighlight]);


  return (
    <div
      ref={containerRef}
      className="pdf-viewer-container fixed right-0 top-0 h-screen bg-background border-l border-border shadow-2xl z-50 animate-slide-in-right flex
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
        <div className="flex items-center justify-between p-4 border-b border-border bg-card gap-3 flex-wrap">
          <div className="flex flex-col flex-1 min-w-0">
            <h3 className="text-sm font-semibold text-foreground truncate">
              {title}
            </h3>
            {authors?.length ? (
              <p className="text-xs text-muted-foreground truncate">
                {authors.join(", ")}
              </p>
            ) : null}
          </div>
          <div className="flex items-center gap-2 shrink-0">
            {source ? (
              <Badge variant="secondary" className="text-xs">
                {source}
              </Badge>
            ) : null}
            <Button
              variant="ghost"
              size="icon"
              onClick={onClose}
              className="shrink-0 hover:bg-muted"
            >
              <X className="w-4 h-4" />
            </Button>
          </div>
        </div>

        {isLoading ? (
          <div className="flex-1 flex items-center justify-center">
            <div className="text-muted-foreground">PDFを読み込み中...</div>
          </div>
        ) : (
          <div className="flex-1 overflow-auto p-4 bg-muted/30">
            <div
              ref={pdfContainerRef}
              className="mx-auto flex flex-col items-center w-full max-w-full"
            />
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