"""
KnowWho Data Service

事前処理されたJSONファイルから従業員・研究データを読み込む
"""

import json
from pathlib import Path
from dataclasses import dataclass
from typing import Optional

# Data directory
DATA_DIR = Path(__file__).parent.parent.parent / "data"
KNOWWHO_DB_FILE = DATA_DIR / "knowwho_db.json"
KNOWWHO_EMBEDDINGS_FILE = DATA_DIR / "knowwho_embeddings.json"
KNOWWHO_CLUSTERED_FILE = DATA_DIR / "knowwho_embeddings_clustered.json"
SHAREPOINT_PATHS_FILE = DATA_DIR / "sharepoint_paths_with_embeddings.json"


@dataclass
class Employee:
    """Employee data"""
    employee_id: str
    display_name: str
    mail: str
    job_title: str
    department: str
    manager_employee_id: Optional[str] = None
    research_summary: str = ""
    expertise: list[str] = None
    keywords: list[str] = None
    bio: str = ""
    tsne_x: float = 0.0
    tsne_y: float = 0.0
    cluster_id: Optional[int] = None
    cluster_label: str = ""

    def __post_init__(self):
        if self.expertise is None:
            self.expertise = []
        if self.keywords is None:
            self.keywords = []


@dataclass
class InternalResearch:
    """Internal research data"""
    title: str
    tags: list[str]
    similarity: float
    year: str


@dataclass
class BusinessChallenge:
    """Business challenge data"""
    challenge: str
    business_unit: str
    priority: str
    keywords: list[str]


# Load data from JSON files
def _load_knowwho_data() -> tuple[list[Employee], str]:
    """Load employee data from JSON files"""
    employees = []
    current_user_id = "E100"

    # Load base employee data
    if KNOWWHO_DB_FILE.exists():
        with open(KNOWWHO_DB_FILE, "r", encoding="utf-8") as f:
            data = json.load(f)
            current_user_id = data.get("current_user_id", "E100")

            for emp_data in data.get("employees", []):
                profile = emp_data.get("profile", {})
                employees.append(Employee(
                    employee_id=emp_data["employee_id"],
                    display_name=emp_data["display_name"],
                    mail=emp_data["mail"],
                    job_title=emp_data["job_title"],
                    department=emp_data["department"],
                    manager_employee_id=emp_data.get("manager_employee_id"),
                    research_summary=profile.get("research_summary", ""),
                    expertise=profile.get("expertise", []),
                    keywords=profile.get("keywords", []),
                    bio=profile.get("bio", ""),
                ))

    # Merge t-SNE coordinates and cluster info from clustered file (or fallback to embeddings)
    clustered_file = KNOWWHO_CLUSTERED_FILE if KNOWWHO_CLUSTERED_FILE.exists() else KNOWWHO_EMBEDDINGS_FILE

    if clustered_file.exists():
        with open(clustered_file, "r", encoding="utf-8") as f:
            embeddings_data = json.load(f)
            tsne_cluster_map = {
                e["employee_id"]: {
                    "tsne_x": e.get("tsne_x", 0.0),
                    "tsne_y": e.get("tsne_y", 0.0),
                    "cluster_id": e.get("cluster_id"),
                    "cluster_label": e.get("cluster_label", ""),
                }
                for e in embeddings_data.get("employees", [])
            }

            for emp in employees:
                if emp.employee_id in tsne_cluster_map:
                    info = tsne_cluster_map[emp.employee_id]
                    emp.tsne_x = info["tsne_x"]
                    emp.tsne_y = info["tsne_y"]
                    emp.cluster_id = info["cluster_id"]
                    emp.cluster_label = info["cluster_label"]

    return employees, current_user_id


# Load cluster metadata
def _load_cluster_metadata() -> dict:
    """Load cluster metadata from clustered file"""
    if KNOWWHO_CLUSTERED_FILE.exists():
        with open(KNOWWHO_CLUSTERED_FILE, "r", encoding="utf-8") as f:
            data = json.load(f)
            return data.get("clusters", {})
    return {}


CLUSTER_METADATA = _load_cluster_metadata()


# Initialize data
EMPLOYEES, CURRENT_USER_ID = _load_knowwho_data()

# Create lookup dict
_EMPLOYEE_MAP = {emp.employee_id: emp for emp in EMPLOYEES}


