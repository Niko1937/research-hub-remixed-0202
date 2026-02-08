"""
OIPF Summary Test Data Generator

研究概要テストデータを生成するスクリプト
- 5件の研究概要
- employeesデータと連携（related_researchers）
- 研究テーマタグ
"""

import json
import csv
import random
from pathlib import Path
from datetime import datetime, timedelta

# パス設定
DATA_DIR = Path(__file__).parent / "data"
EMPLOYEES_FILE = DATA_DIR / "employees_test.csv"
OUTPUT_FILE = DATA_DIR / "oipf_summary_test.ndjson"

# 研究テーマ定義（5つの研究プロジェクト）
RESEARCH_PROJECTS = [
    {
        "id": "OIPF-2024-001",
        "title": "次世代AIによる自動運転システムの研究開発",
        "abstract": """本研究では、深層学習と強化学習を組み合わせた次世代自動運転システムの開発を行う。
従来のルールベースシステムでは対応困難だった複雑な交通状況への適応能力を向上させ、
安全性と効率性を両立した自動運転技術の実現を目指す。
特に、リアルタイム画像認識、センサーフュージョン、意思決定アルゴリズムの統合に注力し、
Level 4自動運転の実用化に向けた基盤技術を確立する。""",
        "themetags": ["AI", "機械学習", "自動運転", "深層学習", "画像認識", "センサーフュージョン"],
        "departments": ["AI推進部", "研究開発部"],
        "researcher_count": 8,
    },
    {
        "id": "OIPF-2024-002",
        "title": "高効率エネルギー貯蔵用次世代電池材料の開発",
        "abstract": """再生可能エネルギーの大規模導入に向けて、高効率かつ長寿命のエネルギー貯蔵システムが求められている。
本研究では、全固体電池用の新規固体電解質材料の開発に取り組む。
イオン伝導性と安定性を両立する材料設計指針を確立し、
従来のリチウムイオン電池を凌駕するエネルギー密度と安全性を実現する。
また、量産化を見据えた製造プロセスの最適化も並行して進める。""",
        "themetags": ["材料科学", "電池", "エネルギー", "固体電解質", "ナノテクノロジー"],
        "departments": ["研究開発部", "製造技術部"],
        "researcher_count": 6,
    },
    {
        "id": "OIPF-2024-003",
        "title": "バイオインフォマティクスを活用した創薬支援プラットフォーム",
        "abstract": """AIとビッグデータ解析を活用した次世代創薬プラットフォームの構築を目指す。
タンパク質構造予測、分子動力学シミュレーション、機械学習による候補化合物スクリーニングを統合し、
創薬プロセスの効率化と成功確率向上を図る。
製薬企業との共同研究を通じて、実際の創薬プロジェクトへの適用を進め、
プラットフォームの有効性を検証する。""",
        "themetags": ["バイオ", "創薬", "AI", "ビッグデータ", "タンパク質", "シミュレーション"],
        "departments": ["AI推進部", "技術戦略室"],
        "researcher_count": 5,
    },
    {
        "id": "OIPF-2024-004",
        "title": "産業用協働ロボットの知能化と安全性向上",
        "abstract": """人とロボットが同じ空間で協働する次世代製造システムの実現に向けて、
協働ロボットの知能化と安全性向上に関する研究を行う。
環境認識、動作計画、力覚制御の高度化により、
柔軟で安全な協働作業を可能にする技術を開発する。
中小企業でも導入しやすい低コストかつ高機能なシステムを目指す。""",
        "themetags": ["ロボット", "協働ロボット", "安全性", "センシング", "制御工学", "製造"],
        "departments": ["製造技術部", "研究開発部"],
        "researcher_count": 7,
    },
    {
        "id": "OIPF-2024-005",
        "title": "カーボンニュートラル実現に向けた水素エネルギーシステム",
        "abstract": """2050年カーボンニュートラル達成に向けて、水素エネルギーシステムの高効率化研究を推進する。
水電解による水素製造、水素貯蔵・輸送技術、燃料電池システムの統合最適化を行い、
再生可能エネルギーを活用したグリーン水素の社会実装を加速する。
産学官連携により、技術開発から社会実装までの一貫した取り組みを展開する。""",
        "themetags": ["水素", "エネルギー", "カーボンニュートラル", "燃料電池", "環境", "持続可能性"],
        "departments": ["技術戦略室", "事業開発部"],
        "researcher_count": 6,
    },
]


