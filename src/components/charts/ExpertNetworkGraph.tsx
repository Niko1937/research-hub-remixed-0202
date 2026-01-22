import React, { useMemo, useState } from 'react';

interface PathNode {
  employee_id: string;
  name: string;
  role: string;
  department: string;
}

interface Expert {
  name: string;
  affiliation: string;
  role: string;
  approachability: 'direct' | 'introduction' | 'via_manager';
  connectionPath?: string;
  pathDetails?: PathNode[];
  distance?: number;
  suggestedQuestions?: string[];
  contactMethods?: string[];
}

interface NetworkNode {
  id: string;
  label: string;
  role: string;
  department: string;
  type: 'user' | 'expert' | 'intermediate';
  approachability?: 'direct' | 'introduction' | 'via_manager';
  x: number;
  y: number;
  roleLevel: number;
}

interface NetworkEdge {
  source: string;
  target: string;
  expertId: string; // どのエキスパートへの経路か
}

interface ExpertNetworkGraphProps {
  experts: Expert[];
}

// 職階レベルを取得（数字が大きいほど上位）
const getRoleLevel = (role: string): number => {
  const roleLower = role.toLowerCase();
  if (roleLower.includes('ceo') || roleLower.includes('社長') || roleLower.includes('代表')) return 4;
  if (roleLower.includes('執行役') || roleLower.includes('vp') || roleLower.includes('vice president') || roleLower.includes('役員') || roleLower.includes('cto') || roleLower.includes('cso') || roleLower.includes('cfo')) return 3;
  if (roleLower.includes('部長') || roleLower.includes('director') || roleLower.includes('manager') || roleLower.includes('教授')) return 2;
  if (roleLower.includes('課長') || roleLower.includes('lead') || roleLower.includes('主任') || roleLower.includes('准教授') || roleLower.includes('講師')) return 1;
  return 0;
};

// 職階レベルのラベル
const getRoleLevelLabel = (level: number): string => {
  switch (level) {
    case 4: return '経営層';
    case 3: return '役員級';
    case 2: return '部長級';
    case 1: return '課長級';
    default: return '一般';
  }
};

// エキスパートのアプローチ色
const getExpertColor = (approachability?: string): string => {
  switch (approachability) {
    case 'direct': return 'hsl(142, 76%, 36%)';
    case 'introduction': return 'hsl(38, 92%, 50%)';
    case 'via_manager': return 'hsl(0, 84%, 60%)';
    default: return 'hsl(var(--muted-foreground))';
  }
};

