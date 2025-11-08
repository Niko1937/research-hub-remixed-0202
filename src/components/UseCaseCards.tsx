import { FileText, Target, FileSpreadsheet, ArrowRight } from "lucide-react";

export function UseCaseCards() {
  const useCases = [
    {
      icon: FileText,
      title: "個別資料との対話学習",
      description: "資料と対話して学びながら、専門家も見つける",
      gradient: "from-blue-500/10 to-cyan-500/10",
      iconColor: "text-blue-600 dark:text-blue-400",
      borderColor: "hover:border-blue-500/30",
    },
    {
      icon: Target,
      title: "研究戦略の立案",
      description: "ポジショニング分析とシーズ・ニーズマッチング",
      gradient: "from-emerald-500/10 to-teal-500/10",
      iconColor: "text-emerald-600 dark:text-emerald-400",
      borderColor: "hover:border-emerald-500/30",
    },
    {
      icon: FileSpreadsheet,
      title: "AI資料自動生成",
      description: "定例・進捗・提案報告を自動作成",
      gradient: "from-violet-500/10 to-purple-500/10",
      iconColor: "text-violet-600 dark:text-violet-400",
      borderColor: "hover:border-violet-500/30",
    },
  ];

  return (
    <div className="max-w-6xl mx-auto px-6 pt-12 pb-6">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {useCases.map((useCase, index) => {
          const Icon = useCase.icon;
          return (
            <div
              key={index}
              className={`group relative overflow-hidden rounded-2xl bg-gradient-to-br ${useCase.gradient} 
                border border-border/50 ${useCase.borderColor}
                transition-all duration-500 ease-out
                hover:shadow-2xl hover:shadow-primary/5 hover:-translate-y-1
                cursor-pointer backdrop-blur-sm`}
            >
              {/* Subtle shine effect on hover */}
              <div className="absolute inset-0 bg-gradient-to-br from-white/0 via-white/5 to-white/0 opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
              
              <div className="relative p-8">
                {/* Icon */}
                <div className="mb-6 flex items-center justify-between">
                  <div className={`${useCase.iconColor} transition-transform duration-500 group-hover:scale-110 group-hover:rotate-3`}>
                    <Icon className="w-8 h-8" strokeWidth={1.5} />
                  </div>
                  <ArrowRight className="w-5 h-5 text-muted-foreground/40 opacity-0 -translate-x-2 group-hover:opacity-100 group-hover:translate-x-0 transition-all duration-500" />
                </div>

                {/* Content */}
                <div className="space-y-3">
                  <h3 className="text-xl font-semibold text-foreground tracking-tight leading-tight">
                    {useCase.title}
                  </h3>
                  <p className="text-sm text-muted-foreground leading-relaxed">
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
