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
# OpenSearch設定（社内研究検索に必須）
# 注意: 社内研究検索を有効にするには、OpenSearchとEmbedding両方の設定が必要
# ===========================================
OPENSEARCH_URL=https://your-opensearch-endpoint:9200
OPENSEARCH_USERNAME=admin
OPENSEARCH_PASSWORD=your-password
# OPENSEARCH_VERIFY_SSL=false
# OPENSEARCH_PROXY_ENABLED=false
# OPENSEARCH_PROXY_URL=http://proxy.example.com:8080

# ===========================================
# KnowWho設定（有識者検索・組織経路図）
# ===========================================
# KNOWWHO_USE_OPENSEARCH=false  # trueでOpenSearchのemployeesインデックスを使用、falseでモックデータ
# KNOWWHO_CURRENT_USER_ID=E100  # 組織経路図の起点となる「自分」のemployee_id（両モード共通）
# KNOWWHO_TARGET_EMPLOYEES=E001,E002,E003  # 経路探索対象の従業員ID（カンマ区切り、省略時は部署ベース検索）

# ===========================================
# エンベディングAPI設定（社内研究検索に必須）
# 注意: 社内研究検索を有効にするには、OpenSearchとEmbedding両方の設定が必要
# ===========================================
EMBEDDING_API_URL=https://your-embedding-api-endpoint.com
EMBEDDING_API_KEY=your-api-key
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

# ===========================================
# 汎用プロキシ設定（前処理スクリプト用、オプション）
# 注意: サービス別プロキシ設定（LLM_PROXY_*等）が優先されます
# ===========================================
# PROXY_ENABLED=false
# PROXY_URL=http://proxy.example.com:8080
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

#### 社内研究検索の有効化

社内研究検索をOpenSearchで有効にするには、**OpenSearch**と**EmbeddingAPI**の**両方**を設定する必要があります。

| 設定状態 | 動作 |
|---------|------|
| OpenSearch + Embedding 両方設定済み | OpenSearchによる社内研究検索が有効 |
| どちらかが未設定 | モックデータによるデモ動作 |

#### KnowWho（有識者検索・組織経路図）の設定

有識者検索と組織経路図のデータソースを切り替えられます。

```env
# OpenSearchのemployeesインデックスを使用する場合
KNOWWHO_USE_OPENSEARCH=true

# モックデータ（JSONファイル）を使用する場合（デフォルト）
KNOWWHO_USE_OPENSEARCH=false

# 組織経路図の起点「自分」を指定（両モード共通、employee_idで指定）
KNOWWHO_CURRENT_USER_ID=E100

# 経路探索対象の従業員IDを指定（カンマ区切り、省略時は部署ベースの検索）
KNOWWHO_TARGET_EMPLOYEES=E001,E002,E003
```

| 設定 | 説明 |
|------|------|
| `KNOWWHO_USE_OPENSEARCH=true` | OpenSearch (employees) を使用。事前にprocess_employees.pyでデータ登録が必要 |
| `KNOWWHO_USE_OPENSEARCH=false` | JSONファイル（knowwho_db.json等）を使用（デフォルト） |
| `KNOWWHO_CURRENT_USER_ID` | 組織経路図の起点となる「自分」のemployee_id。省略時はモックデータのデフォルト値またはE100 |
| `KNOWWHO_TARGET_EMPLOYEES` | 経路探索対象の従業員ID（カンマ区切り）。指定時は部署検索をスキップし、自分から指定従業員への経路のみを探索 |

**注意**: OpenSearchモードでは、t-SNE座標やクラスタ情報は利用できません（可視化は簡易版になります）。

バックエンド起動時に以下のログで設定状態を確認できます:
```
Internal Research Search:
  Status: ENABLED (OpenSearch)  ← または DISABLED (Mock Data)
```

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
.venv\Scripts\activate  # Windows
# または source .venv/bin/activate  # macOS/Linux

# 依存関係をインストール
pip install -r requirements.txt
```

### OpenSearchインデックス作成

```bash
# oipf-detailsインデックスを作成（デフォルト）
python opensearch/create_indices.py

# 全インデックス（oipf-summary, oipf-details, employees）を作成
python opensearch/create_indices.py --all

# employeesインデックスのみ作成
python opensearch/create_indices.py --index employees

# インデックスを再作成（削除→作成）
python opensearch/create_indices.py --action recreate --index oipf-details
```

**利用可能なインデックス**:
| インデックス名 | 用途 |
|--------------|------|
| `oipf-summary` | 研究概要（フォルダ単位の要約、ベクトル検索） |
| `oipf-details` | ファイル詳細（RAG向け、ファイル単位） |
| `employees` | 従業員・有識者（組織経路図、KnowWho検索） |

### OpenSearchデータエクスポート

別のOpenSearchにデータを移行する際に使用します。

```bash
# 全インデックスをエクスポート
python opensearch/export_indices.py --all

