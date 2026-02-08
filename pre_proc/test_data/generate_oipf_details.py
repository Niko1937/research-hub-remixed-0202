"""
OIPF Details Test Data Generator

研究詳細テストデータを生成するスクリプト
- 100件の研究詳細
- oipf-summaryと連携
"""

import json
import random
from pathlib import Path
from datetime import datetime, timedelta

# パス設定
DATA_DIR = Path(__file__).parent / "data"
SUMMARY_FILE = DATA_DIR / "oipf_summary_test.ndjson"
OUTPUT_FILE = DATA_DIR / "oipf_details_test.ndjson"

# 研究詳細のテンプレート（各プロジェクトごとに20件ずつ生成）
DETAIL_TEMPLATES = {
    "OIPF-2024-001": {
        "project_name": "次世代AI自動運転",
        "categories": ["画像認識", "センサー統合", "経路計画", "シミュレーション", "実車検証"],
        "contents": [
            "LiDARセンサーデータの3D点群処理アルゴリズムの最適化",
            "カメラ画像からの歩行者検出精度向上",
            "悪天候時の視認性改善技術の開発",
            "リアルタイム物体追跡システムの実装",
            "センサーフュージョンによる環境認識精度の評価",
            "深層学習モデルの軽量化と推論速度の改善",
            "シミュレーション環境での大規模テストデータ生成",
            "実道路での走行データ収集と分析",
            "緊急回避システムの応答時間短縮",
            "V2X通信を活用した協調走行の検討",
            "強化学習による意思決定モデルの訓練",
            "エッジコンピューティング向けモデル最適化",
            "夜間走行における認識精度の検証",
            "交差点での右左折判断アルゴリズム開発",
            "駐車支援システムとの連携機能実装",
            "OTA（Over-The-Air）アップデート機構の設計",
            "サイバーセキュリティ対策の強化",
            "機能安全規格ISO 26262への適合検証",
            "ユーザーインターフェースの設計と評価",
            "量産化に向けたコスト削減検討",
        ],
    },
    "OIPF-2024-002": {
        "project_name": "次世代電池材料",
        "categories": ["材料合成", "物性評価", "電気化学", "シミュレーション", "量産化"],
        "contents": [
            "新規固体電解質材料の合成条件最適化",
            "イオン伝導度測定と温度依存性評価",
            "電極-電解質界面の安定性向上",
            "第一原理計算によるイオン伝導機構解析",
            "充放電サイクル特性の長期評価",
            "高温環境下での材料安定性検証",
            "電極材料との適合性評価",
            "インピーダンス分光法による内部抵抗解析",
            "薄膜電池セルの試作と評価",
            "量産プロセスのスケールアップ検討",
            "原料コスト低減のための代替材料探索",
            "環境負荷低減を考慮した製造プロセス設計",
            "品質管理手法の確立",
            "異常検知システムの開発",
            "電池パック設計への組み込み検討",
            "安全性試験（過充電、短絡、高温）の実施",
            "リサイクルプロセスの検討",
            "特許調査と知財戦略の立案",
            "競合技術との比較分析",
            "事業化に向けたロードマップ策定",
        ],
    },
    "OIPF-2024-003": {
        "project_name": "創薬支援AI",
        "categories": ["データ解析", "機械学習", "分子設計", "検証実験", "プラットフォーム"],
        "contents": [
            "タンパク質構造予測モデルの精度改善",
            "分子動力学シミュレーションの高速化",
            "化合物ライブラリのスクリーニング自動化",
            "薬物動態予測モデルの構築",
            "毒性予測AIの開発と検証",
            "標的タンパク質とリガンドの結合予測",
            "新規化合物の生成モデル開発",
            "臨床データとの相関分析",
            "バイオマーカー探索アルゴリズムの改良",
            "マルチオミクスデータ統合解析基盤の構築",
            "創薬ターゲット優先順位付けシステム",
            "副作用予測モデルの精緻化",
            "個別化医療に向けた遺伝子解析パイプライン",
            "製薬企業との共同研究プロジェクト推進",
            "規制対応を考慮したデータ管理体制",
            "解釈可能なAIモデルの開発",
            "実験結果フィードバックシステムの構築",
            "クラウド計算基盤の最適化",
            "ユーザー向けWebインターフェース開発",
            "導入効果の定量的評価手法確立",
        ],
    },
    "OIPF-2024-004": {
        "project_name": "協働ロボット知能化",
        "categories": ["環境認識", "動作計画", "力覚制御", "安全機構", "システム統合"],
        "contents": [
            "3Dカメラによる作業空間認識システム",
            "人体検出と姿勢推定アルゴリズム",
            "動的障害物回避のための経路再計画",
            "力覚センサーによる接触検知と応答",
            "柔軟物ハンドリング技術の開発",
            "組立作業の自動動作生成",
            "人間の意図推定と先読み動作",
            "音声・ジェスチャーによる直感的指示",
            "安全停止機能の応答時間短縮",
            "リスクアセスメント手法の確立",
            "ISO/TS 15066準拠の検証",
            "複数ロボット協調制御システム",
            "教示作業の簡素化と時間短縮",
            "異常検知と自己診断機能",
            "予知保全システムの構築",
            "中小企業向け導入パッケージ開発",
            "ROI評価ツールの作成",
            "オペレーター訓練プログラム設計",
            "実工場での実証実験計画",
            "導入事例のドキュメント化",
        ],
    },
    "OIPF-2024-005": {
        "project_name": "水素エネルギー",
        "categories": ["水素製造", "貯蔵・輸送", "燃料電池", "システム統合", "社会実装"],
        "contents": [
            "高効率水電解セルの開発",
            "再生可能エネルギー連携運転制御",
            "水素貯蔵タンクの軽量化技術",
            "液化水素輸送システムの効率化",
            "燃料電池スタックの耐久性向上",
            "白金代替触媒材料の探索",
            "システム全体のエネルギー効率最適化",
            "需給予測に基づく運転計画",
            "水素ステーション設計の標準化",
            "安全基準の策定と検証",
            "カーボンフットプリント評価",
            "経済性評価モデルの構築",
            "地域エネルギーシステムとの統合",
            "産業用水素利用の実証",
            "水素サプライチェーン全体最適化",
            "政策提言に向けた分析",
            "国際標準化活動への参画",
            "人材育成プログラムの設計",
            "広報・啓発活動の企画",
            "次期プロジェクト計画の策定",
        ],
    },
}

