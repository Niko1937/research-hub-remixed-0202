"""
KnowWho Service

有識者検索・組織経路図サービス
- OpenSearch (employees index) またはモックデータ (JSON) を切り替え可能
- 環境変数 KNOWWHO_USE_OPENSEARCH で制御

機能:
- search_experts: 専門家検索
- find_path_between: 組織経路図
- get_all_employees_for_tsne: t-SNE可視化用データ
"""

import os
from dataclasses import dataclass
from typing import Optional

from app.config import get_settings
from app.services.opensearch_client import opensearch_client


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


class KnowWhoService:
    """
    KnowWho service that can use either OpenSearch or mock data

    Set KNOWWHO_USE_OPENSEARCH=true to use OpenSearch employees index.
    Otherwise, falls back to JSON mock data.
    """

    def __init__(self):
        self.settings = get_settings()
        self._mock_data_loaded = False
        self._mock_employees: list[Employee] = []
        self._mock_employee_map: dict[str, Employee] = {}
        self._mock_current_user_id: str = "E100"
        self._mock_cluster_metadata: dict = {}

    @property
    def use_opensearch(self) -> bool:
        """Check if OpenSearch should be used"""
        env_value = os.getenv("KNOWWHO_USE_OPENSEARCH", "false").lower()
        return env_value == "true" and opensearch_client.is_configured

    @property
    def is_opensearch_available(self) -> bool:
        """Check if OpenSearch employees index is available"""
        return opensearch_client.is_configured

    def _load_mock_data(self):
        """Load mock data from JSON files (lazy loading)"""
        if self._mock_data_loaded:
            return

        # Import mock_data module to get the already loaded data
        from app.services.mock_data import (
            EMPLOYEES,
            CURRENT_USER_ID,
            CLUSTER_METADATA,
            _EMPLOYEE_MAP,
        )

        self._mock_employees = EMPLOYEES
        self._mock_employee_map = _EMPLOYEE_MAP
        self._mock_current_user_id = CURRENT_USER_ID
        self._mock_cluster_metadata = CLUSTER_METADATA
        self._mock_data_loaded = True

    def get_current_user_id(self) -> str:
        """Get current user ID"""
        if self.use_opensearch:
            # For OpenSearch, use environment variable or default
            return os.getenv("KNOWWHO_CURRENT_USER_ID", "E100")
        else:
            self._load_mock_data()
            return self._mock_current_user_id

    async def get_employee_by_id(self, employee_id: str) -> Optional[Employee]:
        """Get employee by ID"""
        if self.use_opensearch:
            return await self._get_employee_by_id_opensearch(employee_id)
        else:
            self._load_mock_data()
            return self._mock_employee_map.get(employee_id)

    async def _get_employee_by_id_opensearch(self, employee_id: str) -> Optional[Employee]:
        """Get employee from OpenSearch by ID"""
        try:
            response = await opensearch_client.get_document(
                index="employees",
                doc_id=employee_id,
            )

            if response and "_source" in response:
                return self._parse_opensearch_employee(response["_source"])
            return None

        except Exception as e:
            print(f"[KnowWhoService] Error getting employee {employee_id}: {e}")
            return None

    def _parse_opensearch_employee(self, source: dict) -> Employee:
        """Parse OpenSearch document to Employee"""
        profile = source.get("profile", {})

        return Employee(
            employee_id=source.get("employee_id", ""),
            display_name=source.get("display_name", ""),
            mail=source.get("mail", ""),
            job_title=source.get("job_title", ""),
            department=source.get("department", ""),
            manager_employee_id=source.get("manager_employee_id"),
            research_summary=profile.get("research_summary", ""),
            expertise=profile.get("expertise", []),
            keywords=profile.get("keywords", []),
            bio=profile.get("bio", ""),
            # t-SNE coordinates not in OpenSearch (computed separately if needed)
            tsne_x=0.0,
            tsne_y=0.0,
            cluster_id=None,
            cluster_label="",
        )

    async def get_ancestors(self, employee_id: str) -> list[Employee]:
        """Get all ancestors of an employee"""
        ancestors = []
        current_id = employee_id

        while current_id:
            employee = await self.get_employee_by_id(current_id)
            if not employee:
                break
            ancestors.append(employee)
            current_id = employee.manager_employee_id

        return ancestors

    async def find_path_between(
        self,
        from_id: str,
        to_id: str,
    ) -> tuple[Optional[Employee], list[Employee], int]:
        """
        Find organizational path between two employees

        Returns:
            Tuple of (LCA employee, full path, distance)
        """
        my_ancestors = await self.get_ancestors(from_id)
        my_ancestor_set = {e.employee_id for e in my_ancestors}

        target_ancestors = await self.get_ancestors(to_id)

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

    async def search_experts(self, departments: list[str]) -> list[dict]:
        """Search for experts in given departments"""
        if self.use_opensearch:
            return await self._search_experts_opensearch(departments)
        else:
            return await self._search_experts_mock(departments)

    async def _search_experts_opensearch(self, departments: list[str]) -> list[dict]:
        """Search experts using OpenSearch"""
        current_user_id = self.get_current_user_id()
        current_user = await self.get_employee_by_id(current_user_id)

        if not current_user:
            print(f"[KnowWhoService] Current user {current_user_id} not found")
            return []

        try:
            # Build department filter query
            should_clauses = []
            for dept in departments:
                should_clauses.append({"match": {"department": dept}})

            query = {
                "bool": {
                    "should": should_clauses,
                    "minimum_should_match": 1,
                    "must_not": [
                        {"term": {"employee_id": current_user_id}},
                    ],
                }
            }

            # Also exclude direct manager
            if current_user.manager_employee_id:
                query["bool"]["must_not"].append(
                    {"term": {"employee_id": current_user.manager_employee_id}}
                )

            response = await opensearch_client.search(
                index="employees",
                query=query,
                size=50,  # Get more candidates for filtering
            )

            hits = response.get("hits", {}).get("hits", [])
            candidates = []

            for hit in hits:
                source = hit["_source"]
                emp = self._parse_opensearch_employee(source)

                # Skip executives
                if "CEO" in emp.job_title or "執行役" in emp.job_title:
                    continue

                # Calculate path
                _, full_path, distance = await self.find_path_between(
                    current_user_id, emp.employee_id
                )

                same_dept = emp.department == current_user.department

                # Determine approachability
                if same_dept:
                    approachability = "direct"
                elif distance <= 3:
                    approachability = "introduction"
                else:
                    approachability = "via_manager"

                # Determine contact methods
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

            return candidates[:10]

        except Exception as e:
            print(f"[KnowWhoService] Error searching experts: {e}")
            return []

    async def _search_experts_mock(self, departments: list[str]) -> list[dict]:
        """Search experts using mock data"""
        self._load_mock_data()

        # Use the existing mock_data function
        from app.services.mock_data import search_experts
        return search_experts(departments)

    async def get_all_employees_for_tsne(self) -> list[dict]:
        """Get all employees with t-SNE coordinates for visualization"""
        if self.use_opensearch:
            return await self._get_all_employees_opensearch()
        else:
            return self._get_all_employees_mock()

    async def _get_all_employees_opensearch(self) -> list[dict]:
        """Get all employees from OpenSearch"""
        current_user_id = self.get_current_user_id()

        try:
            # Get all employees (using scroll for large datasets would be better)
            response = await opensearch_client.search(
                index="employees",
                query={"match_all": {}},
                size=1000,
            )

            hits = response.get("hits", {}).get("hits", [])
            employees = []

            for hit in hits:
                source = hit["_source"]
                profile = source.get("profile", {})

                employees.append({
                    "employee_id": source.get("employee_id", ""),
                    "name": source.get("display_name", ""),
                    "department": source.get("department", ""),
                    "role": source.get("job_title", ""),
                    "expertise": profile.get("expertise", []),
                    "keywords": profile.get("keywords", []),
                    # t-SNE coordinates - not in OpenSearch, would need separate computation
                    "tsne_x": 0.0,
                    "tsne_y": 0.0,
                    "cluster_id": None,
                    "cluster_label": "",
                    "is_current_user": source.get("employee_id") == current_user_id,
                })

            return employees

        except Exception as e:
            print(f"[KnowWhoService] Error getting employees: {e}")
            return []

    def _get_all_employees_mock(self) -> list[dict]:
        """Get all employees from mock data"""
        from app.services.mock_data import get_all_employees_for_tsne
        return get_all_employees_for_tsne()

    def get_cluster_metadata(self) -> dict:
        """Get cluster metadata (only available in mock data mode)"""
        if self.use_opensearch:
            # Cluster metadata not stored in OpenSearch
            return {}
        else:
            self._load_mock_data()
            return self._mock_cluster_metadata

    def get_status(self) -> dict:
        """Get service status"""
        return {
            "mode": "opensearch" if self.use_opensearch else "mock",
            "opensearch_available": self.is_opensearch_available,
            "opensearch_enabled": os.getenv("KNOWWHO_USE_OPENSEARCH", "false").lower() == "true",
        }


# Global service instance
knowwho_service = KnowWhoService()
