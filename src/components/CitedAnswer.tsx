import { useRef, useCallback } from "react";
import { Microscope } from "lucide-react";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import rehypeRaw from "rehype-raw";

interface Paper {
  id?: number;
  title: string;
  abstract: string;
  authors: string[];
  year: string;
  source: string;
  url: string;
  citations?: number;
}

interface CitedAnswerProps {
  summary: string;
  papers: Paper[];
  onPaperClick?: (paper: { url: string; title: string; authors?: string[]; source?: string }) => void;
  onDeepDive?: (paper: Paper) => void;
}

export function CitedAnswer({ summary, papers, onPaperClick, onDeepDive }: CitedAnswerProps) {
  const getPaperById = useCallback((id: number) => {
    return papers.find(p => p.id === id);
  }, [papers]);

  // Convert citation references [1] to clickable links in markdown
  const processedSummary = summary.replace(/\[(\d+)\]/g, (match, num) => {
    const paper = getPaperById(parseInt(num, 10));
    if (paper) {
      return `<cite data-id="${num}">[${num}]</cite>`;
    }
    return match;
  });

  return (
    <TooltipProvider>
      <div className="space-y-4">
        {/* Answer Section - Markdown rendered */}
        {summary && (
          <div className="prose prose-sm dark:prose-invert max-w-none">
            <ReactMarkdown
              remarkPlugins={[remarkGfm]}
              rehypePlugins={[rehypeRaw]}
              components={{
                h1: ({ children }) => <h1 className="text-lg font-bold text-foreground mt-4 mb-2">{children}</h1>,
                h2: ({ children }) => <h2 className="text-base font-semibold text-foreground mt-3 mb-2">{children}</h2>,
                h3: ({ children }) => <h3 className="text-sm font-semibold text-foreground mt-2 mb-1">{children}</h3>,
                p: ({ children }) => <p className="text-sm text-foreground leading-relaxed mb-3">{children}</p>,
                ul: ({ children }) => <ul className="list-disc list-inside text-sm text-foreground mb-3 space-y-1">{children}</ul>,
                ol: ({ children }) => <ol className="list-decimal list-inside text-sm text-foreground mb-3 space-y-1">{children}</ol>,
                li: ({ children }) => <li className="text-sm text-foreground">{children}</li>,
                a: ({ href, children }) => (
                  <a href={href} className="text-primary hover:text-highlight underline" target="_blank" rel="noopener noreferrer">
                    {children}
                  </a>
                ),
                code: ({ children, className }) => {
                  const isInline = !className;
                  return isInline ? (
                    <code className="bg-muted px-1.5 py-0.5 rounded text-xs font-mono">{children}</code>
                  ) : (
                    <code className="block bg-muted p-3 rounded-lg text-xs font-mono overflow-x-auto">{children}</code>
                  );
                },
                blockquote: ({ children }) => (
                  <blockquote className="border-l-2 border-primary pl-4 italic text-muted-foreground my-3">
                    {children}
                  </blockquote>
                ),
                table: ({ children }) => (
                  <div className="overflow-x-auto my-3">
                    <table className="min-w-full border border-border text-sm">{children}</table>
                  </div>
                ),
                th: ({ children }) => <th className="border border-border bg-muted px-3 py-2 text-left font-medium">{children}</th>,
                td: ({ children }) => <td className="border border-border px-3 py-2">{children}</td>,
                strong: ({ children }) => <strong className="font-semibold text-foreground">{children}</strong>,
                em: ({ children }) => <em className="italic">{children}</em>,
                cite: ({ node, ...props }: any) => {
                  const dataId = props['data-id'];
                  const id = dataId ? parseInt(dataId, 10) : null;
                  const paper = id ? getPaperById(id) : null;
                  
                  if (!paper || !onDeepDive) {
                    return <span className="text-primary font-medium">{props.children}</span>;
                  }
                  
                  return (
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <button
                          className="inline-flex items-center gap-0.5 text-primary hover:text-highlight 
                                     font-medium cursor-pointer transition-colors mx-0.5 
                                     hover:bg-primary/10 rounded px-1 py-0.5"
                          onClick={() => onDeepDive(paper)}
                        >
                          <Microscope className="w-3 h-3" />
                          <span>[{id}]</span>
                        </button>
                      </TooltipTrigger>
                      <TooltipContent side="top" className="max-w-xs">
                        <p className="text-xs font-medium line-clamp-2">{paper.title}</p>
                        <p className="text-xs text-muted-foreground mt-1">クリックでDeepDive</p>
                      </TooltipContent>
                    </Tooltip>
                  );
                },
              }}
            >
              {processedSummary}
            </ReactMarkdown>
          </div>
        )}
      </div>
    </TooltipProvider>
  );
}
