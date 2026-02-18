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
  employee_id?: string;
  name: string;
  affiliation: string;
  role: string;
  approachability: 'direct' | 'introduction' | 'via_manager';
  pathDetails?: PathNode[];
}

interface ClusterInfo {
  label: string;
  center_x: number;
  center_y: number;
  count: number;
}

interface EmployeeForTSNE {
  employee_id: string;
  name: string;
  department: string;
  role: string;
  expertise?: string[];
  keywords?: string[];
  tsne_x: number;
  tsne_y: number;
  cluster_id?: number;
  cluster_label?: string;
  is_current_user?: boolean;
}

interface ExpertTSNEMapProps {
  experts: Expert[];
  allEmployees?: EmployeeForTSNE[];
  clusters?: Record<string, ClusterInfo>;
}

// クラスタIDに基づく色を生成
const CLUSTER_COLORS = [
  "hsl(210, 80%, 60%)",  // 青
  "hsl(280, 70%, 60%)",  // 紫
  "hsl(150, 70%, 50%)",  // 緑
  "hsl(30, 80%, 55%)",   // オレンジ
  "hsl(340, 70%, 60%)",  // ピンク
  "hsl(180, 60%, 50%)",  // シアン
  "hsl(60, 70%, 50%)",   // 黄
  "hsl(0, 0%, 50%)",     // グレー
];

const getClusterColor = (clusterId: number | undefined): string => {
  if (clusterId === undefined) return "hsl(200, 50%, 60%)";
  return CLUSTER_COLORS[clusterId % CLUSTER_COLORS.length];
};

