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

```env
LLM_BASE_URL=https://your-llm-api-endpoint.com
LLM_API_KEY=your-api-key
LLM_MODEL=vertex_ai.gemini-2.5-flash
```

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

社内研究検索は、コサイン類似度によるベクトル検索を使用します。

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
     │         （例: 「OIPF-2024-001 の詳細を教えて」）
     │
     ├── research_id_filter が明示的に指定
     │         → oipf-details を検索（研究IDフィルタ付き）
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

### ベクトル検索フロー

```
oipf-summary検索
     │
     ├── クエリをエンベディング
     ├── oipf_research_abstract_embedding で KNN検索
     └── コサイン類似度スコア（0.0〜1.0）を返却

oipf-details検索
     │
     ├── クエリをエンベディング
     ├── oipf_abstract_embedding で KNN検索
     ├── （研究IDフィルタがあれば適用）
     └── コサイン類似度スコア（0.0〜1.0）を返却
```

### スコアの解釈

| スコア | 意味 |
|--------|------|
| 0.8〜1.0 | 非常に高い類似度 |
| 0.6〜0.8 | 高い類似度 |
| 0.4〜0.6 | 中程度の類似度 |
| 0.2〜0.4 | 低い類似度 |
| 0.0〜0.2 | ほぼ無関係 |

### なぜベクトル検索か

- **一貫性**: 全検索で同じスコア体系（コサイン類似度）
- **意味的検索**: キーワード一致ではなく、意味の近さで検索
- **スコアの解釈性**: 0〜1の範囲で直感的に理解可能

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
│   ├── config.py              # Environment settings
│   ├── routers/
│   │   ├── research_chat.py   # /api/research-chat (メインAPI)
│   │   ├── research_chat_v1.py # /api-v1/research-chat (レガシー)
│   │   ├── arxiv_proxy.py     # /api/arxiv-proxy
│   │   └── pdf_proxy.py       # /api/pdf-proxy
│   ├── services/
│   │   ├── llm_client.py      # LLM API client
│   │   ├── embedding_client.py # Embedding API client
│   │   ├── opensearch_client.py # OpenSearch client
│   │   ├── internal_research_search.py # 社内研究検索
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
