// Mock employee data for KnowWho feature
// Structure: CEO → 役員 → 部長 → 課長 → 一般

export interface Employee {
  employee_id: string;
  display_name: string;
  mail: string;
  job_title: string;
  department: string;
  manager_employee_id: string | null;
}

export const mockEmployees: Employee[] = [
  // CEO (Level 4)
  {
    employee_id: "E001",
    display_name: "山田 太郎",
    mail: "yamada.taro@company.com",
    job_title: "代表取締役CEO",
    department: "経営",
    manager_employee_id: null,
  },

  // 役員 (Level 3)
  {
    employee_id: "E010",
    display_name: "佐藤 一郎",
    mail: "sato.ichiro@company.com",
    job_title: "執行役員 CTO",
    department: "技術本部",
    manager_employee_id: "E001",
  },
  {
    employee_id: "E011",
    display_name: "鈴木 花子",
    mail: "suzuki.hanako@company.com",
    job_title: "執行役員 CSO",
    department: "戦略本部",
    manager_employee_id: "E001",
  },
  {
    employee_id: "E012",
    display_name: "高橋 健一",
    mail: "takahashi.kenichi@company.com",
    job_title: "執行役員 CFO",
    department: "管理本部",
    manager_employee_id: "E001",
  },

  // 部長 (Level 2)
  {
    employee_id: "E020",
    display_name: "田中 誠",
    mail: "tanaka.makoto@company.com",
    job_title: "研究開発部長",
    department: "研究開発部",
    manager_employee_id: "E010",
  },
  {
    employee_id: "E021",
    display_name: "伊藤 美咲",
    mail: "ito.misaki@company.com",
    job_title: "AI推進部長",
    department: "AI推進部",
    manager_employee_id: "E010",
  },
  {
    employee_id: "E022",
    display_name: "渡辺 剛",
    mail: "watanabe.tsuyoshi@company.com",
    job_title: "技術戦略室長",
    department: "技術戦略室",
    manager_employee_id: "E010",
  },
  {
    employee_id: "E023",
    display_name: "小林 真理",
    mail: "kobayashi.mari@company.com",
    job_title: "企画部長",
    department: "企画部",
    manager_employee_id: "E011",
  },
  {
    employee_id: "E024",
    display_name: "加藤 隆",
    mail: "kato.takashi@company.com",
    job_title: "事業開発部長",
    department: "事業開発部",
    manager_employee_id: "E011",
  },

  // 課長 (Level 1)
  {
    employee_id: "E030",
    display_name: "吉田 健太",
    mail: "yoshida.kenta@company.com",
    job_title: "NLP研究課長",
    department: "研究開発部",
    manager_employee_id: "E020",
  },
  {
    employee_id: "E031",
    display_name: "山本 愛",
    mail: "yamamoto.ai@company.com",
    job_title: "CV研究課長",
    department: "研究開発部",
    manager_employee_id: "E020",
  },
  {
    employee_id: "E032",
    display_name: "中村 翔",
    mail: "nakamura.sho@company.com",
    job_title: "LLM推進課長",
    department: "AI推進部",
    manager_employee_id: "E021",
  },
  {
    employee_id: "E033",
    display_name: "小川 裕子",
    mail: "ogawa.yuko@company.com",
    job_title: "MLOps課長",
    department: "AI推進部",
    manager_employee_id: "E021",
  },
  {
    employee_id: "E034",
    display_name: "藤田 大輔",
    mail: "fujita.daisuke@company.com",
    job_title: "技術調査課長",
    department: "技術戦略室",
    manager_employee_id: "E022",
  },

  // 一般社員 (Level 0)
  {
    employee_id: "E100",
    display_name: "自分",
    mail: "me@company.com",
    job_title: "AIリサーチャー",
    department: "研究開発部",
    manager_employee_id: "E030",
  },
  {
    employee_id: "E101",
    display_name: "松本 理沙",
    mail: "matsumoto.risa@company.com",
    job_title: "シニアリサーチャー",
    department: "研究開発部",
    manager_employee_id: "E030",
  },
  {
    employee_id: "E102",
    display_name: "井上 拓也",
    mail: "inoue.takuya@company.com",
    job_title: "リサーチャー",
    department: "研究開発部",
    manager_employee_id: "E031",
  },
  {
    employee_id: "E103",
    display_name: "木村 優太",
    mail: "kimura.yuta@company.com",
    job_title: "MLエンジニア",
    department: "AI推進部",
    manager_employee_id: "E032",
  },
  {
    employee_id: "E104",
    display_name: "林 さくら",
    mail: "hayashi.sakura@company.com",
    job_title: "シニアMLエンジニア",
    department: "AI推進部",
    manager_employee_id: "E032",
  },
  {
    employee_id: "E105",
    display_name: "清水 龍一",
    mail: "shimizu.ryuichi@company.com",
    job_title: "MLOpsエンジニア",
    department: "AI推進部",
    manager_employee_id: "E033",
  },
  {
    employee_id: "E106",
    display_name: "森 真由美",
    mail: "mori.mayumi@company.com",
    job_title: "テックリサーチャー",
    department: "技術戦略室",
    manager_employee_id: "E034",
  },
  {
    employee_id: "E107",
    display_name: "池田 光",
    mail: "ikeda.hikaru@company.com",
    job_title: "ストラテジスト",
    department: "企画部",
    manager_employee_id: "E023",
  },
  {
    employee_id: "E108",
    display_name: "橋本 和也",
    mail: "hashimoto.kazuya@company.com",
    job_title: "ビジネスデベロッパー",
    department: "事業開発部",
    manager_employee_id: "E024",
  },
  {
    employee_id: "E109",
    display_name: "石井 美穂",
    mail: "ishii.miho@company.com",
    job_title: "プロンプトエンジニア",
    department: "AI推進部",
    manager_employee_id: "E032",
  },
  {
    employee_id: "E110",
    display_name: "前田 拓海",
    mail: "maeda.takumi@company.com",
    job_title: "データサイエンティスト",
    department: "研究開発部",
    manager_employee_id: "E031",
  },
];