const ExpertTSNEMap: React.FC<ExpertTSNEMapProps> = ({ experts, allEmployees, clusters }) => {
  const [hoveredEmployee, setHoveredEmployee] = useState<string | null>(null);
  const [scale, setScale] = useState(1);
  const [translate, setTranslate] = useState({ x: 0, y: 0 });
  const [isPanning, setIsPanning] = useState(false);
  const [panStart, setPanStart] = useState({ x: 0, y: 0 });
  const svgRef = useRef<SVGSVGElement>(null);

  const svgWidth = 600;
  const svgHeight = 400;
  const padding = 40;

  // 有識者のIDセット
  const expertIds = useMemo(() => {
    const ids = new Set<string>();
    experts.forEach(e => {
      if (e.employee_id) ids.add(e.employee_id);
      if (e.pathDetails && e.pathDetails.length > 0) {
        const lastNode = e.pathDetails[e.pathDetails.length - 1];
        if (lastNode.employee_id) ids.add(lastNode.employee_id);
      }
    });
    return ids;
  }, [experts]);

  // 全従業員の座標を計算 - バックエンドからのt-SNE座標を使用
  const employeePositions = useMemo(() => {
    if (!allEmployees || allEmployees.length === 0) {
      return [];
    }

    return allEmployees.map(emp => {
      // バックエンドからのt-SNE座標を使用 (0-1の範囲を想定)
      const x = padding + emp.tsne_x * (svgWidth - 2 * padding);
      const y = padding + emp.tsne_y * (svgHeight - 2 * padding);

      return {
        ...emp,
        x,
        y,
        isExpert: expertIds.has(emp.employee_id),
        isUser: emp.is_current_user || false,
      };
    });
  }, [allEmployees, expertIds]);

  // クラスタラベルの位置を計算
  const clusterLabels = useMemo(() => {
    if (!clusters) return [];

    return Object.entries(clusters).map(([id, info]) => ({
      id,
      label: info.label,
      x: padding + info.center_x * (svgWidth - 2 * padding),
      y: padding + info.center_y * (svgHeight - 2 * padding),
      color: getClusterColor(parseInt(id)),
    }));
  }, [clusters]);

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
    if (e.button === 0) {
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

  const handleZoomIn = () => setScale(s => Math.min(s * 1.2, 3));
  const handleZoomOut = () => setScale(s => Math.max(s * 0.8, 0.5));
  const handleReset = () => {
    setScale(1);
    setTranslate({ x: 0, y: 0 });
  };

  const hoveredEmp = employeePositions.find(e => e.employee_id === hoveredEmployee);

  // データがない場合の表示
  if (!allEmployees || allEmployees.length === 0) {
    return (
      <div className="w-full p-8 text-center text-muted-foreground text-sm">
        <p>t-SNEデータがありません</p>
        <p className="text-xs mt-2">バックエンドでクラスタリングを実行してください</p>
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
        className="w-full overflow-hidden rounded-lg border border-border bg-card relative"
        style={{ height: 350, cursor: isPanning ? 'grabbing' : 'grab' }}
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

            {/* 従業員ドット - クラスタの色で表示、有識者は赤でハイライト */}
            {employeePositions.map((emp) => {
              const isHovered = hoveredEmployee === emp.employee_id;
              const clusterColor = getClusterColor(emp.cluster_id);
              const radius = emp.isUser ? 8 : emp.isExpert ? 7 : 4;

              let fillColor: string;
              let strokeColor: string | undefined;
              let strokeWidth: number;

              if (emp.isUser) {
                fillColor = 'hsl(var(--primary))';
                strokeColor = 'hsl(var(--background))';
                strokeWidth = 2;
              } else if (emp.isExpert) {
                fillColor = 'hsl(0, 75%, 55%)'; // 赤でハイライト
                strokeColor = 'hsl(var(--background))';
                strokeWidth = 2;
              } else {
                fillColor = clusterColor;
                strokeColor = undefined;
                strokeWidth = 0;
              }

              return (
                <g
                  key={emp.employee_id}
                  transform={`translate(${emp.x}, ${emp.y})`}
                  onMouseEnter={() => setHoveredEmployee(emp.employee_id)}
                  onMouseLeave={() => setHoveredEmployee(null)}
                  style={{ cursor: 'pointer' }}
                  className="transition-all duration-150"
                >
                  <circle
                    r={isHovered ? radius + 2 : radius}
                    fill={fillColor}
                    opacity={isHovered ? 1 : 0.8}
                    stroke={strokeColor}
                    strokeWidth={strokeWidth}
                  />
                </g>
              );
            })}

            {/* クラスタラベル（LLMで生成されたラベル） */}
            {clusterLabels.map((cluster) => (
              <g key={`label-${cluster.id}`} transform={`translate(${cluster.x}, ${cluster.y})`}>
                <rect
                  x={-cluster.label.length * 5}
                  y={-12}
                  width={cluster.label.length * 10}
                  height={20}
                  fill="hsl(var(--card))"
                  opacity={0.9}
                  rx={4}
                />
                <text
                  textAnchor="middle"
                  dominantBaseline="middle"
                  fill="hsl(var(--foreground))"
                  fontSize={11}
                  fontWeight={600}
                  style={{ pointerEvents: 'none' }}
                >
                  {cluster.label}
                </text>
              </g>
            ))}
          </g>

          {/* 凡例（固定位置） */}
          <g transform={`translate(${svgWidth - 90}, 15)`}>
            <rect x={-10} y={-10} width={85} height={55} fill="hsl(var(--background))" rx={6} opacity={0.95} stroke="hsl(var(--border))" strokeWidth={1} />
            <text fill="hsl(var(--foreground))" fontSize={10} fontWeight={600}>凡例</text>
            {[
              { color: 'hsl(var(--primary))', label: '自分' },
              { color: 'hsl(0, 75%, 55%)', label: '有識者' },
            ].map((item, idx) => (
              <g key={item.label} transform={`translate(0, ${16 + idx * 16})`}>
                <circle r={5} cx={6} cy={0} fill={item.color} stroke="hsl(var(--background))" strokeWidth={1.5} />
                <text x={18} y={4} fill="hsl(var(--muted-foreground))" fontSize={10}>
                  {item.label}
                </text>
              </g>
            ))}
          </g>
        </svg>

        {/* Tooltip */}
        {hoveredEmp && (
          <div
            className="absolute bg-popover border border-border rounded-lg shadow-lg p-3 pointer-events-none z-10"
            style={{
              left: Math.min(hoveredEmp.x * scale + translate.x + 15, svgWidth - 200),
              top: Math.min(hoveredEmp.y * scale + translate.y - 10, svgHeight - 100),
            }}
          >
            <div className="font-medium text-sm">{hoveredEmp.name}</div>
            <div className="text-xs text-muted-foreground">{hoveredEmp.department}</div>
            <div className="text-xs text-muted-foreground">{hoveredEmp.role}</div>
            {hoveredEmp.cluster_label && (
              <div className="text-xs text-primary mt-1">クラスタ: {hoveredEmp.cluster_label}</div>
            )}
            {hoveredEmp.expertise && hoveredEmp.expertise.length > 0 && (
              <div className="flex flex-wrap gap-1 mt-2">
                {hoveredEmp.expertise.slice(0, 4).map(skill => (
                  <span key={skill} className="px-1.5 py-0.5 text-[10px] bg-muted rounded">
                    {skill}
                  </span>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      <p className="text-xs text-muted-foreground text-center">
        t-SNE + k-meansクラスタリング（LLMラベル付き）。ホバーで詳細表示。
      </p>
    </div>
  );
};

export default ExpertTSNEMap;
