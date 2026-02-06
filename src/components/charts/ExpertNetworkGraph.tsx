import React, { useMemo, useState, useRef, useCallback, useEffect } from 'react';
import { ZoomIn, ZoomOut, Maximize2 } from 'lucide-react';
import { Button } from '@/components/ui/button';

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
  expertId: string;
}

interface ExpertNetworkGraphProps {
  experts: Expert[];
}

// 職階レベルを取得（役職名ベース）
const getRoleLevelFromTitle = (role: string): number => {
  const roleLower = role.toLowerCase();
  // 経営層（仮想CEOを含む）
  if (roleLower.includes('経営層') || roleLower.includes('ceo') || roleLower.includes('社長') || roleLower.includes('代表')) return 4;
  // 役員級
  if (roleLower.includes('執行役') || roleLower.includes('vp') || roleLower.includes('vice president') || roleLower.includes('役員') || roleLower.includes('cto') || roleLower.includes('cso') || roleLower.includes('cfo')) return 3;
  // 部長級
  if (roleLower.includes('部長') || roleLower.includes('director') || roleLower.includes('manager') || roleLower.includes('教授')) return 2;
  // 課長級
  if (roleLower.includes('課長') || roleLower.includes('lead') || roleLower.includes('主任') || roleLower.includes('准教授') || roleLower.includes('講師')) return 1;
  return 0;
};

// 経路の位置からレベルを計算（上に行くほど高いレベル）
const getRoleLevelFromPath = (pathIndex: number, pathLength: number, isUser: boolean, isTarget: boolean): number => {
  if (pathLength <= 1) return 0;

  // 自分とターゲットは末端（レベル0）
  if (isUser || isTarget) return 0;

  // 中間ノードは経路の位置に基づいてレベルを設定
  // 経路の中央付近が最も高いレベル（LCA付近）
  const midPoint = Math.floor(pathLength / 2);
  const distanceFromMid = Math.abs(pathIndex - midPoint);
  const maxLevel = Math.min(4, Math.floor(pathLength / 2));

  return Math.max(1, maxLevel - distanceFromMid);
};

