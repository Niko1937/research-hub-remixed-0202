import { useRef, useState } from "react";

interface Expert {
  name: string;
  affiliation: string;
  role: string;
  approachability: 'direct' | 'introduction' | 'via_manager';
  connectionPath?: string;
  suggestedQuestions: string[];
  contactMethods: ('slack' | 'email' | 'request_intro' | 'ask_manager')[];
}

interface NetworkNode {
  id: string;
  label: string;
  type: 'user' | 'expert' | 'intermediary';
  approachability?: 'direct' | 'introduction' | 'via_manager';
  x: number;
  y: number;
  affiliation: string;
  role: string;
}

// 職階の階層定義 (上が高い)
const roleHierarchy: Record<string, number> = {
  'CEO': 0,
  '社長': 0,
  '取締役': 1,
  '本部長': 2,
  '部長': 2,
  'Director': 2,
  '副部長': 3,
  'マネージャー': 3,
  '課長': 3,
  'Manager': 3,
  'リーダー': 4,
  '主任': 4,
  'Lead': 4,
  'Principal': 4,
  'Senior': 5,
  'シニア': 5,
  '研究員': 5,
  'Researcher': 5,
  'Engineer': 6,
  'エンジニア': 6,
  'Associate': 6,
  'アソシエイト': 6,
  'Staff': 7,
  'スタッフ': 7,
  'Junior': 8,
  'ジュニア': 8,
};

// 組織分類の距離定義 (同じ部門ほど近い)
const getOrgDistance = (aff1: string, aff2: string): number => {
  if (aff1 === aff2) return 0;
  // 同じ系統の部門 (e.g., 研究部門同士)
  const getCategory = (aff: string): string => {
    if (aff.includes('研究') || aff.includes('R&D') || aff.includes('リサーチ')) return 'research';
    if (aff.includes('開発') || aff.includes('エンジニア') || aff.includes('技術')) return 'engineering';
    if (aff.includes('営業') || aff.includes('マーケ') || aff.includes('事業')) return 'business';
    if (aff.includes('企画') || aff.includes('戦略')) return 'strategy';
    if (aff.includes('人事') || aff.includes('総務') || aff.includes('管理')) return 'admin';
    return 'other';
  };
  if (getCategory(aff1) === getCategory(aff2)) return 1;
  return 2;
};

const getRoleLevel = (role: string): number => {
  for (const [keyword, level] of Object.entries(roleHierarchy)) {
    if (role.includes(keyword)) return level;
  }
  return 6; // デフォルトは中間レベル
};

interface NetworkEdge {
  from: string;
  to: string;
  weight: number; // 0-1, combined org proximity + research similarity
  orgWeight: number;
  researchWeight: number;
}

interface ExpertNetworkGraphProps {
  experts: Expert[];
}

const approachabilityColors = {
  user: { fill: "hsl(var(--primary))", stroke: "hsl(var(--primary))" },
  direct: { fill: "hsl(142 76% 36%)", stroke: "hsl(142 76% 36%)" },
  introduction: { fill: "hsl(45 93% 47%)", stroke: "hsl(45 93% 47%)" },
  via_manager: { fill: "hsl(0 84% 60%)", stroke: "hsl(0 84% 60%)" },
};

