# Research Hub Backend

FastAPI backend for Research Hub application.

## Setup

```bash
cd backend

# Create virtual environment
python -m venv venv

# Activate virtual environment
# Windows:
venv\Scripts\activate
# macOS/Linux:
source venv/bin/activate

# Install dependencies
pip install -r requirements.txt
```

## Environment Variables

Create a `.env` file in the project root with:

### 必須設定

```env
# LLM API設定
LLM_BASE_URL=https://your-llm-api-endpoint.com
LLM_API_KEY=your-api-key
LLM_MODEL=vertex_ai.gemini-2.5-flash

# OpenSearch設定
OPENSEARCH_URL=https://your-opensearch:9200
OPENSEARCH_USERNAME=admin
OPENSEARCH_PASSWORD=your-password

# エンベディングAPI設定
EMBEDDING_API_URL=https://your-embedding-api.com
EMBEDDING_API_KEY=your-api-key
EMBEDDING_MODEL=text-embedding-3-large
```

### 検索重み設定（オプション）

```env
# 各検索方法の重み（相対比率、合計100である必要なし）
SEARCH_ABSTRACT_TEXT_WEIGHT=0       # 要約テキスト検索（BM25）
SEARCH_ABSTRACT_VECTOR_WEIGHT=40    # 要約ベクトル検索（KNN）
SEARCH_TAGS_TEXT_WEIGHT=0           # タグテキスト検索
SEARCH_TAGS_VECTOR_WEIGHT=30        # タグベクトル検索（KNN）
SEARCH_PROPER_NOUNS_TEXT_WEIGHT=0   # 固有名詞テキスト検索
SEARCH_PROPER_NOUNS_VECTOR_WEIGHT=30 # 固有名詞ベクトル検索（KNN）
```

### 検索結果件数設定（オプション）

```env
SEARCH_OIPF_SUMMARY_LIMIT=3   # 研究プロジェクトの検索結果件数
SEARCH_OIPF_DETAILS_LIMIT=5   # ファイルの検索結果件数
SEARCH_RESULT_MAX_TAGS=10     # 返却するタグの最大数
```

詳細な設定については、プロジェクトルートの README.md を参照してください。

## Run

```bash
cd backend
uvicorn app.main:app --reload --port 8000
```

Or:

```bash
cd backend
python -m app.main
```

## API Endpoints

### ヘルスチェック

| エンドポイント | メソッド | 説明 |
|---------------|---------|------|
| `/` | GET | API稼働確認 |
| `/health` | GET | ヘルスチェック |

### メインAPI

#### `POST /api/research-chat`

メインのチャット・検索エンドポイント。SSE（Server-Sent Events）でストリーミングレスポンスを返します。

**リクエストボディ**:
```json
{
  "messages": [{"role": "user", "content": "質問内容"}],
  "mode": "search" | "assistant",
  "tool": "wide-knowledge" | "knowwho" | "positioning-analysis" | ...,
  "pdfContext": "PDFのテキスト内容（オプション）",
  "deepDiveContext": { "source": {...}, "virtualFolder": [...] },
  "researchIdFilter": "AB12"
}
```

**リクエストパラメータ**:
| パラメータ | 必須 | 説明 |
|-----------|------|------|
| `messages` | ○ | チャットメッセージの配列 |
| `mode` | - | `search` または `assistant`（デフォルト: `assistant`） |
| `tool` | - | 使用するツール |
| `researchIdFilter` | - | 研究IDでフィルタリング。指定すると初回から oipf-details を検索 |

**モード**:
| モード | 説明 |
|--------|------|
| `search` | 論文・社内資料・ビジネス課題を並列検索 |
| `assistant` | ツール実行（プラン生成→ツール実行→要約） |

**利用可能なツール**:
| ツール | 説明 |
|--------|------|
| `wide-knowledge` | 外部論文検索（arXiv, OpenAlex, Semantic Scholar） |
| `internal-docs` | 社内資料検索（OpenSearch / モックデータ） |
| `knowwho` | 社内専門家検索 |
| `deep-file-search` | DeepDive用ファイル検索 |
| `positioning-analysis` | ポジショニング分析 |
| `seeds-needs-matching` | シーズ・ニーズマッチング |
| `html-generation` | HTMLインフォグラフィック生成 |

