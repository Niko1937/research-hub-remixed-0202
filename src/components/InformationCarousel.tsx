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
    return () => {
      emblaApi.off('select', onSelect);
    };
  }, [emblaApi, onSelect]);

  const items = [
    {
      title: "背景と課題",
      subtitle: "AIは「研究実行」へ。しかし現場は「過去の把握」と「結果の言語化」に追われている",
      detail: "AIの進化は凄まじく、Microsoft DiscoveryやAlphaEvolveのようにAIが研究プロセスそのものを実行する段階に入っています。しかし多くの組織では「過去の社内資料はどこに？」「誰が詳しい？」といったナレッジの把握と、AIが出した成果を報告書に言語化する作業が依然として最大の課題です。\n\nこのプロトタイプは、これら複雑に絡み合う課題を対話的に解決するアプローチを示します。"
    },
    {
      title: "現在の機能",
      subtitle: "今できること（最小構成の7機能）",
      detail: "開発の時間的制約もあり、現在のプロトタイプで動くのは、AgentChatシステムのごく一部の機能だけです。\n\n現在実装されている機能:\n\n• 論文検索 - 外部API連携で関連文献を収集\n• テーマ評価 - 社内 vs 外部の研究動向を分析\n• 専門家検索 - 関連分野の専門家を推薦\n• ポジショニング分析 - 動的軸生成と3種類のチャート\n• シーズ・ニーズマッチング - 技術と課題の接続\n• HTML報告書生成 - インフォグラフィック自動作成\n• PDF閲覧・対話 - 文献との対話的学習\n\n現在は外部の論文APIを叩くAgentとLLMで整えるAgentしか実装されていないため、社内ドキュメントや共有フォルダには接続していません。"
    },
    {
      title: "本質は拡張性",
      subtitle: "Agentベースアーキテクチャの設計思想",
      detail: "このプロトタイプが本当に示したいのは、現在の機能ではなく、対話的な研究支援（AgentChat）がいかに拡張可能か、という点です。\n\nChat UIは、多様な能力を持つAI Agent（エージェント）たちを柔軟に呼び出すための「窓口」に過ぎません。現在は最小限のAgentしかいませんが、この設計のまま、裏側で呼ぶAgentを差し替えるだけで、将来的に以下のような機能拡張が容易になります:\n\n• 社内ナレッジ検索Agent（「過去の類似研究レポート出して」）\n• 専門家推薦Agent（「社内で〇〇に詳しい人いる？」）\n• 報告書自動生成Agent（「今月の定例報告書つくって」）\n• シミュレーション実行Agent（「このパラメータで回してみて」）\n\nこのプロトタイプは、Chat UIをフロントとし、裏側のAgentを疎結合に組み合わせることで、複雑な研究活動を支援できるという「拡張性」を感じてもらうための第一歩です。"
    },
    {
      title: "よくある質問",
      subtitle: "FAQ",
      detail: "Q. なぜこんなに機能が少ないのですか?\n\nA. これは完成品ではなく、対話型Agentシステムの「拡張性」を感じてもらうための最小構成のToyApp（おもちゃのアプリ）だからです。時間的制約から、まず外部論文APIを叩く部分だけを実装しています。\n\nQ. 社内の資料は見られますか?\n\nA. 現状は見られません。将来的には「社内ナレッジ検索Agent」を追加することで対応可能になる設計ですが、現在のToyApp版には未実装です。\n\nQ. なぜChat UIなのですか?\n\nA. 多様なAgent（論文検索、社内検索、要約、実行）を柔軟に呼び出し、対話的に研究を進めるスタイルに最も適しているインターフェースだと考えているからです。\n\nQ. モデルはgemini 2.5 flash固定ですか?\n\nA. はい。現在のToyAppではレスポンス速度を重視して固定していますが、Agent設計の一部なので、将来的にタスクに応じて最適なLLMを呼び出すように拡張可能です。"
    },
    {
      title: "ユースケース",
      subtitle: "個別資料との対話学習",
      detail: "PDFや論文などの個別資料を読み込み、その内容について対話しながら学習を深めることができます。\n\n資料の要点を抽出し、わからない箇所を質問したり、関連する専門家を推薦してもらったりすることで、効率的な学習をサポートします。\n\n現在実装されている機能:\n\n• PDF閲覧機能でテキストをハイライト\n• ハイライト部分について質問・対話\n• 関連する専門家の検索と推薦\n• 論文の要約と重要ポイントの抽出"
    },
    {
      title: "ユースケース",
      subtitle: "研究戦略の立案",
      detail: "研究テーマのポジショニング分析やシーズ・ニーズマッチングを通じて、効果的な研究戦略を立案できます。\n\n競合研究との差別化ポイントを可視化し、自社の技術シーズと市場ニーズの接点を発見することで、戦略的な研究開発を支援します。\n\n現在実装されている機能:\n\n• ポジショニング分析（散布図・箱ひげ図・レーダーチャート）\n• 動的な分析軸の生成と再生成\n• シーズ・ニーズマッチングの可視化\n• テーマ評価（社内外の研究動向分析）"
    },
    {
      title: "ユースケース",
      subtitle: "AI資料自動生成",
      detail: "研究の定例報告、進捗報告、提案資料などを、対話を通じてAIが自動生成します。\n\n研究内容や進捗状況を入力するだけで、見やすいインフォグラフィック形式の報告書が作成され、報告書作成の時間を大幅に削減できます。\n\n現在実装されている機能:\n\n• HTML形式のインフォグラフィック自動生成\n• 研究テーマに応じた構成の自動調整\n• 視覚的にわかりやすいレイアウト\n• プレビュー機能での即時確認"
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
                <div className="rounded-2xl bg-card/50 border border-border p-4 md:p-6 lg:p-10 transition-all duration-300 hover:bg-card hover:shadow-lg hover:border-primary/20">
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-[35%_65%] gap-6 md:gap-8 lg:gap-12">
                    {/* Left side: Title and Subtitle */}
                    <div className="space-y-3 md:space-y-4">
                      <h2 className="text-2xl md:text-3xl lg:text-4xl font-extrabold text-foreground leading-tight">
                        {item.title}
                      </h2>
                      <p className="text-base md:text-lg font-medium text-muted-foreground leading-relaxed">
                        {item.subtitle}
                      </p>
                    </div>

                    {/* Right side: Detail content */}
                    <div className="border-t md:border-t-0 md:border-l border-border/40 pt-4 md:pt-0 md:pl-8 lg:pl-12">
                      <div className="prose prose-sm max-w-none">
                        {item.detail.split('\n\n').map((paragraph, idx) => {
                          // Check if paragraph contains bullet points
                          if (paragraph.includes('•')) {
                            const lines = paragraph.split('\n');
                            const intro = lines[0].includes('•') ? null : lines[0];
                            const bullets = lines.filter(line => line.includes('•'));
                            
                            return (
                              <div key={idx} className="mb-4">
                                {intro && (
                                  <p className="text-sm text-muted-foreground leading-loose mb-3">
                                    {intro}
                                  </p>
                                )}
                                <ul className="space-y-2 list-none pl-0">
                                  {bullets.map((bullet, bulletIdx) => (
                                    <li key={bulletIdx} className="text-sm text-muted-foreground leading-loose flex items-start gap-2">
                                      <span className="text-primary mt-1">•</span>
                                      <span>{bullet.replace('•', '').trim()}</span>
                                    </li>
                                  ))}
                                </ul>
                              </div>
                            );
                          }
                          
                          // Check if it's a Q&A format
                          if (paragraph.startsWith('Q.') || paragraph.startsWith('A.')) {
                            const isQuestion = paragraph.startsWith('Q.');
                            return (
                              <p 
                                key={idx} 
                                className={cn(
                                  "text-sm leading-loose mb-4",
                                  isQuestion 
                                    ? "font-semibold text-foreground" 
                                    : "text-muted-foreground pl-4 border-l-2 border-primary/30 bg-accent/10 py-2 px-4 rounded"
                                )}
                              >
                                {paragraph}
                              </p>
                            );
                          }
                          
                          // Regular paragraph
                          return (
                            <p key={idx} className="text-sm text-muted-foreground leading-loose mb-4">
                              {paragraph}
                            </p>
                          );
                        })}
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Navigation Buttons - Always visible */}
        <Button
          variant="outline"
          size="icon"
          onClick={scrollPrev}
          aria-label="前のスライドへ"
          className="absolute left-0 top-1/2 -translate-y-1/2 -translate-x-3 md:-translate-x-4 
            opacity-70 hover:opacity-100 transition-all duration-200
            bg-background/95 backdrop-blur-sm z-10 hover:bg-background hover:scale-110 shadow-lg"
        >
          <ChevronLeft className="h-5 w-5" />
        </Button>
        <Button
          variant="outline"
          size="icon"
          onClick={scrollNext}
          aria-label="次のスライドへ"
          className="absolute right-0 top-1/2 -translate-y-1/2 translate-x-3 md:translate-x-4 
            opacity-70 hover:opacity-100 transition-all duration-200
            bg-background/95 backdrop-blur-sm z-10 hover:bg-background hover:scale-110 shadow-lg"
        >
          <ChevronRight className="h-5 w-5" />
        </Button>

        {/* Dot Indicators */}
        <div className="flex justify-center gap-2 mt-6 md:mt-8" role="tablist" aria-label="スライド選択">
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
