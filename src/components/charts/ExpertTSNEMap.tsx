import React, { useMemo, useState, useRef, useCallback } from 'react';
import { ZoomIn, ZoomOut, Maximize2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { mockEmployees, CURRENT_USER_ID, type Employee } from '@/data/mockEmployees';

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

interface ExpertTSNEMapProps {
  experts: Expert[];
}

// クラスタ中心座標
const CLUSTER_CENTERS: Record<string, { x: number; y: number; color: string }> = {
  "NLP/自然言語": { x: 20, y: 25, color: "hsl(210, 80%, 60%)" },
  "CV/画像認識": { x: 75, y: 20, color: "hsl(280, 70%, 60%)" },
  "LLM/生成AI": { x: 35, y: 55, color: "hsl(150, 70%, 50%)" },
  "MLOps/基盤": { x: 70, y: 65, color: "hsl(30, 80%, 55%)" },
  "戦略/企画": { x: 50, y: 85, color: "hsl(340, 70%, 60%)" },
  "経営": { x: 50, y: 10, color: "hsl(0, 0%, 50%)" },
};

// 部署・職種からクラスタを推定
const inferCluster = (employee: Employee): string => {
  const dept = employee.department.toLowerCase();
  const job = employee.job_title.toLowerCase();
  
  if (job.includes('llm') || job.includes('プロンプト') || dept.includes('ai推進')) {
    return "LLM/生成AI";
  }
  if (job.includes('nlp') || job.includes('自然言語') || (dept.includes('研究') && job.includes('リサーチ'))) {
    return "NLP/自然言語";
  }
  if (job.includes('cv') || job.includes('画像') || job.includes('vision')) {
    return "CV/画像認識";
  }
  if (job.includes('mlops') || job.includes('基盤') || job.includes('インフラ')) {
    return "MLOps/基盤";
  }
  if (dept.includes('企画') || dept.includes('事業開発') || dept.includes('戦略')) {
    return "戦略/企画";
  }
  if (dept.includes('経営') || job.includes('ceo') || job.includes('代表')) {
    return "経営";
  }
  // デフォルト: 部署に基づいて振り分け
  if (dept.includes('研究')) return "NLP/自然言語";
  if (dept.includes('ai')) return "LLM/生成AI";
  return "戦略/企画";
};

// 座標を生成（クラスタ中心 + ランダム散らし）
const generateCoordinates = (employee: Employee): { x: number; y: number } => {
  if (employee.embedding_x !== undefined && employee.embedding_y !== undefined) {
    return { x: employee.embedding_x, y: employee.embedding_y };
  }
  
  const cluster = employee.expertise_cluster || inferCluster(employee);
  const center = CLUSTER_CENTERS[cluster] || { x: 50, y: 50 };
  
  // 従業員IDからシードを生成して一貫した散らしを実現
  const seed = employee.employee_id.split('').reduce((acc, c) => acc + c.charCodeAt(0), 0);
  const angle = (seed % 360) * (Math.PI / 180);
  const radius = (seed % 15) + 5;
  
  return {
    x: Math.max(5, Math.min(95, center.x + Math.cos(angle) * radius)),
    y: Math.max(5, Math.min(95, center.y + Math.sin(angle) * radius)),
  };
};

const ExpertTSNEMap: React.FC<ExpertTSNEMapProps> = ({ experts }) => {
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

  // 全従業員の座標を計算
  const employeePositions = useMemo(() => {
    return mockEmployees.map(emp => {
      const coords = generateCoordinates(emp);
      const cluster = emp.expertise_cluster || inferCluster(emp);
      return {
        ...emp,
        x: padding + (coords.x / 100) * (svgWidth - 2 * padding),
        y: padding + (coords.y / 100) * (svgHeight - 2 * padding),
        cluster,
        isExpert: expertIds.has(emp.employee_id),
        isUser: emp.employee_id === CURRENT_USER_ID,
      };
    });
  }, [expertIds]);

  // Zoom handlers
  const handleWheel = useCallback((e: React.WheelEvent) => {
    e.preventDefault();
    const delta = e.deltaY > 0 ? 0.9 : 1.1;
    const newScale = Math.min(Math.max(scale * delta, 0.5), 3);
    
    if (svgRef.current) {
      const rect = svgRef.current.getBoundingClientRect();
      const mouseX = e.clientX - rect.left;
      const mouseY = e.clientY - rect.top;
      
      const newTranslateX = mouseX - (mouseX - translate.x) * (newScale / scale);
      const newTranslateY = mouseY - (mouseY - translate.y) * (newScale / scale);
      
      setScale(newScale);
      setTranslate({ x: newTranslateX, y: newTranslateY });
    }
  }, [scale, translate]);

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
          onWheel={handleWheel}
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
              const clusterColor = CLUSTER_CENTERS[emp.cluster]?.color || 'hsl(200, 50%, 60%)';
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
          </g>

          {/* 凡例（固定位置） */}
          <g transform={`translate(${svgWidth - 110}, 15)`}>
            <rect x={-10} y={-10} width={105} height={55} fill="hsl(var(--background))" rx={6} opacity={0.95} stroke="hsl(var(--border))" strokeWidth={1} />
            <text fill="hsl(var(--foreground))" fontSize={10} fontWeight={600}>凡例</text>
            {[
              { color: 'hsl(var(--primary))', label: '自分' },
              { color: 'hsl(0, 75%, 55%)', label: '有識者' },
            ].map((item, idx) => (
              <g key={item.label} transform={`translate(0, ${16 + idx * 16})`}>
                <circle r={5} cx={6} cy={0} fill={item.color} />
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
            <div className="font-medium text-sm">{hoveredEmp.display_name}</div>
            <div className="text-xs text-muted-foreground">{hoveredEmp.department}</div>
            <div className="text-xs text-muted-foreground">{hoveredEmp.job_title}</div>
            {hoveredEmp.skills && hoveredEmp.skills.length > 0 && (
              <div className="flex flex-wrap gap-1 mt-2">
                {hoveredEmp.skills.slice(0, 4).map(skill => (
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
        専門性の類似度に基づく2D配置。ホバーで詳細表示。
      </p>
    </div>
  );
};

export default ExpertTSNEMap;
