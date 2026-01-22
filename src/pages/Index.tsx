import { useState, useEffect, useCallback, useRef } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { ResearchSidebar } from "@/components/ResearchSidebar";
import { ChatInput } from "@/components/ChatInput";
import { ResearchResults } from "@/components/ResearchResults";
import { ThinkingBlock } from "@/components/ThinkingBlock";
import { PDFViewer } from "@/components/PDFViewer";
import { HTMLViewer } from "@/components/HTMLViewer";
import { ThemeEvaluation } from "@/components/ThemeEvaluation";
import { KnowWhoResults } from "@/components/KnowWhoResults";
import { SearchResultItem } from "@/components/SearchResultItem";
import { UseCaseCards } from "@/components/UseCaseCards";
import { HeroSection } from "@/components/HeroSection";
import { ConceptSections } from "@/components/ConceptSections";
import { ExtensibilityMatrix } from "@/components/ExtensibilityMatrix";
import { PositioningAnalysis } from "@/components/PositioningAnalysis";
import { SeedsNeedsMatching } from "@/components/SeedsNeedsMatching";
import { DeepDiveBanner, DeepDiveSource, VirtualFile } from "@/components/DeepDiveBanner";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Sparkles, Loader2, FileText, Search, MessageSquare, X, ChevronDown } from "lucide-react";
import { useResearchChat } from "@/hooks/useResearchChat";
import { SidebarProvider } from "@/components/ui/sidebar";
import { useIsMobile } from "@/hooks/use-mobile";
import { supabase } from "@/integrations/supabase/client";

// Mock virtual folder generator based on paper metadata
function generateMockVirtualFolder(title: string): VirtualFile[] {
  const baseFiles: VirtualFile[] = [
    { path: "/data/experiment_results.csv", description: "主要な実験結果データ", type: "data" },
    { path: "/data/training_metrics.json", description: "学習曲線・メトリクスデータ", type: "data" },
    { path: "/figures/architecture.png", description: "モデルアーキテクチャ図", type: "figure" },
    { path: "/figures/results_chart.png", description: "結果のグラフ・チャート", type: "figure" },
    { path: "/references/bibliography.bib", description: "引用論文一覧", type: "reference" },
    { path: "/references/related_works.md", description: "関連研究まとめノート", type: "reference" },
    { path: "/code/model_config.py", description: "モデル設定・ハイパーパラメータ", type: "code" },
    { path: "/code/train.py", description: "学習スクリプト", type: "code" },
  ];
  
  // Add some randomization based on title hash
  const hash = title.split("").reduce((acc, char) => acc + char.charCodeAt(0), 0);
  const numFiles = 4 + (hash % 5); // 4-8 files
  
  return baseFiles.slice(0, numFiles);
}

interface DeepDiveContext {
  source: DeepDiveSource;
  virtualFolder: VirtualFile[];
  pdfText?: string;
}

