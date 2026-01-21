import { useState, useCallback } from 'react';
import { Card } from './ui/card';
import { cn } from '@/lib/utils';
import { X, Sparkles, Search, Brain, Lightbulb, PenTool } from 'lucide-react';

// Data complexity levels (vertical axis)
const dataLevels = [
  { id: 'llm', label: 'LLM知識', description: '事前学習された一般知識' },
  { id: 'web-general', label: 'Web一般', description: '最新ニュース・一般情報' },
  { id: 'internal-structured', label: '社内構造化', description: 'DB・スプレッドシート等' },
  { id: 'internal-unstructured', label: '社内非構造化', description: 'Slack・メール・議事録' },
  { id: 'tacit-rules', label: '暗黙ルール', description: '社内ルール・慣習' },
  { id: 'web-expert', label: 'Web専門', description: '論文・特許・専門情報' },
  { id: 'tacit-knowledge', label: '暗黙知', description: '経験・ノウハウ・人脈' },
];

// AI sophistication levels (horizontal axis)
const aiLevels = [
  { id: 'search', label: '検索・抽出', icon: Search },
  { id: 'summary', label: '要約・分析', icon: Brain },
  { id: 'inference', label: '推論・判断', icon: Lightbulb },
  { id: 'creation', label: '創造・実行', icon: PenTool },
];

// Use cases mapped to the matrix
type UseCase = {
  id: string;
  name: string;
  dataLevel: string;
  aiLevel: string;
  status: 'implemented' | 'mock' | 'future';
  description: string;
  why: string[];
  value: string;
};

const useCases: UseCase[] = [
  {
    id: 'paper-search',
    name: '論文検索・調査',
    dataLevel: 'web-expert',
    aiLevel: 'search',
    status: 'implemented',
    description: 'OpenAlex/arXiv/Semantic Scholarから論文を検索',
    why: ['この分野の全体像を把握したい', '見落としている重要な研究がないか確認したい'],
    value: '検索結果のリストではなく、対話を通じて「理解」に至る',
  },
  {
    id: 'field-understanding',
    name: '分野理解・要約',
    dataLevel: 'web-expert',
    aiLevel: 'summary',
    status: 'implemented',
    description: '論文群から分野の構造と動向を解釈',
    why: ['自分の研究がどの位置にあるか知りたい', '新しい研究テーマのヒントを得たい'],
    value: '断片的な情報から全体像を構築',
  },
  {
    id: 'expert-discovery',
    name: '専門家発見',
    dataLevel: 'tacit-knowledge',
    aiLevel: 'inference',
    status: 'implemented',
    description: '文脈から関連専門家を推定・提案',
    why: ['困ったとき相談できる人を見つけたい', '共同研究のパートナーを探したい'],
    value: '名前のリストではなく、アプローチの道筋を提案',
  },
  {
    id: 'report-generation',
    name: '報告書生成',
    dataLevel: 'web-expert',
    aiLevel: 'creation',
    status: 'implemented',
    description: '調査結果からインフォグラフィック形式のHTMLを生成',
    why: ['見やすい報告書を作りたい', '報告時間を削減したい'],
    value: '分析結果を即座に共有可能な形式に変換',
  },
  {
    id: 'positioning',
    name: 'ポジショニング分析',
    dataLevel: 'internal-structured',
    aiLevel: 'summary',
    status: 'mock',
    description: '比較対象と軸を動的に生成し可視化',
    why: ['競合との差別化ポイントを知りたい', '戦略的な研究計画を立てたい'],
    value: '定性的な比較を定量的に可視化',
  },
  {
    id: 'seeds-needs',
    name: 'シーズ・ニーズ',
    dataLevel: 'internal-structured',
    aiLevel: 'inference',
    status: 'mock',
    description: '技術シーズと市場ニーズのマッチング',
    why: ['研究成果の応用先を見つけたい', '市場ニーズに合った研究テーマを探したい'],
    value: '技術と市場の橋渡しを支援',
  },
  {
    id: 'internal-search',
    name: '社内ナレッジ検索',
    dataLevel: 'internal-unstructured',
    aiLevel: 'search',
    status: 'future',
    description: '過去のレポート・Slack・メールを横断検索',
    why: ['過去の類似研究を知りたい', '誰が何を知っているか把握したい'],
    value: '散在する情報を一元的にアクセス可能に',
  },
  {
    id: 'internal-expert',
    name: '社内専門家推薦',
    dataLevel: 'tacit-knowledge',
    aiLevel: 'inference',
    status: 'future',
    description: '社内の誰に相談すべきかを提案',
    why: ['社内で〇〇に詳しい人を知りたい', '適切な相談相手を見つけたい'],
    value: '組織内の知識ネットワークを可視化',
  },
  {
    id: 'approval-flow',
    name: '承認フロー提案',
    dataLevel: 'tacit-rules',
    aiLevel: 'inference',
    status: 'future',
    description: '社内の暗黙的なルールに基づく提案',
    why: ['うちの承認フローは？', '適切な手続きを知りたい'],
    value: '暗黙知を形式知に変換',
  },
  {
    id: 'llm-qa',
    name: '一般知識Q&A',
    dataLevel: 'llm',
    aiLevel: 'search',
    status: 'implemented',
    description: 'LLMの事前学習知識に基づく回答',
    why: ['基本的な概念を確認したい', '用語の意味を知りたい'],
    value: '即座に基礎知識を確認',
  },
  {
    id: 'llm-analysis',
    name: '概念分析',
    dataLevel: 'llm',
    aiLevel: 'summary',
    status: 'implemented',
    description: '複雑な概念の整理と説明',
    why: ['複雑な概念を整理したい', '関係性を理解したい'],
    value: '抽象的な情報を構造化',
  },
];

