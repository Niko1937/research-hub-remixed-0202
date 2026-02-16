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
  "deepDiveContext": { "source": {...}, "virtualFolder": [...] }
}
```

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
