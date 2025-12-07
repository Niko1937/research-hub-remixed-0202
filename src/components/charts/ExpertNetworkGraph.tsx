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
  subLabel?: string;
  type: 'user' | 'expert' | 'intermediary';
  intermediaryType?: 'introducer' | 'manager';
  approachability?: 'direct' | 'introduction' | 'via_manager';
  x: number;
  y: number;
  affiliation: string;
  role: string;
}

interface NetworkEdge {
  from: string;
  to: string;
  weight: number;
  orgWeight: number;
  researchWeight: number;
}

interface ExpertNetworkGraphProps {
  experts: Expert[];
}

// 職階レベル (0=最上位, 数字が大きいほど下位)
const getRoleLevel = (role: string): number => {
  const roleLower = role.toLowerCase();
  if (roleLower.includes('ceo') || roleLower.includes('社長')) return 0;
  if (roleLower.includes('取締役') || roleLower.includes('役員')) return 1;
  if (roleLower.includes('本部長') || roleLower.includes('director')) return 2;
  if (roleLower.includes('部長')) return 2;
  if (roleLower.includes('副部長')) return 3;
  if (roleLower.includes('マネージャー') || roleLower.includes('manager') || roleLower.includes('課長')) return 3;
  if (roleLower.includes('リーダー') || roleLower.includes('lead') || roleLower.includes('主任')) return 4;
  if (roleLower.includes('principal') || roleLower.includes('シニア') || roleLower.includes('senior')) return 5;
  if (roleLower.includes('研究員') || roleLower.includes('researcher')) return 5;
  if (roleLower.includes('エンジニア') || roleLower.includes('engineer')) return 6;
  if (roleLower.includes('アソシエイト') || roleLower.includes('associate')) return 6;
  if (roleLower.includes('スタッフ') || roleLower.includes('staff')) return 7;
  if (roleLower.includes('ジュニア') || roleLower.includes('junior')) return 8;
  return 6;
};

// 組織カテゴリ分類
const getOrgCategory = (aff: string): string => {
  if (aff.includes('研究') || aff.includes('R&D') || aff.includes('リサーチ')) return 'research';
  if (aff.includes('開発') || aff.includes('エンジニア') || aff.includes('技術')) return 'engineering';
  if (aff.includes('営業') || aff.includes('マーケ') || aff.includes('事業')) return 'business';
  if (aff.includes('企画') || aff.includes('戦略')) return 'strategy';
  if (aff.includes('人事') || aff.includes('総務') || aff.includes('管理')) return 'admin';
  return 'other';
};

// カテゴリ間の距離
const categoryDistances: Record<string, Record<string, number>> = {
  research: { research: 0, engineering: 1, strategy: 2, business: 3, admin: 4, other: 3 },
  engineering: { research: 1, engineering: 0, strategy: 2, business: 2, admin: 3, other: 2 },
  strategy: { research: 2, engineering: 2, strategy: 0, business: 1, admin: 2, other: 2 },
  business: { research: 3, engineering: 2, strategy: 1, business: 0, admin: 2, other: 2 },
  admin: { research: 4, engineering: 3, strategy: 2, business: 2, admin: 0, other: 2 },
  other: { research: 3, engineering: 2, strategy: 2, business: 2, admin: 2, other: 0 },
};

const getOrgDistance = (aff1: string, aff2: string): number => {
  if (aff1 === aff2) return 0;
  const cat1 = getOrgCategory(aff1);
  const cat2 = getOrgCategory(aff2);
  return categoryDistances[cat1]?.[cat2] ?? 2;
};

const approachabilityColors = {
  user: { fill: "hsl(var(--primary))", stroke: "hsl(var(--primary))" },
  direct: { fill: "hsl(142 76% 36%)", stroke: "hsl(142 76% 36%)" },
  introduction: { fill: "hsl(45 93% 47%)", stroke: "hsl(45 93% 47%)" },
  via_manager: { fill: "hsl(0 84% 60%)", stroke: "hsl(0 84% 60%)" },
  intermediary: { fill: "hsl(220 14% 50%)", stroke: "hsl(220 14% 40%)" },
};

