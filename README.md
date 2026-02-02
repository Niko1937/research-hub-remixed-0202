# Research Hub

研究情報検索・分析プラットフォーム

## 技術スタック

### フロントエンド
- Vite
- TypeScript
- React
- shadcn-ui
- Tailwind CSS

### バックエンド
- Python 3.11+
- FastAPI
- uvicorn

## セットアップ

### 前提条件
- Node.js 18+ & npm ([nvm](https://github.com/nvm-sh/nvm#installing-and-updating)でインストール推奨)
- Python 3.11+

### 1. リポジトリをクローン

```bash
git clone https://github.com/yoshi2210/remix-of-research-hub-30.git
cd remix-of-research-hub-30
```

### 2. 環境変数の設定

プロジェクトルートに`.env`ファイルを作成:

```env
# ===========================================
# LLM設定（必須）
# ===========================================
LLM_BASE_URL=https://your-llm-api-endpoint.com
LLM_API_KEY=your-api-key
LLM_MODEL=vertex_ai.gemini-2.5-flash
# LLM_TIMEOUT=60
# LLM_PROXY_ENABLED=false
# LLM_PROXY_URL=http://proxy.example.com:8080

# ===========================================
# OpenSearch設定（オプション）
# ===========================================
# OPENSEARCH_URL=https://your-opensearch-endpoint:9200
# OPENSEARCH_USERNAME=admin
# OPENSEARCH_PASSWORD=your-password
# OPENSEARCH_VERIFY_SSL=false
# OPENSEARCH_PROXY_ENABLED=false
# OPENSEARCH_PROXY_URL=http://proxy.example.com:8080

# ===========================================
# エンベディングAPI設定（前処理スクリプト用）
# ===========================================
# EMBEDDING_API_URL=https://your-embedding-api-endpoint.com
# EMBEDDING_API_KEY=your-api-key
# EMBEDDING_MODEL=text-embedding-3-large
# EMBEDDING_DIMENSIONS=1024
# EMBEDDING_BATCH_SIZE=10
# EMBEDDING_TIMEOUT=60
# EMBEDDING_PROXY_ENABLED=false
# EMBEDDING_PROXY_URL=http://proxy.example.com:8080

# ===========================================
# ファイル処理設定（前処理スクリプト用）
# ===========================================
# MAX_FILE_SIZE_MB=100
# MAX_FOLDER_DEPTH=4
# SKIP_INDEXED_FOLDERS=false
```

#### プロキシ環境での設定

各サービス（LLM、Embedding、OpenSearch）には個別にプロキシを設定できます。

**LLMプロキシ設定**:

```env
LLM_PROXY_ENABLED=true
LLM_PROXY_URL=http://proxy.example.com:8080
```

**Embeddingプロキシ設定**:

```env
EMBEDDING_PROXY_ENABLED=true
EMBEDDING_PROXY_URL=http://proxy.example.com:8080
```

**OpenSearchプロキシ設定**:

```env
OPENSEARCH_PROXY_ENABLED=true
OPENSEARCH_PROXY_URL=http://proxy.example.com:8080
```

プロキシが不要な環境では、`*_PROXY_ENABLED`と`*_PROXY_URL`は設定不要です（デフォルトでプロキシは無効）。

#### LLM設定

LLM APIの詳細設定:

```env
LLM_BASE_URL=https://your-llm-api-endpoint.com
LLM_API_KEY=your-api-key
LLM_MODEL=vertex_ai.gemini-2.5-flash
LLM_TIMEOUT=60
```

| パラメータ | デフォルト | 説明 |
|-----------|-----------|------|
| `LLM_BASE_URL` | - | LLM APIのベースURL（必須） |
| `LLM_API_KEY` | - | LLM APIキー（必須） |
| `LLM_MODEL` | `vertex_ai.gemini-2.5-flash` | 使用するモデル名 |
| `LLM_TIMEOUT` | 60 | APIリクエストのタイムアウト（秒） |

**注意**: 画像ファイルの解析にはVision対応モデル（例: `gemini-2.0-flash`, `gpt-4-vision-preview`）が必要です。

#### OpenSearch設定

OpenSearchを使用する場合は以下を設定:

```env
OPENSEARCH_URL=https://your-opensearch-endpoint:9200
OPENSEARCH_USERNAME=admin
OPENSEARCH_PASSWORD=your-password
```

**SSL検証設定**（ローカルOpenSearch向け）:

```env
# 自己署名証明書の場合はSSL検証を無効化（デフォルト: false）
OPENSEARCH_VERIFY_SSL=false
```

#### エンベディングAPI設定

前処理スクリプト（ドキュメントエンベディング）を使用する場合:

```env
EMBEDDING_API_URL=https://your-embedding-api-endpoint.com
EMBEDDING_API_KEY=your-api-key
EMBEDDING_MODEL=text-embedding-3-large
EMBEDDING_DIMENSIONS=1024
EMBEDDING_BATCH_SIZE=10
EMBEDDING_TIMEOUT=60
```

| パラメータ | デフォルト | 説明 |
|-----------|-----------|------|
| `EMBEDDING_DIMENSIONS` | 1024 | エンベディングの次元数（oipf-detailsスキーマに合わせる） |
| `EMBEDDING_BATCH_SIZE` | 10 | バッチ処理時の同時リクエスト数 |
| `EMBEDDING_TIMEOUT` | 60 | APIリクエストのタイムアウト（秒） |

#### ファイル処理設定

前処理スクリプトのファイル処理制限:

```env
MAX_FILE_SIZE_MB=100
MAX_FOLDER_DEPTH=4
SKIP_INDEXED_FOLDERS=false
```

| パラメータ | デフォルト | 説明 |
|-----------|-----------|------|
| `MAX_FILE_SIZE_MB` | 100 | 最大ファイルサイズ（MB）。これを超えるファイルは処理をスキップ |
| `MAX_FOLDER_DEPTH` | 4 | 最大フォルダ探索深度。0で無制限 |
| `SKIP_INDEXED_FOLDERS` | false | 既にインデックス済みのサブフォルダをスキップするかどうか |

**SKIP_INDEXED_FOLDERS について**:
- `true` を設定すると、対象フォルダの1階層下のサブフォルダごとに既存インデックスをチェック
- 既にインデックスされているファイルがあるサブフォルダは丸ごとスキップ（増分処理に便利）
- サブフォルダ内のファイルパス（`oipf_file_path`）がOpenSearchに存在するかをチェック

### 3. フロントエンドのセットアップ

```bash
# 依存関係をインストール
npm install

# 開発サーバーを起動
npm run dev
```

フロントエンドは http://localhost:5173 で起動します。

### 4. バックエンドのセットアップ

```bash
# backendディレクトリに移動
cd backend

# 仮想環境を作成
python -m venv .venv

# 仮想環境を有効化
# Windows:
.venv\Scripts\activate
# macOS/Linux:
source .venv/bin/activate

# 依存関係をインストール
pip install -r requirements.txt

# 開発サーバーを起動
uvicorn app.main:app --reload --port 5000
```

バックエンドは http://localhost:5000 で起動します。

## 開発

### フロントエンド開発サーバー
```bash
npm run dev
```

### バックエンド開発サーバー
```bash
cd backend
uvicorn app.main:app --reload --port 5000
```

### 両方を同時に起動
ターミナルを2つ開いて、それぞれでフロントエンドとバックエンドを起動してください。

## 前処理スクリプト（pre_proc）

アプリケーション起動前に実行するデータ準備スクリプトです。

### セットアップ

```bash
cd pre_proc

# 仮想環境を作成（推奨）
python -m venv .venv
source .venv/bin/activate  # macOS/Linux
# または .venv\Scripts\activate  # Windows

# 依存関係をインストール
pip install -r requirements.txt
```

### OpenSearchインデックス作成

```bash
# oipf-detailsインデックスを作成（デフォルト）
python opensearch/create_indices.py

# 全インデックス（oipf-summary, oipf-details）を作成
python opensearch/create_indices.py --all

# インデックスを再作成（削除→作成）
python opensearch/create_indices.py --action recreate --index oipf-details
```

### フォルダ構造のMarkdown出力

```bash
# フォルダ構造をMarkdownファイルに出力
python folder_structure/generate_structure.py /path/to/folder -o structure.md

# 深度制限（デフォルト: 4階層）
python folder_structure/generate_structure.py /path/to/folder --depth 2
```

### ドキュメントエンベディング・OpenSearch投入

指定フォルダ内のドキュメントをLangChainで解析し、LLMで要約・タグ生成、エンベディングを生成してOpenSearchに投入します。

```bash
# 基本的な使用方法
python embeddings/process_folder_embeddings.py /path/to/folder

# ドライラン（実際に投入しない）
python embeddings/process_folder_embeddings.py /path/to/folder --dry-run

# オプション指定
python embeddings/process_folder_embeddings.py /path/to/folder \
    --index oipf-details \
    --depth 4 \
    --ignore "*.tmp" \
    --output-json result.json

# 対応ファイル形式を確認
python embeddings/process_folder_embeddings.py --supported-formats
```

**対応ファイル形式**:
- **ドキュメント**: PDF, Word (.docx), Excel (.xlsx, .xls), PowerPoint (.pptx), Markdown, HTML, CSV, JSON, テキストファイル
- **画像**: JPEG (.jpg, .jpeg), PNG, GIF, WebP, BMP（Vision LLMで内容を解析・要約）

**注意**: 画像ファイルはVision対応のLLMモデル（例: `gemini-2.0-flash`, `gpt-4-vision-preview`）が必要です。

**プロキシ環境**: `.env`で`PROXY_ENABLED=true`と`PROXY_URL`を設定すると、全ての外部API呼び出し（LLM、エンベディング、OpenSearch）がプロキシ経由になります。

## API エンドポイント

- `GET /` - ヘルスチェック
- `GET /health` - ヘルスチェック
- `POST /api/research-chat` - メインチャットエンドポイント (SSE streaming)

## プロジェクト構造

```
remix-of-research-hub-30/
├── src/                    # フロントエンドソースコード
│   ├── components/         # Reactコンポーネント
│   ├── hooks/              # カスタムフック
│   ├── pages/              # ページコンポーネント
│   └── lib/                # ユーティリティ
├── backend/                # バックエンドソースコード
│   ├── app/
│   │   ├── main.py         # FastAPIエントリーポイント
│   │   ├── config.py       # 環境設定
│   │   ├── routers/        # APIルーター
│   │   ├── services/       # ビジネスロジック
│   │   └── models/         # Pydanticモデル
│   ├── data/               # JSONデータストレージ
│   └── requirements.txt    # Python依存関係
├── pre_proc/               # 前処理スクリプト
│   ├── common/             # 共通モジュール（設定管理）
│   ├── opensearch/         # OpenSearchインデックス管理
│   ├── embeddings/         # エンベディング処理パイプライン
│   ├── folder_structure/   # フォルダ構造出力
│   └── entra_hierarchy/    # MS Entra階層構造取得
├── public/                 # 静的ファイル
├── package.json            # Node.js依存関係
└── .env                    # 環境変数（gitignore対象）
```

## 注意事項

- `.env`ファイルはGitにコミットしないでください（`.gitignore`で除外済み）
- `node_modules/`と`backend/.venv/`もGitにコミットしないでください

## ライセンス

Private
