import { HeroSection } from "@/components/HeroSection";
import { ValueProposition } from "@/components/ValueProposition";
import { Button } from "@/components/ui/button";
import { ArrowRight, Search } from "lucide-react";
import { Link } from "react-router-dom";

const Index = () => {
  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="fixed top-0 left-0 right-0 z-50 bg-background/80 backdrop-blur-lg border-b border-border/50">
        <div className="max-w-6xl mx-auto px-6 sm:px-8 h-14 sm:h-16 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-primary/20 flex items-center justify-center">
              <Search className="w-4 h-4 text-primary" />
            </div>
            <span className="font-bold text-foreground tracking-tight">ResearchAI</span>
          </div>
          
          <nav className="flex items-center gap-4">
            <Link to="/explorer">
              <Button variant="default" size="sm" className="gap-2">
                Explorer
                <ArrowRight className="w-4 h-4" />
              </Button>
            </Link>
          </nav>
        </div>
      </header>
      
      {/* Main Content */}
      <main className="pt-14 sm:pt-16">
        <HeroSection />
        <ValueProposition />
        
        {/* CTA Section */}
        <section className="py-16 sm:py-24 text-center">
          <div className="max-w-2xl mx-auto px-6 sm:px-8">
            <h2 className="text-2xl sm:text-3xl font-bold text-foreground mb-4">
              今すぐ試してみる
            </h2>
            <p className="text-muted-foreground mb-8">
              論文検索、専門家探し、研究テーマの深掘りをAIと対話しながら進めましょう。
            </p>
            <Link to="/explorer">
              <Button size="lg" className="gap-2 text-base px-8">
                Explorerを開く
                <ArrowRight className="w-5 h-5" />
              </Button>
            </Link>
          </div>
        </section>
      </main>
      
      {/* Footer */}
      <footer className="border-t border-border/50 py-8">
        <div className="max-w-6xl mx-auto px-6 sm:px-8 text-center text-sm text-muted-foreground">
          © 2024 ResearchAI. Built for researchers.
        </div>
      </footer>
    </div>
  );
};

export default Index;
