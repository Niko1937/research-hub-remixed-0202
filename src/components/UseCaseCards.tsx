import { FileText, Target, FileSpreadsheet } from "lucide-react";

export function UseCaseCards() {
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
  ];

  return (
    <div className="max-w-6xl mx-auto px-6 pt-12 pb-8">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {useCases.map((useCase, index) => {
          const Icon = useCase.icon;
          return (
            <div
              key={index}
              className="group relative overflow-hidden rounded-2xl bg-card/50 
                border border-border
                transition-all duration-300 ease-out
                hover:bg-card hover:shadow-lg hover:border-primary/20
                cursor-pointer"
            >
              <div className="relative p-10">
                {/* Icon */}
                <div className="mb-6">
                  <div className="text-primary transition-transform duration-300 group-hover:scale-110">
                    <Icon className="w-12 h-12" strokeWidth={1.5} />
                  </div>
                </div>

                {/* Content */}
                <div className="space-y-3">
                  <h3 className="text-xl font-semibold text-foreground">
                    {useCase.title}
                  </h3>
                  <p className="text-base text-muted-foreground leading-relaxed">
                    {useCase.description}
                  </p>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
