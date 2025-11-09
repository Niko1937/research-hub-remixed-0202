import { FileText, Target, FileSpreadsheet, ChevronLeft, ChevronRight } from "lucide-react";
import useEmblaCarousel from "embla-carousel-react";
import { useCallback } from "react";
import { Button } from "@/components/ui/button";

export function UseCaseCards() {
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

  const useCases = [
    {
      icon: FileText,
      title: "個別資料との対話学習",
      description: "資料と対話して学びながら、専門家も見つける",
    },
    {
      icon: Target,
      title: "研究戦略の立案",
      description: "ポジショニング分析とシーズ・ニーズマッチング",
    },
    {
      icon: FileSpreadsheet,
      title: "AI資料自動生成",
      description: "定例・進捗・提案報告を自動作成",
    },
    {
      icon: FileText,
      title: "論文検索と要約",
      description: "外部文献を検索して要約・解釈",
    },
    {
      icon: Target,
      title: "テーマ評価",
      description: "社内研究とビジネス課題の関連性を評価",
    },
    {
      icon: FileSpreadsheet,
      title: "専門家検索",
      description: "関連分野の専門家を推薦",
    },
    {
      icon: FileText,
      title: "HTML報告書生成",
      description: "インフォグラフィック形式で自動作成",
    },
  ];

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 py-4 sm:py-5">
      <div className="relative">
        <div className="overflow-hidden" ref={emblaRef}>
          <div className="flex gap-3 sm:gap-4">
            {useCases.map((useCase, index) => {
              const Icon = useCase.icon;
              return (
                <div
                  key={index}
                  className="flex-[0_0_100%] sm:flex-[0_0_calc(50%-0.5rem)] md:flex-[0_0_calc(33.333%-0.67rem)] min-w-0"
                >
                  <div
                    className="group relative overflow-hidden rounded-xl sm:rounded-2xl bg-card/50 
                      border border-border h-full
                      transition-all duration-300 ease-out
                      hover:bg-card hover:shadow-lg hover:border-primary/20
                      cursor-pointer"
                  >
                    <div className="relative p-4 sm:p-5 md:p-6">
                      {/* Icon */}
                      <div className="mb-2 sm:mb-3">
                        <div className="text-primary transition-transform duration-300 group-hover:scale-110">
                          <Icon className="w-7 h-7 sm:w-8 sm:h-8" strokeWidth={1.5} />
                        </div>
                      </div>

                      {/* Content */}
                      <div className="space-y-1 sm:space-y-1.5">
                        <h3 className="text-sm sm:text-base font-semibold text-foreground">
                          {useCase.title}
                        </h3>
                        <p className="text-xs text-muted-foreground leading-relaxed">
                          {useCase.description}
                        </p>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Navigation Buttons */}
        <Button
          variant="outline"
          size="icon"
          onClick={scrollPrev}
          className="absolute left-0 top-1/2 -translate-y-1/2 -translate-x-4 
            hidden md:flex opacity-0 group-hover:opacity-100 transition-opacity
            bg-background/80 backdrop-blur-sm"
        >
          <ChevronLeft className="h-4 w-4" />
        </Button>
        <Button
          variant="outline"
          size="icon"
          onClick={scrollNext}
          className="absolute right-0 top-1/2 -translate-y-1/2 translate-x-4 
            hidden md:flex opacity-0 group-hover:opacity-100 transition-opacity
            bg-background/80 backdrop-blur-sm"
        >
          <ChevronRight className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}