const initialSearchResults = [
  { 
    title: "Deep Learning for Natural Language Processing", 
    authors: ["Smith, J.", "Wang, L."], 
    year: "2024", 
    source: "arXiv", 
    citations: 152, 
    url: "https://arxiv.org/pdf/2401.00001.pdf", 
    query: "機械学習",
    abstract: "本論文では、自然言語処理における深層学習の最新手法を包括的に調査する。特にTransformerアーキテクチャの発展と、事前学習モデルの効率的な活用方法について詳述する。"
  },
  { 
    title: "Transformer Architecture and Its Applications", 
    authors: ["Chen, Y.", "Liu, M."], 
    year: "2024", 
    source: "ACL", 
    citations: 289, 
    url: "https://arxiv.org/pdf/2401.00002.pdf", 
    query: "機械学習",
    abstract: "We present a comprehensive analysis of Transformer architectures and their applications across various NLP tasks. Our study demonstrates significant improvements in translation, summarization, and question-answering benchmarks."
  },
  { 
    title: "Large Language Models: A Comprehensive Survey", 
    authors: ["Brown, T.", "Davis, R."], 
    year: "2024", 
    source: "OpenAlex", 
    citations: 412, 
    url: "https://arxiv.org/pdf/2401.00003.pdf", 
    query: "LLM",
    abstract: "This survey examines the evolution of large language models from GPT-3 to contemporary architectures. We analyze training methodologies, scaling laws, emergent capabilities, and ethical considerations in deployment."
  },
  { 
    title: "Efficient Training of Large Language Models", 
    authors: ["Johnson, A.", "Lee, K."], 
    year: "2023", 
    source: "NeurIPS", 
    citations: 276, 
    url: "https://arxiv.org/pdf/2401.00004.pdf", 
    query: "LLM",
    abstract: "We propose novel optimization techniques for training large-scale language models with reduced computational costs. Our methods achieve 40% faster convergence while maintaining model quality across multiple benchmarks."
  },
  { 
    title: "Multi-Agent Reinforcement Learning Framework", 
    authors: ["Garcia, M.", "Kim, S."], 
    year: "2024", 
    source: "ICML", 
    citations: 198, 
    url: "https://arxiv.org/pdf/2401.00005.pdf", 
    query: "Agent",
    abstract: "マルチエージェント強化学習のための新しいフレームワークを提案する。協調と競争が混在する環境において、エージェント間の効率的な学習と通信プロトコルを実現する。"
  },
  { 
    title: "Autonomous Agents in Complex Environments", 
    authors: ["Wilson, D.", "Zhang, H."], 
    year: "2024", 
    source: "arXiv", 
    citations: 143, 
    url: "https://arxiv.org/pdf/2401.00006.pdf", 
    query: "Agent",
    abstract: "This paper explores the design and implementation of autonomous agents capable of navigating complex, dynamic environments. We introduce a hierarchical decision-making framework that balances exploration and exploitation."
  },
  { 
    title: "Neural Architecture Search for Machine Learning", 
    authors: ["Anderson, P.", "Taylor, E."], 
    year: "2023", 
    source: "ICLR", 
    citations: 231, 
    url: "https://arxiv.org/pdf/2401.00007.pdf", 
    query: "機械学習",
    abstract: "ニューラルアーキテクチャサーチの最新動向を調査し、効率的な探索アルゴリズムと評価指標を提案する。実験結果により、提案手法が従来手法を大幅に上回ることを示す。"
  },
  { 
    title: "Prompt Engineering for Large Language Models", 
    authors: ["Martinez, R.", "White, C."], 
    year: "2024", 
    source: "Semantic Scholar", 
    citations: 167, 
    url: "https://arxiv.org/pdf/2401.00008.pdf", 
    query: "LLM",
    abstract: "We systematically investigate prompt engineering techniques for optimizing large language model performance. Our findings reveal critical factors affecting model outputs and provide practical guidelines for effective prompt design."
  },
];

const DEFAULT_RECOMMEND_QUERY = "AI machine learning";

type RecommendedPaper = typeof initialSearchResults[number];

type ActivePdfViewer = {
  url: string;
  title: string;
  authors?: string[];
  source?: string;
  openedAt: number;
};

