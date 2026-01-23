import React from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Mail, MessageSquare, Users, ArrowRight, Star, FileText } from 'lucide-react';
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
  mail?: string;
  approachability: 'direct' | 'introduction' | 'via_manager';
  pathDetails?: PathNode[];
  suggestedQuestions?: string[];
  contactMethods?: ('slack' | 'email' | 'request_intro' | 'ask_manager')[];
}

interface ExpertSkillCardsProps {
  experts: Expert[];
}

const approachabilityConfig = {
  direct: {
    label: "すぐ話せる",
    className: "bg-green-500/20 text-green-400 border-green-500/30",
  },
  introduction: {
    label: "紹介経由",
    className: "bg-yellow-500/20 text-yellow-400 border-yellow-500/30",
  },
  via_manager: {
    label: "上司経由",
    className: "bg-red-500/20 text-red-400 border-red-500/30",
  },
};

const contactMethodConfig = {
  slack: { label: "Slack", icon: MessageSquare },
  email: { label: "Email", icon: Mail },
  request_intro: { label: "紹介依頼", icon: Users },
  ask_manager: { label: "上司相談", icon: ArrowRight },
};

// デフォルトスキルを職種から推定
const inferSkills = (employee: Employee): string[] => {
  const job = employee.job_title.toLowerCase();
  const dept = employee.department.toLowerCase();
  
  const skills: string[] = [];
  
  if (job.includes('llm') || job.includes('プロンプト')) {
    skills.push('LLM', 'プロンプト設計', 'RAG');
  }
  if (job.includes('ml') || job.includes('機械学習')) {
    skills.push('PyTorch', 'TensorFlow', 'scikit-learn');
  }
  if (job.includes('nlp') || job.includes('自然言語')) {
    skills.push('NLP', 'Transformers', 'BERT');
  }
  if (job.includes('cv') || job.includes('画像')) {
    skills.push('画像認識', 'OpenCV', 'CNN');
  }
  if (job.includes('mlops')) {
    skills.push('MLflow', 'Kubernetes', 'Docker');
  }
  if (job.includes('データ')) {
    skills.push('データ分析', 'SQL', 'Python');
  }
  if (dept.includes('研究')) {
    skills.push('論文執筆', '実験設計');
  }
  if (dept.includes('企画') || dept.includes('戦略')) {
    skills.push('事業企画', 'マーケット分析');
  }
  
  // 最低限のスキルを保証
  if (skills.length === 0) {
    skills.push('プロジェクト管理', 'コミュニケーション');
  }
  
  return skills.slice(0, 5);
};

// デフォルト活動を推定
const inferActivity = (employee: Employee): string => {
  const activities = [
    `${employee.department}での業務を推進中`,
    '社内勉強会で登壇予定',
    'プロジェクトのリードを担当',
    '技術調査レポートを作成中',
    'チーム間連携プロジェクトに参画',
  ];
  
  // 従業員IDからシードを生成
  const seed = employee.employee_id.split('').reduce((acc, c) => acc + c.charCodeAt(0), 0);
  return activities[seed % activities.length];
};

const ExpertSkillCards: React.FC<ExpertSkillCardsProps> = ({ experts }) => {
  // 有識者の詳細情報を取得
  const expertDetails = experts.map(expert => {
    // employee_idまたはpathDetailsから従業員を特定
    let employee: Employee | undefined;
    
    if (expert.employee_id) {
      employee = mockEmployees.find(e => e.employee_id === expert.employee_id);
    }
    
    if (!employee && expert.pathDetails && expert.pathDetails.length > 0) {
      const lastNode = expert.pathDetails[expert.pathDetails.length - 1];
      employee = mockEmployees.find(e => e.employee_id === lastNode.employee_id);
    }
    
    const skills = employee?.skills || inferSkills(employee || {
      employee_id: '',
      display_name: expert.name,
      mail: expert.mail || '',
      job_title: expert.role,
      department: expert.affiliation,
      manager_employee_id: null,
    });
    
    const activity = employee?.recentActivity || inferActivity(employee || {
      employee_id: '',
      display_name: expert.name,
      mail: expert.mail || '',
      job_title: expert.role,
      department: expert.affiliation,
      manager_employee_id: null,
    });
    
    return {
      ...expert,
      skills,
      activity,
    };
  });

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
      {expertDetails.map((expert, index) => {
        const config = approachabilityConfig[expert.approachability];
        
        return (
          <Card key={expert.employee_id || index} className="overflow-hidden">
            <CardHeader className="pb-2">
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-2">
                  <Star className="w-4 h-4 text-yellow-500 fill-yellow-500" />
                  <span className="font-semibold text-sm">{expert.name}</span>
                </div>
                <Badge variant="outline" className={`text-[10px] ${config.className}`}>
                  {config.label}
                </Badge>
              </div>
              <div className="text-xs text-muted-foreground">
                {expert.affiliation} / {expert.role}
              </div>
            </CardHeader>
            
            <CardContent className="space-y-3">
              {/* スキルタグ */}
              <div className="flex flex-wrap gap-1">
                {expert.skills.map(skill => (
                  <Badge 
                    key={skill} 
                    variant="secondary" 
                    className="text-[10px] px-1.5 py-0"
                  >
                    {skill}
                  </Badge>
                ))}
              </div>
              
              {/* 最近の活動 */}
              <div className="flex items-start gap-2 text-xs text-muted-foreground bg-muted/50 rounded-md p-2">
                <FileText className="w-3 h-3 mt-0.5 flex-shrink-0" />
                <span>{expert.activity}</span>
              </div>
              
              {/* アクションボタン */}
              <div className="flex gap-1 pt-1">
                {(expert.contactMethods || ['slack', 'email']).slice(0, 3).map((method) => {
                  const methodConfig = contactMethodConfig[method as keyof typeof contactMethodConfig];
                  if (!methodConfig) return null;
                  
                  return (
                    <Button
                      key={method}
                      variant="outline"
                      size="sm"
                      className="h-7 px-2 text-xs flex-1"
                    >
                      <methodConfig.icon className="w-3 h-3 mr-1" />
                      {methodConfig.label}
                    </Button>
                  );
                })}
              </div>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
};

export default ExpertSkillCards;
