// Mock employee data for KnowWho feature
// Structure: CEO → 役員 → 部長 → 課長 → 一般

export interface Employee {
  employee_id: string;
  display_name: string;
  mail: string;
  job_title: string;
  department: string;
  manager_employee_id: string | null;
  // t-SNE用埋め込み座標
  embedding_x?: number;
  embedding_y?: number;
  // スキル・活動情報
  skills?: string[];
  recentActivity?: string;
  expertise_cluster?: string;
}

export const mockEmployees: Employee[] = [
  // CEO (Level 4)
  {
    employee_id: "E001",
    display_name: "山田 太郎",
    mail: "yamada.taro@company.com",
    job_title: "代表取締役CEO",
    department: "経営",
    manager_employee_id: null,
    embedding_x: 50,
    embedding_y: 8,
    skills: ["経営戦略", "M&A", "ビジョン策定"],
    recentActivity: "年度計画の策定と全社キックオフを主導",
    expertise_cluster: "経営",
  },

  // 役員 (Level 3)
  {
    employee_id: "E010",
    display_name: "佐藤 一郎",
    mail: "sato.ichiro@company.com",
    job_title: "執行役員 CTO",
    department: "技術本部",
    manager_employee_id: "E001",
    embedding_x: 45,
    embedding_y: 35,
    skills: ["技術戦略", "アーキテクチャ設計", "チームビルディング"],
    recentActivity: "AI技術ロードマップの策定を推進中",
    expertise_cluster: "LLM/生成AI",
  },
  {
    employee_id: "E011",
    display_name: "鈴木 花子",
    mail: "suzuki.hanako@company.com",
    job_title: "執行役員 CSO",
    department: "戦略本部",
    manager_employee_id: "E001",
    embedding_x: 55,
    embedding_y: 80,
    skills: ["事業戦略", "市場分析", "パートナーシップ"],
    recentActivity: "新規事業領域の探索と提携交渉を主導",
    expertise_cluster: "戦略/企画",
  },
  {
    employee_id: "E012",
    display_name: "高橋 健一",
    mail: "takahashi.kenichi@company.com",
    job_title: "執行役員 CFO",
    department: "管理本部",
    manager_employee_id: "E001",
  },

  // 部長 (Level 2)
  {
    employee_id: "E020",
    display_name: "田中 誠",
    mail: "tanaka.makoto@company.com",
    job_title: "研究開発部長",
    department: "研究開発部",
    manager_employee_id: "E010",
    embedding_x: 22,
    embedding_y: 28,
    skills: ["NLP", "論文執筆", "研究マネジメント", "学会発表"],
    recentActivity: "対話システムの研究プロジェクトを主査として統括",
    expertise_cluster: "NLP/自然言語",
  },
  {
    employee_id: "E021",
    display_name: "伊藤 美咲",
    mail: "ito.misaki@company.com",
    job_title: "AI推進部長",
    department: "AI推進部",
    manager_employee_id: "E010",
    embedding_x: 38,
    embedding_y: 52,
    skills: ["LLM", "生成AI", "プロダクト開発", "チームマネジメント"],
    recentActivity: "社内LLM基盤の全社展開を推進中",
    expertise_cluster: "LLM/生成AI",
  },
  {
    employee_id: "E022",
    display_name: "渡辺 剛",
    mail: "watanabe.tsuyoshi@company.com",
    job_title: "技術戦略室長",
    department: "技術戦略室",
    manager_employee_id: "E010",
    embedding_x: 60,
    embedding_y: 40,
    skills: ["技術調査", "トレンド分析", "レポート執筆"],
    recentActivity: "最新AI技術の調査レポートを作成中",
    expertise_cluster: "LLM/生成AI",
  },
  {
    employee_id: "E023",
    display_name: "小林 真理",
    mail: "kobayashi.mari@company.com",
    job_title: "企画部長",
    department: "企画部",
    manager_employee_id: "E011",
    embedding_x: 48,
    embedding_y: 88,
    skills: ["事業企画", "マーケット分析", "プレゼンテーション"],
    recentActivity: "新規AI事業の企画立案を主導",
    expertise_cluster: "戦略/企画",
  },
  {
    employee_id: "E024",
    display_name: "加藤 隆",
    mail: "kato.takashi@company.com",
    job_title: "事業開発部長",
    department: "事業開発部",
    manager_employee_id: "E011",
  },

  // 課長 (Level 1)
  {
    employee_id: "E030",
    display_name: "吉田 健太",
    mail: "yoshida.kenta@company.com",
    job_title: "NLP研究課長",
    department: "研究開発部",
    manager_employee_id: "E020",
    embedding_x: 18,
    embedding_y: 32,
    skills: ["NLP", "Transformers", "BERT", "対話システム"],
    recentActivity: "チャットボット精度向上プロジェクトを統括中",
    expertise_cluster: "NLP/自然言語",
  },
  {
    employee_id: "E031",
    display_name: "山本 愛",
    mail: "yamamoto.ai@company.com",
    job_title: "CV研究課長",
    department: "研究開発部",
    manager_employee_id: "E020",
    embedding_x: 78,
    embedding_y: 22,
    skills: ["画像認識", "CNN", "物体検出", "セグメンテーション"],
    recentActivity: "製造ライン向け画像検査AIの研究を主導",
    expertise_cluster: "CV/画像認識",
  },
  {
    employee_id: "E032",
    display_name: "中村 翔",
    mail: "nakamura.sho@company.com",
    job_title: "LLM推進課長",
    department: "AI推進部",
    manager_employee_id: "E021",
    embedding_x: 32,
    embedding_y: 58,
    skills: ["LLM", "プロンプトエンジニアリング", "RAG", "GPT"],
    recentActivity: "社内RAGシステムの本番運用を推進中",
    expertise_cluster: "LLM/生成AI",
  },
  {
    employee_id: "E033",
    display_name: "小川 裕子",
    mail: "ogawa.yuko@company.com",
    job_title: "MLOps課長",
    department: "AI推進部",
    manager_employee_id: "E021",
    embedding_x: 72,
    embedding_y: 68,
    skills: ["MLflow", "Kubernetes", "CI/CD", "モデル管理"],
    recentActivity: "ML基盤のGPUクラスタ拡張を計画中",
    expertise_cluster: "MLOps/基盤",
  },
  {
    employee_id: "E034",
    display_name: "藤田 大輔",
    mail: "fujita.daisuke@company.com",
    job_title: "技術調査課長",
    department: "技術戦略室",
    manager_employee_id: "E022",
    embedding_x: 55,
    embedding_y: 45,
    skills: ["技術調査", "ベンチマーク", "レポート執筆"],
    recentActivity: "競合AI製品の比較調査を実施中",
    expertise_cluster: "LLM/生成AI",
  },

  // 一般社員 (Level 0)
  {
    employee_id: "E100",
    display_name: "自分",
    mail: "me@company.com",
    job_title: "AIリサーチャー",
    department: "研究開発部",
    manager_employee_id: "E030",
    embedding_x: 25,
    embedding_y: 35,
    skills: ["NLP", "Python", "PyTorch", "論文調査"],
    recentActivity: "最新LLM論文のサーベイと社内共有を担当",
    expertise_cluster: "NLP/自然言語",
  },
  {
    employee_id: "E101",
    display_name: "松本 理沙",
    mail: "matsumoto.risa@company.com",
    job_title: "シニアリサーチャー",
    department: "研究開発部",
    manager_employee_id: "E030",
    embedding_x: 20,
    embedding_y: 38,
    skills: ["NLP", "言語モデル", "評価手法", "データ分析"],
    recentActivity: "新規言語モデルの評価ベンチマーク設計中",
    expertise_cluster: "NLP/自然言語",
  },
  {
    employee_id: "E102",
    display_name: "井上 拓也",
    mail: "inoue.takuya@company.com",
    job_title: "リサーチャー",
    department: "研究開発部",
    manager_employee_id: "E031",
    embedding_x: 80,
    embedding_y: 25,
    skills: ["画像認識", "OpenCV", "データ拡張", "アノテーション"],
    recentActivity: "画像データセットの構築と品質管理を担当",
    expertise_cluster: "CV/画像認識",
  },
  {
    employee_id: "E103",
    display_name: "木村 優太",
    mail: "kimura.yuta@company.com",
    job_title: "MLエンジニア",
    department: "AI推進部",
    manager_employee_id: "E032",
    embedding_x: 35,
    embedding_y: 62,
    skills: ["Python", "LangChain", "ベクトルDB", "API開発"],
    recentActivity: "RAGパイプラインの高速化を実装中",
    expertise_cluster: "LLM/生成AI",
  },
  {
    employee_id: "E104",
    display_name: "林 さくら",
    mail: "hayashi.sakura@company.com",
    job_title: "シニアMLエンジニア",
    department: "AI推進部",
    manager_employee_id: "E032",
    embedding_x: 30,
    embedding_y: 55,
    skills: ["PyTorch", "ファインチューニング", "モデル最適化", "量子化"],
    recentActivity: "社内LLMの推論最適化プロジェクトをリード中",
    expertise_cluster: "LLM/生成AI",
  },
  {
    employee_id: "E105",
    display_name: "清水 龍一",
    mail: "shimizu.ryuichi@company.com",
    job_title: "MLOpsエンジニア",
    department: "AI推進部",
    manager_employee_id: "E033",
    embedding_x: 68,
    embedding_y: 72,
    skills: ["Docker", "Kubernetes", "Terraform", "監視運用"],
    recentActivity: "GPU基盤の自動スケーリング機能を構築中",
    expertise_cluster: "MLOps/基盤",
  },
  {
    employee_id: "E106",
    display_name: "森 真由美",
    mail: "mori.mayumi@company.com",
    job_title: "テックリサーチャー",
    department: "技術戦略室",
    manager_employee_id: "E034",
    embedding_x: 52,
    embedding_y: 48,
    skills: ["技術調査", "プレゼンテーション", "レポート執筆"],
    recentActivity: "AIスタートアップの動向調査レポートを作成中",
    expertise_cluster: "LLM/生成AI",
  },
  {
    employee_id: "E107",
    display_name: "池田 光",
    mail: "ikeda.hikaru@company.com",
    job_title: "ストラテジスト",
    department: "企画部",
    manager_employee_id: "E023",
    embedding_x: 45,
    embedding_y: 85,
    skills: ["市場分析", "競合調査", "事業計画"],
    recentActivity: "AI市場のトレンド分析と事業機会の調査を担当",
    expertise_cluster: "戦略/企画",
  },
  {
    employee_id: "E108",
    display_name: "橋本 和也",
    mail: "hashimoto.kazuya@company.com",
    job_title: "ビジネスデベロッパー",
    department: "事業開発部",
    manager_employee_id: "E024",
    embedding_x: 58,
    embedding_y: 90,
    skills: ["パートナーシップ", "交渉", "契約管理"],
    recentActivity: "大手企業とのAI共同開発の提携交渉を推進中",
    expertise_cluster: "戦略/企画",
  },
  {
    employee_id: "E109",
    display_name: "石井 美穂",
    mail: "ishii.miho@company.com",
    job_title: "プロンプトエンジニア",
    department: "AI推進部",
    manager_employee_id: "E032",
    embedding_x: 28,
    embedding_y: 60,
    skills: ["プロンプト設計", "LLM評価", "ユーザーテスト"],
    recentActivity: "社内AIアシスタントのプロンプト最適化を担当",
    expertise_cluster: "LLM/生成AI",
  },
  {
    employee_id: "E110",
    display_name: "前田 拓海",
    mail: "maeda.takumi@company.com",
    job_title: "データサイエンティスト",
    department: "研究開発部",
    manager_employee_id: "E031",
    embedding_x: 75,
    embedding_y: 28,
    skills: ["データ分析", "統計", "可視化", "機械学習"],
    recentActivity: "画像認識モデルの性能分析ダッシュボードを開発中",
    expertise_cluster: "CV/画像認識",
  },
  // ===== 追加のモック従業員（デモ用に人数を増やす） =====
  
  // NLP/自然言語クラスタ追加メンバー
  {
    employee_id: "E201",
    display_name: "佐々木 翔太",
    mail: "sasaki.shota@company.com",
    job_title: "NLPリサーチャー",
    department: "研究開発部",
    manager_employee_id: "E030",
    embedding_x: 15,
    embedding_y: 28,
    skills: ["形態素解析", "固有表現抽出", "BERT"],
    recentActivity: "日本語BERTモデルの改良を担当",
    expertise_cluster: "NLP/自然言語",
  },
  {
    employee_id: "E202",
    display_name: "安藤 萌",
    mail: "ando.moe@company.com",
    job_title: "言語学スペシャリスト",
    department: "研究開発部",
    manager_employee_id: "E030",
    embedding_x: 22,
    embedding_y: 22,
    skills: ["言語学", "コーパス構築", "アノテーション"],
    recentActivity: "対話コーパスの設計と品質管理",
    expertise_cluster: "NLP/自然言語",
  },
  {
    employee_id: "E203",
    display_name: "村田 健",
    mail: "murata.ken@company.com",
    job_title: "対話システムエンジニア",
    department: "研究開発部",
    manager_employee_id: "E030",
    embedding_x: 18,
    embedding_y: 35,
    skills: ["対話管理", "意図分類", "スロットフィリング"],
    recentActivity: "カスタマーサポートボットの開発",
    expertise_cluster: "NLP/自然言語",
  },
  {
    employee_id: "E204",
    display_name: "岡田 理恵",
    mail: "okada.rie@company.com",
    job_title: "テキストマイニングエンジニア",
    department: "研究開発部",
    manager_employee_id: "E030",
    embedding_x: 25,
    embedding_y: 25,
    skills: ["感情分析", "トピックモデル", "要約生成"],
    recentActivity: "SNS分析ダッシュボードの開発",
    expertise_cluster: "NLP/自然言語",
  },
  {
    employee_id: "E205",
    display_name: "長谷川 直樹",
    mail: "hasegawa.naoki@company.com",
    job_title: "機械翻訳エンジニア",
    department: "研究開発部",
    manager_employee_id: "E030",
    embedding_x: 12,
    embedding_y: 30,
    skills: ["機械翻訳", "Transformer", "多言語モデル"],
    recentActivity: "社内文書の多言語翻訳システムを構築",
    expertise_cluster: "NLP/自然言語",
  },
  
  // CV/画像認識クラスタ追加メンバー
  {
    employee_id: "E211",
    display_name: "斎藤 陽子",
    mail: "saito.yoko@company.com",
    job_title: "画像認識エンジニア",
    department: "研究開発部",
    manager_employee_id: "E031",
    embedding_x: 72,
    embedding_y: 18,
    skills: ["物体検出", "YOLO", "画像分類"],
    recentActivity: "リアルタイム物体検出の最適化",
    expertise_cluster: "CV/画像認識",
  },
  {
    employee_id: "E212",
    display_name: "川口 大地",
    mail: "kawaguchi.daichi@company.com",
    job_title: "3Dビジョンエンジニア",
    department: "研究開発部",
    manager_employee_id: "E031",
    embedding_x: 82,
    embedding_y: 15,
    skills: ["点群処理", "3D再構成", "深度推定"],
    recentActivity: "工場向け3D検査システムの開発",
    expertise_cluster: "CV/画像認識",
  },
  {
    employee_id: "E213",
    display_name: "上田 麻衣",
    mail: "ueda.mai@company.com",
    job_title: "医療画像AIエンジニア",
    department: "研究開発部",
    manager_employee_id: "E031",
    embedding_x: 78,
    embedding_y: 30,
    skills: ["医療画像", "セグメンテーション", "診断支援"],
    recentActivity: "CT画像の異常検出モデルを研究",
    expertise_cluster: "CV/画像認識",
  },
  {
    employee_id: "E214",
    display_name: "野村 恵介",
    mail: "nomura.keisuke@company.com",
    job_title: "動画解析エンジニア",
    department: "研究開発部",
    manager_employee_id: "E031",
    embedding_x: 85,
    embedding_y: 22,
    skills: ["動画解析", "行動認識", "トラッキング"],
    recentActivity: "防犯カメラの行動検知システム開発",
    expertise_cluster: "CV/画像認識",
  },
  {
    employee_id: "E215",
    display_name: "福島 真央",
    mail: "fukushima.mao@company.com",
    job_title: "OCRエンジニア",
    department: "研究開発部",
    manager_employee_id: "E031",
    embedding_x: 70,
    embedding_y: 25,
    skills: ["OCR", "文書解析", "レイアウト認識"],
    recentActivity: "手書き文字認識の精度向上を担当",
    expertise_cluster: "CV/画像認識",
  },
  {
    employee_id: "E216",
    display_name: "宮本 亮太",
    mail: "miyamoto.ryota@company.com",
    job_title: "生成画像エンジニア",
    department: "研究開発部",
    manager_employee_id: "E031",
    embedding_x: 75,
    embedding_y: 32,
    skills: ["画像生成", "Stable Diffusion", "GAN"],
    recentActivity: "商品画像自動生成システムの開発",
    expertise_cluster: "CV/画像認識",
  },
  
  // LLM/生成AIクラスタ追加メンバー
  {
    employee_id: "E221",
    display_name: "西田 優",
    mail: "nishida.yu@company.com",
    job_title: "LLMエンジニア",
    department: "AI推進部",
    manager_employee_id: "E032",
    embedding_x: 38,
    embedding_y: 55,
    skills: ["LLM", "Claude", "GPT-4", "API設計"],
    recentActivity: "社内LLMゲートウェイの構築",
    expertise_cluster: "LLM/生成AI",
  },
  {
    employee_id: "E222",
    display_name: "藤原 彩香",
    mail: "fujiwara.ayaka@company.com",
    job_title: "RAGエンジニア",
    department: "AI推進部",
    manager_employee_id: "E032",
    embedding_x: 32,
    embedding_y: 52,
    skills: ["RAG", "ベクトルDB", "Pinecone", "埋め込み"],
    recentActivity: "ナレッジベース検索の高度化",
    expertise_cluster: "LLM/生成AI",
  },
  {
    employee_id: "E223",
    display_name: "内田 康介",
    mail: "uchida.kosuke@company.com",
    job_title: "ファインチューニングエンジニア",
    department: "AI推進部",
    manager_employee_id: "E032",
    embedding_x: 28,
    embedding_y: 58,
    skills: ["ファインチューニング", "LoRA", "PEFT"],
    recentActivity: "ドメイン特化LLMの学習を担当",
    expertise_cluster: "LLM/生成AI",
  },
  {
    employee_id: "E224",
    display_name: "三浦 香織",
    mail: "miura.kaori@company.com",
    job_title: "AIプロダクトマネージャー",
    department: "AI推進部",
    manager_employee_id: "E021",
    embedding_x: 42,
    embedding_y: 48,
    skills: ["プロダクト管理", "要件定義", "ユーザーリサーチ"],
    recentActivity: "社内AIアシスタントのロードマップ策定",
    expertise_cluster: "LLM/生成AI",
  },
  {
    employee_id: "E225",
    display_name: "原田 誠一",
    mail: "harada.seiichi@company.com",
    job_title: "LLM評価エンジニア",
    department: "AI推進部",
    manager_employee_id: "E032",
    embedding_x: 35,
    embedding_y: 50,
    skills: ["LLM評価", "ベンチマーク", "品質管理"],
    recentActivity: "LLM出力品質の自動評価システムを開発",
    expertise_cluster: "LLM/生成AI",
  },
  {
    employee_id: "E226",
    display_name: "菊地 美咲",
    mail: "kikuchi.misaki@company.com",
    job_title: "コンテンツ生成エンジニア",
    department: "AI推進部",
    manager_employee_id: "E032",
    embedding_x: 40,
    embedding_y: 60,
    skills: ["コンテンツ生成", "コピーライティングAI", "マーケ支援"],
    recentActivity: "マーケティング文章自動生成ツールの開発",
    expertise_cluster: "LLM/生成AI",
  },
  {
    employee_id: "E227",
    display_name: "遠藤 大輝",
    mail: "endo.daiki@company.com",
    job_title: "エージェントエンジニア",
    department: "AI推進部",
    manager_employee_id: "E032",
    embedding_x: 30,
    embedding_y: 65,
    skills: ["AIエージェント", "LangChain", "ツール連携"],
    recentActivity: "マルチエージェントシステムの研究開発",
    expertise_cluster: "LLM/生成AI",
  },
  {
    employee_id: "E228",
    display_name: "久保田 愛",
    mail: "kubota.ai@company.com",
    job_title: "音声AIエンジニア",
    department: "AI推進部",
    manager_employee_id: "E021",
    embedding_x: 45,
    embedding_y: 55,
    skills: ["音声認識", "音声合成", "Whisper", "TTS"],
    recentActivity: "社内会議の自動文字起こしシステムを開発",
    expertise_cluster: "LLM/生成AI",
  },
  
  // MLOps/基盤クラスタ追加メンバー
  {
    employee_id: "E231",
    display_name: "坂本 健太郎",
    mail: "sakamoto.kentaro@company.com",
    job_title: "MLプラットフォームエンジニア",
    department: "AI推進部",
    manager_employee_id: "E033",
    embedding_x: 65,
    embedding_y: 70,
    skills: ["Kubeflow", "MLプラットフォーム", "ワークフロー管理"],
    recentActivity: "ML実験管理基盤の構築",
    expertise_cluster: "MLOps/基盤",
  },
  {
    employee_id: "E232",
    display_name: "今井 裕子",
    mail: "imai.yuko@company.com",
    job_title: "GPUインフラエンジニア",
    department: "AI推進部",
    manager_employee_id: "E033",
    embedding_x: 75,
    embedding_y: 65,
    skills: ["GPU", "CUDA", "クラスタ管理", "コスト最適化"],
    recentActivity: "GPUリソース予約システムの開発",
    expertise_cluster: "MLOps/基盤",
  },
  {
    employee_id: "E233",
    display_name: "中島 勇気",
    mail: "nakajima.yuki@company.com",
    job_title: "モデルデプロイエンジニア",
    department: "AI推進部",
    manager_employee_id: "E033",
    embedding_x: 70,
    embedding_y: 75,
    skills: ["モデルサービング", "TensorRT", "ONNX", "推論最適化"],
    recentActivity: "本番環境向け推論サーバーの運用",
    expertise_cluster: "MLOps/基盤",
  },
  {
    employee_id: "E234",
    display_name: "松田 彩",
    mail: "matsuda.aya@company.com",
    job_title: "データパイプラインエンジニア",
    department: "AI推進部",
    manager_employee_id: "E033",
    embedding_x: 68,
    embedding_y: 62,
    skills: ["Airflow", "データパイプライン", "ETL", "Spark"],
    recentActivity: "学習データパイプラインの自動化",
    expertise_cluster: "MLOps/基盤",
  },
  {
    employee_id: "E235",
    display_name: "大野 翔平",
    mail: "ono.shohei@company.com",
    job_title: "ML監視エンジニア",
    department: "AI推進部",
    manager_employee_id: "E033",
    embedding_x: 72,
    embedding_y: 68,
    skills: ["モデル監視", "ドリフト検出", "アラート設計"],
    recentActivity: "本番モデルの性能監視ダッシュボードを構築",
    expertise_cluster: "MLOps/基盤",
  },
  {
    employee_id: "E236",
    display_name: "吉川 舞",
    mail: "yoshikawa.mai@company.com",
    job_title: "フィーチャーストアエンジニア",
    department: "AI推進部",
    manager_employee_id: "E033",
    embedding_x: 65,
    embedding_y: 75,
    skills: ["フィーチャーストア", "Feast", "特徴量管理"],
    recentActivity: "全社共通フィーチャーストアの設計",
    expertise_cluster: "MLOps/基盤",
  },
  
  // 戦略/企画クラスタ追加メンバー
  {
    employee_id: "E241",
    display_name: "永井 健司",
    mail: "nagai.kenji@company.com",
    job_title: "AI事業企画",
    department: "企画部",
    manager_employee_id: "E023",
    embedding_x: 52,
    embedding_y: 82,
    skills: ["事業企画", "ROI分析", "ビジネスケース"],
    recentActivity: "AI導入のROI算定フレームワークを策定",
    expertise_cluster: "戦略/企画",
  },
  {
    employee_id: "E242",
    display_name: "田村 沙織",
    mail: "tamura.saori@company.com",
    job_title: "マーケットアナリスト",
    department: "企画部",
    manager_employee_id: "E023",
    embedding_x: 48,
    embedding_y: 90,
    skills: ["市場調査", "競合分析", "トレンド予測"],
    recentActivity: "生成AI市場の競合レポートを作成",
    expertise_cluster: "戦略/企画",
  },
  {
    employee_id: "E243",
    display_name: "相田 洋介",
    mail: "aida.yosuke@company.com",
    job_title: "パートナーシップマネージャー",
    department: "事業開発部",
    manager_employee_id: "E024",
    embedding_x: 55,
    embedding_y: 88,
    skills: ["アライアンス", "契約交渉", "パートナー管理"],
    recentActivity: "テック企業との戦略提携を推進",
    expertise_cluster: "戦略/企画",
  },
  {
    employee_id: "E244",
    display_name: "島田 美穂",
    mail: "shimada.miho@company.com",
    job_title: "AI倫理スペシャリスト",
    department: "企画部",
    manager_employee_id: "E023",
    embedding_x: 50,
    embedding_y: 78,
    skills: ["AI倫理", "ガバナンス", "リスク管理"],
    recentActivity: "AI利用ガイドラインの策定を主導",
    expertise_cluster: "戦略/企画",
  },
  {
    employee_id: "E245",
    display_name: "水野 拓也",
    mail: "mizuno.takuya@company.com",
    job_title: "DX推進担当",
    department: "事業開発部",
    manager_employee_id: "E024",
    embedding_x: 60,
    embedding_y: 85,
    skills: ["DX戦略", "業務改革", "チェンジマネジメント"],
    recentActivity: "社内業務のAI活用促進プロジェクトを推進",
    expertise_cluster: "戦略/企画",
  },
  
  // クロスファンクショナル（複数領域にまたがる人材）
  {
    employee_id: "E251",
    display_name: "黒田 将人",
    mail: "kuroda.masato@company.com",
    job_title: "フルスタックMLエンジニア",
    department: "AI推進部",
    manager_employee_id: "E021",
    embedding_x: 50,
    embedding_y: 55,
    skills: ["フルスタック", "API開発", "フロントエンド", "ML"],
    recentActivity: "社内AIツールのUI/UX改善を担当",
    expertise_cluster: "LLM/生成AI",
  },
  {
    employee_id: "E252",
    display_name: "増田 あかり",
    mail: "masuda.akari@company.com",
    job_title: "リサーチエンジニア",
    department: "研究開発部",
    manager_employee_id: "E020",
    embedding_x: 30,
    embedding_y: 40,
    skills: ["研究開発", "論文実装", "プロトタイプ"],
    recentActivity: "最新論文の社内実装と検証を担当",
    expertise_cluster: "NLP/自然言語",
  },
  {
    employee_id: "E253",
    display_name: "河野 健一",
    mail: "kono.kenichi@company.com",
    job_title: "シニアアーキテクト",
    department: "技術戦略室",
    manager_employee_id: "E022",
    embedding_x: 55,
    embedding_y: 50,
    skills: ["システム設計", "アーキテクチャ", "技術選定"],
    recentActivity: "次世代AIプラットフォームの設計を主導",
    expertise_cluster: "LLM/生成AI",
  },
  {
    employee_id: "E254",
    display_name: "平野 結衣",
    mail: "hirano.yui@company.com",
    job_title: "AIトレーナー",
    department: "AI推進部",
    manager_employee_id: "E021",
    embedding_x: 45,
    embedding_y: 65,
    skills: ["AI教育", "ワークショップ", "ハンズオン"],
    recentActivity: "社内AI活用研修プログラムの企画運営",
    expertise_cluster: "LLM/生成AI",
  },
  {
    employee_id: "E255",
    display_name: "丸山 智也",
    mail: "maruyama.tomoya@company.com",
    job_title: "セキュリティエンジニア",
    department: "技術戦略室",
    manager_employee_id: "E022",
    embedding_x: 62,
    embedding_y: 58,
    skills: ["AIセキュリティ", "脆弱性診断", "プライバシー"],
    recentActivity: "LLMセキュリティガイドラインの策定",
    expertise_cluster: "MLOps/基盤",
  },
  
  // さらに追加（密度を上げる）
  {
    employee_id: "E261",
    display_name: "新井 貴之",
    mail: "arai.takayuki@company.com",
    job_title: "ジュニアMLエンジニア",
    department: "AI推進部",
    manager_employee_id: "E032",
    embedding_x: 36,
    embedding_y: 58,
    skills: ["Python", "scikit-learn", "データ前処理"],
    expertise_cluster: "LLM/生成AI",
  },
  {
    employee_id: "E262",
    display_name: "太田 真理子",
    mail: "ota.mariko@company.com",
    job_title: "データアナリスト",
    department: "研究開発部",
    manager_employee_id: "E020",
    embedding_x: 28,
    embedding_y: 32,
    skills: ["データ分析", "SQL", "Tableau"],
    expertise_cluster: "NLP/自然言語",
  },
  {
    employee_id: "E263",
    display_name: "須藤 悠太",
    mail: "sudo.yuta@company.com",
    job_title: "インフラエンジニア",
    department: "AI推進部",
    manager_employee_id: "E033",
    embedding_x: 78,
    embedding_y: 70,
    skills: ["AWS", "クラウド", "ネットワーク"],
    expertise_cluster: "MLOps/基盤",
  },
  {
    employee_id: "E264",
    display_name: "関根 美優",
    mail: "sekine.miyu@company.com",
    job_title: "UIデザイナー",
    department: "AI推進部",
    manager_employee_id: "E021",
    embedding_x: 48,
    embedding_y: 45,
    skills: ["UI/UX", "Figma", "プロトタイピング"],
    expertise_cluster: "LLM/生成AI",
  },
  {
    employee_id: "E265",
    display_name: "北村 大樹",
    mail: "kitamura.daiki@company.com",
    job_title: "バックエンドエンジニア",
    department: "AI推進部",
    manager_employee_id: "E032",
    embedding_x: 40,
    embedding_y: 52,
    skills: ["Go", "gRPC", "マイクロサービス"],
    expertise_cluster: "LLM/生成AI",
  },
  {
    employee_id: "E266",
    display_name: "古賀 真帆",
    mail: "koga.maho@company.com",
    job_title: "QAエンジニア",
    department: "AI推進部",
    manager_employee_id: "E021",
    embedding_x: 42,
    embedding_y: 58,
    skills: ["テスト自動化", "品質保証", "CI/CD"],
    expertise_cluster: "LLM/生成AI",
  },
  {
    employee_id: "E267",
    display_name: "金子 翔",
    mail: "kaneko.sho@company.com",
    job_title: "画像処理エンジニア",
    department: "研究開発部",
    manager_employee_id: "E031",
    embedding_x: 80,
    embedding_y: 20,
    skills: ["OpenCV", "画像処理", "エッジAI"],
    expertise_cluster: "CV/画像認識",
  },
  {
    employee_id: "E268",
    display_name: "竹内 沙也加",
    mail: "takeuchi.sayaka@company.com",
    job_title: "アノテーター",
    department: "研究開発部",
    manager_employee_id: "E031",
    embedding_x: 72,
    embedding_y: 28,
    skills: ["データラベリング", "品質管理", "ガイドライン作成"],
    expertise_cluster: "CV/画像認識",
  },
  {
    employee_id: "E269",
    display_name: "飯田 隆史",
    mail: "iida.takashi@company.com",
    job_title: "シニアNLPエンジニア",
    department: "研究開発部",
    manager_employee_id: "E030",
    embedding_x: 20,
    embedding_y: 30,
    skills: ["NLP", "spaCy", "知識グラフ"],
    expertise_cluster: "NLP/自然言語",
  },
  {
    employee_id: "E270",
    display_name: "本田 千尋",
    mail: "honda.chihiro@company.com",
    job_title: "データエンジニア",
    department: "AI推進部",
    manager_employee_id: "E033",
    embedding_x: 68,
    embedding_y: 65,
    skills: ["BigQuery", "dbt", "データモデリング"],
    expertise_cluster: "MLOps/基盤",
  },
  {
    employee_id: "E271",
    display_name: "浅野 雄介",
    mail: "asano.yusuke@company.com",
    job_title: "AIコンサルタント",
    department: "事業開発部",
    manager_employee_id: "E024",
    embedding_x: 55,
    embedding_y: 82,
    skills: ["コンサルティング", "要件定義", "顧客折衝"],
    expertise_cluster: "戦略/企画",
  },
  {
    employee_id: "E272",
    display_name: "樋口 奈々",
    mail: "higuchi.nana@company.com",
    job_title: "テクニカルライター",
    department: "技術戦略室",
    manager_employee_id: "E034",
    embedding_x: 50,
    embedding_y: 42,
    skills: ["テクニカルライティング", "ドキュメント", "API仕様"],
    expertise_cluster: "LLM/生成AI",
  },
  {
    employee_id: "E273",
    display_name: "萩原 拓海",
    mail: "hagiwara.takumi@company.com",
    job_title: "MLリサーチャー",
    department: "研究開発部",
    manager_employee_id: "E020",
    embedding_x: 25,
    embedding_y: 38,
    skills: ["強化学習", "最適化", "シミュレーション"],
    expertise_cluster: "NLP/自然言語",
  },
  {
    employee_id: "E274",
    display_name: "土井 恵理",
    mail: "doi.eri@company.com",
    job_title: "プロダクトデザイナー",
    department: "AI推進部",
    manager_employee_id: "E021",
    embedding_x: 46,
    embedding_y: 50,
    skills: ["プロダクトデザイン", "ユーザビリティ", "A/Bテスト"],
    expertise_cluster: "LLM/生成AI",
  },
  {
    employee_id: "E275",
    display_name: "岩田 圭介",
    mail: "iwata.keisuke@company.com",
    job_title: "SREエンジニア",
    department: "AI推進部",
    manager_employee_id: "E033",
    embedding_x: 75,
    embedding_y: 72,
    skills: ["SRE", "可観測性", "インシデント対応"],
    expertise_cluster: "MLOps/基盤",
  },
  {
    employee_id: "E276",
    display_name: "近藤 麻衣",
    mail: "kondo.mai@company.com",
    job_title: "ビジネスアナリスト",
    department: "企画部",
    manager_employee_id: "E023",
    embedding_x: 52,
    embedding_y: 85,
    skills: ["ビジネス分析", "KPI設計", "レポーティング"],
    expertise_cluster: "戦略/企画",
  },
  {
    employee_id: "E277",
    display_name: "星野 大輔",
    mail: "hoshino.daisuke@company.com",
    job_title: "エンベデッドMLエンジニア",
    department: "研究開発部",
    manager_employee_id: "E031",
    embedding_x: 82,
    embedding_y: 25,
    skills: ["エッジAI", "TensorFlow Lite", "組み込み"],
    expertise_cluster: "CV/画像認識",
  },
  {
    employee_id: "E278",
    display_name: "工藤 真紀",
    mail: "kudo.maki@company.com",
    job_title: "コーパスエンジニア",
    department: "研究開発部",
    manager_employee_id: "E030",
    embedding_x: 18,
    embedding_y: 25,
    skills: ["コーパス構築", "データ収集", "クレンジング"],
    expertise_cluster: "NLP/自然言語",
  },
  {
    employee_id: "E279",
    display_name: "石川 悠馬",
    mail: "ishikawa.yuma@company.com",
    job_title: "MLプロダクトマネージャー",
    department: "AI推進部",
    manager_employee_id: "E021",
    embedding_x: 44,
    embedding_y: 52,
    skills: ["プロダクト戦略", "ロードマップ", "ステークホルダー管理"],
    expertise_cluster: "LLM/生成AI",
  },
  {
    employee_id: "E280",
    display_name: "杉本 彩乃",
    mail: "sugimoto.ayano@company.com",
    job_title: "AI法務担当",
    department: "企画部",
    manager_employee_id: "E023",
    embedding_x: 48,
    embedding_y: 75,
    skills: ["AI規制", "著作権", "契約法務"],
    expertise_cluster: "戦略/企画",
  },
];

