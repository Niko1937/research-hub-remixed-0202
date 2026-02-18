import { useState, useMemo, useRef, useEffect } from "react";
import { Search, X, Info } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import {
  Table, TableHeader, TableBody, TableRow, TableHead, TableCell,
} from "@/components/ui/table";

// --- Types ---
interface QueryContext {
  queryId: string;
  queryText: string;
  centerNodeId: string;
  definitions: Record<string, string>;
  scoringInputs?: Record<string, string[]>;
}

interface NodeMetrics {
  orgReportLineDistance?: number;
  collabResearchCount?: number;
  queryMatchScore?: number;
  relatedDocCreatedCount?: number;
  relevance?: number;
  expertiseScore?: number;
}

interface GraphNode {
  id: string;
  name: string;
  department: string;
  metrics?: NodeMetrics;
}

interface GraphEdge {
  source: string;
  target: string;
  type: string;
  weight: number;
}

interface FullGraphData {
  queryContext: QueryContext;
  nodes: GraphNode[];
  edges: GraphEdge[];
}

// --- Department colors (HSL) ---
const COLOR_PALETTE = [
  "hsl(210, 90%, 58%)",
  "hsl(150, 70%, 55%)",
  "hsl(280, 75%, 65%)",
  "hsl(340, 85%, 60%)",
  "hsl(25, 95%, 58%)",
  "hsl(50, 85%, 55%)",
  "hsl(180, 60%, 50%)",
  "hsl(0, 75%, 60%)",
  "hsl(90, 60%, 50%)",
  "hsl(320, 70%, 55%)",
];

function getDeptColor(dept: string, deptList: string[]): string {
  const idx = deptList.indexOf(dept);
  return COLOR_PALETTE[idx % COLOR_PALETTE.length];
}

function hashString(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = ((h << 5) - h + s.charCodeAt(i)) | 0;
  return Math.abs(h);
}

// --- BFS org-only shortest path ---
function bfsOrgPath(centerId: string, targetId: string, edges: GraphEdge[]): string[] {
  if (centerId === targetId) return [centerId];
  const adj: Record<string, string[]> = {};
  for (const e of edges) {
    if (e.type !== "org") continue;
    if (!adj[e.source]) adj[e.source] = [];
    if (!adj[e.target]) adj[e.target] = [];
    adj[e.source].push(e.target);
    adj[e.target].push(e.source);
  }
  const parent: Record<string, string | null> = { [centerId]: null };
  const visited = new Set([centerId]);
  const queue = [centerId];
  let head = 0;
  while (head < queue.length) {
    const u = queue[head++];
    for (const v of adj[u] || []) {
      if (!visited.has(v)) {
        visited.add(v);
        parent[v] = u;
        if (v === targetId) {
          const path: string[] = [];
          let cur: string | null = v;
          while (cur !== null) { path.push(cur); cur = parent[cur] ?? null; }
          return path.reverse();
        }
        queue.push(v);
      }
    }
  }
  return [];
}

// --- BFS all-edge shortest path (fallback) ---
function bfsAllPath(centerId: string, targetId: string, edges: GraphEdge[]): string[] {
  if (centerId === targetId) return [centerId];
  const adj: Record<string, string[]> = {};
  for (const e of edges) {
    if (!adj[e.source]) adj[e.source] = [];
    if (!adj[e.target]) adj[e.target] = [];
    adj[e.source].push(e.target);
    adj[e.target].push(e.source);
  }
  const parent: Record<string, string | null> = { [centerId]: null };
  const visited = new Set([centerId]);
  const queue = [centerId];
  let head = 0;
  while (head < queue.length) {
    const u = queue[head++];
    for (const v of adj[u] || []) {
      if (!visited.has(v)) {
        visited.add(v);
        parent[v] = u;
        if (v === targetId) {
          const path: string[] = [];
          let cur: string | null = v;
          while (cur !== null) { path.push(cur); cur = parent[cur] ?? null; }
          return path.reverse();
        }
        queue.push(v);
      }
    }
  }
  return [];
}

// --- Layout ---
const RING_RADII: Record<number, number> = { 1: 120, 2: 210, 3: 300, 4: 380 };
function getRingRadius(d: number): number {
  return RING_RADII[d] ?? 380 + (d - 4) * 70;
}

function mapExpertiseToRadius(score?: number): number {
  if (score == null) return 16;
  return 10 + (Math.max(0, Math.min(100, score)) / 100) * 26;
}