**SSEイベントタイプ**:
| タイプ | 説明 |
|--------|------|
| `thinking_start` | 思考開始 |
| `plan` | 実行プラン |
| `step_start` / `step_complete` | ステップ進捗 |
| `research_data` | 検索結果データ |
| `knowwho_results` | 専門家検索結果 |
| `final_answer` | 最終回答（引用付き） |
| `chat_start` | ストリーミング回答開始 |

##### 内部処理フロー

```
リクエスト受信
     │
     ▼
┌─────────────┐
│ mode の判定  │
└─────────────┘
     │
     ├─── mode="search" ──────► handle_search_mode
     │
     └─── mode="assistant" ──► handle_assistant_mode
```

###### Search Mode（検索モード）

シンプルな並列検索 → AI要約のフロー

```
1. 並列検索実行
   ├── 外部論文検索 (arXiv, OpenAlex, Semantic Scholar)
   ├── 社内研究検索 (OpenSearch / モック)
   └── ビジネス課題検索 (モック)
            │
            ▼
2. SSE送信: research_data
   { internal: [...], business: [...], external: [...] }
            │
            ▼
3. LLMストリーミング回答
   (検索結果をコンテキストとして使用)
            │
            ▼
4. SSE送信: choices[0].delta.content (チャンクごと)
            │
            ▼
5. [DONE]
```

###### Assistant Mode（アシスタントモード）

ツール実行を含む複雑なフロー

```
1. OpenSearch社内研究検索（自動実行、設定時のみ）
            │
            ▼
2. SSE送信: research_data
            │
            ▼
3. プラン決定
   ├── deepDiveContext あり → 固定プラン [deep-file-search, knowwho, chat]
   ├── tool 指定あり        → 固定プラン [指定ツール, chat]
   └── tool 指定なし        → LLMでプラン生成
            │
            ▼
4. SSE送信: thinking_start
            │
            ▼
5. SSE送信: plan { steps: [{tool, query, description}, ...] }
            │
            ▼
6. 各ステップをループ実行
   ┌────────────────────────────────────────────────┐
   │  SSE: step_start                               │
   │           │                                    │
   │           ▼                                    │
   │  ツール実行（ツール別処理）                      │
   │  ├── wide-knowledge  → 外部論文検索 + 要約生成  │
   │  ├── internal-docs   → OpenSearch/モック検索   │
   │  ├── knowwho         → 専門家検索 + t-SNEデータ │
   │  ├── deep-file-search → 詳細ファイル検索       │
   │  ├── positioning-analysis → LLMでJSON生成     │
   │  ├── seeds-needs-matching → マッチング分析     │
   │  └── html-generation → HTMLストリーミング生成  │
   │           │                                    │
   │           ▼                                    │
   │  SSE: ツール結果 (knowwho_results等)            │
   │           │                                    │
   │           ▼                                    │
   │  SSE: step_complete                            │
   └────────────────────────────────────────────────┘
            │
            ▼
7. SSE送信: chat_start
            │
            ▼
8. 最終回答生成
   ├── sources あり (wide-knowledge実行後)
   │    → LLM一括生成 → SSE: final_answer {content, sources}
   │
   └── sources なし
        → LLMストリーミング → SSE: choices[0].delta.content
            │
            ▼
9. [DONE]
```

###### SSEイベント発火順序（典型例）

**wide-knowledge検索の場合**:
```
1. research_data      ← OpenSearch自動検索結果
2. thinking_start
3. plan
4. step_start (0)
5. step_complete (0)
6. step_start (1)     ← chat ステップ
7. step_complete (1)
8. chat_start
9. final_answer       ← 引用付き回答（一括）
10. [DONE]
```