// connectionPathから仲介者名を抽出
const extractIntermediaryName = (connectionPath?: string, fallback?: string): string => {
  if (!connectionPath) return fallback || '仲介者';
  // "〇〇さん経由" や "〇〇を通じて" のパターン
  const match = connectionPath.match(/([^、。\s]+?)(?:さん)?(?:経由|を通じて|に紹介|から紹介)/);
  if (match) return match[1];
  // "上司の〇〇" パターン
  const managerMatch = connectionPath.match(/上司(?:の)?([^、。\s]+)/);
  if (managerMatch) return managerMatch[1];
  return fallback || connectionPath.slice(0, 6);
};

export function ExpertNetworkGraph({ experts }: ExpertNetworkGraphProps) {
  const svgRef = useRef<SVGSVGElement>(null);
  const [hoveredNode, setHoveredNode] = useState<string | null>(null);

  const generateNetworkData = () => {
    const nodes: NetworkNode[] = [];
    const edges: NetworkEdge[] = [];
    
    const svgWidth = 900;
    const svgHeight = 600;
    const leftMargin = 100;
    const rightMargin = svgWidth - 80;
    const topMargin = 70;
    const bottomMargin = svgHeight - 90;
    
    const userAffiliation = '自チーム';
    const userRoleLevel = 6;

    // 全組織を収集しカテゴリ別にグループ化
    const affiliationSet = new Set<string>();
    experts.forEach(e => affiliationSet.add(e.affiliation));
    const affiliations = Array.from(affiliationSet);
    
    // 組織をカテゴリでソートし、ユーザーチームからの距離順に並べる
    const sortedAffiliations = affiliations.sort((a, b) => {
      const distA = getOrgDistance(userAffiliation, a);
      const distB = getOrgDistance(userAffiliation, b);
      if (distA !== distB) return distA - distB;
      return a.localeCompare(b);
    });
    
    // X座標: 自チームを左端、他組織を距離順に配置
    const affiliationXMap = new Map<string, number>();
    affiliationXMap.set(userAffiliation, leftMargin);
    
    const orgSpacing = (rightMargin - leftMargin - 120) / Math.max(sortedAffiliations.length, 1);
    sortedAffiliations.forEach((aff, idx) => {
      affiliationXMap.set(aff, leftMargin + 150 + idx * orgSpacing);
    });

    // Y座標: 職階レベルをマップ
    const levelToY = (level: number): number => {
      return topMargin + (level / 8) * (bottomMargin - topMargin);
    };

    // ユーザーノード
    nodes.push({
      id: 'user',
      label: 'あなた',
      type: 'user',
      x: affiliationXMap.get(userAffiliation)!,
      y: levelToY(userRoleLevel),
      affiliation: userAffiliation,
      role: '',
    });

    // 専門家をグリッド配置 (重複回避)
    const expertNodes: { expert: Expert; index: number; x: number; y: number }[] = [];
    const occupiedPositions: { x: number; y: number }[] = [];
    const minDistance = 80; // ノード間の最小距離

    const findNonOverlappingPosition = (baseX: number, baseY: number): { x: number; y: number } => {
      let x = baseX;
      let y = baseY;
      let attempts = 0;
      const maxAttempts = 20;
      
      while (attempts < maxAttempts) {
        const hasOverlap = occupiedPositions.some(pos => {
          const dist = Math.sqrt((pos.x - x) ** 2 + (pos.y - y) ** 2);
          return dist < minDistance;
        });
        
        if (!hasOverlap) break;
        
        // スパイラル状に位置を探索
        const angle = attempts * 0.8;
        const radius = 50 + attempts * 15;
        x = baseX + Math.cos(angle) * radius;
        y = baseY + Math.sin(angle) * radius * 0.6;
        
        // 範囲内に収める
        x = Math.max(leftMargin + 50, Math.min(rightMargin - 50, x));
        y = Math.max(topMargin + 30, Math.min(bottomMargin - 30, y));
        
        attempts++;
      }
      
      return { x, y };
    };

    experts.forEach((expert, index) => {
      const roleLevel = getRoleLevel(expert.role);
      const baseX = affiliationXMap.get(expert.affiliation) || 400;
      const baseY = levelToY(roleLevel);
      
      const { x, y } = findNonOverlappingPosition(baseX, baseY);
      occupiedPositions.push({ x, y });
      
      expertNodes.push({
        expert,
        index,
        x,
        y,
      });
    });

    // 仲介者ノードを生成 (connectionPathから具体的な名前を抽出)
    const intermediaryMap = new Map<string, { id: string; name: string; type: 'introducer' | 'manager'; x: number; y: number; expertIndices: number[] }>();
    
    expertNodes.forEach(({ expert, index, x, y }) => {
      if (expert.approachability === 'introduction') {
        const name = extractIntermediaryName(expert.connectionPath, '紹介者');
        const key = `intro-${name}`;
        if (!intermediaryMap.has(key)) {
          // 仲介者はユーザーと専門家の中間に配置
          const userX = affiliationXMap.get(userAffiliation)!;
          const userY = levelToY(userRoleLevel);
          intermediaryMap.set(key, {
            id: key,
            name,
            type: 'introducer',
            x: (userX + x) / 2,
            y: (userY + y) / 2 - 10,
            expertIndices: [index],
          });
        } else {
          intermediaryMap.get(key)!.expertIndices.push(index);
        }
      } else if (expert.approachability === 'via_manager') {
        const name = extractIntermediaryName(expert.connectionPath, '上司');
        const key = `manager-${name}`;
        if (!intermediaryMap.has(key)) {
          const userX = affiliationXMap.get(userAffiliation)!;
          const userY = levelToY(userRoleLevel);
          // 上司はユーザーより上の職階に配置
          intermediaryMap.set(key, {
            id: key,
            name,
            type: 'manager',
            x: (userX + x) / 2 + 15,
            y: Math.min(userY, y) - 40,
            expertIndices: [index],
          });
        } else {
          intermediaryMap.get(key)!.expertIndices.push(index);
        }
      }
    });

    // 仲介者の位置を再計算 (関連する専門家全体の中心へ)
    intermediaryMap.forEach((inter) => {
      if (inter.expertIndices.length > 1) {
        const relatedExperts = inter.expertIndices.map(i => expertNodes[i]);
        const avgX = relatedExperts.reduce((sum, e) => sum + e.x, 0) / relatedExperts.length;
        const avgY = relatedExperts.reduce((sum, e) => sum + e.y, 0) / relatedExperts.length;
        const userX = affiliationXMap.get(userAffiliation)!;
        const userY = levelToY(userRoleLevel);
        inter.x = (userX + avgX) / 2;
        inter.y = inter.type === 'manager' 
          ? Math.min(userY, avgY) - 35
          : (userY + avgY) / 2;
      }
    });

    // 専門家ノードを追加
    expertNodes.forEach(({ expert, index, x, y }) => {
      nodes.push({
        id: `expert-${index}`,
        label: expert.name,
        subLabel: expert.role,
        type: 'expert',
        approachability: expert.approachability,
        x,
        y,
        affiliation: expert.affiliation,
        role: expert.role,
      });
    });

    // 仲介者ノードを追加
    intermediaryMap.forEach((inter) => {
      nodes.push({
        id: inter.id,
        label: inter.name,
        subLabel: inter.type === 'manager' ? '上司' : '紹介者',
        type: 'intermediary',
        intermediaryType: inter.type,
        x: inter.x,
        y: Math.max(topMargin, inter.y),
        affiliation: '',
        role: '',
      });
    });

    // エッジ生成
    experts.forEach((expert, index) => {
      const orgWeight = expert.approachability === 'direct' ? 1.0 :
                        expert.approachability === 'introduction' ? 0.5 : 0.3;
      
      if (expert.approachability === 'direct') {
        edges.push({
          from: 'user',
          to: `expert-${index}`,
          weight: orgWeight,
          orgWeight,
          researchWeight: 0,
        });
      } else if (expert.approachability === 'introduction') {
        const name = extractIntermediaryName(expert.connectionPath, '紹介者');
        const interKey = `intro-${name}`;
        if (!edges.find(e => e.from === 'user' && e.to === interKey)) {
          edges.push({
            from: 'user',
            to: interKey,
            weight: 0.7,
            orgWeight: 0.7,
            researchWeight: 0,
          });
        }
        edges.push({
          from: interKey,
          to: `expert-${index}`,
          weight: orgWeight,
          orgWeight,
          researchWeight: 0,
        });
      } else {
        const name = extractIntermediaryName(expert.connectionPath, '上司');
        const interKey = `manager-${name}`;
        if (!edges.find(e => e.from === 'user' && e.to === interKey)) {
          edges.push({
            from: 'user',
            to: interKey,
            weight: 0.5,
            orgWeight: 0.5,
            researchWeight: 0,
          });
        }
        edges.push({
          from: interKey,
          to: `expert-${index}`,
          weight: orgWeight,
          orgWeight,
          researchWeight: 0,
        });
      }
    });

    // 研究類似性エッジ
    for (let i = 0; i < experts.length; i++) {
      for (let j = i + 1; j < experts.length; j++) {
        const exp1 = experts[i];
        const exp2 = experts[j];
        let similarity = 0;
        if (exp1.affiliation === exp2.affiliation) similarity = 0.8;
        else if (getOrgCategory(exp1.affiliation) === getOrgCategory(exp2.affiliation)) similarity = 0.5;
        
        if (similarity > 0.4) {
          edges.push({
            from: `expert-${i}`,
            to: `expert-${j}`,
            weight: similarity * 0.6,
            orgWeight: 0,
            researchWeight: similarity,
          });
        }
      }
    }

    return { nodes, edges, affiliationXMap, levelToY };
  };

  const { nodes, edges, affiliationXMap, levelToY } = generateNetworkData();

  const getNodeRadius = (node: NetworkNode) => {
    if (node.type === 'user') return 32;
    if (node.type === 'intermediary') return 26;
    return 30;
  };

  const getNodeColor = (node: NetworkNode) => {
    if (node.type === 'user') return approachabilityColors.user;
    if (node.type === 'intermediary') return approachabilityColors.intermediary;
    return approachabilityColors[node.approachability || 'direct'];
  };

  return (
    <div className="space-y-3">
      <h4 className="text-sm font-medium text-foreground">ネットワーク概観</h4>

      <div className="relative bg-card/50 rounded-lg border border-border overflow-hidden">
        <svg
          ref={svgRef}
          viewBox="0 0 900 600"
          className="w-full h-[520px]"
        >
          {/* 組織ラベル (X軸上部) */}
          {Array.from(affiliationXMap.entries()).map(([aff, x]) => (
            <text
              key={`org-${aff}`}
              x={x}
              y={40}
              fontSize="12"
              fill="hsl(var(--muted-foreground))"
              textAnchor="middle"
              fontWeight="500"
              className="pointer-events-none select-none"
            >
              {aff.length > 12 ? aff.slice(0, 11) + '…' : aff}
            </text>
          ))}

          {/* 職階ラベル (Y軸左側) */}
          {[
            { level: 2, label: '部長級' },
            { level: 4, label: 'リーダー級' },
            { level: 6, label: '担当者級' },
          ].map(({ level, label }) => (
            <text
              key={`level-${level}`}
              x={20}
              y={levelToY(level)}
              fontSize="11"
              fill="hsl(var(--muted-foreground))"
              textAnchor="start"
              fontWeight="500"
              dominantBaseline="middle"
            >
              {label}
            </text>
          ))}

          {/* エッジ */}
          {edges.map((edge, index) => {
            const fromNode = nodes.find(n => n.id === edge.from);
            const toNode = nodes.find(n => n.id === edge.to);
            if (!fromNode || !toNode) return null;

            const isHighlighted = hoveredNode === edge.from || hoveredNode === edge.to;
            const baseOpacity = 0.2 + edge.weight * 0.5;
            const opacity = hoveredNode ? (isHighlighted ? Math.min(baseOpacity + 0.4, 1) : 0.06) : baseOpacity;
            const strokeWidth = 1.5 + edge.weight * 2.5;

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
                strokeDasharray={isResearchOnly ? "5 3" : "none"}
                opacity={opacity}
                className="transition-all duration-200"
              />
            );
          })}

          {/* ノード */}
          {nodes.map((node) => {
            const colors = getNodeColor(node);
            const radius = getNodeRadius(node);
            const isHovered = hoveredNode === node.id;
            const isConnected = hoveredNode && edges.some(
              e => (e.from === hoveredNode && e.to === node.id) || 
                   (e.to === hoveredNode && e.from === node.id)
            );
            const opacity = hoveredNode 
              ? (isHovered || isConnected ? 1 : 0.2) 
              : 1;

            return (
              <g
                key={node.id}
                className="cursor-pointer transition-opacity duration-200"
                style={{ opacity }}
                onMouseEnter={() => setHoveredNode(node.id)}
                onMouseLeave={() => setHoveredNode(null)}
              >
                {/* ホバー時のグロー */}
                {isHovered && (
                  <circle
                    cx={node.x}
                    cy={node.y}
                    r={radius + 8}
                    fill="none"
                    stroke={colors.stroke}
                    strokeWidth={2}
                    opacity={0.4}
                  />
                )}
                
                {/* ノード本体 */}
                <circle
                  cx={node.x}
                  cy={node.y}
                  r={radius}
                  fill={colors.fill}
                  stroke={isHovered ? "hsl(var(--foreground))" : colors.stroke}
                  strokeWidth={isHovered ? 2.5 : 1.5}
                  opacity={0.95}
                />
                
                {/* ノード内テキスト */}
                <text
                  x={node.x}
                  y={node.y}
                  dy="0.35em"
                  fontSize={node.type === 'user' ? 13 : 11}
                  fill="white"
                  textAnchor="middle"
                  fontWeight="600"
                  className="pointer-events-none select-none"
                >
                  {node.label.length > 5 ? node.label.slice(0, 4) + '…' : node.label}
                </text>
                
                {/* ノード下のラベル */}
                <text
                  x={node.x}
                  y={node.y + radius + 16}
                  fontSize="11"
                  fill="hsl(var(--foreground))"
                  textAnchor="middle"
                  fontWeight="500"
                  className="pointer-events-none select-none"
                >
                  {node.label}
                </text>
                
                {/* サブラベル (役職 or 仲介者種別) */}
                {node.subLabel && (
                  <text
                    x={node.x}
                    y={node.y + radius + 30}
                    fontSize="10"
                    fill="hsl(var(--muted-foreground))"
                    textAnchor="middle"
                    className="pointer-events-none select-none"
                  >
                    {node.subLabel.length > 14 ? node.subLabel.slice(0, 13) + '…' : node.subLabel}
                  </text>
                )}
                
                {/* 組織名 (専門家のみ) */}
                {node.type === 'expert' && node.affiliation && (
                  <text
                    x={node.x}
                    y={node.y + radius + 44}
                    fontSize="9"
                    fill="hsl(var(--muted-foreground))"
                    textAnchor="middle"
                    opacity={0.7}
                    className="pointer-events-none select-none"
                  >
                    {node.affiliation.length > 14 ? node.affiliation.slice(0, 13) + '…' : node.affiliation}
                  </text>
                )}
              </g>
            );
          })}
        </svg>
      </div>

      {/* 凡例 */}
      <div className="flex flex-wrap gap-4 text-xs">
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1.5">
            <div className="w-3 h-3 rounded-full" style={{ backgroundColor: approachabilityColors.direct.fill }} />
            <span className="text-muted-foreground">直接連絡可</span>
          </div>
          <div className="flex items-center gap-1.5">
            <div className="w-3 h-3 rounded-full" style={{ backgroundColor: approachabilityColors.introduction.fill }} />
            <span className="text-muted-foreground">紹介経由</span>
          </div>
          <div className="flex items-center gap-1.5">
            <div className="w-3 h-3 rounded-full" style={{ backgroundColor: approachabilityColors.via_manager.fill }} />
            <span className="text-muted-foreground">上司経由</span>
          </div>
          <div className="flex items-center gap-1.5">
            <div className="w-3 h-3 rounded-full" style={{ backgroundColor: approachabilityColors.intermediary.fill }} />
            <span className="text-muted-foreground">仲介者</span>
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
