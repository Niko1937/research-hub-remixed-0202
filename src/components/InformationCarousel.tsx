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
        "論文検索 - OpenAlex/Semantic Scholar/arXiv APIから最大5件取得（モック無し）",
        "テーマ評価 - モックの社内研究データ2件 + モックのビジネス課題2件（実データベース接続無し）",
        "専門家検索 - ハードコードされた3名のモック専門家データ（検索機能無し）",
        "ポジショニング分析 - Gemini 2.5 flashで動的にJSON生成（軸数・項目数は可変）",
        "シーズ・ニーズマッチング - モックデータによるマッチングスコア算出（実データベース接続無し）",
        "HTML報告書生成 - Gemini 2.5 flashでインフォグラフィックHTMLコード生成",
        "PDF閲覧 - 外部PDFをプロキシ経由で取得・表示（テキスト抽出やハイライトは未対応）"
      ],
      note: "Edge Function実装: research-chat（926行）とpdf-proxy（61行）。社内ドキュメント検索、共有フォルダ接続、ベクトル検索、RAG等は未実装。全てLovable AI（Gemini 2.5 flash固定）で処理。"
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
      title: "ユースケース",
      layout: "feature",
      subtitle: "個別資料との対話学習",
      description: "PDFや論文などの個別資料を読み込み、その内容について対話しながら学習を深めることができます。資料の要点を抽出し、わからない箇所を質問したり、関連する専門家を推薦してもらったりすることで、効率的な学習をサポートします。",
      items: [
        "PDF閲覧機能でテキストをハイライト",
        "ハイライト部分について質問・対話",
        "関連する専門家の検索と推薦",
        "論文の要約と重要ポイントの抽出"
      ]
    },
    {
      title: "ユースケース",
      layout: "feature",
      subtitle: "研究戦略の立案",
      description: "研究テーマのポジショニング分析やシーズ・ニーズマッチングを通じて、効果的な研究戦略を立案できます。競合研究との差別化ポイントを可視化し、自社の技術シーズと市場ニーズの接点を発見することで、戦略的な研究開発を支援します。",
      items: [
        "ポジショニング分析（散布図・箱ひげ図・レーダーチャート）",
        "動的な分析軸の生成と再生成",
        "シーズ・ニーズマッチングの可視化",
        "テーマ評価（社内外の研究動向分析）"
      ]
    },
    {
      title: "ユースケース",
      layout: "feature",
      subtitle: "AI資料自動生成",
      description: "研究の定例報告、進捗報告、提案資料などを、対話を通じてAIが自動生成します。研究内容や進捗状況を入力するだけで、見やすいインフォグラフィック形式の報告書が作成され、報告書作成の時間を大幅に削減できます。",
      items: [
        "HTML形式のインフォグラフィック自動生成",
        "研究テーマに応じた構成の自動調整",
        "視覚的にわかりやすいレイアウト",
        "プレビュー機能での即時確認"
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
                              <h3 className="text-base md:text-lg font-semibold text-primary leading-relaxed mb-4">
                                {block.text}
                              </h3>
                            )}
                            {block.type === 'text' && (
                              <p 
                                className="text-sm text-muted-foreground leading-loose"
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
                        <p className="text-base md:text-lg font-medium text-primary leading-relaxed">
                          {item.subtitle}
                        </p>
                        <ul className="grid grid-cols-1 md:grid-cols-2 gap-3">
                          {item.items?.map((listItem: string, idx: number) => (
                            <li key={idx} className="flex items-start gap-3 p-3 rounded-lg bg-accent/5 border border-border/50 hover:bg-accent/10 transition-colors">
                              <span className="text-primary mt-0.5 font-bold">•</span>
                              <span className="text-sm text-foreground leading-relaxed flex-1">{listItem}</span>
                            </li>
                          ))}
                        </ul>
                        {item.note && (
                          <p className="text-xs text-muted-foreground leading-relaxed p-4 bg-muted/30 rounded-lg border-l-2 border-primary/50">
                            {item.note}
                          </p>
                        )}
                      </div>
                    )}

                    {/* Center Layout */}
                    {item.layout === 'center' && (
                      <div className="max-w-3xl mx-auto space-y-6 text-center">
                        <p className="text-base md:text-lg font-medium text-primary leading-relaxed">
                          {item.subtitle}
                        </p>
                        <p className="text-sm text-muted-foreground leading-loose">
                          {item.detail}
                        </p>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mt-6 text-left">
                          {item.items?.map((listItem: string, idx: number) => (
                            <div key={idx} className="p-3 rounded-lg bg-primary/5 border border-primary/20 hover:bg-primary/10 transition-colors">
                              <span className="text-sm text-foreground leading-relaxed block">{listItem}</span>
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
                            <p className="text-sm font-semibold text-foreground flex items-start gap-2">
                              <span className="text-primary">Q.</span>
                              <span>{qa.q}</span>
                            </p>
                            <p className="text-sm text-muted-foreground leading-loose pl-6 py-3 px-4 bg-accent/10 rounded-lg border-l-2 border-primary/30">
                              <span className="font-medium text-primary">A. </span>
                              {qa.a}
                            </p>
                          </div>
                        ))}
                      </div>
                    )}

                    {/* Feature Layout */}
                    {item.layout === 'feature' && (
                      <div className="space-y-6">
                        <p className="text-base md:text-lg font-medium text-primary leading-relaxed">
                          {item.subtitle}
                        </p>
                        <p className="text-sm text-muted-foreground leading-loose">
                          {item.description}
                        </p>
                        <div className="space-y-2">
                          <p className="text-xs font-semibold text-foreground uppercase tracking-wide">実装済み機能</p>
                          <ul className="space-y-2">
                            {item.items?.map((listItem: string, idx: number) => (
                              <li key={idx} className="flex items-start gap-3 text-sm text-muted-foreground leading-relaxed">
                                <span className="text-primary mt-1">✓</span>
                                <span className="flex-1">{listItem}</span>
                              </li>
                            ))}
                          </ul>
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
