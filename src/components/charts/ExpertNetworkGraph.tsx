import React, { useMemo, useState } from 'react';

interface Expert {
  name: string;
  affiliation: string;
  role: string;
  approachability: 'direct' | 'introduction' | 'via_manager';
  connectionPath?: string;
  suggestedQuestions?: string[];
  contactMethods?: string[];
}

interface NetworkNode {
  id: string;
  label: string;
  role: string;
  affiliation: string;
  type: 'user' | 'expert';
  approachability?: 'direct' | 'introduction' | 'via_manager';
  x: number;
  y: number;
  roleLevel: number;
}

interface NetworkEdge {
  source: string;
  target: string;
}

interface ExpertNetworkGraphProps {
  experts: Expert[];
}

// 職階レベルを取得（数字が大きいほど上位）
const getRoleLevel = (role: string): number => {
  const roleLower = role.toLowerCase();
  if (roleLower.includes('ceo') || roleLower.includes('社長') || roleLower.includes('代表')) return 4;
  if (roleLower.includes('執行役') || roleLower.includes('vp') || roleLower.includes('vice president') || roleLower.includes('役員')) return 3;
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
    default: return 'hsl(var(--primary))';
  }
};

const ExpertNetworkGraph: React.FC<ExpertNetworkGraphProps> = ({ experts }) => {
  const [hoveredNode, setHoveredNode] = useState<string | null>(null);

  const { nodes, edges, roleLevels } = useMemo(() => {
    const nodeList: NetworkNode[] = [];
    const edgeList: NetworkEdge[] = [];
    const roleLevelSet = new Set<number>();

    const svgWidth = 900;
    const svgHeight = 600;
    const centerX = svgWidth / 2;
    const centerY = svgHeight / 2;
    
    // 中心に自分を配置
    nodeList.push({
      id: 'user',
      label: '自分',
      role: '研究員',
      affiliation: '自社',
      type: 'user',
      x: centerX,
      y: centerY,
      roleLevel: 0
    });

    // エキスパートを職階レベルごとにグループ化
    const expertsByLevel: Record<number, Expert[]> = {};
    experts.forEach(expert => {
      const level = getRoleLevel(expert.role);
      roleLevelSet.add(level);
      if (!expertsByLevel[level]) expertsByLevel[level] = [];
      expertsByLevel[level].push(expert);
    });

    // 同心円状に配置（職階が高いほど外側の円）
    const sortedLevels = Array.from(roleLevelSet).sort((a, b) => a - b);
    const baseRadius = 120;
    const radiusStep = 100;
    
    sortedLevels.forEach((level, levelIndex) => {
      const expertsAtLevel = expertsByLevel[level] || [];
      const radius = baseRadius + levelIndex * radiusStep;
      
      expertsAtLevel.forEach((expert, idx) => {
        // 均等に配置、少しオフセットを加えて重なりを防ぐ
        const angleOffset = levelIndex * 0.3; // レベルごとに回転
        const angle = (2 * Math.PI * idx) / expertsAtLevel.length - Math.PI / 2 + angleOffset;
        const x = centerX + radius * Math.cos(angle);
        const y = centerY + radius * Math.sin(angle);

        const nodeId = `expert-${expert.name}`;
        nodeList.push({
          id: nodeId,
          label: expert.name,
          role: expert.role,
          affiliation: expert.affiliation,
          type: 'expert',
          approachability: expert.approachability,
          x,
          y,
          roleLevel: level
        });

        // 自分からエキスパートへのエッジ
        edgeList.push({
          source: 'user',
          target: nodeId
        });
      });
    });

    return { 
      nodes: nodeList, 
      edges: edgeList,
      roleLevels: sortedLevels
    };
  }, [experts]);

  const svgWidth = 900;
  const svgHeight = 600;
  const centerX = svgWidth / 2;
  const centerY = svgHeight / 2;
  const baseRadius = 120;
  const radiusStep = 100;

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

            const isHighlighted = hoveredNode === edge.source || hoveredNode === edge.target;

            return (
              <line
                key={`edge-${idx}`}
                x1={sourceNode.x}
                y1={sourceNode.y}
                x2={targetNode.x}
                y2={targetNode.y}
                stroke={isHighlighted ? "hsl(var(--primary))" : "hsl(var(--muted-foreground))"}
                strokeWidth={isHighlighted ? 2 : 1}
                opacity={hoveredNode && !isHighlighted ? 0.15 : 0.4}
                className="transition-opacity duration-200"
              />
            );
          })}

          {/* ノード */}
          {nodes.map((node) => {
            const isUser = node.type === 'user';
            const radius = isUser ? 30 : 24;
            const fillColor = isUser 
              ? 'hsl(var(--primary))' 
              : getApproachabilityColor(node.approachability);
            const isHighlighted = hoveredNode === node.id;
            const isConnected = hoveredNode && edges.some(
              e => (e.source === hoveredNode && e.target === node.id) || 
                   (e.target === hoveredNode && e.source === node.id)
            );

            return (
              <g
                key={node.id}
                transform={`translate(${node.x}, ${node.y})`}
                onMouseEnter={() => setHoveredNode(node.id)}
                onMouseLeave={() => setHoveredNode(null)}
                style={{ cursor: 'pointer' }}
                opacity={hoveredNode && !isHighlighted && !isConnected ? 0.3 : 1}
                className="transition-opacity duration-200"
              >
                {/* ノード円 */}
                <circle
                  r={radius}
                  fill={fillColor}
                  stroke={isHighlighted ? "hsl(var(--foreground))" : "hsl(var(--background))"}
                  strokeWidth={isHighlighted ? 3 : 2}
                />
                
                {/* ノードラベル（名前） */}
                <text
                  y={radius + 16}
                  textAnchor="middle"
                  fill="hsl(var(--foreground))"
                  fontSize={12}
                  fontWeight={500}
                >
                  {node.label}
                </text>

                {/* サブラベル（所属） */}
                {!isUser && (
                  <text
                    y={radius + 30}
                    textAnchor="middle"
                    fill="hsl(var(--muted-foreground))"
                    fontSize={10}
                  >
                    {node.affiliation.length > 10 ? node.affiliation.slice(0, 9) + '…' : node.affiliation}
                  </text>
                )}
              </g>
            );
          })}

          {/* 凡例 */}
          <g transform={`translate(24, ${svgHeight - 100})`}>
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
          </g>
        </svg>
      </div>
    </div>
  );
};

export default ExpertNetworkGraph;