def load_employees():
    """従業員データを読み込み"""
    if not EMPLOYEES_FILE.exists():
        raise FileNotFoundError(f"従業員データが見つかりません: {EMPLOYEES_FILE}")

    employees = []
    with open(EMPLOYEES_FILE, "r", encoding="utf-8-sig") as f:
        reader = csv.DictReader(f)
        for row in reader:
            employees.append(row)

    return employees


def get_researchers_for_project(employees: list, project: dict) -> list:
    """プロジェクトに関連する研究者を選択"""
    # プロジェクトの部署に所属する従業員をフィルタ
    dept_employees = [
        emp for emp in employees
        if emp["department"] in project["departments"]
        and int(emp["job_level"]) <= 1  # 課長以下（研究実務者）
    ]

    # 必要な人数を選択
    count = min(project["researcher_count"], len(dept_employees))
    selected = random.sample(dept_employees, count)

    return [emp["display_name"] for emp in selected]


def generate_dummy_embedding(dim: int = 1024) -> list:
    """ダミーの埋め込みベクトルを生成"""
    # 正規化されたランダムベクトル
    vec = [random.gauss(0, 1) for _ in range(dim)]
    norm = sum(v * v for v in vec) ** 0.5
    return [v / norm for v in vec]


def generate_oipf_summary(employees: list):
    """OIPF Summaryデータを生成"""
    summaries = []
    base_date = datetime(2024, 4, 1)

    for i, project in enumerate(RESEARCH_PROJECTS):
        # 関連研究者を選択
        researchers = get_researchers_for_project(employees, project)

        # 日付を生成
        created_date = base_date + timedelta(days=i * 30)
        updated_date = created_date + timedelta(days=random.randint(30, 90))

        summary = {
            "oipf_id": project["id"],
            "oipf_research_title": project["title"],
            "oipf_research_abstract": project["abstract"].strip().replace("\n", " "),
            "oipf_research_themetags": project["themetags"],
            "related_researchers": researchers,
            "oipf_status": random.choice(["進行中", "計画中", "完了"]),
            "oipf_created_date": created_date.isoformat(),
            "oipf_updated_date": updated_date.isoformat(),
            "oipf_department": project["departments"][0],
            "oipf_research_abstract_embedding": generate_dummy_embedding(),
        }
        summaries.append(summary)

    return summaries


def save_ndjson(summaries: list):
    """NDJSONファイルに保存"""
    DATA_DIR.mkdir(parents=True, exist_ok=True)

    with open(OUTPUT_FILE, "w", encoding="utf-8") as f:
        for summary in summaries:
            f.write(json.dumps(summary, ensure_ascii=False) + "\n")

    return OUTPUT_FILE


def main():
    print("=" * 60)
    print("OIPF Summary Test Data Generator")
    print("=" * 60)

    # 乱数シードを固定
    random.seed(42)

    # 従業員データを読み込み
    print(f"\n従業員データを読み込み中: {EMPLOYEES_FILE}")
    employees = load_employees()
    print(f"  読み込んだ従業員数: {len(employees)}")

    # Summaryデータを生成
    print("\n研究概要データを生成中...")
    summaries = generate_oipf_summary(employees)
    print(f"  生成した研究概要数: {len(summaries)}")

    # NDJSON保存
    output_path = save_ndjson(summaries)
    print(f"\n出力ファイル: {output_path}")

    # サンプル表示
    print("\n生成したデータ:")
    for s in summaries:
        print(f"\n  [{s['oipf_id']}] {s['oipf_research_title']}")
        print(f"    テーマタグ: {', '.join(s['oipf_research_themetags'][:4])}...")
        print(f"    関連研究者: {', '.join(s['related_researchers'][:3])}...")
        print(f"    ステータス: {s['oipf_status']}")

    return summaries


if __name__ == "__main__":
    summaries = main()