# 進捗状況のテンプレート
PROGRESS_TEMPLATES = [
    "計画通り進行中。{milestone}を達成。",
    "若干の遅延あり。{issue}の解決に取り組み中。",
    "予定より前倒しで進行。{achievement}を実現。",
    "検証フェーズ中。{test}の結果を分析中。",
    "レビュー待ち。{deliverable}の承認プロセス中。",
]

MILESTONES = ["第1次マイルストーン", "プロトタイプ完成", "基本設計完了", "性能目標達成"]
ISSUES = ["技術的課題", "リソース調整", "外部依存要因", "仕様変更対応"]
ACHIEVEMENTS = ["目標性能の120%達成", "新規手法の確立", "特許出願完了", "論文採択"]
TESTS = ["ベンチマークテスト", "実環境評価", "ユーザー検証", "負荷試験"]
DELIVERABLES = ["設計書", "評価レポート", "試作品", "導入計画"]


def load_summary():
    """oipf-summaryデータを読み込み"""
    if not SUMMARY_FILE.exists():
        raise FileNotFoundError(f"Summaryデータが見つかりません: {SUMMARY_FILE}")

    summaries = []
    with open(SUMMARY_FILE, "r", encoding="utf-8") as f:
        for line in f:
            if line.strip():
                summaries.append(json.loads(line))

    return summaries