const getRoleLevelLabel = (level: number): string => {
  switch (level) {
    case 4: return '経営層';
    case 3: return '役員級';
    case 2: return '部長級';
    case 1: return '課長級';
    default: return '一般';
  }
};

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
  
  // Zoom and pan state
  const [scale, setScale] = useState(1);
  const [translate, setTranslate] = useState({ x: 0, y: 0 });
  const [isPanning, setIsPanning] = useState(false);
  const [panStart, setPanStart] = useState({ x: 0, y: 0 });
  const svgRef = useRef<SVGSVGElement>(null);

  const svgWidth = 1000;
  const svgHeight = 500;
  const topMargin = 50;
  const bottomMargin = 80;
  const leftMargin = 80;
  const rightMargin = 200; // ラベル用に余裕を持たせる

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
        const pathLength = expert.pathDetails.length;

        for (let i = 0; i < expert.pathDetails.length; i++) {
          const pathNode = expert.pathDetails[i];
          const isFirst = i === 0;
          const isLast = i === expert.pathDetails.length - 1;

          const nodeId = pathNode.employee_id || `node-${pathNode.name}`;
          pathNodeIds.add(nodeId);

          if (!nodeMap.has(nodeId)) {
            const isUser = pathNode.name === '自分' || isFirst;

            // 役職名からのレベルと経路位置からのレベルを組み合わせ
            const titleLevel = getRoleLevelFromTitle(pathNode.role);
            const pathLevel = getRoleLevelFromPath(i, pathLength, isUser, isLast);

            // 役職名レベルが明示的に設定されている場合（>0）はそれを優先
            // そうでなければ経路位置からのレベルを使用
            const roleLevel = titleLevel > 0 ? titleLevel : pathLevel;
            roleLevelSet.add(roleLevel);

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
          node.x = leftMargin + usableWidth / 2;
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

  // Zoom handlers - use native event listener with passive: false
  useEffect(() => {
    const svgElement = svgRef.current;
    if (!svgElement) return;

    const handleWheel = (e: WheelEvent) => {
      e.preventDefault();
      const delta = e.deltaY > 0 ? 0.9 : 1.1;
      setScale(prevScale => {
        const newScale = Math.min(Math.max(prevScale * delta, 0.5), 3);

        const rect = svgElement.getBoundingClientRect();
        const mouseX = e.clientX - rect.left;
        const mouseY = e.clientY - rect.top;

        setTranslate(prevTranslate => ({
          x: mouseX - (mouseX - prevTranslate.x) * (newScale / prevScale),
          y: mouseY - (mouseY - prevTranslate.y) * (newScale / prevScale),
        }));

        return newScale;
      });
    };

    svgElement.addEventListener('wheel', handleWheel, { passive: false });
    return () => svgElement.removeEventListener('wheel', handleWheel);
  }, []);

  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    if (e.button === 0) { // Left click
      setIsPanning(true);
      setPanStart({ x: e.clientX - translate.x, y: e.clientY - translate.y });
    }
  }, [translate]);

  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    if (isPanning) {
      setTranslate({
        x: e.clientX - panStart.x,
        y: e.clientY - panStart.y
      });
    }
  }, [isPanning, panStart]);

  const handleMouseUp = useCallback(() => {
    setIsPanning(false);
  }, []);

  const handleZoomIn = () => {
    setScale(s => Math.min(s * 1.2, 3));
  };

  const handleZoomOut = () => {
    setScale(s => Math.max(s * 0.8, 0.5));
  };

  const handleReset = () => {
    setScale(1);
    setTranslate({ x: 0, y: 0 });
  };

  if (nodes.length === 0) {
    return (
      <div className="w-full p-4 text-center text-muted-foreground text-sm">
        経路データがありません
      </div>
    );
  }

  return (
    <div className="w-full space-y-2">
      {/* Zoom controls */}
      <div className="flex items-center justify-end gap-1">
        <Button variant="outline" size="sm" onClick={handleZoomOut} className="h-7 w-7 p-0">
          <ZoomOut className="w-3.5 h-3.5" />
        </Button>
        <span className="text-xs text-muted-foreground w-12 text-center">{Math.round(scale * 100)}%</span>
        <Button variant="outline" size="sm" onClick={handleZoomIn} className="h-7 w-7 p-0">
          <ZoomIn className="w-3.5 h-3.5" />
        </Button>
        <Button variant="outline" size="sm" onClick={handleReset} className="h-7 w-7 p-0">
          <Maximize2 className="w-3.5 h-3.5" />
        </Button>
      </div>

      {/* Graph container */}
      <div 
        className="w-full overflow-hidden rounded-lg border border-border bg-card"
        style={{ height: 400, cursor: isPanning ? 'grabbing' : 'grab' }}
      >
        <svg
          ref={svgRef}
          width="100%"
          height="100%"
          viewBox={`0 0 ${svgWidth} ${svgHeight}`}
          onMouseDown={handleMouseDown}
          onMouseMove={handleMouseMove}
          onMouseUp={handleMouseUp}
          onMouseLeave={handleMouseUp}
          style={{ userSelect: 'none' }}
        >
          <g transform={`translate(${translate.x}, ${translate.y}) scale(${scale})`}>
            {/* 背景 */}
            <rect width={svgWidth} height={svgHeight} fill="hsl(var(--card))" />

            {/* 職階ラベル */}
            {roleLevels.map((level, idx) => {
              const usableHeight = svgHeight - topMargin - bottomMargin;
              const levelCount = roleLevels.length || 1;
              const y = topMargin + idx * (usableHeight / Math.max(levelCount - 1, 1));
              
              return (
                <g key={`level-label-${level}`}>
                  <line
                    x1={leftMargin - 20}
                    y1={y}
                    x2={svgWidth - rightMargin + 20}
                    y2={y}
                    stroke="hsl(var(--border))"
                    strokeWidth={1}
                    strokeDasharray="6 4"
                    opacity={0.25}
                  />
                  <text
                    x={10}
                    y={y + 4}
                    fill="hsl(var(--muted-foreground))"
                    fontSize={11}
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
                  strokeWidth={isHighlighted ? 2.5 : 1.5}
                  opacity={hoveredNode && !isHighlighted ? 0.1 : isHighlighted ? 1 : 0.35}
                  className="transition-all duration-150"
                />
              );
            })}

            {/* ノード */}
            {nodes.map((node) => {
              const isUser = node.type === 'user';
              const isExpert = node.type === 'expert';
              const radius = isUser ? 22 : isExpert ? 20 : 14;
              
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
                    strokeWidth={isHighlighted ? 3 : 2}
                    className="transition-all duration-150"
                  />
                  
                  {/* 有識者マーカー */}
                  {isExpert && (
                    <text
                      y={5}
                      textAnchor="middle"
                      fill="white"
                      fontSize={13}
                      fontWeight={700}
                    >
                      ★
                    </text>
                  )}
                  
                  {/* 名前ラベル - フルで表示 */}
                  <text
                    x={radius + 8}
                    y={isExpert || isUser ? -2 : 4}
                    textAnchor="start"
                    fill="hsl(var(--foreground))"
                    fontSize={isExpert ? 13 : 12}
                    fontWeight={isExpert || isUser ? 600 : 400}
                  >
                    {node.label}
                    {isExpert && ' ★'}
                  </text>

                  {/* 役職 - フルで表示 */}
                  {(isExpert || isUser) && (
                    <text
                      x={radius + 8}
                      y={14}
                      textAnchor="start"
                      fill="hsl(var(--muted-foreground))"
                      fontSize={11}
                    >
                      {node.role}
                    </text>
                  )}

                  {/* 部署（中間ノード用） */}
                  {!isExpert && !isUser && (
                    <text
                      x={radius + 8}
                      y={18}
                      textAnchor="start"
                      fill="hsl(var(--muted-foreground))"
                      fontSize={10}
                    >
                      {node.department}
                    </text>
                  )}
                </g>
              );
            })}
          </g>

          {/* 凡例（固定位置） */}
          <g transform={`translate(${svgWidth - 150}, 20)`}>
            <rect x={-10} y={-10} width={140} height={100} fill="hsl(var(--background))" rx={6} opacity={0.95} stroke="hsl(var(--border))" strokeWidth={1} />
            <text fill="hsl(var(--foreground))" fontSize={11} fontWeight={600}>凡例</text>
            {[
              { color: 'hsl(var(--primary))', label: '自分' },
              { color: 'hsl(142, 76%, 36%)', label: '有識者（直接）' },
              { color: 'hsl(38, 92%, 50%)', label: '有識者（紹介経由）' },
              { color: 'hsl(0, 84%, 60%)', label: '有識者（上司経由）' },
            ].map((item, idx) => (
              <g key={item.label} transform={`translate(0, ${18 + idx * 18})`}>
                <circle r={6} cx={8} cy={0} fill={item.color} />
                <text x={20} y={4} fill="hsl(var(--muted-foreground))" fontSize={10}>
                  {item.label}
                </text>
              </g>
            ))}
          </g>
        </svg>
      </div>

      <p className="text-xs text-muted-foreground text-center">
        マウスホイールで拡大縮小 / ドラッグで移動
      </p>
    </div>
  );
};

export default ExpertNetworkGraph;