function computeLayout(
  nodes: GraphNode[],
  centerId: string,
  width: number,
  height: number
) {
  const cx = width / 2;
  const cy = height / 2;
  const departments = [...new Set(nodes.map((n) => n.department))];
  const deptAngle: Record<string, number> = {};
  departments.forEach((d, i) => {
    deptAngle[d] = (i / departments.length) * 2 * Math.PI - Math.PI / 2;
  });

  const groupKey = (n: GraphNode) => `${n.metrics?.orgReportLineDistance ?? 99}_${n.department}`;
  const groupCount: Record<string, number> = {};
  const groupIdx: Record<string, number> = {};
  for (const n of nodes) {
    if (n.id === centerId) continue;
    const k = groupKey(n);
    groupCount[k] = (groupCount[k] || 0) + 1;
  }

  const positions: Record<string, { x: number; y: number; radius: number }> = {};
  for (const n of nodes) {
    if (n.id === centerId) {
      positions[n.id] = { x: cx, y: cy, radius: 20 };
      continue;
    }
    const dist = n.metrics?.orgReportLineDistance ?? 4;
    const r = getRingRadius(dist);
    const baseAngle = deptAngle[n.department] ?? 0;
    const k = groupKey(n);
    const count = groupCount[k] || 1;
    const idx = groupIdx[k] || 0;
    groupIdx[k] = idx + 1;

    let spread: number;
    if (count === 1) {
      spread = ((hashString(n.id) % 100) / 100 - 0.5) * 0.24;
    } else {
      spread = ((idx / (count - 1)) - 0.5) * 0.35;
    }
    const angle = baseAngle + spread;
    positions[n.id] = {
      x: cx + r * Math.cos(angle),
      y: cy + r * Math.sin(angle),
      radius: mapExpertiseToRadius(n.metrics?.expertiseScore),
    };
  }

  return { positions, departments };
}

// --- Edge styles ---
const EDGE_STYLE: Record<string, { dash: string; color: string; label: string }> = {
  org: { dash: "", color: "hsl(0, 0%, 55%)", label: "組織" },
  collab_research: { dash: "6 3", color: "hsl(210, 70%, 55%)", label: "共同研究" },
  collab_doc: { dash: "2 4", color: "hsl(150, 60%, 50%)", label: "共同文書" },
};

// --- RRF Ranking ---
interface RankedNode {
  node: GraphNode;
  expertiseRank: number;
  relevanceRank: number;
  rrfScore: number;
  finalRank: number;
}

function assignTiedRanks(sorted: GraphNode[], getValue: (n: GraphNode) => number): Map<string, number> {
  const rankMap = new Map<string, number>();
  let rank = 1;
  for (let i = 0; i < sorted.length; i++) {
    if (i > 0 && getValue(sorted[i]) < getValue(sorted[i - 1])) {
      rank = i + 1;
    }
    rankMap.set(sorted[i].id, rank);
  }
  return rankMap;
}

function computeRRFRanking(nodes: GraphNode[], centerId: string, k = 60): RankedNode[] {
  const candidates = nodes.filter(n => n.id !== centerId && n.metrics);
  const n = candidates.length;
  if (n === 0) return [];

  // Rank with ties for expertiseScore
  const byExpertise = [...candidates].sort(
    (a, b) => (b.metrics?.expertiseScore ?? 0) - (a.metrics?.expertiseScore ?? 0)
  );
  const expertiseRankMap = assignTiedRanks(byExpertise, node => node.metrics?.expertiseScore ?? 0);

  // Rank with ties for relevance
  const byRelevance = [...candidates].sort(
    (a, b) => (b.metrics?.relevance ?? 0) - (a.metrics?.relevance ?? 0)
  );
  const relevanceRankMap = assignTiedRanks(byRelevance, node => node.metrics?.relevance ?? 0);

  // Raw RRF scores
  const rawScores = candidates.map(node => {
    const er = expertiseRankMap.get(node.id)!;
    const rr = relevanceRankMap.get(node.id)!;
    return { node, er, rr, raw: 1 / (k + er) + 1 / (k + rr) };
  });

  // Normalize to 0-100 scale
  const maxRaw = Math.max(...rawScores.map(s => s.raw));
  const minRaw = Math.min(...rawScores.map(s => s.raw));
  const range = maxRaw - minRaw || 1;

  const ranked: RankedNode[] = rawScores.map(s => ({
    node: s.node,
    expertiseRank: s.er,
    relevanceRank: s.rr,
    rrfScore: ((s.raw - minRaw) / range) * 100,
    finalRank: 0,
  }));

  ranked.sort((a, b) => b.rrfScore - a.rrfScore);
  // Tied final ranks too
  let fRank = 1;
  for (let i = 0; i < ranked.length; i++) {
    if (i > 0 && ranked[i].rrfScore < ranked[i - 1].rrfScore) {
      fRank = i + 1;
    }
    ranked[i].finalRank = fRank;
  }
  return ranked;
}