# Mock internal research (static for now)
MOCK_INTERNAL_RESEARCH = [
    InternalResearch("次世代バッテリー材料の開発と評価", ["エネルギー事業部", "材料科学", "電池"], 0.85, "2023"),
    InternalResearch("AI駆動型プロセス最適化システム", ["製造事業部", "AI/ML", "最適化"], 0.72, "2024"),
    InternalResearch("自然言語処理による文書分類システム", ["AI推進部", "NLP", "分類"], 0.68, "2023"),
    InternalResearch("画像認識を用いた品質検査自動化", ["製造事業部", "CV", "品質管理"], 0.65, "2024"),
    InternalResearch("大規模言語モデルの業務適用研究", ["AI推進部", "LLM", "業務効率化"], 0.82, "2024"),
]

# Mock business challenges (static for now)
MOCK_BUSINESS_CHALLENGES = [
    BusinessChallenge("製造ラインの歩留まり向上（目標：5%改善）", "製造事業部", "高", ["歩留まり", "品質管理", "プロセス改善"]),
    BusinessChallenge("新規エネルギー貯蔵システムの開発", "エネルギー事業部", "中", ["バッテリー", "エネルギー", "持続可能性"]),
    BusinessChallenge("顧客問い合わせ対応の自動化", "カスタマーサービス", "高", ["自動化", "NLP", "チャットボット"]),
    BusinessChallenge("研究開発プロセスのDX推進", "研究開発部", "中", ["DX", "効率化", "データ活用"]),
    BusinessChallenge("AIを活用した需要予測システムの構築", "事業開発部", "高", ["AI", "予測", "需要"]),
]


def get_employee_by_id(employee_id: str) -> Optional[Employee]:
    """Get employee by ID"""
    return _EMPLOYEE_MAP.get(employee_id)


def get_ancestors(employee_id: str) -> list[Employee]:
    """Get all ancestors of an employee"""
    ancestors = []
    current_id = employee_id

    while current_id:
        employee = get_employee_by_id(current_id)
        if not employee:
            break
        ancestors.append(employee)
        current_id = employee.manager_employee_id

    return ancestors


def find_path_between(from_id: str, to_id: str) -> tuple[Optional[Employee], list[Employee], int]:
    """
    Find organizational path between two employees

    Returns:
        Tuple of (LCA employee, full path, distance)
    """
    my_ancestors = get_ancestors(from_id)
    my_ancestor_set = {e.employee_id for e in my_ancestors}

    target_ancestors = get_ancestors(to_id)

    lca = None
    lca_index_in_target = -1

    for i, ancestor in enumerate(target_ancestors):
        if ancestor.employee_id in my_ancestor_set:
            lca = ancestor
            lca_index_in_target = i
            break

    if not lca:
        return None, [], -1

    lca_index_in_me = next(
        (i for i, e in enumerate(my_ancestors) if e.employee_id == lca.employee_id),
        -1
    )

    path_from_me = my_ancestors[:lca_index_in_me + 1]
    path_to_target = list(reversed(target_ancestors[:lca_index_in_target]))
    full_path = path_from_me + path_to_target

    distance = len(path_from_me) + len(path_to_target) - 1

    return lca, full_path, distance


def search_internal_research(query: str) -> list[InternalResearch]:
    """Search internal research by query"""
    query_lower = query.lower()

    results = []
    for research in MOCK_INTERNAL_RESEARCH:
        if (
            query_lower[:5] in research.title.lower()
            or any(query_lower[:5] in tag.lower() for tag in research.tags)
        ):
            results.append(research)

    return results


def search_business_challenges(query: str) -> list[BusinessChallenge]:
    """Search business challenges by query"""
    query_lower = query.lower()

    results = []
    for challenge in MOCK_BUSINESS_CHALLENGES:
        if any(kw.lower() in query_lower or query_lower in kw.lower() for kw in challenge.keywords):
            results.append(challenge)

    return results


