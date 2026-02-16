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