// --- Default data ---
const DEFAULT_DATA: FullGraphData = {
  "queryContext": {
    "queryId": "Q-0001",
    "queryText": "（例）量子機械学習について",
    "centerNodeId": "E001",
    "definitions": {
      "orgReportLineDistance": "中心人物(E001)からorgエッジのみでの最短ホップ数",
      "relevance": "orgReportLineDistance と collabResearchCount から算出するスコア(1-100)",
      "expertiseScore": "queryMatchScore と relatedDocCreatedCount から算出するスコア(1-100)"
    },
    "scoringInputs": {
      "relevance": ["orgReportLineDistance", "collabResearchCount"],
      "expertiseScore": ["queryMatchScore", "relatedDocCreatedCount"]
    }
  },
  "nodes": [
    { "id": "E001", "name": "ユーザ", "department": "AI研究" },
    { "id": "E002", "name": "佐藤 花子", "department": "AI研究", "metrics": { "orgReportLineDistance": 1, "collabResearchCount": 3, "queryMatchScore": 59, "relatedDocCreatedCount": 2, "relevance": 82, "expertiseScore": 41 } },
    { "id": "E003", "name": "鈴木 健", "department": "材料開発", "metrics": { "orgReportLineDistance": 1, "collabResearchCount": 9, "queryMatchScore": 36, "relatedDocCreatedCount": 1, "relevance": 100, "expertiseScore": 25 } },
    { "id": "E004", "name": "高橋 美咲", "department": "材料開発", "metrics": { "orgReportLineDistance": 2, "collabResearchCount": 6, "queryMatchScore": 68, "relatedDocCreatedCount": 17, "relevance": 77, "expertiseScore": 66 } },
    { "id": "E005", "name": "伊藤 直樹", "department": "プロセス技術", "metrics": { "orgReportLineDistance": 1, "collabResearchCount": 9, "queryMatchScore": 29, "relatedDocCreatedCount": 10, "relevance": 100, "expertiseScore": 32 } },
    { "id": "E006", "name": "渡辺 彩", "department": "プロセス技術", "metrics": { "orgReportLineDistance": 2, "collabResearchCount": 0, "queryMatchScore": 45, "relatedDocCreatedCount": 8, "relevance": 50, "expertiseScore": 39 } },
    { "id": "E008", "name": "加藤 優", "department": "品質・評価", "metrics": { "orgReportLineDistance": 2, "collabResearchCount": 0, "queryMatchScore": 44, "relatedDocCreatedCount": 7, "relevance": 50, "expertiseScore": 38 } },
    { "id": "E009", "name": "吉田 恒一", "department": "知財", "metrics": { "orgReportLineDistance": 1, "collabResearchCount": 9, "queryMatchScore": 84, "relatedDocCreatedCount": 2, "relevance": 100, "expertiseScore": 57 } },
    { "id": "E010", "name": "中村 玲奈", "department": "知財", "metrics": { "orgReportLineDistance": 2, "collabResearchCount": 6, "queryMatchScore": 72, "relatedDocCreatedCount": 19, "relevance": 77, "expertiseScore": 73 } },
    { "id": "E011", "name": "田中 由紀子", "department": "データ基盤", "metrics": { "orgReportLineDistance": 1, "collabResearchCount": 7, "queryMatchScore": 83, "relatedDocCreatedCount": 2, "relevance": 100, "expertiseScore": 56 } },
    { "id": "E012", "name": "山本 恒一", "department": "AI研究", "metrics": { "orgReportLineDistance": 2, "collabResearchCount": 0, "queryMatchScore": 92, "relatedDocCreatedCount": 20, "relevance": 50, "expertiseScore": 86 } },
    { "id": "E013", "name": "石井 宏", "department": "AI研究", "metrics": { "orgReportLineDistance": 2, "collabResearchCount": 2, "queryMatchScore": 79, "relatedDocCreatedCount": 3, "relevance": 59, "expertiseScore": 55 } },
    { "id": "E014", "name": "藤田 真", "department": "材料開発", "metrics": { "orgReportLineDistance": 2, "collabResearchCount": 2, "queryMatchScore": 43, "relatedDocCreatedCount": 18, "relevance": 59, "expertiseScore": 52 } },
    { "id": "E015", "name": "松本 亮", "department": "生産技術", "metrics": { "orgReportLineDistance": 1, "collabResearchCount": 7, "queryMatchScore": 40, "relatedDocCreatedCount": 3, "relevance": 100, "expertiseScore": 30 } },
    { "id": "E016", "name": "井上 彩香", "department": "プロセス技術", "metrics": { "orgReportLineDistance": 2, "collabResearchCount": 6, "queryMatchScore": 60, "relatedDocCreatedCount": 13, "relevance": 77, "expertiseScore": 56 } },
    { "id": "E017", "name": "山口 遥", "department": "知財", "metrics": { "orgReportLineDistance": 2, "collabResearchCount": 0, "queryMatchScore": 35, "relatedDocCreatedCount": 7, "relevance": 50, "expertiseScore": 32 } },
    { "id": "E018", "name": "岡田 恒一", "department": "データ基盤", "metrics": { "orgReportLineDistance": 2, "collabResearchCount": 4, "queryMatchScore": 95, "relatedDocCreatedCount": 17, "relevance": 68, "expertiseScore": 84 } },
    { "id": "E019", "name": "斎藤 健司", "department": "品質・評価", "metrics": { "orgReportLineDistance": 1, "collabResearchCount": 7, "queryMatchScore": 64, "relatedDocCreatedCount": 2, "relevance": 100, "expertiseScore": 44 } },
    { "id": "E020", "name": "西村 直子", "department": "データ基盤", "metrics": { "orgReportLineDistance": 2, "collabResearchCount": 6, "queryMatchScore": 66, "relatedDocCreatedCount": 2, "relevance": 77, "expertiseScore": 45 } },
    { "id": "E021", "name": "清水 剛", "department": "生産技術", "metrics": { "orgReportLineDistance": 2, "collabResearchCount": 5, "queryMatchScore": 92, "relatedDocCreatedCount": 18, "relevance": 73, "expertiseScore": 84 } },
    { "id": "E022", "name": "森 さくら", "department": "生産技術", "metrics": { "orgReportLineDistance": 2, "collabResearchCount": 0, "queryMatchScore": 32, "relatedDocCreatedCount": 18, "relevance": 50, "expertiseScore": 44 } },
    { "id": "E023", "name": "伊東 真琴", "department": "材料開発", "metrics": { "orgReportLineDistance": 3, "collabResearchCount": 2, "queryMatchScore": 61, "relatedDocCreatedCount": 22, "relevance": 41, "expertiseScore": 68 } },
    { "id": "E024", "name": "橋本 優子", "department": "プロセス技術", "metrics": { "orgReportLineDistance": 3, "collabResearchCount": 0, "queryMatchScore": 75, "relatedDocCreatedCount": 4, "relevance": 32, "expertiseScore": 54 } },
    { "id": "E025", "name": "前田 翔", "department": "品質・評価", "metrics": { "orgReportLineDistance": 2, "collabResearchCount": 3, "queryMatchScore": 47, "relatedDocCreatedCount": 17, "relevance": 64, "expertiseScore": 53 } },
    { "id": "E026", "name": "堀江 彩", "department": "品質・評価", "metrics": { "orgReportLineDistance": 3, "collabResearchCount": 1, "queryMatchScore": 79, "relatedDocCreatedCount": 8, "relevance": 36, "expertiseScore": 62 } },
    { "id": "E007", "name": "小林 卓也", "department": "品質・評価", "metrics": { "orgReportLineDistance": 4, "collabResearchCount": 2, "queryMatchScore": 46, "relatedDocCreatedCount": 10, "relevance": 23, "expertiseScore": 43 } }
  ],
  "edges": [
    { "source": "E001", "target": "E002", "type": "org", "weight": 3 },
    { "source": "E001", "target": "E003", "type": "org", "weight": 3 },
    { "source": "E001", "target": "E005", "type": "org", "weight": 3 },
    { "source": "E001", "target": "E009", "type": "org", "weight": 3 },
    { "source": "E001", "target": "E011", "type": "org", "weight": 3 },
    { "source": "E001", "target": "E015", "type": "org", "weight": 3 },
    { "source": "E001", "target": "E019", "type": "org", "weight": 3 },
    { "source": "E002", "target": "E012", "type": "org", "weight": 2 },
    { "source": "E002", "target": "E013", "type": "org", "weight": 2 },
    { "source": "E003", "target": "E004", "type": "org", "weight": 2 },
    { "source": "E003", "target": "E014", "type": "org", "weight": 2 },
    { "source": "E004", "target": "E023", "type": "org", "weight": 1 },
    { "source": "E005", "target": "E006", "type": "org", "weight": 2 },
    { "source": "E005", "target": "E016", "type": "org", "weight": 2 },
    { "source": "E006", "target": "E024", "type": "org", "weight": 1 },
    { "source": "E009", "target": "E010", "type": "org", "weight": 2 },
    { "source": "E009", "target": "E017", "type": "org", "weight": 2 },
    { "source": "E011", "target": "E018", "type": "org", "weight": 2 },
    { "source": "E011", "target": "E020", "type": "org", "weight": 2 },
    { "source": "E015", "target": "E021", "type": "org", "weight": 2 },
    { "source": "E015", "target": "E022", "type": "org", "weight": 2 },
    { "source": "E019", "target": "E008", "type": "org", "weight": 2 },
    { "source": "E019", "target": "E025", "type": "org", "weight": 2 },
    { "source": "E025", "target": "E026", "type": "org", "weight": 1 },
    { "source": "E026", "target": "E007", "type": "org", "weight": 1 },
    { "source": "E001", "target": "E003", "type": "collab_research", "weight": 4 },
    { "source": "E001", "target": "E005", "type": "collab_research", "weight": 2 },
    { "source": "E001", "target": "E009", "type": "collab_doc", "weight": 5 },
    { "source": "E001", "target": "E011", "type": "collab_doc", "weight": 3 },
    { "source": "E001", "target": "E015", "type": "collab_research", "weight": 2 },
    { "source": "E002", "target": "E011", "type": "collab_doc", "weight": 2 },
    { "source": "E003", "target": "E005", "type": "collab_doc", "weight": 2 },
    { "source": "E003", "target": "E018", "type": "collab_research", "weight": 3 },
    { "source": "E003", "target": "E014", "type": "collab_research", "weight": 2 },
    { "source": "E004", "target": "E016", "type": "collab_doc", "weight": 1 },
    { "source": "E005", "target": "E014", "type": "collab_research", "weight": 2 },
    { "source": "E005", "target": "E020", "type": "collab_doc", "weight": 2 },
    { "source": "E006", "target": "E008", "type": "collab_research", "weight": 1 },
    { "source": "E010", "target": "E017", "type": "collab_doc", "weight": 2 },
    { "source": "E012", "target": "E013", "type": "collab_research", "weight": 2 },
    { "source": "E012", "target": "E018", "type": "collab_doc", "weight": 1 },
    { "source": "E014", "target": "E023", "type": "collab_doc", "weight": 2 },
    { "source": "E016", "target": "E024", "type": "collab_doc", "weight": 2 },
    { "source": "E018", "target": "E020", "type": "collab_research", "weight": 2 },
    { "source": "E020", "target": "E022", "type": "collab_doc", "weight": 1 },
    { "source": "E021", "target": "E022", "type": "collab_research", "weight": 1 },
    { "source": "E009", "target": "E015", "type": "collab_doc", "weight": 2 },
    { "source": "E011", "target": "E015", "type": "collab_doc", "weight": 1 },
    { "source": "E019", "target": "E005", "type": "collab_research", "weight": 1 },
    { "source": "E025", "target": "E008", "type": "collab_doc", "weight": 1 },
    { "source": "E026", "target": "E024", "type": "collab_doc", "weight": 1 }
  ]
};