**knowwho検索の場合**:
```
1. research_data
2. thinking_start
3. plan
4. step_start (0)
5. knowwho_thinking   ← "部署特定中..."
6. knowwho_thinking   ← "候補者検索中..."
7. knowwho_results    ← 専門家リスト + t-SNEデータ
8. step_complete (0)
9. step_start (1)
10. step_complete (1)
11. chat_start
12. delta.content     ← ストリーミング回答
13. [DONE]
```

---

#### `POST /api-v1/research-chat`

レガシー版チャットAPI（後方互換性用）。機能は`/api/research-chat`と同等ですが、OpenSearch非対応でモックデータのみ使用します。

---

### プロキシAPI

#### `POST /api/arxiv-proxy`

arXiv API検索のプロキシ（CORS回避用）。

**リクエスト**:
```json
{
  "searchQuery": "検索クエリ",
  "maxResults": 10
}
```

**レスポンス**:
```json
{
  "xmlData": "<?xml ...>..."
}
```

---

#### `GET /api/pdf-proxy`

PDF取得プロキシ（CORS回避用）。セキュリティのためarXivドメインのみ許可。

**クエリパラメータ**: `?url=https://arxiv.org/pdf/xxxx.pdf`

**レスポンス**: PDFバイナリ（`application/pdf`）

---

## 検索アルゴリズム

社内研究検索は、6つの検索方法を組み合わせたハイブリッド検索を使用します。

### 起動時の初期化

バックエンド起動時に、oipf-summaryから全研究IDをキャッシュにロードします。

```
バックエンド起動
     │
     ▼
oipf-summary から全 oipf_research_id を取得
     │
     ▼
メモリキャッシュに保存（Set型でO(1)検索）
     │
     ▼
「Research ID cache: N IDs loaded」とログ出力
```

### 検索ルーティング

ユーザーのクエリ内容に応じて、適切なインデックスを選択します。

```
ユーザーからのクエリ
     │
     ├── クエリに既知の研究IDが含まれる
     │         → oipf-details を直接検索（研究IDフィルタ付き）
     │         （例: 「AB12 の詳細を教えて」）
     │
     ├── research_id_filter が明示的に指定
     │         → oipf-details を検索（研究IDフィルタ付き）
     │
     ├── 研究発見クエリ（「過去に類似研究はあるか」等）
     │         → oipf-summary を検索（2回目以降でも）
     │
     ├── 初回検索（会話履歴なし）
     │         → oipf-summary を検索（研究概要レベル）
     │
     └── 2回目以降（会話履歴あり）
               → oipf-details を検索（ファイルレベル）
```

### 各インデックスの役割

| インデックス | 粒度 | 用途 |
|-------------|------|------|
| oipf-summary | 研究プロジェクト単位 | 初回検索、概要把握 |
| oipf-details | ファイル単位 | 詳細検索、深掘り |

---

## 統合検索システム（Unified Search）

6つの検索方法を重み付けで組み合わせるハイブリッド検索を実装しています。

### 6つの検索方法

| 検索方法 | 環境変数 | 説明 |
|----------|----------|------|
| 要約テキスト検索 | `SEARCH_ABSTRACT_TEXT_WEIGHT` | BM25による要約文のテキストマッチ |
| 要約ベクトル検索 | `SEARCH_ABSTRACT_VECTOR_WEIGHT` | 要約エンベディングのKNN類似度検索 |
| タグテキスト検索 | `SEARCH_TAGS_TEXT_WEIGHT` | タグのキーワードマッチ |
| タグベクトル検索 | `SEARCH_TAGS_VECTOR_WEIGHT` | タグエンベディングのKNN類似度検索 |
| 固有名詞テキスト検索 | `SEARCH_PROPER_NOUNS_TEXT_WEIGHT` | 固有名詞の完全一致検索 |
| 固有名詞ベクトル検索 | `SEARCH_PROPER_NOUNS_VECTOR_WEIGHT` | 固有名詞エンベディングのKNN類似度検索 |

### デフォルト設定

```env
SEARCH_ABSTRACT_TEXT_WEIGHT=0
SEARCH_ABSTRACT_VECTOR_WEIGHT=40
SEARCH_TAGS_TEXT_WEIGHT=0
SEARCH_TAGS_VECTOR_WEIGHT=30
SEARCH_PROPER_NOUNS_TEXT_WEIGHT=0
SEARCH_PROPER_NOUNS_VECTOR_WEIGHT=30
```