// Get position on grid
const getGridPosition = (dataLevel: string, aiLevel: string) => {
  const dataIndex = dataLevels.findIndex(d => d.id === dataLevel);
  const aiIndex = aiLevels.findIndex(a => a.id === aiLevel);
  return { row: dataLevels.length - 1 - dataIndex, col: aiIndex };
};

// Status colors
const statusColors = {
  implemented: 'bg-primary text-primary-foreground',
  mock: 'bg-amber-500/80 text-amber-50',
  future: 'bg-muted text-muted-foreground border border-dashed border-border',
};

const statusLabels = {
  implemented: '実装済み',
  mock: 'モック',
  future: '将来拡張',
};

export function ExtensibilityMatrix() {
  const [selectedUseCase, setSelectedUseCase] = useState<UseCase | null>(null);
  const [hoveredUseCase, setHoveredUseCase] = useState<UseCase | null>(null);

  const handleUseCaseClick = useCallback((useCase: UseCase) => {
    setSelectedUseCase(prev => prev?.id === useCase.id ? null : useCase);
  }, []);

  const closeDetail = useCallback(() => {
    setSelectedUseCase(null);
  }, []);

  return (
    <div className="max-w-7xl mx-auto px-3 sm:px-4 md:px-6 lg:px-8 py-6 sm:py-8 md:py-10">
      {/* Header */}
      <div className="text-center mb-6 sm:mb-8">
        <h2 className="text-lg sm:text-xl md:text-2xl font-bold text-foreground mb-2">
          拡張性マップ
        </h2>
        <p className="text-sm sm:text-base text-muted-foreground max-w-2xl mx-auto">
          このUIのまま、Agentを追加するだけでマップ上の空白が埋まっていく
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-[1fr_320px] gap-6">
        {/* Matrix */}
        <Card className="p-4 sm:p-6 overflow-x-auto">
          <div className="min-w-[500px]">
            {/* AI Axis Labels (top) */}
            <div className="grid grid-cols-[100px_repeat(4,1fr)] gap-1 mb-2">
              <div className="text-xs text-muted-foreground text-right pr-2 flex items-end justify-end pb-1">
                AI →
              </div>
              {aiLevels.map(level => (
                <div key={level.id} className="text-center">
                  <div className="flex items-center justify-center gap-1 text-xs sm:text-sm font-medium text-foreground">
                    <level.icon className="h-3 w-3 sm:h-4 sm:w-4 text-primary" />
                    <span className="hidden sm:inline">{level.label}</span>
                  </div>
                </div>
              ))}
            </div>

            {/* Grid */}
            <div className="relative">
              {/* Data Axis Label (left side) */}
              <div className="absolute -left-1 top-1/2 -translate-y-1/2 -rotate-90 text-xs text-muted-foreground whitespace-nowrap origin-center">
                Data ↑
              </div>

              {dataLevels.slice().reverse().map((dataLevel, rowIndex) => (
                <div key={dataLevel.id} className="grid grid-cols-[100px_repeat(4,1fr)] gap-1 mb-1">
                  {/* Data level label */}
                  <div className="text-xs text-right pr-2 flex items-center justify-end">
                    <span className="text-foreground font-medium">{dataLevel.label}</span>
                  </div>

                  {/* Cells */}
                  {aiLevels.map((aiLevel, colIndex) => {
                    const cellUseCases = useCases.filter(
                      uc => uc.dataLevel === dataLevel.id && uc.aiLevel === aiLevel.id
                    );

                    return (
                      <div
                        key={`${dataLevel.id}-${aiLevel.id}`}
                        className="relative aspect-square sm:aspect-[4/3] bg-accent/5 rounded-lg border border-border/30 flex items-center justify-center p-1"
                      >
                        {cellUseCases.length > 0 ? (
                          <div className="flex flex-wrap gap-1 justify-center">
                            {cellUseCases.map(useCase => (
                              <button
                                key={useCase.id}
                                onClick={() => handleUseCaseClick(useCase)}
                                onMouseEnter={() => setHoveredUseCase(useCase)}
                                onMouseLeave={() => setHoveredUseCase(null)}
                                className={cn(
                                  'w-6 h-6 sm:w-8 sm:h-8 rounded-full flex items-center justify-center',
                                  'transition-all duration-200 hover:scale-110 cursor-pointer',
                                  'text-[10px] sm:text-xs font-bold',
                                  statusColors[useCase.status],
                                  selectedUseCase?.id === useCase.id && 'ring-2 ring-primary ring-offset-2 ring-offset-background scale-110',
                                  useCase.status === 'future' && 'animate-pulse'
                                )}
                                aria-label={useCase.name}
                              >
                                {useCase.status === 'implemented' ? '●' : useCase.status === 'mock' ? '○' : '◌'}
                              </button>
                            ))}
                          </div>
                        ) : (
                          <div className="w-6 h-6 sm:w-8 sm:h-8 rounded-full border border-dashed border-border/50 opacity-30" />
                        )}
                      </div>
                    );
                  })}
                </div>
              ))}
            </div>

            {/* Legend */}
            <div className="flex flex-wrap items-center justify-center gap-4 mt-4 pt-4 border-t border-border/50">
              {Object.entries(statusLabels).map(([status, label]) => (
                <div key={status} className="flex items-center gap-2 text-xs sm:text-sm">
                  <span className={cn(
                    'w-4 h-4 rounded-full flex items-center justify-center text-[10px]',
                    statusColors[status as keyof typeof statusColors]
                  )}>
                    {status === 'implemented' ? '●' : status === 'mock' ? '○' : '◌'}
                  </span>
                  <span className="text-muted-foreground">{label}</span>
                </div>
              ))}
            </div>
          </div>
        </Card>

        {/* Detail Panel */}
        <Card className={cn(
          'p-4 sm:p-6 transition-all duration-300',
          selectedUseCase ? 'opacity-100' : 'opacity-60'
        )}>
          {selectedUseCase ? (
            <div className="space-y-4 animate-fade-in">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <span className={cn(
                      'px-2 py-0.5 rounded text-xs font-medium',
                      statusColors[selectedUseCase.status]
                    )}>
                      {statusLabels[selectedUseCase.status]}
                    </span>
                  </div>
                  <h3 className="text-lg font-bold text-foreground">
                    {selectedUseCase.name}
                  </h3>
                </div>
                <button
                  onClick={closeDetail}
                  className="p-1 rounded hover:bg-muted transition-colors"
                  aria-label="閉じる"
                >
                  <X className="h-4 w-4 text-muted-foreground" />
                </button>
              </div>

              <p className="text-sm text-muted-foreground">
                {selectedUseCase.description}
              </p>

              <div className="space-y-2">
                <h4 className="text-sm font-semibold text-foreground flex items-center gap-1">
                  <Sparkles className="h-3 w-3 text-primary" />
                  なぜこれが必要か？
                </h4>
                <ul className="space-y-1">
                  {selectedUseCase.why.map((reason, idx) => (
                    <li key={idx} className="text-sm text-muted-foreground flex items-start gap-2">
                      <span className="text-primary mt-0.5">•</span>
                      <span>「{reason}」</span>
                    </li>
                  ))}
                </ul>
              </div>

              <div className="p-3 bg-primary/5 rounded-lg border-l-2 border-primary">
                <p className="text-sm text-foreground font-medium">
                  {selectedUseCase.value}
                </p>
              </div>

              <div className="pt-2 border-t border-border/50 text-xs text-muted-foreground">
                <div className="flex items-center gap-4">
                  <span>Data: {dataLevels.find(d => d.id === selectedUseCase.dataLevel)?.label}</span>
                  <span>AI: {aiLevels.find(a => a.id === selectedUseCase.aiLevel)?.label}</span>
                </div>
              </div>
            </div>
          ) : (
            <div className="h-full flex flex-col items-center justify-center text-center py-8">
              <div className="w-12 h-12 rounded-full bg-muted flex items-center justify-center mb-3">
                <Search className="h-5 w-5 text-muted-foreground" />
              </div>
              <p className="text-sm text-muted-foreground">
                マップ上のポイントをクリックして<br />詳細を表示
              </p>
            </div>
          )}
        </Card>
      </div>

      {/* Hover Tooltip (mobile-friendly) */}
      {hoveredUseCase && !selectedUseCase && (
        <div className="fixed bottom-20 left-1/2 -translate-x-1/2 z-50 pointer-events-none">
          <Card className="px-3 py-2 shadow-lg animate-fade-in">
            <p className="text-sm font-medium text-foreground">{hoveredUseCase.name}</p>
            <p className="text-xs text-muted-foreground">{statusLabels[hoveredUseCase.status]}</p>
          </Card>
        </div>
      )}
    </div>
  );
}
