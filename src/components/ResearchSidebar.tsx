import { Home, Search, MessageSquare, Settings, Plus, Clock, Sparkles, FileText } from "lucide-react";
import { NavLink } from "@/components/NavLink";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuItem,
  SidebarMenuButton,
  SidebarTrigger,
  useSidebar,
} from "@/components/ui/sidebar";

interface Thread {
  id: string;
  title: string;
  timestamp: string;
}

const mockThreads: Thread[] = [
  { id: "1", title: "量子コンピューティングの最新研究", timestamp: "2時間前" },
  { id: "2", title: "機械学習モデルの最適化手法", timestamp: "昨日" },
  { id: "3", title: "バイオインフォマティクスの応用", timestamp: "3日前" },
];

export function ResearchSidebar() {
  const { open } = useSidebar();

  return (
    <Sidebar collapsible="icon" className="border-r border-border">
      {/* Header with ResearchHub title and toggle */}
      <div className="flex items-center justify-between px-4 py-4 border-b border-border">
        {open ? (
          <>
            <div className="flex items-center gap-2">
              <Sparkles className="w-5 h-5 text-primary" />
              <h1 className="text-lg font-semibold text-foreground">ResearchHub</h1>
            </div>
            <SidebarTrigger className="hover:bg-accent rounded-md" />
          </>
        ) : (
          <SidebarTrigger className="hover:bg-accent rounded-md mx-auto" />
        )}
      </div>

      <SidebarContent className="pt-4">
        <SidebarGroup>
          <SidebarGroupLabel className="px-4 text-xs uppercase tracking-wider text-muted-foreground mb-2">
            {open && "メニュー"}
          </SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              <SidebarMenuItem>
                <NavLink
                  to="/"
                  className="flex items-center gap-3 px-3 py-2 rounded-lg text-sidebar-foreground hover:bg-sidebar-accent transition-colors"
                  activeClassName="bg-sidebar-accent text-sidebar-accent-foreground"
                >
                  <Home className="w-5 h-5 shrink-0" />
                  {open && <span className="text-sm font-medium">ホーム</span>}
                </NavLink>
              </SidebarMenuItem>

              <SidebarMenuItem>
                <NavLink
                  to="/search"
                  className="flex items-center gap-3 px-3 py-2 rounded-lg text-sidebar-foreground hover:bg-sidebar-accent transition-colors"
                  activeClassName="bg-sidebar-accent text-sidebar-accent-foreground"
                >
                  <Search className="w-5 h-5 shrink-0" />
                  {open && <span className="text-sm font-medium">検索</span>}
                </NavLink>
              </SidebarMenuItem>

              <SidebarMenuItem>
                <NavLink
                  to="/assistant"
                  className="flex items-center gap-3 px-3 py-2 rounded-lg text-sidebar-foreground hover:bg-sidebar-accent transition-colors"
                  activeClassName="bg-sidebar-accent text-sidebar-accent-foreground"
                >
                  <MessageSquare className="w-5 h-5 shrink-0" />
                  {open && <span className="text-sm font-medium">アシスタント</span>}
                </NavLink>
              </SidebarMenuItem>
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        <SidebarGroup>
          <SidebarGroupLabel className="px-4 text-xs uppercase tracking-wider text-muted-foreground mb-2">
            {open && "スレッド履歴"}
          </SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              <SidebarMenuItem>
                <button className="flex items-center gap-3 px-3 py-2 w-full rounded-lg text-sidebar-foreground hover:bg-sidebar-accent transition-colors text-left">
                  <FileText className="w-5 h-5 shrink-0" />
                  {open && <span className="text-sm truncate">量子機械学習について</span>}
                </button>
              </SidebarMenuItem>
              <SidebarMenuItem>
                <button className="flex items-center gap-3 px-3 py-2 w-full rounded-lg text-sidebar-foreground hover:bg-sidebar-accent transition-colors text-left">
                  <FileText className="w-5 h-5 shrink-0" />
                  {open && <span className="text-sm truncate">深層学習の最新動向</span>}
                </button>
              </SidebarMenuItem>
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
    </Sidebar>
  );
}