export function ExpertNetworkGraph({ experts }: ExpertNetworkGraphProps) {
  const svgRef = useRef<SVGSVGElement>(null);
  const [hoveredNode, setHoveredNode] = useState<string | null>(null);

  // Generate network data with hierarchy (Y) x org distance (X) positioning
  const generateNetworkData = () => {
    const nodes: NetworkNode[] = [];
    const edges: NetworkEdge[] = [];
    
    const userAffiliation = '自チーム';
    const userRoleLevel = 6; // 自分の職階レベル

    // Collect all unique affiliations and assign X positions
    const allAffiliations = new Set<string>([userAffiliation]);
    experts.forEach(e => allAffiliations.add(e.affiliation));
    
    // Sort affiliations by distance from user's team
    const sortedAffiliations = Array.from(allAffiliations).sort((a, b) => {
      const distA = getOrgDistance(userAffiliation, a);
      const distB = getOrgDistance(userAffiliation, b);
      return distA - distB;
    });
    
    // Assign X position per affiliation (spread across width)
    const affiliationXMap = new Map<string, number>();
    const leftMargin = 70;
    const rightMargin = 430;
    const affiliationCount = sortedAffiliations.length;
    sortedAffiliations.forEach((aff, idx) => {
      const x = affiliationCount === 1 
        ? (leftMargin + rightMargin) / 2 
        : leftMargin + (idx / (affiliationCount - 1)) * (rightMargin - leftMargin);
      affiliationXMap.set(aff, x);
    });

    // Y position based on role hierarchy (top = senior, bottom = junior)
    const topMargin = 50;
    const bottomMargin = 340;
    const levelToY = (level: number): number => {
      const minLevel = 0;
      const maxLevel = 8;
      return topMargin + ((level - minLevel) / (maxLevel - minLevel)) * (bottomMargin - topMargin);
    };

    // Add user node
    nodes.push({
      id: 'user',
      label: 'あなた',
      type: 'user',
      x: affiliationXMap.get(userAffiliation) || leftMargin,
      y: levelToY(userRoleLevel),
      affiliation: userAffiliation,
      role: '',
    });

    // Track positions to avoid overlap
    const positionOffsets = new Map<string, number>();
    
    // Add intermediary nodes
    const intermediaries: { id: string; name: string; x: number; y: number; role: string }[] = [];

    // Add expert nodes positioned by role (Y) and affiliation (X)
    experts.forEach((expert, index) => {
      const roleLevel = getRoleLevel(expert.role);
      const baseX = affiliationXMap.get(expert.affiliation) || 250;
      const baseY = levelToY(roleLevel);
      
      // Offset to avoid exact overlap
      const posKey = `${Math.round(baseX)}-${Math.round(baseY)}`;
      const offset = positionOffsets.get(posKey) || 0;
      positionOffsets.set(posKey, offset + 1);
      
      const x = baseX + (offset % 3) * 35 - 35;
      const y = baseY + Math.floor(offset / 3) * 30;

      nodes.push({
        id: `expert-${index}`,
        label: expert.name,
        type: 'expert',
        approachability: expert.approachability,
        x,
        y,
        affiliation: expert.affiliation,
        role: expert.role,
      });
      
      // Add intermediaries for indirect connections
      if (expert.approachability === 'introduction') {
        const intermediaryId = `intro-${expert.affiliation}`;
        if (!intermediaries.find(i => i.id === intermediaryId)) {
          const introX = (affiliationXMap.get(userAffiliation)! + baseX) / 2;
          const introY = (levelToY(userRoleLevel) + baseY) / 2;
          intermediaries.push({
            id: intermediaryId,
            name: '共通知人',
            x: introX,
            y: introY,
            role: 'intermediary',
          });
        }
      } else if (expert.approachability === 'via_manager') {
        const managerId = `manager-${expert.affiliation}`;
        if (!intermediaries.find(i => i.id === managerId)) {
          const managerX = (affiliationXMap.get(userAffiliation)! + baseX) / 2 + 20;
          const managerY = Math.min(levelToY(userRoleLevel), baseY) - 30;
          intermediaries.push({
            id: managerId,
            name: '上司',
            x: managerX,
            y: Math.max(topMargin, managerY),
            role: 'manager',
          });
        }
      }
    });

    // Add intermediary nodes
    intermediaries.forEach(inter => {
      nodes.push({
        id: inter.id,
        label: inter.name,
        type: 'intermediary',
        x: inter.x,
        y: inter.y,
        affiliation: '',
        role: '',
      });
    });

    // Calculate research similarity based on affiliation overlap
    const getResearchSimilarity = (exp1Idx: number, exp2Idx: number): number => {
      const exp1 = experts[exp1Idx];
      const exp2 = experts[exp2Idx];
      if (exp1.affiliation === exp2.affiliation) return 0.8;
      // Partial similarity for related fields (simplified heuristic)
      if (exp1.affiliation.includes(exp2.affiliation.slice(0, 2)) ||
          exp2.affiliation.includes(exp1.affiliation.slice(0, 2))) return 0.4;
      return 0.1;
    };

    // Create edges from user to experts (direct or via intermediaries)
    experts.forEach((expert, index) => {
      const orgWeight = expert.approachability === 'direct' ? 1.0 :
                        expert.approachability === 'introduction' ? 0.5 : 0.2;
      
      if (expert.approachability === 'direct') {
        // Direct connection
        edges.push({
          from: 'user',
          to: `expert-${index}`,
          weight: orgWeight,
          orgWeight,
          researchWeight: 0.5,
        });
      } else if (expert.approachability === 'introduction') {
        // Via intermediary
        const introId = intermediaries.find(i => i.id.startsWith('intro-'))?.id;
        if (introId) {
          // User to intermediary
          if (!edges.find(e => e.from === 'user' && e.to === introId)) {
            edges.push({
              from: 'user',
              to: introId,
              weight: 0.7,
              orgWeight: 0.7,
              researchWeight: 0,
            });
          }
          // Intermediary to expert
          edges.push({
            from: introId,
            to: `expert-${index}`,
            weight: orgWeight,
            orgWeight,
            researchWeight: 0.3,
          });
        }
      } else {
        // Via manager
        const managerId = intermediaries.find(i => i.id.startsWith('manager-'))?.id;
        if (managerId) {
          // User to manager
          if (!edges.find(e => e.from === 'user' && e.to === managerId)) {
            edges.push({
              from: 'user',
              to: managerId,
              weight: 0.4,
              orgWeight: 0.4,
              researchWeight: 0,
            });
          }
          // Manager to expert
          edges.push({
            from: managerId,
            to: `expert-${index}`,
            weight: orgWeight,
            orgWeight,
            researchWeight: 0.2,
          });
        }
      }
    });

    // Create edges between experts based on research similarity
    for (let i = 0; i < experts.length; i++) {
      for (let j = i + 1; j < experts.length; j++) {
        const researchWeight = getResearchSimilarity(i, j);
        if (researchWeight > 0.3) {
          edges.push({
            from: `expert-${i}`,
            to: `expert-${j}`,
            weight: researchWeight * 0.7,
            orgWeight: 0,
            researchWeight,
          });
        }
      }
    }

    return { nodes, edges };
  };

  const { nodes, edges } = generateNetworkData();

  const getNodeRadius = (type: string) => {
    if (type === 'user') return 28;
    if (type === 'intermediary') return 18;
    return 22;
  };

  const getNodeColor = (node: NetworkNode) => {
    if (node.type === 'user') return approachabilityColors.user;
    if (node.type === 'intermediary') return { fill: "hsl(var(--muted))", stroke: "hsl(var(--muted-foreground))" };
    return approachabilityColors[node.approachability || 'direct'];
  };

  return (
    <div className="space-y-3">
      <h4 className="text-sm font-medium text-foreground">ネットワーク概観</h4>

      <div className="relative bg-card/50 rounded-lg border border-border overflow-hidden">
        <svg
          ref={svgRef}
          viewBox="0 0 500 400"
          className="w-full h-[320px]"
        >
          {/* Edges with combined weight */}
          {edges.map((edge, index) => {
            const fromNode = nodes.find(n => n.id === edge.from);
            const toNode = nodes.find(n => n.id === edge.to);
            if (!fromNode || !toNode) return null;

            const isHighlighted = hoveredNode === edge.from || hoveredNode === edge.to;
            const baseOpacity = 0.15 + edge.weight * 0.6;
            const opacity = hoveredNode ? (isHighlighted ? Math.min(baseOpacity + 0.3, 1) : 0.08) : baseOpacity;
            const strokeWidth = 1 + edge.weight * 3;

            // Color based on edge type mix
            const isResearchOnly = edge.orgWeight === 0;
            const strokeColor = isResearchOnly 
              ? "hsl(var(--primary))" 
              : "hsl(var(--muted-foreground))";

            return (
              <line
                key={`edge-${index}`}
                x1={fromNode.x}
                y1={fromNode.y}
                x2={toNode.x}
                y2={toNode.y}
                stroke={strokeColor}
                strokeWidth={isHighlighted ? strokeWidth + 1 : strokeWidth}
                strokeDasharray={isResearchOnly ? "4 3" : "none"}
                opacity={opacity}
                className="transition-all duration-200"
              />
            );
          })}

          {/* Nodes */}
          {nodes.map((node) => {
            const colors = getNodeColor(node);
            const radius = getNodeRadius(node.type);
            const isHovered = hoveredNode === node.id;
            const isConnected = hoveredNode && edges.some(
              e => (e.from === hoveredNode && e.to === node.id) || 
                   (e.to === hoveredNode && e.from === node.id)
            );
            const opacity = hoveredNode 
              ? (isHovered || isConnected || hoveredNode === null ? 1 : 0.25) 
              : 1;

            return (
              <g
                key={node.id}
                className="cursor-pointer"
                style={{ opacity }}
                onMouseEnter={() => setHoveredNode(node.id)}
                onMouseLeave={() => setHoveredNode(null)}
              >
                {/* Glow effect for hovered */}
                {isHovered && (
                  <circle
                    cx={node.x}
                    cy={node.y}
                    r={radius + 6}
                    fill="none"
                    stroke={colors.stroke}
                    strokeWidth={2}
                    opacity={0.3}
                  />
                )}
                <circle
                  cx={node.x}
                  cy={node.y}
                  r={radius}
                  fill={colors.fill}
                  stroke={isHovered ? "hsl(var(--foreground))" : colors.stroke}
                  strokeWidth={isHovered ? 2.5 : 1.5}
                  opacity={node.type === 'intermediary' ? 0.7 : 0.9}
                />
                <text
                  x={node.x}
                  y={node.y}
                  dy="0.35em"
                  fontSize={node.type === 'user' ? 11 : node.type === 'intermediary' ? 8 : 9}
                  fill={node.type === 'intermediary' ? "hsl(var(--foreground))" : "white"}
                  textAnchor="middle"
                  fontWeight="600"
                  className="pointer-events-none select-none"
                >
                  {node.label.length > 4 ? node.label.slice(0, 3) + '…' : node.label}
                </text>
                {/* Full name below node */}
                {node.type !== 'intermediary' && (
                  <>
                    <text
                      x={node.x}
                      y={node.y + radius + 12}
                      fontSize="9"
                      fill="hsl(var(--foreground))"
                      textAnchor="middle"
                      className="pointer-events-none select-none"
                    >
                      {node.label}
                    </text>
                    {node.affiliation && node.type === 'expert' && (
                      <text
                        x={node.x}
                        y={node.y + radius + 23}
                        fontSize="7"
                        fill="hsl(var(--muted-foreground))"
                        textAnchor="middle"
                        className="pointer-events-none select-none"
                      >
                        {node.affiliation.length > 14 ? node.affiliation.slice(0, 12) + '…' : node.affiliation}
                      </text>
                    )}
                  </>
                )}
              </g>
            );
          })}
        </svg>
      </div>

      {/* Legend */}
      <div className="flex flex-wrap gap-4 text-xs">
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-1.5">
            <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: approachabilityColors.direct.fill }} />
            <span className="text-muted-foreground">直接</span>
          </div>
          <div className="flex items-center gap-1.5">
            <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: approachabilityColors.introduction.fill }} />
            <span className="text-muted-foreground">紹介経由</span>
          </div>
          <div className="flex items-center gap-1.5">
            <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: approachabilityColors.via_manager.fill }} />
            <span className="text-muted-foreground">上司経由</span>
          </div>
        </div>
        <div className="flex items-center gap-3 border-l border-border pl-3">
          <div className="flex items-center gap-1.5">
            <div className="w-5 h-0.5 bg-muted-foreground" />
            <span className="text-muted-foreground">組織関係</span>
          </div>
          <div className="flex items-center gap-1.5">
            <div className="w-5 h-0 border-t-2 border-dashed border-primary" />
            <span className="text-muted-foreground">研究類似</span>
          </div>
        </div>
      </div>
    </div>
  );
}