// 現在のユーザー（自分）のID
export const CURRENT_USER_ID = "E100";

// 従業員をIDで検索
export function getEmployeeById(id: string): Employee | undefined {
  return mockEmployees.find((e) => e.employee_id === id);
}

// 祖先リストを取得（自分 → 上司 → ... → CEO）
export function getAncestors(employeeId: string): Employee[] {
  const ancestors: Employee[] = [];
  let currentId: string | null = employeeId;

  while (currentId) {
    const employee = getEmployeeById(currentId);
    if (!employee) break;
    ancestors.push(employee);
    currentId = employee.manager_employee_id;
  }

  return ancestors;
}

// LCA（最小共通祖先）を見つけて経路を返す
export function findPathBetween(
  fromId: string,
  toId: string
): {
  lca: Employee | null;
  pathFromMe: Employee[];
  pathToTarget: Employee[];
  fullPath: Employee[];
  distance: number;
} {
  const myAncestors = getAncestors(fromId);
  const myAncestorSet = new Set(myAncestors.map((e) => e.employee_id));

  const targetAncestors = getAncestors(toId);

  // ターゲットの祖先をたどって、自分の祖先と交わる点（LCA）を探す
  let lca: Employee | null = null;
  let lcaIndexInTarget = -1;

  for (let i = 0; i < targetAncestors.length; i++) {
    if (myAncestorSet.has(targetAncestors[i].employee_id)) {
      lca = targetAncestors[i];
      lcaIndexInTarget = i;
      break;
    }
  }

  if (!lca) {
    return {
      lca: null,
      pathFromMe: myAncestors,
      pathToTarget: targetAncestors,
      fullPath: [],
      distance: -1,
    };
  }

  const lcaIndexInMe = myAncestors.findIndex(
    (e) => e.employee_id === lca!.employee_id
  );

  // 経路: fromId → ... → LCA → ... → toId
  const pathFromMe = myAncestors.slice(0, lcaIndexInMe + 1);
  const pathToTarget = targetAncestors.slice(0, lcaIndexInTarget).reverse();
  const fullPath = [...pathFromMe, ...pathToTarget];

  return {
    lca,
    pathFromMe,
    pathToTarget,
    fullPath,
    distance: pathFromMe.length + pathToTarget.length - 1,
  };
}

// approachabilityを判定
export function calculateApproachability(
  fromId: string,
  toId: string
): "direct" | "introduction" | "via_manager" {
  const from = getEmployeeById(fromId);
  const to = getEmployeeById(toId);

  if (!from || !to) return "via_manager";

  const { distance } = findPathBetween(fromId, toId);

  // 同じ部署 → direct
  if (from.department === to.department) return "direct";

  // 経路が2以下 → direct
  if (distance <= 2) return "direct";

  // 経路が4以下 → introduction
  if (distance <= 4) return "introduction";

  // それ以外 → via_manager
  return "via_manager";
}

// 経路を文字列で表現
export function formatConnectionPath(fromId: string, toId: string): string {
  const { fullPath } = findPathBetween(fromId, toId);

  if (fullPath.length === 0) return "";

  return fullPath.map((e) => e.display_name).join(" → ");
}

// 部署で従業員を検索
export function searchByDepartment(department: string): Employee[] {
  return mockEmployees.filter((e) =>
    e.department.toLowerCase().includes(department.toLowerCase())
  );
}

// 職種で従業員を検索
export function searchByJobTitle(keyword: string): Employee[] {
  return mockEmployees.filter((e) =>
    e.job_title.toLowerCase().includes(keyword.toLowerCase())
  );
}

// キーワードで従業員を検索（部署・職種・名前）
export function searchEmployees(query: string): Employee[] {
  const lowerQuery = query.toLowerCase();
  return mockEmployees.filter(
    (e) =>
      e.display_name.toLowerCase().includes(lowerQuery) ||
      e.department.toLowerCase().includes(lowerQuery) ||
      e.job_title.toLowerCase().includes(lowerQuery)
  );
}
