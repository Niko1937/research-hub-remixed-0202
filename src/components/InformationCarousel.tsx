import { FileText, Target, FileSpreadsheet, ChevronLeft, ChevronRight } from "lucide-react";
import useEmblaCarousel from "embla-carousel-react";
import { useCallback } from "react";
import { Button } from "@/components/ui/button";

export function InformationCarousel() {
  const [emblaRef, emblaApi] = useEmblaCarousel({ 
    align: "start",
    loop: false,
    slidesToScroll: 1,
  });

  const scrollPrev = useCallback(() => {
    if (emblaApi) emblaApi.scrollPrev();
  }, [emblaApi]);

  const scrollNext = useCallback(() => {
    if (emblaApi) emblaApi.scrollNext();
  }, [emblaApi]);

  const items = [
    {
      type: "concept",
      title: "AIは「研究実行」へ。しかし現場は「過去の把握」と「結果の言語化」に追われている",
      content: (
        <p className="text-sm text-muted-foreground leading-relaxed">
          AIの進化は凄まじく、Microsoft DiscoveryやAlphaEvolveのようにAIが研究プロセスそのものを実行する段階に入っています。
          しかし多くの組織では「過去の社内資料はどこに？」「誰が詳しい？」といった<strong className="text-foreground">ナレッジの把握</strong>と、
          AIが出した成果を<strong className="text-foreground">報告書に言語化する作業</strong>が依然として最大の課題です。
        </p>
      )
    },
    {
      type: "concept",
      title: "今できること（最小構成の7機能）",
      content: (
        <ul className="text-sm text-muted-foreground space-y-2 leading-relaxed">
          <li>• <strong className="text-foreground">論文検索</strong> - 外部API連携で関連文献を収集</li>
          <li>• <strong className="text-foreground">テーマ評価</strong> - 社内 vs 外部の研究動向を分析</li>
          <li>• <strong className="text-foreground">専門家検索</strong> - 関連分野の専門家を推薦</li>
          <li>• <strong className="text-foreground">ポジショニング分析</strong> - 動的軸生成と3種類のチャート</li>
          <li>• <strong className="text-foreground">シーズ・ニーズマッチング</strong> - 技術と課題の接続</li>
          <li>• <strong className="text-foreground">HTML報告書生成</strong> - インフォグラフィック自動作成</li>
          <li>• <strong className="text-foreground">PDF閲覧・対話</strong> - 文献との対話的学習</li>
        </ul>
      )
    },
    {
      type: "concept",
      title: "本質は「拡張性」：Agentベースアーキテクチャ",
      content: (
        <p className="text-sm text-muted-foreground leading-relaxed">
          このToyAppが示したいのは、<strong className="text-foreground">対話UIの裏側でAgentを疎結合に組み合わせる設計</strong>です。
          現在は最小限のAgentですが、将来的に「社内ナレッジ検索Agent」「リアルタイム専門家推薦Agent」
          「定例報告書自動生成Agent」などを追加するだけで、複雑な研究活動を対話的に支援できるようになります。
        </p>
      )
    },
    {
      type: "concept",
      title: "よくある質問",
      content: (
        <div className="space-y-2.5 text-sm">
          <div>
            <p className="font-medium text-foreground">Q. なぜ機能が少ない？</p>
            <p className="text-muted-foreground">A. Agent設計の「拡張性」を示す最小構成だからです。</p>
          </div>
          <div>
            <p className="font-medium text-foreground">Q. 社内資料は見られる？</p>
            <p className="text-muted-foreground">A. 現状は未実装。将来Agentを追加して対応可能です。</p>
          </div>
          <div>
            <p className="font-medium text-foreground">Q. なぜChat UI？</p>
            <p className="text-muted-foreground">A. 多様なAgentを柔軟に呼び出せる最適なインターフェースだからです。</p>
          </div>
        </div>
      )
    },
    {
      type: "usecase",
      icon: FileText,
      title: "個別資料との対話学習",
      description: "資料と対話して学びながら、専門家も見つける"
    },
    {
      type: "usecase",
      icon: Target,
      title: "研究戦略の立案",
      description: "ポジショニング分析とシーズ・ニーズマッチング"
    },
    {
      type: "usecase",
      icon: FileSpreadsheet,
      title: "AI資料自動生成",
      description: "定例・進捗・提案報告を自動作成"
    }
  ];

  return (
    <div className="max-w-6xl mx-auto px-6 py-5 border-b border-border">
      <div className="relative group">
        <div className="overflow-hidden" ref={emblaRef}>
          <div className="flex">
            {items.map((item, index) => (
              <div
                key={index}
                className="flex-[0_0_100%] md:flex-[0_0_50%] lg:flex-[0_0_33.333%] min-w-0 px-2"
              >
                <div className="h-full rounded-2xl bg-card/50 border border-border p-6 transition-all duration-300 hover:bg-card hover:shadow-lg hover:border-primary/20">
                  {item.type === "concept" ? (
                    <div className="space-y-3">
                      <h3 className="text-base font-semibold text-foreground leading-tight">
                        {item.title}
                      </h3>
                      <div>{item.content}</div>
                    </div>
                  ) : (
                    <div className="flex flex-col h-full">
                      <div className="mb-4">
                        <div className="text-primary">
                          {item.icon && <item.icon className="w-10 h-10" strokeWidth={1.5} />}
                        </div>
                      </div>
                      <div className="space-y-2">
                        <h3 className="text-lg font-semibold text-foreground">
                          {item.title}
                        </h3>
                        <p className="text-sm text-muted-foreground leading-relaxed">
                          {item.description}
                        </p>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Navigation Buttons */}
        <Button
          variant="outline"
          size="icon"
          onClick={scrollPrev}
          className="absolute left-0 top-1/2 -translate-y-1/2 -translate-x-4 
            opacity-0 group-hover:opacity-100 transition-opacity
            bg-background/80 backdrop-blur-sm z-10"
        >
          <ChevronLeft className="h-4 w-4" />
        </Button>
        <Button
          variant="outline"
          size="icon"
          onClick={scrollNext}
          className="absolute right-0 top-1/2 -translate-y-1/2 translate-x-4 
            opacity-0 group-hover:opacity-100 transition-opacity
            bg-background/80 backdrop-blur-sm z-10"
        >
          <ChevronRight className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}