const ExpertNetworkGraph: React.FC<ExpertNetworkGraphProps> = ({ experts }) => {
  const [hoveredNode, setHoveredNode] = useState<string | null>(null);
  const [hoveredExpertPath, setHoveredExpertPath] = useState<Set<string> | null>(null);

  const svgWidth = 800;
  const svgHeight = 420;
  const topMargin = 40;
  const bottomMargin = 60;
  const leftMargin = 70;
  const rightMargin = 30;

  const { nodes, edges, roleLevels, expertPaths } = useMemo(() => {
    const nodeMap = new Map<string, NetworkNode>();
    const edgeList: NetworkEdge[] = [];
    const roleLevelSet = new Set<number>();
    const expertPathsMap = new Map<string, Set<string>>();

    experts.forEach(expert => {
      if (expert.pathDetails && expert.pathDetails.length > 0) {
        const pathNodeIds = new Set<string>();
        const expertNodeId = expert.pathDetails[expert.pathDetails.length - 1].employee_id || 
                            `node-${expert.pathDetails[expert.pathDetails.length - 1].name}`;
        
        for (let i = 0; i < expert.pathDetails.length; i++) {
          const pathNode = expert.pathDetails[i];
          const isFirst = i === 0;
          const isLast = i === expert.pathDetails.length - 1;
          
          const nodeId = pathNode.employee_id || `node-${pathNode.name}`;
          pathNodeIds.add(nodeId);
          
          if (!nodeMap.has(nodeId)) {
            const roleLevel = getRoleLevel(pathNode.role);
            roleLevelSet.add(roleLevel);
            
            const isUser = pathNode.name === '自分' || isFirst;
            
            nodeMap.set(nodeId, {
              id: nodeId,
              label: pathNode.name,
              role: pathNode.role,
              department: pathNode.department,
              type: isUser ? 'user' : (isLast ? 'expert' : 'intermediate'),
              approachability: isLast ? expert.approachability : undefined,
              x: 0,
              y: 0,
              roleLevel
            });
          } else if (isLast) {
            const existingNode = nodeMap.get(nodeId)!;
            if (existingNode.type !== 'user') {
              existingNode.type = 'expert';
              existingNode.approachability = expert.approachability;
            }
          }

          if (i > 0) {
            const prevNode = expert.pathDetails[i - 1];
            const prevNodeId = prevNode.employee_id || `node-${prevNode.name}`;
            
            const edgeExists = edgeList.some(e => 
              (e.source === prevNodeId && e.target === nodeId) ||
              (e.source === nodeId && e.target === prevNodeId)
            );
            
            if (!edgeExists) {
              edgeList.push({
                source: prevNodeId,
                target: nodeId,
                expertId: expertNodeId
              });
            }
          }
        }

        expertPathsMap.set(expertNodeId, pathNodeIds);
      }
    });

    const sortedLevels = Array.from(roleLevelSet).sort((a, b) => b - a);
    const nodesByLevel: Map<number, NetworkNode[]> = new Map();
    
    nodeMap.forEach(node => {
      const level = node.roleLevel;
      if (!nodesByLevel.has(level)) {
        nodesByLevel.set(level, []);
      }
      nodesByLevel.get(level)!.push(node);
    });

    const usableHeight = svgHeight - topMargin - bottomMargin;
    const levelCount = sortedLevels.length || 1;
    const levelSpacing = usableHeight / Math.max(levelCount - 1, 1);

    sortedLevels.forEach((level, levelIndex) => {
      const nodesAtLevel = nodesByLevel.get(level) || [];
      const y = topMargin + levelIndex * levelSpacing;
      
      const usableWidth = svgWidth - leftMargin - rightMargin;
      const nodeCount = nodesAtLevel.length;
      
      nodesAtLevel.forEach((node, idx) => {
        if (nodeCount === 1) {
          node.x = svgWidth / 2;
        } else {
          node.x = leftMargin + (idx * usableWidth) / (nodeCount - 1);
        }
        node.y = y;
      });
    });

    return { 
      nodes: Array.from(nodeMap.values()), 
      edges: edgeList,
      roleLevels: sortedLevels,
      expertPaths: expertPathsMap
    };
  }, [experts]);

  const getHighlightedPath = (nodeId: string): Set<string> | null => {
    if (expertPaths.has(nodeId)) {
      return expertPaths.get(nodeId) || null;
    }
    const allPathNodes = new Set<string>();
    expertPaths.forEach((pathNodes) => {
      if (pathNodes.has(nodeId)) {
        pathNodes.forEach(id => allPathNodes.add(id));
      }
    });
    return allPathNodes.size > 0 ? allPathNodes : null;
  };

  const handleNodeHover = (nodeId: string | null) => {
    setHoveredNode(nodeId);
    if (nodeId) {
      setHoveredExpertPath(getHighlightedPath(nodeId));
    } else {
      setHoveredExpertPath(null);
    }
  };

  const isNodeHighlighted = (nodeId: string): boolean => {
    if (!hoveredExpertPath) return false;
    return hoveredExpertPath.has(nodeId);
  };

  const isEdgeHighlighted = (source: string, target: string): boolean => {
    if (!hoveredExpertPath) return false;
    return hoveredExpertPath.has(source) && hoveredExpertPath.has(target);
  };

  if (nodes.length === 0) {
    return (
      <div className="w-full p-4 text-center text-muted-foreground text-sm">
        経路データがありません
      </div>
    );
  }

  return (
    <div className="w-full overflow-x-auto">
      <svg 
        width={svgWidth} 
        height={svgHeight} 
        className="mx-auto"
        style={{ minWidth: svgWidth }}
      >
        {/* 背景 */}
        <rect width={svgWidth} height={svgHeight} fill="hsl(var(--card))" rx={8} />

        {/* 職階ラベル */}
        {roleLevels.map((level, idx) => {
          const usableHeight = svgHeight - topMargin - bottomMargin;
          const levelCount = roleLevels.length || 1;
          const y = topMargin + idx * (usableHeight / Math.max(levelCount - 1, 1));
          
          return (
            <g key={`level-label-${level}`}>
              <line
                x1={leftMargin - 10}
                y1={y}
                x2={svgWidth - rightMargin + 10}
                y2={y}
                stroke="hsl(var(--border))"
                strokeWidth={1}
                strokeDasharray="4 4"
                opacity={0.3}
              />
              <text
                x={8}
                y={y + 4}
                fill="hsl(var(--muted-foreground))"
                fontSize={10}
                fontWeight={500}
              >
                {getRoleLevelLabel(level)}
              </text>
            </g>
          );
        })}

        {/* エッジ */}
        {edges.map((edge, idx) => {
          const sourceNode = nodes.find(n => n.id === edge.source);
          const targetNode = nodes.find(n => n.id === edge.target);
          if (!sourceNode || !targetNode) return null;

          const isHighlighted = isEdgeHighlighted(edge.source, edge.target);

          return (
            <line
              key={`edge-${idx}`}
              x1={sourceNode.x}
              y1={sourceNode.y}
              x2={targetNode.x}
              y2={targetNode.y}
              stroke={isHighlighted ? 'hsl(var(--primary))' : 'hsl(var(--muted-foreground))'}
              strokeWidth={isHighlighted ? 2.5 : 1}
              opacity={hoveredNode && !isHighlighted ? 0.1 : isHighlighted ? 1 : 0.3}
              className="transition-all duration-150"
            />
          );
        })}

        {/* ノード */}
        {nodes.map((node) => {
          const isUser = node.type === 'user';
          const isExpert = node.type === 'expert';
          const radius = isUser ? 20 : isExpert ? 18 : 12;
          
          // 色: 自分=Primary、エキスパート=アプローチ色、中間=グレー
          let fillColor: string;
          if (isUser) {
            fillColor = 'hsl(var(--primary))';
          } else if (isExpert) {
            fillColor = getExpertColor(node.approachability);
          } else {
            fillColor = 'hsl(var(--muted))';
          }

          const isHighlighted = hoveredNode === node.id || isNodeHighlighted(node.id);
          const isDimmed = hoveredNode && !isHighlighted;

          return (
            <g
              key={node.id}
              transform={`translate(${node.x}, ${node.y})`}
              onMouseEnter={() => handleNodeHover(node.id)}
              onMouseLeave={() => handleNodeHover(null)}
              style={{ cursor: 'pointer' }}
              opacity={isDimmed ? 0.2 : 1}
              className="transition-opacity duration-150"
            >
              <circle
                r={radius}
                fill={fillColor}
                stroke={isHighlighted ? "hsl(var(--foreground))" : "hsl(var(--background))"}
                strokeWidth={isHighlighted ? 2.5 : 1.5}
                className="transition-all duration-150"
              />
              
              {/* 名前ラベル */}
              <text
                x={radius + 6}
                y={3}
                textAnchor="start"
                fill="hsl(var(--foreground))"
                fontSize={11}
                fontWeight={isExpert || isUser ? 600 : 400}
              >
                {node.label}
              </text>

              {/* 役職（エキスパートと自分のみ） */}
              {(isExpert || isUser) && (
                <text
                  x={radius + 6}
                  y={15}
                  textAnchor="start"
                  fill="hsl(var(--muted-foreground))"
                  fontSize={9}
                >
                  {node.role.length > 12 ? node.role.slice(0, 11) + '…' : node.role}
                </text>
              )}
            </g>
          );
        })}

        {/* 凡例 */}
        <g transform={`translate(${svgWidth - 120}, ${svgHeight - 90})`}>
          <rect x={-8} y={-14} width={110} height={85} fill="hsl(var(--background))" rx={4} opacity={0.9} />
          <text fill="hsl(var(--foreground))" fontSize={10} fontWeight={600}>凡例</text>
          {[
            { color: 'hsl(var(--primary))', label: '自分' },
            { color: 'hsl(142, 76%, 36%)', label: 'すぐ話せる' },
            { color: 'hsl(38, 92%, 50%)', label: '紹介経由' },
            { color: 'hsl(0, 84%, 60%)', label: '上司経由' },
          ].map((item, idx) => (
            <g key={item.label} transform={`translate(0, ${14 + idx * 16})`}>
              <circle r={5} cx={6} cy={0} fill={item.color} />
              <text x={16} y={3} fill="hsl(var(--muted-foreground))" fontSize={9}>
                {item.label}
              </text>
            </g>
          ))}
        </g>
      </svg>
    </div>
  );
};

export default ExpertNetworkGraph;