def search_experts(departments: list[str]) -> list[dict]:
    """Search for experts in given departments"""
    current_user = get_employee_by_id(CURRENT_USER_ID)
    if not current_user:
        return []

    candidates = []

    for emp in EMPLOYEES:
        # Exclude current user, their direct manager, and executives
        if emp.employee_id == CURRENT_USER_ID:
            continue
        if emp.employee_id == current_user.manager_employee_id:
            continue
        if "CEO" in emp.job_title or "執行役" in emp.job_title:
            continue

        # Check if in relevant department
        if not any(dept in emp.department for dept in departments):
            continue

        _, full_path, distance = find_path_between(CURRENT_USER_ID, emp.employee_id)
        same_dept = emp.department == current_user.department

        # Determine approachability
        if same_dept:
            approachability = "direct"
        elif distance <= 3:
            approachability = "introduction"
        else:
            approachability = "via_manager"

        # Determine contact methods based on approachability
        if approachability == "direct":
            contact_methods = ["slack", "email"]
        elif approachability == "introduction":
            contact_methods = ["request_intro", "email"]
        else:
            contact_methods = ["ask_manager"]

        candidates.append({
            "employee_id": emp.employee_id,
            "name": emp.display_name,
            "affiliation": emp.department,
            "role": emp.job_title,
            "mail": emp.mail,
            "approachability": approachability,
            "connectionPath": " → ".join(e.display_name for e in full_path) if full_path else "",
            "distance": distance,
            "contactMethods": contact_methods,
            "suggestedQuestions": [
                f"{emp.display_name}さんの専門分野について教えてください",
                "現在進行中のプロジェクトについて伺いたいです",
            ],
            "pathDetails": [
                {
                    "employee_id": e.employee_id,
                    "name": e.display_name,
                    "role": e.job_title,
                    "department": e.department,
                }
                for e in full_path
            ] if full_path else [],
            # Include profile data for visualization
            "expertise": emp.expertise,
            "keywords": emp.keywords,
            "research_summary": emp.research_summary,
            "tsne_x": emp.tsne_x,
            "tsne_y": emp.tsne_y,
            "cluster_id": emp.cluster_id,
            "cluster_label": emp.cluster_label,
        })

    # Sort by same department first, then by distance
    candidates.sort(key=lambda c: (0 if c["approachability"] == "direct" else 1, c["distance"]))

    return candidates[:10]  # Return top 10


def get_all_employees_for_tsne() -> list[dict]:
    """Get all employees with t-SNE coordinates for visualization"""
    return [
        {
            "employee_id": emp.employee_id,
            "name": emp.display_name,
            "department": emp.department,
            "role": emp.job_title,
            "expertise": emp.expertise,
            "keywords": emp.keywords,
            "tsne_x": emp.tsne_x,
            "tsne_y": emp.tsne_y,
            "cluster_id": emp.cluster_id,
            "cluster_label": emp.cluster_label,
            "is_current_user": emp.employee_id == CURRENT_USER_ID,
        }
        for emp in EMPLOYEES
    ]


def get_cluster_metadata() -> dict:
    """Get cluster metadata (labels, centers, etc.)"""
    return CLUSTER_METADATA


# Legacy compatibility
MOCK_EMPLOYEES = EMPLOYEES


# ============================================================================
# SharePoint Path Data
# ============================================================================

@dataclass
class SharePointPath:
    """SharePoint path data"""
    path_id: str
    name: str
    level: int
    full_path: str
    description: str
    deep_content_summary: str = ""
    keywords: list[str] = None
    embedding: list[float] = None

    def __post_init__(self):
        if self.keywords is None:
            self.keywords = []
        if self.embedding is None:
            self.embedding = []


def _load_sharepoint_data() -> tuple[list[SharePointPath], list[dict], list[dict]]:
    """Load SharePoint path data from JSON file"""
    flat_index = []
    coarse_summaries = []
    paths = []

    if SHAREPOINT_PATHS_FILE.exists():
        with open(SHAREPOINT_PATHS_FILE, "r", encoding="utf-8") as f:
            data = json.load(f)
            flat_index = data.get("flat_index", [])
            coarse_summaries = data.get("coarse_summaries", [])

            for entry in flat_index:
                paths.append(SharePointPath(
                    path_id=entry["path_id"],
                    name=entry["name"],
                    level=entry["level"],
                    full_path=entry["full_path"],
                    description=entry.get("description", ""),
                    deep_content_summary=entry.get("deep_content_summary", ""),
                    keywords=entry.get("keywords", []),
                    embedding=entry.get("embedding", []),
                ))

    return paths, flat_index, coarse_summaries


# Initialize SharePoint data
SHAREPOINT_PATHS, SHAREPOINT_FLAT_INDEX, SHAREPOINT_COARSE_SUMMARIES = _load_sharepoint_data()

# Create lookup dict for paths
_PATH_MAP = {path.path_id: path for path in SHAREPOINT_PATHS}


def search_sharepoint_coarse(query: str) -> list[dict]:
    """
    Coarse-level SharePoint search using top-level summaries.
    Returns matching top-level categories.
    """
    query_lower = query.lower()
    results = []

    for summary in SHAREPOINT_COARSE_SUMMARIES:
        # Check if query matches any keywords
        if any(kw.lower() in query_lower or query_lower in kw.lower()
               for kw in summary.get("keywords", [])):
            results.append({
                "path_id": summary["path_id"],
                "summary": summary["summary"],
                "keywords": summary["keywords"],
                "match_type": "coarse",
            })
        # Also check summary text
        elif query_lower in summary.get("summary", "").lower():
            results.append({
                "path_id": summary["path_id"],
                "summary": summary["summary"],
                "keywords": summary["keywords"],
                "match_type": "coarse",
            })

    return results


