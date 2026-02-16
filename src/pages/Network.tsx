import { SidebarProvider } from "@/components/ui/sidebar";
import { ResearchSidebar } from "@/components/ResearchSidebar";
import ExpertNetworkView from "@/components/ExpertNetworkView";

export default function Network() {
  return (
    <SidebarProvider>
      <div className="min-h-screen flex w-full">
        <ResearchSidebar />
        <main className="flex-1 flex flex-col overflow-hidden">
          <ExpertNetworkView />
        </main>
      </div>
    </SidebarProvider>
  );
}