# 特定のインデックスをエクスポート
python opensearch/export_indices.py --index oipf-summary

# 出力ディレクトリを指定
python opensearch/export_indices.py --all --output ./my_exports

# エンベディングを除外（ファイルサイズ削減）
python opensearch/export_indices.py --all --exclude-embeddings
```

**出力ファイル**:
```
exports/export_YYYYMMDD_HHMMSS/
├── manifest.json                  # エクスポート情報
├── oipf-summary_mapping.json      # マッピング・設定
├── oipf-summary_data.ndjson       # ドキュメントデータ
├── oipf-details_mapping.json
├── oipf-details_data.ndjson
├── employees_mapping.json
└── employees_data.ndjson
```

### OpenSearchデータインポート

エクスポートしたデータを別のOpenSearchにインポートします。

```bash
# マニフェストから全インデックスをインポート
python opensearch/import_indices.py --dir ./exports/export_20240101_120000

# 特定のインデックスをインポート
python opensearch/import_indices.py --dir ./exports/export_20240101_120000 --index oipf-summary

# インデックスをマッピングファイルから作成してインポート
python opensearch/import_indices.py --dir ./exports/export_20240101_120000 --create-index

# バッチサイズを指定（大量データ時）
python opensearch/import_indices.py --dir ./exports/export_20240101_120000 --batch-size 1000
```

**オプション一覧**:
| オプション | 短縮形 | 説明 |
|-----------|--------|------|
| `--dir` | `-d` | エクスポートディレクトリ（必須） |
| `--index` | `-i` | インポートするインデックス名（省略時は全インデックス） |
| `--create-index` | `-c` | マッピングファイルからインデックスを作成 |
| `--batch-size` | `-b` | バルクリクエストのバッチサイズ（デフォルト: 500） |

**注意**:
- インポート先のOpenSearchにインデックスが存在する必要があります（`--create-index`で自動作成可能）
- 同じIDのドキュメントは上書きされます

### 従業員データ登録（employees）

CSVファイルから従業員データをemployeesインデックスに登録します。

```bash
# 基本的な使用方法
python embeddings/process_employees.py /path/to/employees.csv

# ドライラン（登録せずに確認）
python embeddings/process_employees.py /path/to/employees.csv --dry-run
```

**必要なCSV列**:
| 列名 | 必須 | 説明 |
|-----|------|------|
| `employee_id` | **必須** | 従業員ID |
| `display_name` | **必須** | 氏名 |
| `mail` | **必須** | メールアドレス |
| `job_title` | **必須** | 役職 |
| `department` | **必須** | 部署 |
| `job_level` | 任意 | 職階レベル（0: 一般, 1: 課長級, 2: 部長級）。組織経路図の階層表示に使用 |
| `manager_mail` | 任意 | 上司のメールアドレス |
| `UserPrincipalName` | 任意 | （使用しない） |
| `UsageLocation` | 任意 | （使用しない） |
| `manager_display_name` | 任意 | （使用しない） |

**処理内容**:
| 処理 | 説明 |
|-----|------|
| manager_employee_id取得 | manager_mailから同CSV内のmailをマッチングしてemployee_idを取得 |
| profile生成 | oipf-summaryのrelated_researchersと名前マッチングしてresearch_summary, expertise, keywordsを生成 |

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

### 研究サマリーインデックス投入（oipf-summary）

単一の研究ドキュメントからサマリー情報を抽出し、oipf-summaryインデックスに投入します。

**コマンド構文**:
```
python embeddings/process_summary_index.py <file> [オプション]
```

| パラメータ | 必須/任意 | 説明 |
|-----------|----------|------|
| `<file>` | **必須** | 処理対象のファイルパス（PDF、Word、PowerPoint等） |
| `[オプション]` | 任意 | 下記オプション一覧を参照 |

**使用例**:
```bash
# 基本的な使用方法（ファイルパスのみ指定）
python embeddings/process_summary_index.py /path/to/research/document.pdf

# ベースパスを指定（フォルダ構造の省略・研究ID抽出用）
python embeddings/process_summary_index.py \
    /data/研究/ABC123_量子研究/報告書.pdf \
    --base-path /data/研究

# ドライラン（OpenSearchに投入しない）
python embeddings/process_summary_index.py /path/to/document.pdf --dry-run

# 研究IDを手動指定（フォルダ名から抽出せずに直接指定）
python embeddings/process_summary_index.py /path/to/document.pdf --research-id XYZ1

# 研究IDを手動指定（短縮形 -r）
python embeddings/process_summary_index.py /path/to/document.pdf -r ABC1

# 研究IDを手動指定 + ドライラン（投入前の確認用）
python embeddings/process_summary_index.py /path/to/document.pdf \
    --research-id TEST \
    --dry-run

