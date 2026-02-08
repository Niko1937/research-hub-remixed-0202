# テストデータ生成・投入ツール

OpenSearchの各インデックス用テストデータを生成・投入するためのツール群です。

## 概要

| インデックス | 件数 | 説明 |
|-------------|------|------|
| `employees` | 100件 | 従業員データ（6部署、3階層） |
| `oipf-summary` | 5件 | 研究プロジェクト概要 |
| `oipf-details` | 100件 | 研究詳細（各プロジェクト20件） |

## データ構造

### employees（従業員）

```
100名の従業員
├── 研究開発部（20名）
│   ├── 部長 1名（job_level=2）
│   ├── 課長 3名（job_level=1）
│   └── 一般 16名（job_level=0）
├── AI推進部（18名）
├── 技術戦略室（15名）
├── 事業開発部（15名）
├── 企画部（15名）
└── 製造技術部（17名）
```

### oipf-summary（研究概要）

5つの研究プロジェクト：
1. **OIPF-2024-001**: 次世代AIによる自動運転システムの研究開発
2. **OIPF-2024-002**: 高効率エネルギー貯蔵用次世代電池材料の開発
3. **OIPF-2024-003**: バイオインフォマティクスを活用した創薬支援プラットフォーム
4. **OIPF-2024-004**: 産業用協働ロボットの知能化と安全性向上
5. **OIPF-2024-005**: カーボンニュートラル実現に向けた水素エネルギーシステム

各プロジェクトには `related_researchers` として employees の名前が紐付けられています。

### oipf-details（研究詳細）

各研究プロジェクトに20件ずつの詳細タスク：
- カテゴリ分類（画像認識、材料合成、データ解析など）
- 進捗状況（0-100%）
- 優先度（高/中/低）

## 使用方法

### 1. テストデータの生成

```bash
cd pre_proc/test_data

# 従業員データを生成
python generate_employees.py

# 研究概要データを生成（employees生成後に実行）
python generate_oipf_summary.py

# 研究詳細データを生成（oipf-summary生成後に実行）
python generate_oipf_details.py
```

生成されたファイル：
```
data/
├── employees_test.csv
├── oipf_summary_test.ndjson
└── oipf_details_test.ndjson
```

### 2. OpenSearchへの投入

```bash
# 環境変数を設定（.envファイルまたはexport）
export OPENSEARCH_URL=https://your-opensearch:9200
export OPENSEARCH_USERNAME=admin
export OPENSEARCH_PASSWORD=your-password

# ドライラン（確認用）
python load_test_data.py --dry-run --all

# 全インデックスに投入
python load_test_data.py --all

# クリアしてから投入
python load_test_data.py --clear --all

# 個別投入
python load_test_data.py --employees
python load_test_data.py --summary
python load_test_data.py --details
```

## データ間の整合性

```
employees                    oipf-summary                oipf-details
┌─────────────┐             ┌──────────────┐            ┌──────────────┐
│ display_name│◄────────────│related_      │            │ parent_      │
│             │             │researchers   │◄───────────│ oipf_id      │
│ department  │────────────►│oipf_         │            │              │
│             │             │department    │            │ related_     │
│ job_level   │             │              │────────────│ themetags    │
└─────────────┘             │oipf_research_│            └──────────────┘
                            │themetags     │
                            └──────────────┘
```

- `oipf-summary.related_researchers` は `employees.display_name` と一致
- `oipf-details.parent_oipf_id` は `oipf-summary.oipf_id` と一致
- `oipf-details.related_themetags` は `oipf-summary.oipf_research_themetags` のサブセット

## テストシナリオ

### 1. KnowWho（有識者検索）テスト

1. `.env`で`KNOWWHO_USE_OPENSEARCH=true`を設定
2. `KNOWWHO_CURRENT_USER_ID=E005`（一般社員）を設定
3. `KNOWWHO_TARGET_EMPLOYEES=E001,E021,E041`（各部署の部長）を設定
4. フロントエンドから有識者検索を実行
5. 組織経路図で階層構造が正しく表示されることを確認

### 2. 研究検索テスト

1. フロントエンドで「AI 自動運転」を検索
2. OIPF-2024-001の研究概要がヒットすることを確認
3. 関連研究者として従業員名が表示されることを確認

### 3. 組織階層テスト

- `job_level=2`（部長）: 6名
- `job_level=1`（課長）: 15名
- `job_level=0`（一般）: 79名

組織経路図で部長→課長→一般の階層が正しく表示されることを確認。

## ファイル一覧

```
pre_proc/test_data/
├── README.md                    # このファイル
├── generate_employees.py        # 従業員データ生成
├── generate_oipf_summary.py     # 研究概要データ生成
├── generate_oipf_details.py     # 研究詳細データ生成
├── load_test_data.py            # OpenSearch投入スクリプト
└── data/
    ├── employees_test.csv       # 生成された従業員CSV
    ├── oipf_summary_test.ndjson # 生成された研究概要NDJSON
    └── oipf_details_test.ndjson # 生成された研究詳細NDJSON
```

## 注意事項

- 乱数シードは固定（42）されているため、再生成しても同じデータが生成されます
- 埋め込みベクトルはダミー（ランダム）です。実際のセマンティック検索には使用できません
- 本番環境への投入は避けてください