def generate_dummy_embedding(dim: int = 1024) -> list:
    """ダミーの埋め込みベクトルを生成"""
    vec = [random.gauss(0, 1) for _ in range(dim)]
    norm = sum(v * v for v in vec) ** 0.5
    return [v / norm for v in vec]


def generate_progress():
    """進捗状況を生成"""
    template = random.choice(PROGRESS_TEMPLATES)
    if "{milestone}" in template:
        return template.format(milestone=random.choice(MILESTONES))
    elif "{issue}" in template:
        return template.format(issue=random.choice(ISSUES))
    elif "{achievement}" in template:
        return template.format(achievement=random.choice(ACHIEVEMENTS))
    elif "{test}" in template:
        return template.format(test=random.choice(TESTS))
    elif "{deliverable}" in template:
        return template.format(deliverable=random.choice(DELIVERABLES))
    return template


def generate_oipf_details(summaries: list):
    """OIPF Detailsデータを生成"""
    details = []
    base_date = datetime(2024, 4, 1)

    for summary in summaries:
        oipf_id = summary["oipf_id"]
        template = DETAIL_TEMPLATES.get(oipf_id)

        if not template:
            continue

        # 各プロジェクトから20件のdetailを生成
        for i, content in enumerate(template["contents"]):
            detail_id = f"{oipf_id}-D{i+1:03d}"
            category = template["categories"][i % len(template["categories"])]
            created_date = base_date + timedelta(days=random.randint(0, 180))
            updated_date = created_date + timedelta(days=random.randint(1, 60))

            detail = {
                "detail_id": detail_id,
                "parent_oipf_id": oipf_id,
                "project_name": template["project_name"],
                "detail_title": content,
                "detail_category": category,
                "detail_description": f"{content}に関する詳細な研究活動。{summary['oipf_research_title']}の一環として実施。",
                "progress_status": generate_progress(),
                "completion_rate": random.randint(0, 100),
                "priority": random.choice(["高", "中", "低"]),
                "created_date": created_date.isoformat(),
                "updated_date": updated_date.isoformat(),
                "related_themetags": random.sample(summary["oipf_research_themetags"], min(3, len(summary["oipf_research_themetags"]))),
                "detail_embedding": generate_dummy_embedding(),
            }
            details.append(detail)

    return details


def save_ndjson(details: list):
    """NDJSONファイルに保存"""
    DATA_DIR.mkdir(parents=True, exist_ok=True)

    with open(OUTPUT_FILE, "w", encoding="utf-8") as f:
        for detail in details:
            f.write(json.dumps(detail, ensure_ascii=False) + "\n")

    return OUTPUT_FILE


def main():
    print("=" * 60)
    print("OIPF Details Test Data Generator")
    print("=" * 60)

    # 乱数シードを固定
    random.seed(42)

    # Summaryデータを読み込み
    print(f"\nSummaryデータを読み込み中: {SUMMARY_FILE}")
    summaries = load_summary()
    print(f"  読み込んだSummary数: {len(summaries)}")

    # Detailsデータを生成
    print("\n研究詳細データを生成中...")
    details = generate_oipf_details(summaries)
    print(f"  生成した研究詳細数: {len(details)}")

    # プロジェクト別集計
    print("\nプロジェクト別詳細件数:")
    project_counts = {}
    for d in details:
        pid = d["parent_oipf_id"]
        project_counts[pid] = project_counts.get(pid, 0) + 1
    for pid, count in project_counts.items():
        print(f"  {pid}: {count}件")

    # NDJSON保存
    output_path = save_ndjson(details)
    print(f"\n出力ファイル: {output_path}")

    # サンプル表示
    print("\nサンプルデータ（最初の3件）:")
    for d in details[:3]:
        print(f"\n  [{d['detail_id']}] {d['detail_title'][:30]}...")
        print(f"    プロジェクト: {d['project_name']}")
        print(f"    カテゴリ: {d['detail_category']}")
        print(f"    進捗: {d['completion_rate']}%")

    return details


if __name__ == "__main__":
    details = main()
