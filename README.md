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
# LLM設定（必須）
LLM_BASE_URL=https://your-llm-api-endpoint.com
LLM_API_KEY=your-api-key
LLM_MODEL=vertex_ai.gemini-2.5-flash

# プロキシ設定（オプション）
# プロキシ環境で使用する場合は以下を設定
# PROXY_ENABLED=true
# PROXY_URL=http://proxy.example.com:8080
```

#### プロキシ環境での設定

プロキシサーバー経由でLLM APIにアクセスする必要がある場合:

```env
PROXY_ENABLED=true
PROXY_URL=http://proxy.example.com:8080
```

プロキシが不要な環境では、`PROXY_ENABLED`と`PROXY_URL`は設定不要です（デフォルトでプロキシは無効）。

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
uvicorn app.main:app --reload --port 8000
```

バックエンドは http://localhost:8000 で起動します。

## 開発

### フロントエンド開発サーバー
```bash
npm run dev
```

### バックエンド開発サーバー
```bash
cd backend
uvicorn app.main:app --reload --port 8000
```

### 両方を同時に起動
ターミナルを2つ開いて、それぞれでフロントエンドとバックエンドを起動してください。

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
├── public/                 # 静的ファイル
├── package.json            # Node.js依存関係
└── .env                    # 環境変数（gitignore対象）
```

## 注意事項

- `.env`ファイルはGitにコミットしないでください（`.gitignore`で除外済み）
- `node_modules/`と`backend/.venv/`もGitにコミットしないでください

## ライセンス

Private