// 現在のユーザー（自分）のID
export const CURRENT_USER_ID = "E100";

// 従業員をIDで検索
export function getEmployeeById(id: string): Employee | undefined {
  return mockEmployees.find((e) => e.employee_id === id);
}

// 祖先リストを取得（自分 → 上司 → ... → CEO）
export function getAncestors(employeeId: string): Employee[] {
  const ancestors: Employee[] = [];
  let currentId: string | null = employeeId;

  while (currentId) {
    const employee = getEmployeeById(currentId);
    if (!employee) break;
    ancestors.push(employee);
    currentId = employee.manager_employee_id;
  }

  return ancestors;
}

// LCA（最小共通祖先）を見つけて経路を返す
export function findPathBetween(
  fromId: string,
  toId: string
): {
  lca: Employee | null;
  pathFromMe: Employee[];
  pathToTarget: Employee[];
  fullPath: Employee[];
  distance: number;
} {
  const myAncestors = getAncestors(fromId);
  const myAncestorSet = new Set(myAncestors.map((e) => e.employee_id));

  const targetAncestors = getAncestors(toId);

  // ターゲットの祖先をたどって、自分の祖先と交わる点（LCA）を探す
  let lca: Employee | null = null;
  let lcaIndexInTarget = -1;

  for (let i = 0; i < targetAncestors.length; i++) {
    if (myAncestorSet.has(targetAncestors[i].employee_id)) {
      lca = targetAncestors[i];
      lcaIndexInTarget = i;
      break;
    }
  }

  if (!lca) {
    return {
      lca: null,
      pathFromMe: myAncestors,
      pathToTarget: targetAncestors,
      fullPath: [],
      distance: -1,
    };
  }

  const lcaIndexInMe = myAncestors.findIndex(
    (e) => e.employee_id === lca!.employee_id
  );

  // 経路: fromId → ... → LCA → ... → toId
  const pathFromMe = myAncestors.slice(0, lcaIndexInMe + 1);
  const pathToTarget = targetAncestors.slice(0, lcaIndexInTarget).reverse();
  const fullPath = [...pathFromMe, ...pathToTarget];

  return {
    lca,
    pathFromMe,
    pathToTarget,
    fullPath,
    distance: pathFromMe.length + pathToTarget.length - 1,
  };
}

