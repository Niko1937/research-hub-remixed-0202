"""
Employees Test Data Generator

従業員テストデータを生成するスクリプト
- 100名の従業員
- 6部署に分散
- 組織階層（部長→課長→一般）
- job_level設定
"""

import csv
import random
from pathlib import Path

# 出力先
OUTPUT_DIR = Path(__file__).parent / "data"
OUTPUT_FILE = OUTPUT_DIR / "employees_test.csv"

# 部署定義
DEPARTMENTS = [
    "研究開発部",
    "AI推進部",
    "技術戦略室",
    "事業開発部",
    "企画部",
    "製造技術部",
]

# 名前のパーツ（姓）
LAST_NAMES = [
    "田中", "鈴木", "佐藤", "山田", "高橋", "渡辺", "伊藤", "中村", "小林", "加藤",
    "吉田", "山本", "松本", "井上", "木村", "林", "清水", "山口", "阿部", "森",
    "池田", "橋本", "石川", "山崎", "藤田", "中島", "前田", "小川", "岡田", "後藤",
    "村上", "長谷川", "近藤", "石井", "坂本", "遠藤", "青木", "藤井", "西村", "福田",
]

# 名前のパーツ（名）
FIRST_NAMES = [
    "太郎", "一郎", "健太", "翔太", "大輔", "拓也", "直樹", "雄介", "達也", "和也",
    "花子", "美咲", "さくら", "陽子", "恵子", "裕子", "真由美", "由美", "明美", "久美子",
    "誠", "修", "博", "隆", "茂", "豊", "正", "清", "勝", "実",
    "悠太", "蓮", "大翔", "陽太", "結衣", "葵", "凛", "さな", "美月", "心愛",
]

# 役職名
JOB_TITLES = {
    2: ["部長", "シニアディレクター", "統括マネージャー"],
    1: ["課長", "マネージャー", "チームリーダー", "主任研究員"],
    0: ["研究員", "エンジニア", "アナリスト", "スペシャリスト", "担当"],
}


def generate_name():
    """ランダムな名前を生成"""
    return f"{random.choice(LAST_NAMES)} {random.choice(FIRST_NAMES)}"


def generate_email(name: str, employee_id: str) -> str:
    """メールアドレスを生成"""
    # 名前からローマ字風のメールアドレスを生成
    return f"{employee_id.lower()}@example.com"


def generate_employees():
    """従業員データを生成"""
    employees = []
    employee_id_counter = 1

    # 各部署の構成を定義
    dept_structure = {
        "研究開発部": {"部長": 1, "課長": 3, "一般": 16},      # 20名
        "AI推進部": {"部長": 1, "課長": 3, "一般": 14},        # 18名
        "技術戦略室": {"部長": 1, "課長": 2, "一般": 12},      # 15名
        "事業開発部": {"部長": 1, "課長": 2, "一般": 12},      # 15名
        "企画部": {"部長": 1, "課長": 2, "一般": 12},          # 15名
        "製造技術部": {"部長": 1, "課長": 3, "一般": 13},      # 17名
    }

    used_names = set()

    for dept in DEPARTMENTS:
        structure = dept_structure[dept]
        dept_employees = []

        # 部長を生成
        for _ in range(structure["部長"]):
            while True:
                name = generate_name()
                if name not in used_names:
                    used_names.add(name)
                    break

            emp_id = f"E{employee_id_counter:03d}"
            employee_id_counter += 1

            emp = {
                "employee_id": emp_id,
                "display_name": name,
                "mail": generate_email(name, emp_id),
                "job_title": random.choice(JOB_TITLES[2]),
                "department": dept,
                "job_level": 2,
                "manager_mail": "",  # 部長は上司なし（テスト用）
                "role": "部長",
            }
            dept_employees.append(emp)
            employees.append(emp)

        # 部長のメールを取得
        dept_manager_mail = dept_employees[0]["mail"]

        # 課長を生成
        section_managers = []
        for _ in range(structure["課長"]):
            while True:
                name = generate_name()
                if name not in used_names:
                    used_names.add(name)
                    break

            emp_id = f"E{employee_id_counter:03d}"
            employee_id_counter += 1

            emp = {
                "employee_id": emp_id,
                "display_name": name,
                "mail": generate_email(name, emp_id),
                "job_title": random.choice(JOB_TITLES[1]),
                "department": dept,
                "job_level": 1,
                "manager_mail": dept_manager_mail,
                "role": "課長",
            }
            section_managers.append(emp)
            dept_employees.append(emp)
            employees.append(emp)

        # 一般社員を生成（課長に均等に配属）
        general_count = structure["一般"]
        for i in range(general_count):
            while True:
                name = generate_name()
                if name not in used_names:
                    used_names.add(name)
                    break

            emp_id = f"E{employee_id_counter:03d}"
            employee_id_counter += 1

            # 課長を順番に割り当て
            manager = section_managers[i % len(section_managers)]

            emp = {
                "employee_id": emp_id,
                "display_name": name,
                "mail": generate_email(name, emp_id),
                "job_title": random.choice(JOB_TITLES[0]),
                "department": dept,
                "job_level": 0,
                "manager_mail": manager["mail"],
                "role": "一般",
            }
            dept_employees.append(emp)
            employees.append(emp)

    return employees


def save_csv(employees: list):
    """CSVファイルに保存"""
    OUTPUT_DIR.mkdir(parents=True, exist_ok=True)

    fieldnames = [
        "employee_id", "display_name", "mail", "job_title",
        "department", "job_level", "manager_mail"
    ]

    with open(OUTPUT_FILE, "w", newline="", encoding="utf-8-sig") as f:
        writer = csv.DictWriter(f, fieldnames=fieldnames)
        writer.writeheader()
        for emp in employees:
            row = {k: emp[k] for k in fieldnames}
            writer.writerow(row)

    return OUTPUT_FILE


def main():
    print("=" * 60)
    print("Employees Test Data Generator")
    print("=" * 60)

    # 乱数シードを固定（再現性のため）
    random.seed(42)

    employees = generate_employees()

    # 統計表示
    print(f"\n生成した従業員数: {len(employees)}")

    # 部署別集計
    print("\n部署別人数:")
    dept_counts = {}
    for emp in employees:
        dept = emp["department"]
        dept_counts[dept] = dept_counts.get(dept, 0) + 1
    for dept, count in dept_counts.items():
        print(f"  {dept}: {count}名")

    # 職階別集計
    print("\n職階別人数:")
    level_counts = {0: 0, 1: 0, 2: 0}
    for emp in employees:
        level_counts[emp["job_level"]] += 1
    print(f"  部長級 (job_level=2): {level_counts[2]}名")
    print(f"  課長級 (job_level=1): {level_counts[1]}名")
    print(f"  一般 (job_level=0): {level_counts[0]}名")

    # CSV保存
    output_path = save_csv(employees)
    print(f"\n出力ファイル: {output_path}")

    # 研究者候補リストを出力（oipf-summaryで使用）
    researchers = [emp["display_name"] for emp in employees if emp["job_level"] <= 1]
    print(f"\n研究者候補（oipf-summary用）: {len(researchers)}名")

    # サンプル表示
    print("\nサンプルデータ（最初の5名）:")
    for emp in employees[:5]:
        print(f"  {emp['employee_id']}: {emp['display_name']} ({emp['job_title']}, {emp['department']}, level={emp['job_level']})")

    return employees


if __name__ == "__main__":
    employees = main()
