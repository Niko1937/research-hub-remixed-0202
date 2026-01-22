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
  isPathEdge: boolean;
  approachability?: 'direct' | 'introduction' | 'via_manager';
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
  return 0; // 一般社員・研究員
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

// アプローチ分類の色
const getApproachabilityColor = (approachability?: string): string => {
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

  const svgWidth = 900;
  const svgHeight = 600;
  const centerX = svgWidth / 2;
  const centerY = svgHeight / 2;
  const baseRadius = 100;
  const radiusStep = 100;

  const { nodes, edges, roleLevels, expertPaths } = useMemo(() => {
    const nodeMap = new Map<string, NetworkNode>();
    const edgeList: NetworkEdge[] = [];
    const roleLevelSet = new Set<number>();
    const expertPathsMap = new Map<string, Set<string>>();

    // 自分を追加（中心）
    nodeMap.set('user', {
      id: 'user',
      label: '自分',
      role: '研究員',
      department: '自社',
      type: 'user',
      x: centerX,
      y: centerY,
      roleLevel: 0
    });

    // 各エキスパートのpathDetailsからノードとエッジを抽出
    experts.forEach(expert => {
      if (expert.pathDetails && expert.pathDetails.length > 0) {
        const pathNodeIds = new Set<string>();
        
        for (let i = 0; i < expert.pathDetails.length; i++) {
          const pathNode = expert.pathDetails[i];
          const isFirst = i === 0;
          const isLast = i === expert.pathDetails.length - 1;
          
          // 最初のノード（自分）はスキップ、userとして既に追加済み
          if (isFirst && pathNode.name === '自分') {
            pathNodeIds.add('user');
            continue;
          }

          const nodeId = pathNode.employee_id || `node-${pathNode.name}`;
          pathNodeIds.add(nodeId);
          
          // ノードを追加（重複排除）
          if (!nodeMap.has(nodeId)) {
            const roleLevel = getRoleLevel(pathNode.role);
            roleLevelSet.add(roleLevel);
            
            nodeMap.set(nodeId, {
              id: nodeId,
              label: pathNode.name,
              role: pathNode.role,
              department: pathNode.department,
              type: isLast ? 'expert' : 'intermediate',
              approachability: isLast ? expert.approachability : undefined,
              x: 0, // 後で計算
              y: 0,
              roleLevel
            });
          } else if (isLast) {
            // 既存ノードがエキスパートの場合、タイプを更新
            const existingNode = nodeMap.get(nodeId)!;
            existingNode.type = 'expert';
            existingNode.approachability = expert.approachability;
          }

          // エッジを追加（経路上の隣接ノード間）
          if (i > 0) {
            const prevNode = expert.pathDetails[i - 1];
            const prevNodeId = (i === 1 && prevNode.name === '自分') ? 'user' : (prevNode.employee_id || `node-${prevNode.name}`);
            
            // 重複エッジを防ぐ
            const edgeKey = `${prevNodeId}-${nodeId}`;
            const reverseEdgeKey = `${nodeId}-${prevNodeId}`;
            const edgeExists = edgeList.some(e => 
              (e.source === prevNodeId && e.target === nodeId) ||
              (e.source === nodeId && e.target === prevNodeId)
            );
            
            if (!edgeExists) {
              edgeList.push({
                source: prevNodeId,
                target: nodeId,
                isPathEdge: true,
                approachability: isLast ? expert.approachability : undefined
              });
            }
          }
        }

        // エキスパートごとの経路ノードIDを保存
        const expertNodeId = expert.pathDetails[expert.pathDetails.length - 1].employee_id || 
                            `node-${expert.pathDetails[expert.pathDetails.length - 1].name}`;
        expertPathsMap.set(expertNodeId, pathNodeIds);
      }
    });

    // 職階レベルごとにノードを配置
    const sortedLevels = Array.from(roleLevelSet).sort((a, b) => a - b);
    const nodesByLevel: Map<number, NetworkNode[]> = new Map();
    
    nodeMap.forEach(node => {
      if (node.type !== 'user') {
        const level = node.roleLevel;
        if (!nodesByLevel.has(level)) {
          nodesByLevel.set(level, []);
        }
        nodesByLevel.get(level)!.push(node);
      }
    });

    // 各レベルのノードを同心円状に配置
    sortedLevels.forEach((level, levelIndex) => {
      const nodesAtLevel = nodesByLevel.get(level) || [];
      const radius = baseRadius + levelIndex * radiusStep;
      
      nodesAtLevel.forEach((node, idx) => {
        const angleOffset = levelIndex * 0.2;
        const angle = (2 * Math.PI * idx) / Math.max(nodesAtLevel.length, 1) - Math.PI / 2 + angleOffset;
        node.x = centerX + radius * Math.cos(angle);
        node.y = centerY + radius * Math.sin(angle);
      });
    });

    return { 
      nodes: Array.from(nodeMap.values()), 
      edges: edgeList,
      roleLevels: sortedLevels,
      expertPaths: expertPathsMap
    };
  }, [experts, centerX, centerY, baseRadius, radiusStep]);

  // ホバー時に経路全体をハイライト
  const getHighlightedPath = (nodeId: string): Set<string> | null => {
    // エキスパートノードの場合、その経路を取得
    if (expertPaths.has(nodeId)) {
      return expertPaths.get(nodeId) || null;
    }
    // 中間ノードの場合、そのノードを含む全経路を取得
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

  return (
    <div className="w-full">
      <h4 className="text-sm font-medium text-foreground mb-3">ネットワーク概観</h4>
      <div className="w-full overflow-x-auto">
        <svg 
          width={svgWidth} 
          height={svgHeight} 
          className="mx-auto"
          style={{ minWidth: svgWidth }}
        >
          {/* 背景 */}
          <rect width={svgWidth} height={svgHeight} fill="hsl(var(--card))" rx={8} />

          {/* 職階レベルの同心円（枠線） */}
          {roleLevels.map((level, idx) => {
            const radius = baseRadius + idx * radiusStep;
            return (
              <g key={`level-${level}`}>
                <circle
                  cx={centerX}
                  cy={centerY}
                  r={radius}
                  fill="none"
                  stroke="hsl(var(--border))"
                  strokeWidth={1.5}
                  strokeDasharray="6 4"
                  opacity={0.6}
                />
                {/* レベルラベル（右上に配置） */}
                <text
                  x={centerX + radius * 0.7 + 10}
                  y={centerY - radius * 0.7 - 5}
                  fill="hsl(var(--muted-foreground))"
                  fontSize={11}
                  fontWeight={500}
                  textAnchor="start"
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
            const edgeColor = edge.approachability 
              ? getApproachabilityColor(edge.approachability)
              : 'hsl(var(--muted-foreground))';

            return (
              <line
                key={`edge-${idx}`}
                x1={sourceNode.x}
                y1={sourceNode.y}
                x2={targetNode.x}
                y2={targetNode.y}
                stroke={isHighlighted ? edgeColor : 'hsl(var(--muted-foreground))'}
                strokeWidth={isHighlighted ? 3 : 1.5}
                opacity={hoveredNode && !isHighlighted ? 0.15 : isHighlighted ? 1 : 0.4}
                className="transition-all duration-200"
              />
            );
          })}

          {/* ノード */}
          {nodes.map((node) => {
            const isUser = node.type === 'user';
            const isExpert = node.type === 'expert';
            const isIntermediate = node.type === 'intermediate';
            const radius = isUser ? 28 : isExpert ? 24 : 18;
            
            let fillColor: string;
            if (isUser) {
              fillColor = 'hsl(var(--primary))';
            } else if (isExpert) {
              fillColor = getApproachabilityColor(node.approachability);
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
                opacity={isDimmed ? 0.25 : 1}
                className="transition-opacity duration-200"
              >
                {/* ノード円 */}
                <circle
                  r={radius}
                  fill={fillColor}
                  stroke={isHighlighted ? "hsl(var(--foreground))" : "hsl(var(--background))"}
                  strokeWidth={isHighlighted ? 3 : 2}
                  className="transition-all duration-200"
                />
                
                {/* ノードラベル（名前） */}
                <text
                  y={radius + 14}
                  textAnchor="middle"
                  fill="hsl(var(--foreground))"
                  fontSize={isIntermediate ? 10 : 12}
                  fontWeight={isExpert ? 600 : 500}
                >
                  {node.label}
                </text>

                {/* サブラベル（役職）- エキスパートと中間ノードのみ */}
                {!isUser && (
                  <text
                    y={radius + (isIntermediate ? 24 : 28)}
                    textAnchor="middle"
                    fill="hsl(var(--muted-foreground))"
                    fontSize={isIntermediate ? 9 : 10}
                  >
                    {node.role.length > 12 ? node.role.slice(0, 11) + '…' : node.role}
                  </text>
                )}
              </g>
            );
          })}

          {/* 凡例 */}
          <g transform={`translate(24, ${svgHeight - 130})`}>
            <text fill="hsl(var(--foreground))" fontSize={12} fontWeight={600}>
              アプローチ分類
            </text>
            {[
              { color: 'hsl(142, 76%, 36%)', label: '直接連絡可' },
              { color: 'hsl(38, 92%, 50%)', label: '紹介経由' },
              { color: 'hsl(0, 84%, 60%)', label: '上司経由' },
            ].map((item, idx) => (
              <g key={item.label} transform={`translate(0, ${20 + idx * 22})`}>
                <circle r={7} cx={10} cy={0} fill={item.color} />
                <text x={24} y={4} fill="hsl(var(--muted-foreground))" fontSize={11}>
                  {item.label}
                </text>
              </g>
            ))}
            {/* 中間ノードの凡例 */}
            <g transform={`translate(0, ${20 + 3 * 22})`}>
              <circle r={6} cx={10} cy={0} fill="hsl(var(--muted))" />
              <text x={24} y={4} fill="hsl(var(--muted-foreground))" fontSize={11}>
                経路上の上司
              </text>
            </g>
          </g>
        </svg>
      </div>
    </div>
  );
};

export default ExpertNetworkGraph;