### 重み付けロジック

```
1. 重みの正規化
   boost係数 = 各メソッドの重み ÷ 全重みの合計

   例: 40, 30, 30 の場合
   abstract_vector の boost = 40/100 = 0.4
   tags_vector の boost = 30/100 = 0.3
   proper_nouns_vector の boost = 30/100 = 0.3

2. OpenSearchクエリの構築
   各検索方法を bool.should 句として組み合わせ

3. スコア計算
   最終スコア = Σ (各検索のスコア × boost係数)
```

### 検索フロー

```
クエリ受信
     │
     ▼
┌─────────────────────────────────┐
│ 1. クエリをエンベディング       │
│    （ベクトル検索用）           │
└─────────────────────────────────┘
     │
     ▼
┌─────────────────────────────────┐
│ 2. 重み > 0 の検索方法を選択     │
│    → should句を構築              │
└─────────────────────────────────┘
     │
     ▼
┌─────────────────────────────────────────────────────┐
│ 3. 並列検索実行                                      │
│                                                      │
│  ┌──────────────┐ ┌──────────────┐ ┌──────────────┐ │
│  │ 要約ベクトル │ │ タグベクトル │ │固有名詞ベクトル│ │
│  │ KNN検索     │ │ KNN検索     │ │ KNN検索      │ │
│  │ boost=0.4   │ │ boost=0.3   │ │ boost=0.3    │ │
│  └──────────────┘ └──────────────┘ └──────────────┘ │
└─────────────────────────────────────────────────────┘
     │
     ▼
┌─────────────────────────────────┐
│ 4. スコア統合                   │
│    各検索のスコア × boost を合計 │
└─────────────────────────────────┘
     │
     ▼
┌─────────────────────────────────┐
│ 5. 重複排除・上位N件を返却       │
└─────────────────────────────────┘
```

### oipf-summary用フィールドマッピング

| 検索方法 | フィールド名 |
|----------|-------------|
| abstract_text | `oipf_research_abstract` |
| abstract_vector | `oipf_research_abstract_embedding` |
| tags_text | `oipf_research_themetags` |
| tags_vector | `oipf_themetags_embedding` |
| proper_nouns_text | `oipf_research_proper_nouns` |
| proper_nouns_vector | `oipf_proper_nouns_embedding` |

### oipf-details用フィールドマッピング

| 検索方法 | フィールド名 |
|----------|-------------|
| abstract_text | `oipf_abstract` |
| abstract_vector | `oipf_abstract_embedding` |
| tags_text | `oipf_tags` |
| tags_vector | `oipf_tags_embedding` |
| proper_nouns_text | `oipf_proper_nouns` |
| proper_nouns_vector | `oipf_proper_nouns_embedding` |

### スコアの解釈

| スコア | 意味 |
|--------|------|
| 0.8〜1.0 | 非常に高い類似度 |
| 0.6〜0.8 | 高い類似度 |
| 0.4〜0.6 | 中程度の類似度 |
| 0.2〜0.4 | 低い類似度 |
| 0.0〜0.2 | ほぼ無関係 |

---

## 検索結果件数設定

LLM回答生成に使用する検索結果の件数を設定できます。

| 環境変数 | デフォルト | 説明 |
|----------|-----------|------|
| `SEARCH_OIPF_SUMMARY_LIMIT` | 3 | oipf-summary（研究プロジェクト）の検索結果件数 |
| `SEARCH_OIPF_DETAILS_LIMIT` | 5 | oipf-details（ファイル）の検索結果件数 |
| `SEARCH_RESULT_MAX_TAGS` | 10 | フロントエンドに返却するタグの最大数 |

---

## タグの優先順位付け

検索結果のタグは、検索クエリとのマッチ度で並び替えられます。

### ロジック

