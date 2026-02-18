# Pre-processing Scripts

OpenSearchインデックスの作成、データ登録、エクスポート/インポートを行う前処理スクリプト群

## ディレクトリ構造

```
pre_proc/
├── opensearch/                    # OpenSearch操作スクリプト
│   ├── create_indices.py          # インデックス作成
│   ├── export_indices.py          # データエクスポート
│   └── import_indices.py          # データインポート
├── embeddings/                    # データ登録スクリプト
│   ├── process_folder_embeddings.py  # フォルダ一括処理（メイン）
│   ├── process_summary_index.py   # oipf-summaryインデックス登録
│   ├── process_details_index.py   # oipf-detailsインデックス登録
│   └── process_employees.py       # employeesインデックス登録
├── common/                        # 共通モジュール
│   ├── config.py                  # 設定管理
│   └── utils.py                   # ユーティリティ
└── tests/                         # テスト
    ├── test_summary_index.py
    ├── test_process_employees.py
    └── test_export_import.py
```

## インデックス一覧

| インデックス | 用途 | 登録スクリプト |
|-------------|------|---------------|
| oipf-summary | 研究概要（フォルダ単位） | process_summary_index.py |
| oipf-details | ファイル詳細（RAG向け） | process_details_index.py |
| employees | 従業員・有識者データ | process_employees.py |

---

## 環境設定

`.env`ファイルに以下の環境変数を設定してください。

```bash
# OpenSearch設定
OPENSEARCH_URL=https://your-opensearch-domain:9200
OPENSEARCH_USERNAME=admin
OPENSEARCH_PASSWORD=your-password

# OpenSearch用プロキシ（オプション）
OPENSEARCH_PROXY_ENABLED=false
OPENSEARCH_PROXY_URL=http://proxy.example.com:8080

# エンベディングAPI設定
EMBEDDING_API_URL=https://your-embedding-api
EMBEDDING_API_KEY=your-api-key
EMBEDDING_MODEL=text-embedding-3-large
EMBEDDING_DIMENSIONS=1024

# LLM API設定（要約・タグ抽出用）
LLM_BASE_URL=https://your-llm-api
LLM_API_KEY=your-api-key
LLM_MODEL=vertex_ai.gemini-2.5-flash
```

---

## OpenSearch操作

### インデックス作成

```bash
# 全インデックスを作成
python opensearch/create_indices.py --all

# 特定のインデックスを作成
python opensearch/create_indices.py --index oipf-summary
python opensearch/create_indices.py --index oipf-details
python opensearch/create_indices.py --index employees

# インデックスを再作成（削除→作成）
python opensearch/create_indices.py --action recreate --index oipf-summary
```

### データエクスポート

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

**出力ファイル:**
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

### データインポート

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

**注意:**
- インポート先のOpenSearchにインデックスが存在する必要があります
- `--create-index`オプションでマッピングファイルからインデックスを作成できます
- 同じIDのドキュメントは上書きされます

---

## データ登録

### process_folder_embeddings.py（フォルダ一括処理）

研究フォルダ内の全ファイルを処理し、LLMで要約・タグを生成、エンベディングを作成してOpenSearchに登録します。

```bash
# 基本的な使用方法
python embeddings/process_folder_embeddings.py /path/to/research/folder

# ドライラン（登録せずに確認）
python embeddings/process_folder_embeddings.py /path/to/folder --dry-run

# 並列処理（5ファイル同時処理）- 処理速度が大幅に向上
python embeddings/process_folder_embeddings.py /path/to/folder --parallel 5

# 並列処理（10ファイル同時処理）
python embeddings/process_folder_embeddings.py /path/to/folder -p 10

# 深度制限と無視パターン
python embeddings/process_folder_embeddings.py /path/to/folder --depth 3 --ignore "*.tmp"

# 結果をJSONで出力
python embeddings/process_folder_embeddings.py /path/to/folder --output-json result.json
```

**並列処理について:**
- `--parallel N` または `-p N` で同時処理ファイル数を指定
- デフォルトは1（逐次処理）
- LLM/エンベディングAPIのレート制限に応じて調整してください
- 例: 100ファイルを `-p 5` で処理すると、5ファイルずつ同時に処理され処理時間が約1/5に短縮

**対応ファイル形式:**
- ドキュメント: PDF, DOCX, PPTX, TXT, MD, HTML, JSON
- スプレッドシート: XLSX, XLS, CSV（Markdown形式で構造を保持）
- 画像: JPG, PNG, GIF, WEBP（Vision LLMで解析）

---

### oipf-summary（研究概要）

研究フォルダを処理し、要約・タグ・関連研究者を抽出してOpenSearchに登録します。

```bash
# 基本的な使用方法
python embeddings/process_summary_index.py /path/to/research/folder --base-path /path/to/base

# 研究IDを手動指定
python embeddings/process_summary_index.py /path/to/folder --base-path /path/to/base --research-id ABC1

# ドライラン（登録せずに確認）
python embeddings/process_summary_index.py /path/to/folder --base-path /path/to/base --dry-run
```

### oipf-details（ファイル詳細）

研究フォルダ内のファイルを個別に処理し、RAG向けのチャンク情報を登録します。

```bash
python embeddings/process_details_index.py /path/to/research/folder --base-path /path/to/base
```

### employees（従業員データ）

CSVファイルから従業員データを読み込み、プロフィール情報を生成して登録します。

```bash
# 基本的な使用方法
python embeddings/process_employees.py /path/to/employees.csv

# ドライラン
python embeddings/process_employees.py /path/to/employees.csv --dry-run
```

**CSVフォーマット:**
```csv
employee_id,display_name,mail,job_title,department,manager_mail
E001,山田 太郎,yamada@example.com,部長,研究開発部,
E002,佐藤 花子,sato@example.com,課長,研究開発部,yamada@example.com
```

**処理内容:**
1. CSVファイルを読み込み（utf-8, cp932, shift_jis対応）
2. manager_mail → manager_employee_id のルックアップ
3. oipf-summaryの related_researchers とマッチングしてプロフィール生成
4. employeesインデックスに登録

---

## テスト実行

```bash
# 全テスト実行
python tests/test_summary_index.py
python tests/test_process_employees.py
python tests/test_export_import.py
```

---

## データ移行手順

1. **エクスポート（移行元）**
   ```bash
   python opensearch/export_indices.py --all
   ```

2. **ファイル転送**
   ```bash
   scp -r exports/export_YYYYMMDD_HHMMSS user@new-server:/path/to/
   ```

3. **インデックス作成（移行先）**
   ```bash
   python opensearch/create_indices.py --all
   ```

4. **インポート（移行先）**
   ```bash
   python opensearch/import_indices.py --dir /path/to/export_YYYYMMDD_HHMMSS
   ```

または、`--create-index`オプションで一括実行：
```bash
python opensearch/import_indices.py --dir /path/to/export_YYYYMMDD_HHMMSS --create-index
```
