export type ToolId = 
  | "wide-knowledge" 
  | "knowwho" 
  | "positioning-analysis" 
  | "seeds-needs-matching" 
  | "html-generation"
  | "deep-file-search";

export interface ToolConfig {
  id: ToolId;
  name: string;
  description: string;
  defaultEnabled: boolean;
  isDeepDiveOnly?: boolean;
}

export const TOOL_DEFINITIONS: ToolConfig[] = [
  { 
    id: "wide-knowledge", 
    name: "ワイドナレッジ検索", 
    description: "幅広い知識ベースから検索", 
    defaultEnabled: true 
  },
  { 
    id: "knowwho", 
    name: "KnowWho検索", 
    description: "専門家・研究者を検索", 
    defaultEnabled: true 
  },
  { 
    id: "positioning-analysis", 
    name: "ポジショニング分析", 
    description: "比較検討軸でビジュアル分析", 
    defaultEnabled: false 
  },
  { 
    id: "seeds-needs-matching", 
    name: "シーズ・ニーズマッチング", 
    description: "研究シーズとニーズ候補を評価", 
    defaultEnabled: false 
  },
  { 
    id: "html-generation", 
    name: "HTML資料生成", 
    description: "会話内容をインフォグラフィックス化", 
    defaultEnabled: false 
  },
  { 
    id: "deep-file-search", 
    name: "DeepFileSearch", 
    description: "論文の仮想データフォルダから関連資料を検索", 
    defaultEnabled: true,
    isDeepDiveOnly: true
  },
];