def search_sharepoint_fine(query: str, parent_path_id: str = None) -> list[dict]:
    """
    Fine-level SharePoint search within a specific path or all paths.
    Uses keywords and deep content summaries.
    """
    query_lower = query.lower()
    results = []

    for path in SHAREPOINT_PATHS:
        # Filter by parent path if specified
        if parent_path_id and not path.path_id.startswith(parent_path_id):
            continue

        score = 0
        match_reasons = []

        # Check path name
        if query_lower in path.name.lower():
            score += 3
            match_reasons.append("name")

        # Check description
        if query_lower in path.description.lower():
            score += 2
            match_reasons.append("description")

        # Check keywords
        for kw in path.keywords:
            if query_lower in kw.lower() or kw.lower() in query_lower:
                score += 2
                match_reasons.append(f"keyword:{kw}")
                break

        # Check deep content summary
        if path.deep_content_summary and query_lower in path.deep_content_summary.lower():
            score += 1
            match_reasons.append("deep_content")

        if score > 0:
            results.append({
                "path_id": path.path_id,
                "name": path.name,
                "level": path.level,
                "full_path": path.full_path,
                "description": path.description,
                "deep_content_summary": path.deep_content_summary,
                "keywords": path.keywords,
                "score": score,
                "match_reasons": match_reasons,
                "match_type": "fine",
            })

    # Sort by score descending
    results.sort(key=lambda x: x["score"], reverse=True)

    return results[:10]  # Return top 10


def search_sharepoint_coarse2fine(query: str) -> dict:
    """
    Coarse-to-Fine SharePoint search.
    First finds relevant top-level categories, then drills down.
    """
    # Step 1: Coarse search
    coarse_results = search_sharepoint_coarse(query)

    # Step 2: Fine search within matched categories (or all if no coarse match)
    fine_results = []
    if coarse_results:
        for coarse in coarse_results:
            path_prefix = coarse["path_id"]
            fine = search_sharepoint_fine(query, path_prefix)
            fine_results.extend(fine)
    else:
        fine_results = search_sharepoint_fine(query)

    # Deduplicate and sort
    seen = set()
    unique_fine = []
    for r in fine_results:
        if r["path_id"] not in seen:
            seen.add(r["path_id"])
            unique_fine.append(r)

    return {
        "coarse_matches": coarse_results,
        "fine_matches": unique_fine[:10],
        "total_coarse": len(coarse_results),
        "total_fine": len(unique_fine),
    }


def get_sharepoint_path_by_id(path_id: str) -> Optional[SharePointPath]:
    """Get SharePoint path by ID"""
    return _PATH_MAP.get(path_id)


def deep_file_search(query: str, paper_keywords: list[str] = None) -> list[dict]:
    """
    Deep file search for DeepDive mode.
    Search SharePoint paths based on query and paper keywords.
    Returns files relevant to the research paper being analyzed.
    """
    all_keywords = [query]
    if paper_keywords:
        all_keywords.extend(paper_keywords)

    results = []
    seen_paths = set()

    for keyword in all_keywords:
        search_result = search_sharepoint_coarse2fine(keyword)
        for match in search_result.get("fine_matches", []):
            if match["path_id"] in seen_paths:
                continue
            seen_paths.add(match["path_id"])

            # Determine file type based on path content
            path_lower = match["full_path"].lower()
            if "モデル" in path_lower or "データ" in path_lower or "実験" in path_lower:
                file_type = "data"
            elif "図" in path_lower or "資料" in path_lower or "レポート" in path_lower:
                file_type = "figure"
            elif "コード" in path_lower or "アーキテクチャ" in path_lower or "設計" in path_lower:
                file_type = "code"
            elif "論文" in path_lower or "研究" in path_lower or "文献" in path_lower:
                file_type = "reference"
            else:
                file_type = "folder"

            results.append({
                "path": match["full_path"],
                "relevantContent": match.get("deep_content_summary", match.get("description", "")),
                "type": file_type,
                "score": match.get("score", 0),
                "keywords": match.get("keywords", []),
            })

    # Sort by score and limit
    results.sort(key=lambda x: x.get("score", 0), reverse=True)
    return results[:10]
