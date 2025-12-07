import { useEffect, useRef, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

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
  type: 'user' | 'direct' | 'introduction' | 'via_manager';
  x: number;
  y: number;
  affiliation: string;
  role: string;
}

interface NetworkEdge {
  from: string;
  to: string;
  type: 'org' | 'research';
  label?: string;
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
  const [viewMode, setViewMode] = useState<'org' | 'research'>('org');

  // Generate network data from experts
  const generateNetworkData = () => {
    const nodes: NetworkNode[] = [];
    const orgEdges: NetworkEdge[] = [];
    const researchEdges: NetworkEdge[] = [];

    // Add user node at center
    nodes.push({
      id: 'user',
      label: 'あなた',
      type: 'user',
      x: 250,
      y: 200,
      affiliation: '',
      role: '',
    });

    // Group experts by affiliation for organizational view
    const affiliationGroups = new Map<string, Expert[]>();
    experts.forEach(expert => {
      const group = affiliationGroups.get(expert.affiliation) || [];
      group.push(expert);
      affiliationGroups.set(expert.affiliation, group);
    });

    // Position experts in a circle around user
    const radius = 150;
    experts.forEach((expert, index) => {
      const angle = (index / experts.length) * 2 * Math.PI - Math.PI / 2;
      const x = 250 + radius * Math.cos(angle);
      const y = 200 + radius * Math.sin(angle);

      nodes.push({
        id: `expert-${index}`,
        label: expert.name,
        type: expert.approachability,
        x,
        y,
        affiliation: expert.affiliation,
        role: expert.role,
      });

      // Organizational edges (based on approachability/connection path)
      orgEdges.push({
        from: 'user',
        to: `expert-${index}`,
        type: 'org',
        label: expert.approachability === 'direct' ? '直接' : 
               expert.approachability === 'introduction' ? '紹介' : '上司経由',
      });
    });

    // Research cluster edges - connect experts in same affiliation
    const affiliationIndices = new Map<string, number[]>();
    experts.forEach((expert, index) => {
      const indices = affiliationIndices.get(expert.affiliation) || [];
      indices.push(index);
      affiliationIndices.set(expert.affiliation, indices);
    });

    affiliationIndices.forEach((indices) => {
      for (let i = 0; i < indices.length; i++) {
        for (let j = i + 1; j < indices.length; j++) {
          researchEdges.push({
            from: `expert-${indices[i]}`,
            to: `expert-${indices[j]}`,
            type: 'research',
            label: '同部署',
          });
        }
      }
    });

    return { nodes, orgEdges, researchEdges };
  };

  const { nodes, orgEdges, researchEdges } = generateNetworkData();
  const edges = viewMode === 'org' ? orgEdges : researchEdges;

  const getNodeRadius = (type: string) => type === 'user' ? 30 : 24;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h4 className="text-sm font-medium text-foreground">ネットワーク概観</h4>
        <Tabs value={viewMode} onValueChange={(v) => setViewMode(v as 'org' | 'research')}>
          <TabsList className="h-8">
            <TabsTrigger value="org" className="text-xs px-3 h-6">組織レポートライン</TabsTrigger>
            <TabsTrigger value="research" className="text-xs px-3 h-6">研究類似クラスタ</TabsTrigger>
          </TabsList>
        </Tabs>
      </div>