# 研究IDを手動指定 + ベースパス指定
python embeddings/process_summary_index.py \
    /data/研究/任意のフォルダ/報告書.pdf \
    --research-id PROJ \
    --base-path /data/研究

# 全オプション指定
python embeddings/process_summary_index.py /path/to/document.pdf \
    --base-path /data/研究 \
    --research-id ABC1 \
    --index oipf-summary \
    --num-tags 12 \
    --max-pages 10
```

**処理内容**:
| フィールド | 処理内容 |
|-----------|---------|
| `oipf_research_id` | `--research-id`で指定、または ベースパス直下のフォルダ名から先頭4桁ASCII英数字を抽出 |
| `oipf_research_abstract` | LLMで研究要約を生成 |
| `oipf_research_abstract_embedding` | 要約をエンベディング（1024次元） |
| `related_researchers` | 先頭5ページからLLMでメンバー名を抽出 |
| `oipf_research_themetags` | LLMで研究分類タグを10個前後生成 |
| `oipf_spo_folderstructure_summary` | フォルダ構造をMarkdown形式で出力 |

**オプション一覧**（すべて任意）:
| オプション | 短縮形 | デフォルト | 説明 |
|-----------|--------|-----------|------|
| `--base-path` | `-b` | ファイルの親フォルダ | フォルダ構造で省略するベースパス |
| `--research-id` | `-r` | (自動抽出) | 研究ID（4桁英数字）を手動指定 |
| `--index` | `-i` | `oipf-summary` | 投入先インデックス名 |
| `--num-tags` | `-t` | 10 | 生成するタグ数 |
| `--max-pages` | `-p` | 5 | メンバー抽出に使用する最大ページ数 |
| `--dry-run` | `-n` | - | OpenSearchに投入しない |
| `--quiet` | `-q` | - | 進捗表示を抑制 |

**フォルダ構造と研究ID**:

フォルダ構造が以下のようになっている場合:
```
/data/研究/
├── ABC123_量子コンピューティング研究/
│   ├── 報告書.pdf          ← 処理対象
│   └── データ/
└── XYZ789_AI画像認識/
    └── 最終報告.pdf
```

`--base-path /data/研究` を指定して `/data/研究/ABC123_量子コンピューティング研究/報告書.pdf` を処理すると:
- **研究ID**: `ABC1`（フォルダ名の先頭4桁ASCII英数字）
- **フォルダ構造**: `ABC123_量子コンピューティング研究/` 以下のツリー構造

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
│   ├── entra_hierarchy/    # MS Entra階層構造取得
│   └── test_data/          # テストデータ生成・投入ツール
├── public/                 # 静的ファイル
├── package.json            # Node.js依存関係
└── .env                    # 環境変数（gitignore対象）
```

## テストデータの生成と投入

開発・検証用のテストデータを生成し、OpenSearchに投入できます。

### テストデータ概要

| インデックス | 件数 | 内容 |
|-------------|------|------|
| `employees` | 100件 | 従業員データ（6部署、3階層：部長6名、課長15名、一般79名） |
| `oipf-summary` | 5件 | 研究プロジェクト概要（従業員名と連携） |
| `oipf-details` | 100件 | 研究詳細タスク（各プロジェクト20件） |

### テストデータの生成

```bash
cd pre_proc/test_data

# 従業員データを生成
python generate_employees.py

# 研究概要データを生成（employees生成後に実行）
python generate_oipf_summary.py

# 研究詳細データを生成（oipf-summary生成後に実行）
python generate_oipf_details.py
```

生成されるファイル:
```
pre_proc/test_data/data/
├── employees_test.csv           # 従業員CSV
├── oipf_summary_test.ndjson     # 研究概要NDJSON
└── oipf_details_test.ndjson     # 研究詳細NDJSON
```

### OpenSearchへの投入

```bash
cd pre_proc/test_data

# ドライラン（確認用、実際には投入しない）
python load_test_data.py --dry-run --all

# 全インデックスに投入
python load_test_data.py --all

# 既存データをクリアしてから投入
python load_test_data.py --clear --all

# 個別投入
python load_test_data.py --employees    # employeesのみ
python load_test_data.py --summary      # oipf-summaryのみ
python load_test_data.py --details      # oipf-detailsのみ
```

### テスト用の環境変数設定例

テストデータ投入後、以下の設定でフロントエンドからのテストが可能です:

```env
# OpenSearchを使用
KNOWWHO_USE_OPENSEARCH=true

# 一般社員を「自分」に設定
KNOWWHO_CURRENT_USER_ID=E005

# 各部署の部長を検索対象に設定
KNOWWHO_TARGET_EMPLOYEES=E001,E021,E039
```

詳細は `pre_proc/test_data/README.md` を参照してください。

## 注意事項

- `.env`ファイルはGitにコミットしないでください（`.gitignore`で除外済み）
- `node_modules/`と`backend/.venv/`もGitにコミットしないでください

## ライセンス

Private