const Index = () => {
  const [mode, setMode] = useState<"search" | "assistant">("search");
  const { 
    timeline, 
    isLoading, 
    sendMessage, 
    clearMessages,
    addAxis,
    removeAxis,
    regenerateAxis
  } = useResearchChat();
  const [pdfViewer, setPdfViewer] = useState<ActivePdfViewer | null>(null);
  const [htmlViewer, setHtmlViewer] = useState<string | null>(null);
  const [recommendedPapers, setRecommendedPapers] = useState<RecommendedPaper[]>(initialSearchResults);
  const [recommendedLoading, setRecommendedLoading] = useState(false);
  const [recommendedError, setRecommendedError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState<string | null>(null);
  const [viewerWidth, setViewerWidth] = useState(500);
  const [selectedPdfText, setSelectedPdfText] = useState<string>("");
  const [pdfContext, setPdfContext] = useState<string>("");
  const [clearHighlightSignal, setClearHighlightSignal] = useState(0);
  const [pendingHtmlAutoOpen, setPendingHtmlAutoOpen] = useState(false);
  const [lastHtmlItemTimestamp, setLastHtmlItemTimestamp] = useState<number | null>(null);
  const [showIntro, setShowIntro] = useState(true);
  const [deepDiveContext, setDeepDiveContext] = useState<DeepDiveContext | null>(null);
  const [capturedScreenshot, setCapturedScreenshot] = useState<string | null>(null);
  const isMobile = useIsMobile();

  const clearHighlight = useCallback(() => {
    setSelectedPdfText("");
    setClearHighlightSignal((prev) => prev + 1);
  }, []);

  const closePdfViewer = useCallback(() => {
    setPdfViewer(null);
    clearHighlight();
    setPdfContext("");
  }, [clearHighlight]);

  const handleHtmlViewerClose = useCallback(() => {
    setHtmlViewer(null);
    setPendingHtmlAutoOpen(false);
  }, []);

  const handleResetToExplorer = useCallback(() => {
    clearMessages();
    setMode("search");
    closePdfViewer();
    handleHtmlViewerClose();
    setLastHtmlItemTimestamp(null);
    setSearchQuery(null);
    setDeepDiveContext(null);
    setCapturedScreenshot(null);
    // Reset to initial recommendations
    setRecommendedLoading(true);
    
    supabase.functions
      .invoke("arxiv-proxy", {
        body: { 
          searchQuery: DEFAULT_RECOMMEND_QUERY,
          maxResults: 7 
        },
      })
      .then(({ data, error }) => {
        if (error) throw error;
        if (!data?.xmlData) throw new Error("No data returned");
        
        const parser = new DOMParser();
        const xml = parser.parseFromString(data.xmlData, "text/xml");
        const entries = Array.from(xml.getElementsByTagName("entry"));

        const mapped: RecommendedPaper[] = entries
          .map((entry) => {
            const text = (tag: string) =>
              entry.getElementsByTagName(tag)[0]?.textContent?.replace(/\s+/g, " ").trim() || "";
            const title = text("title");
            const abstract = text("summary");
            const published = entry.getElementsByTagName("published")[0]?.textContent?.slice(0, 4) || "N/A";
            const id = text("id");
            const pdfUrl = id ? id.replace("/abs/", "/pdf/") + ".pdf" : "";
            if (!pdfUrl) return null;
            const authors = Array.from(entry.getElementsByTagName("name"))
              .map((node) => node.textContent || "Unknown")
              .slice(0, 4);

            return {
              title: title || "Untitled",
              authors: authors.length ? authors : ["Unknown"],
              year: published,
              source: "arXiv",
              citations: undefined,
              url: pdfUrl,
              query: DEFAULT_RECOMMEND_QUERY,
              abstract,
            };
          })
          .filter(Boolean) as RecommendedPaper[];

        setRecommendedPapers(mapped);
      })
      .finally(() => setRecommendedLoading(false));
  }, [clearMessages, closePdfViewer, handleHtmlViewerClose]);

  // Handle DeepDive activation
  const handleDeepDive = useCallback((paper: { id?: number; title: string; url: string; authors?: string[]; source?: string; year?: string }) => {
    // Generate mock virtual folder
    const virtualFolder = generateMockVirtualFolder(paper.title);
    
    setDeepDiveContext({
      source: {
        id: paper.id,
        title: paper.title,
        url: paper.url,
        authors: paper.authors,
        source: paper.source,
        year: paper.year,
      },
      virtualFolder,
      pdfText: pdfContext, // Use current PDF text if available
    });
    
    // Open the PDF if not already open
    if (!pdfViewer || pdfViewer.url !== paper.url) {
      setMode("assistant");
      handleHtmlViewerClose();
      setPdfViewer({
        url: paper.url,
        title: paper.title,
        authors: paper.authors,
        source: paper.source,
        openedAt: Date.now(),
      });
    }
  }, [pdfViewer, pdfContext, handleHtmlViewerClose]);

  const handleCloseDeepDive = useCallback(() => {
    setDeepDiveContext(null);
    setCapturedScreenshot(null);
  }, []);

  const handleCaptureScreenshot = useCallback(async () => {
    // Screenshot feature temporarily disabled
    console.log("Screenshot capture not yet implemented");
  }, []);

  const handleClearScreenshot = useCallback(() => {
    setCapturedScreenshot(null);
  }, []);

  const handleAddAxis = useCallback(async (axisName: string, axisType: "quantitative" | "qualitative") => {
    const lastPositioning = [...timeline].reverse().find(item => item.type === "positioning_analysis");
    if (lastPositioning) {
      await addAxis(lastPositioning.data, axisName, axisType);
    }
  }, [timeline, addAxis]);

  const handleRemoveAxis = useCallback(async (axisName: string) => {
    const lastPositioning = [...timeline].reverse().find(item => item.type === "positioning_analysis");
    if (lastPositioning) {
      await removeAxis(lastPositioning.data, axisName);
    }
  }, [timeline, removeAxis]);

  const handleRegenerateAxis = useCallback(async (axisName: string) => {
    const lastPositioning = [...timeline].reverse().find(item => item.type === "positioning_analysis");
    if (lastPositioning) {
      await regenerateAxis(lastPositioning.data, axisName);
    }
  }, [timeline, regenerateAxis]);

  // Fetch dynamic recommendations
  useEffect(() => {
    let cancelled = false;

    const fetchRecommendations = async () => {
      try {
        setRecommendedLoading(true);
        setRecommendedError(null);

        const { data, error } = await supabase.functions.invoke("arxiv-proxy", {
          body: { 
            searchQuery: DEFAULT_RECOMMEND_QUERY,
            maxResults: 7 
          },
        });

        if (error) throw error;
        if (!data?.xmlData) {
          throw new Error("No data returned from arXiv proxy");
        }
        
        const feed = data.xmlData;
        if (cancelled) return;

        const parser = new DOMParser();
        const xml = parser.parseFromString(feed, "text/xml");
        const entries = Array.from(xml.getElementsByTagName("entry"));

        const mapped: RecommendedPaper[] = entries
          .map((entry) => {
            const text = (tag: string) =>
              entry.getElementsByTagName(tag)[0]?.textContent?.replace(/\s+/g, " ").trim() || "";
            const title = text("title");
            const abstract = text("summary");
            const published = entry.getElementsByTagName("published")[0]?.textContent?.slice(0, 4) || "N/A";
            const id = text("id");
            const pdfUrl = id ? id.replace("/abs/", "/pdf/") + ".pdf" : "";
            if (!pdfUrl) return null;
            const authors = Array.from(entry.getElementsByTagName("name"))
              .map((node) => node.textContent || "Unknown")
              .slice(0, 4);

            return {
              title: title || "Untitled",
              authors: authors.length ? authors : ["Unknown"],
              year: published,
              source: "arXiv",
              citations: undefined,
              url: pdfUrl,
              query: DEFAULT_RECOMMEND_QUERY,
              abstract,
            };
          })
          .filter(Boolean) as RecommendedPaper[];

        if (!mapped.length) {
          throw new Error("No recommendations returned from API");
        }

        setRecommendedPapers(mapped as RecommendedPaper[]);
      } catch (error) {
        console.error(error);
        if (!cancelled) {
          setRecommendedError("本日のおすすめを取得できませんでした。しばらく経ってから再度お試しください。");
        }
      } finally {
        if (!cancelled) {
          setRecommendedLoading(false);
        }
      }
    };

    fetchRecommendations();
    return () => {
      cancelled = true;
    };
  }, []);

  // Update recommended papers when research results are received
  useEffect(() => {
    const latestResearchResult = [...timeline]
      .reverse()
      .find(item => item.type === "research_result");
    
    if (latestResearchResult && latestResearchResult.data?.external) {
      const externalPapers = latestResearchResult.data.external;
      
      // Find the user message before this research result to get the query
      const resultIndex = [...timeline].reverse().findIndex(item => item.type === "research_result");
      const userMessageBeforeResult = [...timeline]
        .reverse()
        .slice(resultIndex)
        .find(item => item.type === "user_message");
      
      if (userMessageBeforeResult) {
        setSearchQuery(userMessageBeforeResult.data.content);
      }
      
      if (externalPapers.length > 0) {
        const mapped: RecommendedPaper[] = externalPapers.map((paper: any) => ({
          title: paper.title || "Untitled",
          authors: paper.authors || ["Unknown"],
          year: paper.year || "N/A",
          source: paper.source || "Unknown",
          citations: paper.citations,
          url: paper.url || "",
          query: "",
          abstract: paper.abstract || "",
        }));
        setRecommendedPapers(mapped);
      }
    }
  }, [timeline]);

  // Auto-open HTML viewer when HTML generation starts and update in real-time
  useEffect(() => {
    const lastHtmlItem = [...timeline]
      .reverse()
      .find(item => item.type === "html_generation");

    if (!lastHtmlItem || !lastHtmlItem.data?.html) {
      return;
    }

    const htmlContent = lastHtmlItem.data.html;
    const isNewHtmlItem = lastHtmlItem.timestamp !== lastHtmlItemTimestamp;

    if (htmlViewer !== null) {
      setHtmlViewer((prev) => (prev === htmlContent ? prev : htmlContent));
      if (isNewHtmlItem) {
        setLastHtmlItemTimestamp(lastHtmlItem.timestamp);
      }
      return;
    }

    if (pendingHtmlAutoOpen && isNewHtmlItem) {
      closePdfViewer();
      setHtmlViewer(htmlContent);
      setLastHtmlItemTimestamp(lastHtmlItem.timestamp);
      setPendingHtmlAutoOpen(false);
    }
  }, [timeline, htmlViewer, pendingHtmlAutoOpen, lastHtmlItemTimestamp, closePdfViewer]);

  const openPdfDocument = useCallback(
    (doc: { url: string; title: string; authors?: string[]; source?: string }) => {
      setMode("assistant");
      handleHtmlViewerClose();
      setPdfViewer({
        url: doc.url,
        title: doc.title,
        authors: doc.authors,
        source: doc.source,
        openedAt: Date.now(),
      });
      clearHighlight();
      setPdfContext("");
    },
    [clearHighlight, handleHtmlViewerClose]
  );

  const handleSubmit = (
    message: string,
    tool?: string,
    pdfContextArg?: string,
    highlightedText?: string,
    screenshot?: string
  ) => {
    if (tool === "html-generation") {
      const lastHtmlItem = [...timeline]
        .reverse()
        .find(item => item.type === "html_generation");
      setLastHtmlItemTimestamp(lastHtmlItem?.timestamp ?? null);
      setPendingHtmlAutoOpen(true);
    }
    // Clear screenshot after sending
    if (screenshot) {
      setCapturedScreenshot(null);
    }
    
    // Build DeepDive context if active
    const deepDivePayload = deepDiveContext ? {
      source: deepDiveContext.source,
      virtualFolder: deepDiveContext.virtualFolder
    } : undefined;
    
    // Don't change mode when in search mode without a tool selected
    if (mode === "search" && !tool) {
      sendMessage(message, "search", tool, pdfContextArg || pdfContext, highlightedText, screenshot, deepDivePayload);
    } else {
      if (mode === "search") {
        setMode("assistant");
      }
      sendMessage(message, "assistant", tool, pdfContextArg || pdfContext, highlightedText, screenshot, deepDivePayload);
    }
  };

  const handleSearchResultClick = (result: { url: string; title: string; authors?: string[]; source?: string }) => {
    openPdfDocument(result);
  };

  const handleViewerWidthChange = (width: number) => {
    setViewerWidth(width);
  };

  return (
    <SidebarProvider>
      <div className="flex h-screen bg-background w-full">
        <ResearchSidebar onExplorerClick={handleResetToExplorer} />

        <main 
          className="flex-1 flex flex-col overflow-hidden transition-all duration-300"
          style={{
            marginRight: (pdfViewer || htmlViewer) && !isMobile ? `${viewerWidth}px` : 0
          }}
        >
          {mode === "search" ? (
            // Search Mode Layout
            <ScrollArea className="flex-1">
              <div className="animate-fade-in">
                {showIntro ? (
                  <div className="relative">
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => setShowIntro(false)}
                      className="absolute top-4 right-4 z-10 hover:bg-muted/80"
                      aria-label="イントロを閉じる"
                    >
                      <X className="h-5 w-5" />
                    </Button>
                    <HeroSection />
                    <ExtensibilityMatrix />
                  </div>
                ) : (
                  <div className="max-w-6xl mx-auto px-4 sm:px-6 pt-4">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setShowIntro(true)}
                      className="gap-2"
                    >
                      <ChevronDown className="h-4 w-4" />
                      イントロを表示
                    </Button>
                  </div>
                )}

                <div className="max-w-6xl mx-auto px-4 sm:px-6 py-5">
                  <ChatInput 
                    onSubmit={handleSubmit}
                    mode={mode}
                    onModeChange={setMode}
                    highlightedText={selectedPdfText}
                    pdfContext={pdfContext}
                    onClearHighlight={clearHighlight}
                  />
                </div>

                {/* Recommended Papers */}
                <div className="max-w-6xl mx-auto px-4 sm:px-6 pb-8">
                  <div className="flex items-center justify-between mb-4">
                    {searchQuery ? (
                      <div className="flex items-center gap-3 flex-1">
                        <h2 className="text-lg font-semibold text-foreground">検索結果</h2>
                        <span className="text-sm text-muted-foreground">
                          「{searchQuery}」
                        </span>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={handleResetToExplorer}
                          className="ml-auto"
                        >
                          <X className="h-4 w-4" />
                        </Button>
                      </div>
                    ) : (
                      <h2 className="text-lg font-semibold text-foreground">本日のおすすめ</h2>
                    )}
                  </div>
                  
                  <Card className="bg-card border-border overflow-hidden">
                    {recommendedLoading || isLoading ? (
                      <div className="p-6 flex items-center justify-center gap-2 text-muted-foreground">
                        <Loader2 className="h-4 w-4 animate-spin" />
                        {searchQuery ? "検索中..." : "本日のおすすめを取得しています..."}
                      </div>
                    ) : recommendedError ? (
                      <div className="p-6 text-center text-destructive">{recommendedError}</div>
                    ) : (
                      recommendedPapers.map((result, index) => (
                        <SearchResultItem
                          key={index}
                          {...result}
                          onClick={() => handleSearchResultClick(result)}
                        />
                      ))
                    )}
                  </Card>
                </div>
              </div>
            </ScrollArea>
          ) : (
            // Assistant Mode Layout
            <div className="flex flex-col h-full animate-fade-in">
              {/* DeepDive Banner - Above Chat */}
              {deepDiveContext && (
                <DeepDiveBanner
                  source={deepDiveContext.source}
                  onClose={handleCloseDeepDive}
                  hasPdfContext={!!pdfContext}
                  hasScreenshot={!!capturedScreenshot}
                />
              )}
              
              <ScrollArea className="flex-1">
                <div className="p-4 sm:p-6">
                  <div className="max-w-4xl mx-auto space-y-6 pb-32">
                    {timeline.length === 0 ? (
                      <div className="flex flex-col items-center justify-center h-[50vh] text-center">
                        <div className="p-4 bg-primary/10 rounded-full mb-4">
                          <Sparkles className="w-8 h-8 text-primary" />
                        </div>
                        <h3 className="text-xl font-semibold text-foreground mb-2">
                          ResearchHub AI
                        </h3>
                        <p className="text-muted-foreground max-w-md">
                          研究に関する質問や、論文の解説、アイデアの整理など、何でもお手伝いします
                        </p>
                      </div>
                    ) : (
                      <div className="space-y-6">
                        {timeline.map((item, index) => {
                          switch (item.type) {
                            case "user_message":
                              return (
                                <div key={index} className="flex justify-end">
                                  <div className="max-w-[85%] rounded-lg p-4">
                                    <p className="text-sm whitespace-pre-wrap text-foreground">{item.data.content}</p>
                                  </div>
                                </div>
                              );
                            
                            case "thinking":
                              return (
                                <ThinkingBlock
                                  key={index}
                                  steps={item.data.steps}
                                  currentStep={item.data.currentStep}
                                />
                              );
                            
                            case "research_result":
                              return (
                                <ResearchResults
                                  key={index}
                                  data={item.data}
                                  onPdfClick={openPdfDocument}
                                  onDeepDive={handleDeepDive}
                                />
                              );
                            
                            case "theme_evaluation":
                              return (
                                <ThemeEvaluation
                                  key={index}
                                  comparison={item.data.comparison}
                                  needs={item.data.needs}
                                />
                              );
                            
                            case "knowwho_result":
                              return <KnowWhoResults key={index} experts={item.data.experts} />;
                            
                            case "positioning_analysis":
                              return (
                                <PositioningAnalysis
                                  key={index}
                                  data={item.data}
                                  onAddAxis={handleAddAxis}
                                  onRemoveAxis={handleRemoveAxis}
                                  onRegenerateAxis={handleRegenerateAxis}
                                />
                              );
                            
                            case "seeds_needs_matching":
                              return (
                                <SeedsNeedsMatching
                                  key={index}
                                  seedTitle={item.data.seedTitle}
                                  seedDescription={item.data.seedDescription}
                                  candidates={item.data.candidates}
                                />
                              );
                            
                            case "html_generation":
                              return (
                                <Card
                                  key={index}
                                  className="p-4 bg-card border-border cursor-pointer hover:bg-card-hover transition-colors"
                                  onClick={() => {
                                    if (item.data.isComplete) {
                                      closePdfViewer();
                                      setHtmlViewer(item.data.html);
                                      setLastHtmlItemTimestamp(item.timestamp);
                                      setPendingHtmlAutoOpen(false);
                                    }
                                  }}
                                >
                                  <div className="flex items-center gap-3">
                                    <FileText className="w-5 h-5 text-primary" />
                                    <div className="flex-1">
                                      <p className="text-sm font-medium text-foreground">
                                        {item.data.isComplete ? "HTML資料生成完了" : "HTML資料生成中..."}
                                      </p>
                                      <p className="text-xs text-muted-foreground mt-1">
                                        {item.data.isComplete
                                          ? "クリックしてプレビュー"
                                          : "生成中です..."}
                                      </p>
                                    </div>
                                    {!item.data.isComplete && (
                                      <Loader2 className="w-4 h-4 animate-spin text-primary" />
                                    )}
                                  </div>
                                </Card>
                              );
                            
                            case "assistant_message":
                              // Skip assistant message if it directly follows knowwho_result
                              const prevItem = timeline[index - 1];
                              if (prevItem && prevItem.type === "knowwho_result") {
                                return null;
                              }
                              return (
                                <div key={index} className="flex justify-start w-full">
                                  <div className="w-full rounded-lg p-4">
                                    <div className="prose prose-sm dark:prose-invert max-w-none">
                                      <ReactMarkdown remarkPlugins={[remarkGfm]}>
                                        {item.data.content}
                                      </ReactMarkdown>
                                    </div>
                                  </div>
                                </div>
                              );
                            
                            default:
                              return null;
                          }
                        })}

                        {isLoading && (
                          <div className="flex items-center gap-2 text-muted-foreground">
                            <Loader2 className="w-4 h-4 animate-spin" />
                            <span className="text-sm">AI が回答を生成中...</span>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              </ScrollArea>

              <div className="animate-slide-in-bottom">
                <ChatInput 
                  onSubmit={handleSubmit}
                  mode={mode}
                  onModeChange={setMode}
                  highlightedText={selectedPdfText}
                  pdfContext={pdfContext}
                  onClearHighlight={clearHighlight}
                  isDeepDiveActive={!!deepDiveContext}
                  screenshot={capturedScreenshot}
                  onCaptureScreenshot={handleCaptureScreenshot}
                  onClearScreenshot={handleClearScreenshot}
                />
              </div>
            </div>
          )}
        </main>

      {pdfViewer && !htmlViewer && (
        <PDFViewer 
          key={`${pdfViewer.url}-${pdfViewer.openedAt}`}
          url={pdfViewer.url} 
          title={pdfViewer.title} 
          authors={pdfViewer.authors}
          source={pdfViewer.source}
          onClose={closePdfViewer}
          onWidthChange={handleViewerWidthChange}
          onTextSelect={(text) => setSelectedPdfText(text)}
          onPdfLoaded={(fullText) => setPdfContext(fullText)}
          clearHighlightSignal={clearHighlightSignal}
        />
      )}
      
      {htmlViewer && (
        <HTMLViewer 
          html={htmlViewer} 
          onClose={handleHtmlViewerClose}
          onWidthChange={handleViewerWidthChange}
        />
      )}
    </div>
    </SidebarProvider>
  );
};

export default Index;
