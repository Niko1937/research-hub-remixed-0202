import { Home, Search, MessageSquare, Settings, Plus, Clock, Sparkles } from "lucide-react";
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
    <Sidebar className={open ? "w-64" : "w-16"} collapsible="icon">
      <div className="p-4 border-b border-sidebar-border flex items-center justify-center">
        {open ? (
          <h1 className="text-lg font-bold bg-gradient-primary bg-clip-text text-transparent">
            Research Hub
          </h1>
        ) : (
          <Sparkles className="w-6 h-6 text-primary" />
        )}
      </div>

      <SidebarContent>
        <SidebarGroup>
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

        {open && (
          <>
            <Separator className="bg-sidebar-border my-2" />

            <SidebarGroup className="flex-1">
              <SidebarGroupLabel className="flex items-center justify-between px-3">
                <span className="flex items-center gap-2">
                  <Clock className="w-4 h-4" />
                  スレッド履歴
                </span>
                <Button size="sm" variant="ghost" className="h-7 w-7 p-0">
                  <Plus className="w-4 h-4" />
                </Button>
              </SidebarGroupLabel>

              <SidebarGroupContent>
                <ScrollArea className="h-[400px]">
                  <div className="space-y-1 px-3">
                    {mockThreads.map((thread) => (
                      <button
                        key={thread.id}
                        className="w-full text-left px-3 py-2 rounded-lg hover:bg-sidebar-accent transition-colors group"
                      >
                        <p className="text-sm text-sidebar-foreground truncate group-hover:text-sidebar-accent-foreground">
                          {thread.title}
                        </p>
                        <p className="text-xs text-muted-foreground mt-0.5">
                          {thread.timestamp}
                        </p>
                      </button>
                    ))}
                  </div>
                </ScrollArea>
              </SidebarGroupContent>
            </SidebarGroup>
          </>
        )}
      </SidebarContent>

      <Separator className="bg-sidebar-border" />

      <div className="p-3">
        <Button
          variant="ghost"
          className="w-full justify-start gap-3 text-sidebar-foreground hover:bg-sidebar-accent"
        >
          <Settings className="w-5 h-5 shrink-0" />
          {open && <span className="text-sm">設定</span>}
        </Button>
      </div>
    </Sidebar>
  );
}
