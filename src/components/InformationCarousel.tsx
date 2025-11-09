import { useCallback, useEffect, useState } from 'react';
import useEmblaCarousel from 'embla-carousel-react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { Button } from './ui/button';
import { cn } from '@/lib/utils';

export function InformationCarousel() {
  const [emblaRef, emblaApi] = useEmblaCarousel({
    align: 'start',
    loop: true,
    skipSnaps: false,
  });
  
  const [selectedIndex, setSelectedIndex] = useState(0);

  const scrollPrev = useCallback(() => emblaApi?.scrollPrev(), [emblaApi]);
  const scrollNext = useCallback(() => emblaApi?.scrollNext(), [emblaApi]);
  const scrollTo = useCallback((index: number) => emblaApi?.scrollTo(index), [emblaApi]);

  const onSelect = useCallback(() => {
    if (!emblaApi) return;
    setSelectedIndex(emblaApi.selectedScrollSnap());
  }, [emblaApi]);

  useEffect(() => {
    if (!emblaApi) return;
    onSelect();
    emblaApi.on('select', onSelect);
    
    // Add mouse wheel support
    const handleWheel = (e: WheelEvent) => {
      if (Math.abs(e.deltaX) > Math.abs(e.deltaY)) {
        e.preventDefault();
        if (e.deltaX > 0) {
          emblaApi.scrollNext();
        } else {
          emblaApi.scrollPrev();
        }
      }
    };
    
    const emblaNode = emblaApi.rootNode();
    emblaNode.addEventListener('wheel', handleWheel, { passive: false });
    
    // Auto-scroll every 15 seconds
    const autoScroll = setInterval(() => {
      emblaApi.scrollNext();
    }, 15000);
    
    return () => {
      emblaApi.off('select', onSelect);
      emblaNode.removeEventListener('wheel', handleWheel);
      clearInterval(autoScroll);
    };
  }, [emblaApi, onSelect]);

  const items = [
    {
      title: "昨今の研究支援AI",
      layout: "paragraph",
      content: [
        {
          type: "heading",
          text: "AIは「研究実行」へ。しかし現場は「過去の把握」と「結果の言語化」に追われている"
        },
        {
          type: "text",
          html: "AIの進化は凄まじく、<span class='text-primary font-semibold'>Microsoft Discovery</span>や<span class='text-primary font-semibold'>AlphaEvolve</span>のようにAIが研究プロセスそのものを実行する段階に入っています。"
        },
        {
          type: "text",
          html: "一方で、<span class='text-primary font-semibold'>Elicit</span>や<span class='text-primary font-semibold'>Consensus</span>、<span class='text-primary font-semibold'>Scite</span>といった研究系AI SaaSは、論文検索・要約・引用分析に特化し、研究者の文献調査を効率化しています。<span class='text-primary font-semibold'>ResearchRabbit</span>や<span class='text-primary font-semibold'>Connected Papers</span>は文献間の関連性を可視化し、新たな研究の糸口を発見する支援をしています。"
        },
        {
          type: "text",
          html: "しかし多くの組織では「過去の社内資料はどこに？」「誰が詳しい？」といったナレッジの把握と、AIが出した成果を報告書に言語化する作業が依然として最大の課題です。既存の研究系AI SaaSは外部文献に強いものの、社内ナレッジとの統合や、組織固有の研究戦略立案には対応していません。"
        },
        {
          type: "text",
          html: "このプロトタイプは、これら複雑に絡み合う課題を対話的に解決するアプローチを示します。"
        }
      ]
    },
    {
      title: "実装済み機能と制約",
      layout: "list",
      subtitle: "現在実装されている機能と、その実装方式",
      items: [
        "<strong>wide-knowledge</strong>（外部論文検索）- OpenAlex/Semantic Scholar/arXivの実APIから取得し、LLMが要約・解釈",
        "<strong>theme-evaluation</strong>（テーマ評価）- <span class='bg-amber-500/20 text-amber-600 dark:text-amber-400 px-1.5 py-0.5 rounded'>モック社内研究2件</span>と<span class='bg-amber-500/20 text-amber-600 dark:text-amber-400 px-1.5 py-0.5 rounded'>モックビジネス課題2件</span>を使用。LLMが評価スコアを算出",
        "<strong>knowwho</strong>（専門家発見）- コンテクスト（検索した論文の著者等）からLLMが3-5名の関連専門家を動的に生成",
        "<strong>positioning-analysis</strong>（ポジショニング分析）- コンテクストからLLMが比較対象（論文・研究テーマ等）と比較軸（2-5軸）を動的に生成・可視化。軸の追加/削除/再生成も対話的に実行可能",
        "<strong>seeds-needs-matching</strong>（シーズ・ニーズマッチング）- <span class='bg-amber-500/20 text-amber-600 dark:text-amber-400 px-1.5 py-0.5 rounded'>モックデータ</span>を使用。LLMがマッチングスコアと理由を定性・定量の両面から算出",
        "<strong>html-generation</strong>（HTML報告書生成）- LLMが全ツール実行結果を統合し、インフォグラフィック形式のHTMLを生成",
        "<strong>PDF閲覧</strong> - 外部PDFをプロキシ経由で取得・表示（テキスト抽出やハイライトは未対応）"
      ],
      note: "社内ドキュメント検索、共有フォルダ接続、ベクトル検索、RAG等は未実装。全ての分析・解釈はLovable AI（Gemini 2.5 flash固定）が実行。各ツールは前ツール結果をコンテクストとして受け取り、段階的に分析を深化させる設計。"
    },
    {
      title: "本質は拡張性",
      layout: "center",
      subtitle: "Agentベースアーキテクチャの設計思想",
      detail: "このプロトタイプが本当に示したいのは、現在の機能ではなく、対話的な研究支援（AgentChat）がいかに拡張可能か、という点です。\n\nChat UIは、多様な能力を持つAI Agent（エージェント）たちを柔軟に呼び出すための「窓口」に過ぎません。現在は最小限のAgentしかいませんが、この設計のまま、裏側で呼ぶAgentを差し替えるだけで、将来的な機能拡張が容易になります。",
      items: [
        "社内ナレッジ検索Agent（「過去の類似研究レポート出して」）",
        "専門家推薦Agent（「社内で〇〇に詳しい人いる？」）",
        "報告書自動生成Agent（「今月の定例報告書つくって」）",
        "シミュレーション実行Agent（「このパラメータで回してみて」）"
      ]
    },
    {
      title: "よくある質問",
      layout: "qa",
      questions: [
        {
          q: "なぜこんなに機能が少ないのですか?",
          a: "これは完成品ではなく、対話型Agentシステムの「拡張性」を感じてもらうための最小構成のToyApp（おもちゃのアプリ）だからです。時間的制約から、まず外部論文APIを叩く部分だけを実装しています。"
        },
        {
          q: "社内の資料は見られますか?",
          a: "現状は見られません。将来的には「社内ナレッジ検索Agent」を追加することで対応可能になる設計ですが、現在のToyApp版には未実装です。"
        },
        {
          q: "なぜChat UIなのですか?",
          a: "多様なAgent（論文検索、社内検索、要約、実行）を柔軟に呼び出し、対話的に研究を進めるスタイルに最も適しているインターフェースだと考えているからです。"
        },
        {
          q: "モデルはgemini 2.5 flash固定ですか?",
          a: "はい。現在のToyAppではレスポンス速度を重視して固定していますが、Agent設計の一部なので、将来的にタスクに応じて最適なLLMを呼び出すように拡張可能です。"
        }
      ]
    },
    {
      title: "ユーザーストーリー",
      layout: "user-story",
      subtitle: "このシステムで実現できること",
      stories: [
        {
          persona: "研究者として",
          action: "論文やPDFを読み込んで対話しながら",
          outcome: "重要なポイントを素早く理解し、関連する専門家を見つけたい"
        },
        {
          persona: "プロジェクトリーダーとして",
          action: "研究テーマのポジショニングを分析し",
          outcome: "競合との差別化ポイントを可視化して、戦略的な研究計画を立てたい"
        },
        {
          persona: "研究マネージャーとして",
          action: "AIと対話しながら進捗状況を整理し",
          outcome: "見やすいインフォグラフィック形式の報告書を自動生成して、報告時間を削減したい"
        }
      ]
    }
  ];

  return (
    <div className="max-w-7xl mx-auto px-4 md:px-6 lg:px-8 py-6 md:py-8 lg:py-10">
      <div 
        className="relative" 
        role="region" 
        aria-label="情報カルーセル"
        aria-roledescription="carousel"
      >
        <div className="overflow-hidden" ref={emblaRef}>
          <div className="flex">
            {items.map((item, index) => (
              <div
                key={index}
                className="flex-[0_0_100%] min-w-0 px-2 md:px-3"
                role="group"
                aria-roledescription="slide"
                aria-label={`${index + 1} / ${items.length}`}
                aria-current={selectedIndex === index ? 'true' : 'false'}
              >
                <div className="rounded-2xl h-[500px] md:h-[450px] transition-all duration-300 overflow-hidden flex flex-col">
                  {/* Content Area */}
                  <div className="flex-1 overflow-y-auto px-6 md:px-8 lg:px-10 py-6 [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]">
                    {/* Paragraph Layout */}
                    {item.layout === 'paragraph' && (
                      <div className="max-w-4xl space-y-6">
                        {item.content?.map((block: any, idx: number) => (
                          <div key={idx}>
                            {block.type === 'heading' && (
                              <h3 className="text-lg md:text-xl lg:text-2xl font-semibold text-primary leading-relaxed mb-4">
                                {block.text}
                              </h3>
                            )}
                            {block.type === 'text' && (
                              <p 
                                className="text-base md:text-lg text-muted-foreground leading-loose"
                                dangerouslySetInnerHTML={{ __html: block.html }}
                              />
                            )}
                          </div>
                        ))}
                      </div>
                    )}

                    {/* List Layout */}
                    {item.layout === 'list' && (
                      <div className="space-y-6">
                        <p className="text-lg md:text-xl lg:text-2xl font-medium text-primary leading-relaxed">
                          {item.subtitle}
                        </p>
                        <ul className="grid grid-cols-1 md:grid-cols-2 gap-3">
                          {item.items?.map((listItem: string, idx: number) => (
                            <li key={idx} className="flex items-start gap-3 p-3 rounded-lg bg-accent/5 border border-border/50 hover:bg-accent/10 transition-colors">
                              <span className="text-primary mt-0.5 font-bold text-base">•</span>
                              <span className="text-base md:text-lg text-foreground leading-relaxed flex-1" dangerouslySetInnerHTML={{ __html: listItem }} />
                            </li>
                          ))}
                        </ul>
                        {item.note && (
                          <p className="text-sm md:text-base text-muted-foreground leading-relaxed p-4 bg-muted/30 rounded-lg border-l-2 border-primary/50">
                            {item.note}
                          </p>
                        )}
                      </div>
                    )}

                    {/* Center Layout */}
                    {item.layout === 'center' && (
                      <div className="max-w-3xl mx-auto space-y-6 text-center">
                        <p className="text-lg md:text-xl lg:text-2xl font-medium text-primary leading-relaxed">
                          {item.subtitle}
                        </p>
                        <p className="text-base md:text-lg text-muted-foreground leading-loose">
                          {item.detail}
                        </p>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mt-6 text-left">
                          {item.items?.map((listItem: string, idx: number) => (
                            <div key={idx} className="p-3 rounded-lg bg-primary/5 border border-primary/20 hover:bg-primary/10 transition-colors">
                              <span className="text-base md:text-lg text-foreground leading-relaxed block">{listItem}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Q&A Layout */}
                    {item.layout === 'qa' && (
                      <div className="space-y-5 max-w-4xl mx-auto">
                        {item.questions?.map((qa: any, idx: number) => (
                          <div key={idx} className="space-y-2">
                            <p className="text-base md:text-lg font-semibold text-foreground flex items-start gap-2">
                              <span className="text-primary">Q.</span>
                              <span>{qa.q}</span>
                            </p>
                            <p className="text-base md:text-lg text-muted-foreground leading-loose pl-6 py-3 px-4 bg-accent/10 rounded-lg border-l-2 border-primary/30">
                              <span className="font-medium text-primary">A. </span>
                              {qa.a}
                            </p>
                          </div>
                        ))}
                      </div>
                    )}

                    {/* User Story Layout */}
                    {item.layout === 'user-story' && (
                      <div className="space-y-6">
                        <p className="text-lg md:text-xl lg:text-2xl font-medium text-primary leading-relaxed mb-6">
                          {item.subtitle}
                        </p>
                        <div className="space-y-6">
                          {item.stories?.map((story: any, idx: number) => (
                            <div key={idx} className="p-5 rounded-xl bg-accent/10 border border-border/50 hover:bg-accent/20 transition-colors">
                              <div className="flex items-start gap-4">
                                <div className="flex-shrink-0 w-8 h-8 rounded-full bg-primary/20 flex items-center justify-center text-primary font-bold">
                                  {idx + 1}
                                </div>
                                <div className="flex-1 space-y-2">
                                  <p className="text-base md:text-lg">
                                    <span className="font-semibold text-foreground">{story.persona}</span>
                                    <span className="text-muted-foreground">、{story.action}、</span>
                                  </p>
                                  <p className="text-base md:text-lg text-primary font-medium pl-4 border-l-2 border-primary/30">
                                    {story.outcome}
                                  </p>
                                </div>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Navigation Buttons - Subtle */}
        <Button
          variant="ghost"
          size="icon"
          onClick={scrollPrev}
          aria-label="前のスライドへ"
          className="absolute left-2 top-1/2 -translate-y-1/2 
            opacity-30 hover:opacity-100 transition-opacity duration-300
            bg-background/50 backdrop-blur-sm z-10 h-8 w-8"
        >
          <ChevronLeft className="h-4 w-4" />
        </Button>
        <Button
          variant="ghost"
          size="icon"
          onClick={scrollNext}
          aria-label="次のスライドへ"
          className="absolute right-2 top-1/2 -translate-y-1/2 
            opacity-30 hover:opacity-100 transition-opacity duration-300
            bg-background/50 backdrop-blur-sm z-10 h-8 w-8"
        >
          <ChevronRight className="h-4 w-4" />
        </Button>

        {/* Dot Indicators */}
        <div className="flex justify-center gap-2 mt-6" role="tablist" aria-label="スライド選択">
          {items.map((_, index) => (
            <button
              key={index}
              onClick={() => scrollTo(index)}
              aria-label={`スライド ${index + 1} へ移動`}
              aria-current={selectedIndex === index ? 'true' : 'false'}
              role="tab"
              className={cn(
                "h-2 rounded-full transition-all duration-300",
                selectedIndex === index 
                  ? "w-8 bg-primary" 
                  : "w-2 bg-muted-foreground/30 hover:bg-muted-foreground/50"
              )}
            />
          ))}
        </div>
      </div>
    </div>
  );
}