      <div className="relative bg-card/50 rounded-lg border border-border overflow-hidden">
        <svg
          ref={svgRef}
          viewBox="0 0 500 400"
          className="w-full h-[300px]"
        >
          {/* Edges */}
          {edges.map((edge, index) => {
            const fromNode = nodes.find(n => n.id === edge.from);
            const toNode = nodes.find(n => n.id === edge.to);
            if (!fromNode || !toNode) return null;

            const isHighlighted = hoveredNode === edge.from || hoveredNode === edge.to;
            const opacity = hoveredNode ? (isHighlighted ? 1 : 0.2) : 0.6;

            return (
              <g key={index}>
                <line
                  x1={fromNode.x}
                  y1={fromNode.y}
                  x2={toNode.x}
                  y2={toNode.y}
                  stroke={viewMode === 'org' ? "hsl(var(--muted-foreground))" : "hsl(var(--primary))"}
                  strokeWidth={isHighlighted ? 2 : 1}
                  strokeDasharray={viewMode === 'research' ? "4 2" : "none"}
                  opacity={opacity}
                />
                {isHighlighted && edge.label && (
                  <text
                    x={(fromNode.x + toNode.x) / 2}
                    y={(fromNode.y + toNode.y) / 2 - 5}
                    fontSize="10"
                    fill="hsl(var(--foreground))"
                    textAnchor="middle"
                    className="pointer-events-none"
                  >
                    {edge.label}
                  </text>
                )}
              </g>
            );
          })}

          {/* Nodes */}
          {nodes.map((node) => {
            const colors = approachabilityColors[node.type];
            const radius = getNodeRadius(node.type);
            const isHighlighted = hoveredNode === node.id || !hoveredNode;
            const opacity = hoveredNode ? (isHighlighted ? 1 : 0.3) : 1;

            return (
              <g
                key={node.id}
                className="cursor-pointer transition-opacity"
                style={{ opacity }}
                onMouseEnter={() => setHoveredNode(node.id)}
                onMouseLeave={() => setHoveredNode(null)}
              >
                <circle
                  cx={node.x}
                  cy={node.y}
                  r={radius}
                  fill={colors.fill}
                  stroke={hoveredNode === node.id ? "hsl(var(--foreground))" : colors.stroke}
                  strokeWidth={hoveredNode === node.id ? 3 : 2}
                  opacity={0.9}
                />
                <text
                  x={node.x}
                  y={node.y}
                  dy="0.35em"
                  fontSize={node.type === 'user' ? 12 : 10}
                  fill="white"
                  textAnchor="middle"
                  fontWeight="600"
                  className="pointer-events-none"
                >
                  {node.label.length > 4 ? node.label.slice(0, 3) + '…' : node.label}
                </text>
                {/* Full name below node */}
                <text
                  x={node.x}
                  y={node.y + radius + 12}
                  fontSize="10"
                  fill="hsl(var(--foreground))"
                  textAnchor="middle"
                  className="pointer-events-none"
                >
                  {node.label}
                </text>
                {/* Affiliation below name for experts */}
                {node.type !== 'user' && (
                  <text
                    x={node.x}
                    y={node.y + radius + 24}
                    fontSize="8"
                    fill="hsl(var(--muted-foreground))"
                    textAnchor="middle"
                    className="pointer-events-none"
                  >
                    {node.affiliation.length > 12 ? node.affiliation.slice(0, 10) + '…' : node.affiliation}
                  </text>
                )}
              </g>
            );
          })}
        </svg>
      </div>

      {/* Legend */}
      <div className="flex flex-wrap gap-3 text-xs">
        <div className="flex items-center gap-1.5">
          <div className="w-3 h-3 rounded-full" style={{ backgroundColor: approachabilityColors.direct.fill }} />
          <span className="text-muted-foreground">すぐ話せる</span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="w-3 h-3 rounded-full" style={{ backgroundColor: approachabilityColors.introduction.fill }} />
          <span className="text-muted-foreground">紹介が必要</span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="w-3 h-3 rounded-full" style={{ backgroundColor: approachabilityColors.via_manager.fill }} />
          <span className="text-muted-foreground">上司経由</span>
        </div>
        {viewMode === 'research' && (
          <div className="flex items-center gap-1.5 ml-2 pl-2 border-l border-border">
            <div className="w-4 h-0 border-t border-dashed border-primary" />
            <span className="text-muted-foreground">研究類似</span>
          </div>
        )}
      </div>
    </div>
  );
}