// approachabilityを判定
export function calculateApproachability(
  fromId: string,
  toId: string
): "direct" | "introduction" | "via_manager" {
  const from = getEmployeeById(fromId);
  const to = getEmployeeById(toId);

  if (!from || !to) return "via_manager";

  const { distance } = findPathBetween(fromId, toId);

  // 同じ部署 → direct
  if (from.department === to.department) return "direct";

  // 経路が2以下 → direct
  if (distance <= 2) return "direct";

  // 経路が4以下 → introduction
  if (distance <= 4) return "introduction";

  // それ以外 → via_manager
  return "via_manager";
}

// 経路を文字列で表現
export function formatConnectionPath(fromId: string, toId: string): string {
  const { fullPath } = findPathBetween(fromId, toId);

  if (fullPath.length === 0) return "";

  return fullPath.map((e) => e.display_name).join(" → ");
}

// 部署で従業員を検索
export function searchByDepartment(department: string): Employee[] {
  return mockEmployees.filter((e) =>
    e.department.toLowerCase().includes(department.toLowerCase())
  );
}

// 職種で従業員を検索
export function searchByJobTitle(keyword: string): Employee[] {
  return mockEmployees.filter((e) =>
    e.job_title.toLowerCase().includes(keyword.toLowerCase())
  );
}

// キーワードで従業員を検索（部署・職種・名前）
export function searchEmployees(query: string): Employee[] {
  const lowerQuery = query.toLowerCase();
  return mockEmployees.filter(
    (e) =>
      e.display_name.toLowerCase().includes(lowerQuery) ||
      e.department.toLowerCase().includes(lowerQuery) ||
      e.job_title.toLowerCase().includes(lowerQuery)
  );
}