```
1. 全タグを取得（最大30個がOpenSearchに格納）
     │
     ▼
2. クエリとのマッチ判定
   ├── タグ ⊂ クエリ（部分一致）
   ├── クエリ ⊂ タグ（部分一致）
   └── クエリの単語 ∈ タグ
     │
     ▼
3. マッチしたタグを先頭に配置
     │
     ▼
4. 残りのタグを元の順序で追加
     │
     ▼
5. 上位10個（SEARCH_RESULT_MAX_TAGS）を返却
```

### 例

```
検索クエリ: 「CFRPの強度解析」
元のタグ: [材料試験, 機械学習, CFRP, 引張強度, 炭素繊維, ...]

返却されるタグ: [CFRP, 引張強度, 材料試験, 機械学習, ...]
                 ↑マッチ優先   ↑残り
```

---

## 検索結果の重複排除

oipf-details検索（2回目以降の深堀り検索）では、類似ファイルの重複排除を行います。

### 問題

検索結果に同じファイルの複数バージョンがヒットすることがある：
```
/研究A/報告書/analysis_v1.xlsx
/研究A/報告書/analysis_v2.xlsx
/研究A/報告書/analysis_final.xlsx
/研究A/報告書/バックアップ/analysis_v2.xlsx
```

### 解決策

後処理で類似ファイルをグルーピングし、最新/最重要バージョンのみを返却。

```
検索結果（limit × 3 件取得）
     │
     ▼
ベース名でグルーピング
（バージョン/日付サフィックスを除去して比較）
     │
     ▼
近接パス判定
（同一ディレクトリ or 1-2階層以内）
     │
     ▼
各グループから最良を選択
     │
     ▼
上位 limit 件を返却
```

### バージョン優先順位

| 条件 | スコア |
|------|--------|
| "final", "最終", "確定", "完成" | +100 |
| "revised", "修正", "改訂" | +50 |
| バージョン番号 (v3 > v2 > v1) | +10 × バージョン |
| 年号 (2024 > 2023) | +(年 - 2000) |
| "backup", "draft", "バックアップ" | -50 |
| パスの深さ | -2 × 階層数 |

### ベース名抽出例

| ファイル名 | ベース名 |
|-----------|---------|
| `analysis_v2.xlsx` | `analysis` |
| `report_2024_final.pdf` | `report` |
| `実験データ_修正版.csv` | `実験データ` |
| `設計書_v3_確定.docx` | `設計書` |

### 適用箇所

- `search_followup()`: oipf-details検索
- `deep_file_search()`: DeepDive用ファイル検索

---

## Project Structure

```
backend/
├── app/
│   ├── __init__.py
│   ├── main.py                # FastAPI entry point
│   ├── config.py              # Environment settings（検索重み設定含む）
│   ├── routers/
│   │   ├── research_chat.py   # /api/research-chat (メインAPI)
│   │   ├── research_chat_v1.py # /api-v1/research-chat (レガシー)
│   │   ├── arxiv_proxy.py     # /api/arxiv-proxy
│   │   └── pdf_proxy.py       # /api/pdf-proxy
│   ├── services/
│   │   ├── llm_client.py      # LLM API client
│   │   ├── embedding_client.py # Embedding API client
│   │   ├── opensearch_client.py # OpenSearch client（統合検索実装）
│   │   ├── internal_research_search.py # 社内研究検索（ルーティング・タグフィルタ）
│   │   ├── knowwho_service.py # 専門家検索
│   │   ├── external_search.py # OpenAlex, Semantic Scholar, arXiv
│   │   └── mock_data.py       # Mock data
│   └── models/
│       └── schemas.py         # Pydantic models
├── data/                      # JSON data storage
├── tests/                     # Test files
├── requirements.txt
└── README.md
```

### 主要ファイルの役割

| ファイル | 役割 |
|----------|------|
| `config.py` | 環境変数読込、検索重み設定、検索件数設定 |
| `opensearch_client.py` | `unified_search()`: 6つの検索方法を組み合わせた統合検索 |
| `internal_research_search.py` | 検索ルーティング、タグの優先順位付け、重複排除 |
| `research_chat.py` | SSEストリーミング、ツール実行、LLM呼び出し |