// --- Component ---
export default function ExpertNetworkView() {
  const [graphData] = useState<FullGraphData>(DEFAULT_DATA);

  const centerId = graphData.queryContext.centerNodeId;
  const [selectedNode, setSelectedNode] = useState<GraphNode | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [hoveredNode, setHoveredNode] = useState<string | null>(null);

  // Edge toggles
  const [showOrg, setShowOrg] = useState(true);
  const [showCollabResearch, setShowCollabResearch] = useState(true);
  const [showCollabDoc, setShowCollabDoc] = useState(true);
  const [showSelectedOnly, setShowSelectedOnly] = useState(false);
  const [showShortestOnly, setShowShortestOnly] = useState(false);

  // Definitions tooltip
  const [showDefs, setShowDefs] = useState(false);

  const SVG_W = 860;
  const SVG_H = 760;

  const svgRef = useRef<SVGSVGElement>(null);

  const { positions, departments } = useMemo(
    () => computeLayout(graphData.nodes, centerId, SVG_W, SVG_H),
    [graphData, centerId]
  );

  // Ring distances from data
  const ringDistances = useMemo(() => {
    const dists = new Set<number>();
    for (const n of graphData.nodes) {
      if (n.id !== centerId && n.metrics?.orgReportLineDistance != null) {
        dists.add(n.metrics.orgReportLineDistance);
      }
    }
    return Array.from(dists).sort((a, b) => a - b);
  }, [graphData, centerId]);

  // Search highlight
  const highlightedIds = useMemo(() => {
    if (!searchQuery.trim()) return new Set<string>();
    const q = searchQuery.toLowerCase();
    return new Set(graphData.nodes.filter((n) => n.name.toLowerCase().includes(q)).map((n) => n.id));
  }, [searchQuery, graphData]);

  // Auto-focus on search result
  useEffect(() => {
    if (highlightedIds.size === 1) {
      const nodeId = [...highlightedIds][0];
      const node = graphData.nodes.find(n => n.id === nodeId);
      if (node) setSelectedNode(node);
    }
  }, [highlightedIds, graphData.nodes]);

  // Org-only shortest path
  const orgPath = useMemo(() => {
    if (!selectedNode || selectedNode.id === centerId) return [];
    return bfsOrgPath(centerId, selectedNode.id, graphData.edges);
  }, [selectedNode, centerId, graphData.edges]);

  // Fallback all-edge path
  const allPath = useMemo(() => {
    if (orgPath.length > 0 || !selectedNode || selectedNode.id === centerId) return [];
    return bfsAllPath(centerId, selectedNode.id, graphData.edges);
  }, [orgPath, selectedNode, centerId, graphData.edges]);

  const activePath = orgPath.length > 0 ? orgPath : allPath;
  const pathNodeSet = useMemo(() => new Set(activePath), [activePath]);
  const pathEdgeSet = useMemo(() => {
    const set = new Set<string>();
    for (let i = 0; i < activePath.length - 1; i++) {
      set.add(`${activePath[i]}-${activePath[i + 1]}`);
      set.add(`${activePath[i + 1]}-${activePath[i]}`);
    }
    return set;
  }, [activePath]);

  const hasSelection = selectedNode !== null && selectedNode.id !== centerId;

  const nodeNameMap = useMemo(() => {
    const m: Record<string, string> = {};
    for (const n of graphData.nodes) m[n.id] = n.name;
    return m;
  }, [graphData]);

  // Should edge be visible?
  const isEdgeVisible = (e: GraphEdge) => {
    if (e.type === "org" && !showOrg) return false;
    if (e.type === "collab_research" && !showCollabResearch) return false;
    if (e.type === "collab_doc" && !showCollabDoc) return false;
    if (showShortestOnly && hasSelection) {
      return pathEdgeSet.has(`${e.source}-${e.target}`) || pathEdgeSet.has(`${e.target}-${e.source}`);
    }
    if (showSelectedOnly && selectedNode) {
      return e.source === selectedNode.id || e.target === selectedNode.id || e.source === centerId || e.target === centerId;
    }
    return true;
  };

  // Deduplicate edges for rendering
  const renderEdges = useMemo(() => {
    const seen = new Set<string>();
    return graphData.edges.filter(e => {
      const key = `${e.source}-${e.target}-${e.type}`;
      const rev = `${e.target}-${e.source}-${e.type}`;
      if (seen.has(key) || seen.has(rev)) return false;
      seen.add(key);
      return true;
    });
  }, [graphData.edges]);

  // RRF Ranking table data
  const rrfRanking = useMemo(
    () => computeRRFRanking(graphData.nodes, centerId),
    [graphData, centerId]
  );

  return (
    <div className="flex flex-col h-full bg-background text-foreground">
      {/* Header */}
      <div className="flex items-center justify-between px-6 py-3 border-b border-border">
        <div className="flex items-center gap-3">
          <h2 className="text-xl font-bold">有識者ネットワーク</h2>
          <Badge variant="outline" className="text-xs text-muted-foreground border-border">
            {graphData.queryContext.queryId}
          </Badge>
          <span className="text-sm text-muted-foreground">
            {graphData.queryContext.queryText}
          </span>
          <TooltipProvider>
            <Tooltip open={showDefs} onOpenChange={setShowDefs}>
              <TooltipTrigger asChild>
                <Button variant="ghost" size="sm" className="h-6 w-6 p-0" onClick={() => setShowDefs(!showDefs)}>
                  <Info className="h-3.5 w-3.5 text-muted-foreground" />
                </Button>
              </TooltipTrigger>
              <TooltipContent side="bottom" className="max-w-sm bg-popover text-popover-foreground border-border z-50">
                <p className="font-semibold text-xs mb-1">スコア定義</p>
                {Object.entries(graphData.queryContext.definitions).map(([k, v]) => (
                  <p key={k} className="text-xs mb-0.5"><span className="font-mono text-primary">{k}</span>: {v}</p>
                ))}
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        </div>
        <div className="relative">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="氏名で検索..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9 w-48 h-9 text-sm bg-secondary border-border"
          />
        </div>
      </div>

      <div className="flex flex-1 overflow-hidden">
        {/* Left control panel */}
        <div className="w-52 border-r border-border p-3 space-y-4 overflow-y-auto shrink-0">
          {/* Edge toggles */}
          <div className="space-y-2">
            <p className="text-xs font-semibold text-muted-foreground">エッジ表示</p>
            {([
              { key: "org", label: "組織 (org)", checked: showOrg, set: setShowOrg, dash: "" },
              { key: "collab_research", label: "共同研究", checked: showCollabResearch, set: setShowCollabResearch, dash: "6 3" },
              { key: "collab_doc", label: "共同文書", checked: showCollabDoc, set: setShowCollabDoc, dash: "2 4" },
            ] as const).map(item => (
              <label key={item.key} className="flex items-center gap-2 text-xs cursor-pointer">
                <Checkbox
                  checked={item.checked}
                  onCheckedChange={(v) => item.set(!!v)}
                  className="h-3.5 w-3.5"
                />
                <svg width="16" height="6"><line x1="0" y1="3" x2="16" y2="3"
                  stroke={EDGE_STYLE[item.key].color}
                  strokeWidth="1.5"
                  strokeDasharray={item.dash} /></svg>
                <span className="text-foreground">{item.label}</span>
              </label>
            ))}
            <div className="border-t border-border pt-2 mt-2 space-y-2">
              <label className="flex items-center gap-2 text-xs cursor-pointer">
                <Checkbox checked={showSelectedOnly} onCheckedChange={(v) => setShowSelectedOnly(!!v)} className="h-3.5 w-3.5" />
                <span className="text-foreground">選択ノード関連のみ</span>
              </label>
              <label className="flex items-center gap-2 text-xs cursor-pointer">
                <Checkbox checked={showShortestOnly} onCheckedChange={(v) => setShowShortestOnly(!!v)} className="h-3.5 w-3.5" />
                <span className="text-foreground">最短経路のみ</span>
              </label>
            </div>
          </div>

          {/* Department legend */}
          <div className="space-y-1.5">
            <p className="text-xs font-semibold text-muted-foreground">部署</p>
            {departments.map((dept) => (
              <div key={dept} className="flex items-center gap-2">
                <span className="inline-block w-3 h-3 rounded-full shrink-0" style={{ background: getDeptColor(dept, departments) }} />
                <span className="text-xs text-foreground truncate">{dept}</span>
              </div>
            ))}
          </div>

          {/* Size legend */}
          <div className="space-y-1">
            <p className="text-xs font-semibold text-muted-foreground">ノードサイズ</p>
            <p className="text-xs text-muted-foreground">= expertiseScore (1-100)</p>
            <div className="flex items-end gap-2 mt-1">
              <div className="flex flex-col items-center">
                <div className="rounded-full bg-muted-foreground" style={{ width: 10, height: 10 }} />
                <span className="text-[9px] text-muted-foreground mt-0.5">低</span>
              </div>
              <div className="flex flex-col items-center">
                <div className="rounded-full bg-muted-foreground" style={{ width: 20, height: 20 }} />
                <span className="text-[9px] text-muted-foreground mt-0.5">中</span>
              </div>
              <div className="flex flex-col items-center">
                <div className="rounded-full bg-muted-foreground" style={{ width: 30, height: 30 }} />
                <span className="text-[9px] text-muted-foreground mt-0.5">高</span>
              </div>
            </div>
          </div>
        </div>

        {/* Main content: SVG + Table */}
        <div className="flex-1 flex flex-col overflow-hidden">
          {/* SVG area */}
          <div className="flex-1 relative overflow-auto flex items-center justify-center min-h-0">
            <svg
              ref={svgRef}
              viewBox={`0 0 ${SVG_W} ${SVG_H}`}
              className="w-full h-full max-w-[950px] max-h-[800px]"
            >
              {/* Ring guides */}
              {ringDistances.map((d) => (
                <g key={`ring-${d}`}>
                  <circle
                    cx={SVG_W / 2} cy={SVG_H / 2} r={getRingRadius(d)}
                    fill="none" stroke="hsl(0, 0%, 40%)" strokeWidth={0.8}
                    strokeDasharray="4 6" opacity={0.5}
                  />
                  <text
                    x={SVG_W / 2 + 6} y={SVG_H / 2 - getRingRadius(d) + 14}
                    fill="hsl(0, 0%, 55%)" fontSize={10} opacity={0.7}
                  >
                    距離 {d}
                  </text>
                </g>
              ))}

              {/* Edges */}
              {renderEdges.map((e, idx) => {
                if (!isEdgeVisible(e)) return null;
                const p1 = positions[e.source];
                const p2 = positions[e.target];
                if (!p1 || !p2) return null;

                const isOnPath = pathEdgeSet.has(`${e.source}-${e.target}`) || pathEdgeSet.has(`${e.target}-${e.source}`);
                const style = EDGE_STYLE[e.type] || EDGE_STYLE.collab_doc;
                const dimmed = hasSelection && !isOnPath;

                return (
                  <line
                    key={`${e.source}-${e.target}-${e.type}-${idx}`}
                    x1={p1.x} y1={p1.y} x2={p2.x} y2={p2.y}
                    stroke={isOnPath ? "hsl(50, 95%, 60%)" : style.color}
                    strokeWidth={isOnPath ? 3 : 1 + e.weight * 0.2}
                    strokeDasharray={isOnPath ? "" : style.dash}
                    opacity={dimmed ? 0.08 : isOnPath ? 1 : 0.3}
                    style={isOnPath ? { filter: "drop-shadow(0 0 4px hsl(50, 95%, 60%))" } : undefined}
                  />
                );
              })}

              {/* Center marker */}
              <g>
                <circle
                  cx={SVG_W / 2} cy={SVG_H / 2} r={20}
                  fill="hsl(0, 0%, 35%)" stroke="hsl(0, 0%, 55%)" strokeWidth={1.5} opacity={0.9}
                />
                <text x={SVG_W / 2} y={SVG_H / 2 + 4} textAnchor="middle"
                  fill="hsl(0, 0%, 95%)" fontSize={10} fontWeight={700}>
                  本人
                </text>
              </g>

              {/* Nodes */}
              {graphData.nodes.filter(n => n.id !== centerId).map((n) => {
                const pos = positions[n.id];
                if (!pos) return null;
                const isSelected = selectedNode?.id === n.id;
                const isSearchHit = highlightedIds.size > 0 && highlightedIds.has(n.id);
                const isOnPath = pathNodeSet.has(n.id);
                const dimmedSearch = highlightedIds.size > 0 && !highlightedIds.has(n.id);
                const dimmedPath = hasSelection && !isOnPath;
                const isDimmed = dimmedSearch || dimmedPath;
                const isHovered = hoveredNode === n.id;
                const color = getDeptColor(n.department, departments);

                return (
                  <g
                    key={n.id}
                    onClick={() => setSelectedNode(isSelected ? null : n)}
                    onMouseEnter={() => setHoveredNode(n.id)}
                    onMouseLeave={() => setHoveredNode(null)}
                    className="cursor-pointer"
                  >
                    {(isSelected || isSearchHit || (isOnPath && hasSelection)) && (
                      <circle cx={pos.x} cy={pos.y} r={pos.radius + 6}
                        fill="none" stroke="hsl(50, 95%, 60%)" strokeWidth={2} opacity={0.8}
                        style={{ filter: "drop-shadow(0 0 6px hsl(50, 95%, 60%))" }} />
                    )}
                    <circle cx={pos.x} cy={pos.y} r={pos.radius}
                      fill={color} opacity={isDimmed ? 0.15 : 0.85} />
                    <text
                      x={pos.x} y={pos.y + pos.radius + 14}
                      textAnchor="middle" fill="hsl(0, 0%, 85%)"
                      fontSize={isHovered || isSelected ? 11 : 10}
                      fontWeight={isHovered || isSelected ? 600 : 400}
                      opacity={isDimmed ? 0.15 : 1}
                    >
                      {n.name}
                    </text>
                  </g>
                );
              })}
            </svg>
          </div>

          {/* RRF Ranking Table */}
          <div className="border-t border-border px-4 py-3 overflow-auto max-h-[320px]">
            <h3 className="text-sm font-bold mb-2 text-foreground">有識者ランキング（RRF）</h3>
            <Table>
              <TableHeader>
                <TableRow className="hover:bg-transparent border-b-0">
                  <TableHead rowSpan={2} className="text-xs w-16 text-center align-middle border-r border-border">総合順位</TableHead>
                  <TableHead rowSpan={2} className="text-xs align-middle border-r border-border">氏名</TableHead>
                  <TableHead rowSpan={2} className="text-xs align-middle border-r border-border">部署</TableHead>
                  <TableHead colSpan={2} className="text-xs text-center border-b border-border border-r border-border">Relevance</TableHead>
                  <TableHead colSpan={2} className="text-xs text-center border-b border-border border-r border-border">Expertise</TableHead>
                  <TableHead rowSpan={2} className="text-xs w-24 text-center align-middle">RRFスコア</TableHead>
                </TableRow>
                <TableRow className="hover:bg-transparent">
                  <TableHead className="text-[10px] text-center w-16 border-r border-border">値</TableHead>
                  <TableHead className="text-[10px] text-center w-16 border-r border-border">順位</TableHead>
                  <TableHead className="text-[10px] text-center w-16 border-r border-border">値</TableHead>
                  <TableHead className="text-[10px] text-center w-16 border-r border-border">順位</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rrfRanking.map((r) => {
                  const isRowSelected = selectedNode?.id === r.node.id;
                  return (
                    <TableRow
                      key={r.node.id}
                      className={`cursor-pointer text-xs ${isRowSelected ? "bg-primary/10" : ""}`}
                      onClick={() => setSelectedNode(isRowSelected ? null : r.node)}
                    >
                      <TableCell className="font-bold text-center text-base border-r border-border">{r.finalRank}</TableCell>
                      <TableCell className="font-medium border-r border-border">{r.node.name}</TableCell>
                      <TableCell className="border-r border-border">
                        <div className="flex items-center gap-1.5">
                          <span className="inline-block w-2.5 h-2.5 rounded-full shrink-0" style={{ background: getDeptColor(r.node.department, departments) }} />
                          {r.node.department}
                        </div>
                      </TableCell>
                      <TableCell className="text-center border-r border-border">{r.node.metrics?.relevance ?? "-"}</TableCell>
                      <TableCell className="text-center text-muted-foreground border-r border-border">{r.relevanceRank}</TableCell>
                      <TableCell className="text-center border-r border-border">{r.node.metrics?.expertiseScore ?? "-"}</TableCell>
                      <TableCell className="text-center text-muted-foreground border-r border-border">{r.expertiseRank}</TableCell>
                      <TableCell className="text-center font-mono">{r.rrfScore.toFixed(1)}</TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        </div>

        {/* Right detail panel */}
        {selectedNode && selectedNode.id !== centerId && (
          <div className="w-72 border-l border-border p-4 overflow-y-auto shrink-0 animate-slide-in-right">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-base font-bold">{selectedNode.name}</h3>
              <Button variant="ghost" size="sm" className="h-6 w-6 p-0" onClick={() => setSelectedNode(null)}>
                <X className="h-4 w-4" />
              </Button>
            </div>
            <Badge variant="outline" className="text-xs mb-3"
              style={{ borderColor: getDeptColor(selectedNode.department, departments), color: getDeptColor(selectedNode.department, departments) }}>
              {selectedNode.department}
            </Badge>

            {/* Metrics grid */}
            {selectedNode.metrics && (
              <div className="grid grid-cols-2 gap-2 mb-4">
                {([
                  { label: "orgReportLineDistance", value: selectedNode.metrics.orgReportLineDistance },
                  { label: "relevance", value: selectedNode.metrics.relevance },
                  { label: "expertiseScore", value: selectedNode.metrics.expertiseScore },
                  { label: "queryMatchScore", value: selectedNode.metrics.queryMatchScore },
                  { label: "collabResearchCount", value: selectedNode.metrics.collabResearchCount },
                  { label: "relatedDocCreatedCount", value: selectedNode.metrics.relatedDocCreatedCount },
                ] as const).map(item => (
                  <div key={item.label} className="bg-secondary rounded p-2">
                    <p className="text-[10px] text-muted-foreground leading-tight">{item.label}</p>
                    <p className="text-lg font-bold">{item.value ?? "-"}</p>
                  </div>
                ))}
              </div>
            )}

            {/* Org shortest path */}
            <div className="border-t border-border pt-3 space-y-2">
              <p className="text-xs font-semibold text-muted-foreground">
                アクセス経路（org最短）
              </p>
              {orgPath.length > 1 ? (
                <p className="text-xs font-mono leading-relaxed text-foreground">
                  {orgPath.map(id => id === centerId ? "本人" : (nodeNameMap[id] || id)).join(" → ")}
                </p>
              ) : orgPath.length === 0 && allPath.length === 0 ? (
                <p className="text-xs text-muted-foreground">経路なし（未接続）</p>
              ) : (
                <>
                  <p className="text-xs text-muted-foreground">org経路なし</p>
                  {allPath.length > 1 && (
                    <>
                      <p className="text-xs font-semibold text-muted-foreground mt-2">代替経路（全エッジ）</p>
                      <p className="text-xs font-mono leading-relaxed text-foreground">
                        {allPath.map(id => id === centerId ? "本人" : (nodeNameMap[id] || id)).join(" → ")}
                      </p>
                    </>
                  )}
                </>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
