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
  const svgHeight = 500;
  const topMargin = 50;
  const bottomMargin = 70;
  const leftMargin = 80;
  const rightMargin = 40;

  const { nodes, edges, roleLevels, expertPaths } = useMemo(() => {
    const nodeMap = new Map<string, NetworkNode>();
    const edgeList: NetworkEdge[] = [];
    const roleLevelSet = new Set<number>();
    const expertPathsMap = new Map<string, Set<string>>();

    // 各エキスパートのpathDetailsからノードとエッジを抽出
    experts.forEach(expert => {
      if (expert.pathDetails && expert.pathDetails.length > 0) {
        const pathNodeIds = new Set<string>();
        
        for (let i = 0; i < expert.pathDetails.length; i++) {
          const pathNode = expert.pathDetails[i];
          const isFirst = i === 0;
          const isLast = i === expert.pathDetails.length - 1;
          
          const nodeId = pathNode.employee_id || `node-${pathNode.name}`;
          pathNodeIds.add(nodeId);
          
          // ノードを追加（重複排除）
          if (!nodeMap.has(nodeId)) {
            const roleLevel = getRoleLevel(pathNode.role);
            roleLevelSet.add(roleLevel);
            
            // 「自分」かどうかを判定
            const isUser = pathNode.name === '自分' || isFirst;
            
            nodeMap.set(nodeId, {
              id: nodeId,
              label: pathNode.name,
              role: pathNode.role,
              department: pathNode.department,
              type: isUser ? 'user' : (isLast ? 'expert' : 'intermediate'),
              approachability: isLast ? expert.approachability : undefined,
              x: 0, // 後で計算
              y: 0,
              roleLevel
            });
          } else if (isLast) {
            // 既存ノードがエキスパートの場合、タイプを更新
            const existingNode = nodeMap.get(nodeId)!;
            if (existingNode.type !== 'user') {
              existingNode.type = 'expert';
              existingNode.approachability = expert.approachability;
            }
          }

          // エッジを追加（経路上の隣接ノード間）
          if (i > 0) {
            const prevNode = expert.pathDetails[i - 1];
            const prevNodeId = prevNode.employee_id || `node-${prevNode.name}`;
            
            // 重複エッジを防ぐ
            const edgeExists = edgeList.some(e => 
              (e.source === prevNodeId && e.target === nodeId) ||
              (e.source === nodeId && e.target === prevNodeId)
            );
            
            if (!edgeExists) {
              edgeList.push({
                source: prevNodeId,
                target: nodeId,
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

    // 職階レベルごとにノードをグループ化
    const sortedLevels = Array.from(roleLevelSet).sort((a, b) => b - a); // 降順（上位が上）
    const nodesByLevel: Map<number, NetworkNode[]> = new Map();
    
    nodeMap.forEach(node => {
      const level = node.roleLevel;
      if (!nodesByLevel.has(level)) {
        nodesByLevel.set(level, []);
      }
      nodesByLevel.get(level)!.push(node);
    });

    // 縦型レイアウト：職階が上のものほど画面上部に配置
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
  }, [experts, svgHeight, svgWidth, topMargin, bottomMargin, leftMargin, rightMargin]);

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

  // ノードが見つからない場合の表示
  if (nodes.length === 0) {
    return (
      <div className="w-full p-4 text-center text-muted-foreground">
        経路データがありません
      </div>
    );
  }

  return (
    <div className="w-full">
      <h4 className="text-sm font-medium text-foreground mb-3">組織経路図</h4>
      <div className="w-full overflow-x-auto">
        <svg 
          width={svgWidth} 
          height={svgHeight} 
          className="mx-auto"
          style={{ minWidth: svgWidth }}
        >
          {/* 背景 */}
          <rect width={svgWidth} height={svgHeight} fill="hsl(var(--card))" rx={8} />

          {/* 職階レベルのラベル（左側に縦配置） */}
          {roleLevels.map((level, idx) => {
            const usableHeight = svgHeight - topMargin - bottomMargin;
            const levelCount = roleLevels.length || 1;
            const y = topMargin + idx * (usableHeight / Math.max(levelCount - 1, 1));
            
            return (
              <g key={`level-label-${level}`}>
                {/* 横の点線ガイド */}
                <line
                  x1={leftMargin - 10}
                  y1={y}
                  x2={svgWidth - rightMargin + 10}
                  y2={y}
                  stroke="hsl(var(--border))"
                  strokeWidth={1}
                  strokeDasharray="4 4"
                  opacity={0.4}
                />
                <text
                  x={12}
                  y={y + 4}
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

            // 曲線パスを使用してエッジを描画
            const midY = (sourceNode.y + targetNode.y) / 2;
            const pathD = `M ${sourceNode.x} ${sourceNode.y} Q ${(sourceNode.x + targetNode.x) / 2} ${midY} ${targetNode.x} ${targetNode.y}`;

            return (
              <path
                key={`edge-${idx}`}
                d={pathD}
                fill="none"
                stroke={isHighlighted ? edgeColor : 'hsl(var(--muted-foreground))'}
                strokeWidth={isHighlighted ? 3 : 1.5}
                opacity={hoveredNode && !isHighlighted ? 0.15 : isHighlighted ? 1 : 0.5}
                className="transition-all duration-200"
              />
            );
          })}

          {/* ノード */}
          {nodes.map((node) => {
            const isUser = node.type === 'user';
            const isExpert = node.type === 'expert';
            const isIntermediate = node.type === 'intermediate';
            const radius = isUser ? 26 : isExpert ? 22 : 16;
            
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
                
                {/* ユーザーアイコン（自分の場合） */}
                {isUser && (
                  <text
                    y={5}
                    textAnchor="middle"
                    fill="hsl(var(--primary-foreground))"
                    fontSize={16}
                    fontWeight={700}
                  >
                    ★
                  </text>
                )}
                
                {/* ノードラベル（名前） - 右側に配置 */}
                <text
                  x={radius + 8}
                  y={4}
                  textAnchor="start"
                  fill="hsl(var(--foreground))"
                  fontSize={isIntermediate ? 11 : 12}
                  fontWeight={isExpert || isUser ? 600 : 500}
                >
                  {node.label}
                </text>

                {/* サブラベル（役職）- 名前の下 */}
                <text
                  x={radius + 8}
                  y={18}
                  textAnchor="start"
                  fill="hsl(var(--muted-foreground))"
                  fontSize={10}
                >
                  {node.role.length > 15 ? node.role.slice(0, 14) + '…' : node.role}
                </text>
              </g>
            );
          })}

          {/* 凡例 */}
          <g transform={`translate(${svgWidth - 140}, ${svgHeight - 110})`}>
            <rect 
              x={-10} 
              y={-20} 
              width={130} 
              height={105} 
              fill="hsl(var(--background))" 
              rx={6}
              opacity={0.9}
            />
            <text fill="hsl(var(--foreground))" fontSize={11} fontWeight={600}>
              アプローチ分類
            </text>
            {[
              { color: 'hsl(142, 76%, 36%)', label: '直接連絡可' },
              { color: 'hsl(38, 92%, 50%)', label: '紹介経由' },
              { color: 'hsl(0, 84%, 60%)', label: '上司経由' },
            ].map((item, idx) => (
              <g key={item.label} transform={`translate(0, ${18 + idx * 20})`}>
                <circle r={6} cx={8} cy={0} fill={item.color} />
                <text x={20} y={4} fill="hsl(var(--muted-foreground))" fontSize={10}>
                  {item.label}
                </text>
              </g>
            ))}
            {/* 自分のマーカー */}
            <g transform={`translate(0, ${18 + 3 * 20})`}>
              <circle r={6} cx={8} cy={0} fill="hsl(var(--primary))" />
              <text x={20} y={4} fill="hsl(var(--muted-foreground))" fontSize={10}>
                自分
              </text>
            </g>
          </g>
        </svg>
      </div>
    </div>
  );
};

export default ExpertNetworkGraph;
