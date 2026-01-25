import researchHeroImage from "@/assets/research-hero.jpg";
import { ArrowRight, Search, FileText, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Link } from "react-router-dom";

export function HeroSection() {
  return (
    <section className="relative overflow-hidden">
      {/* Background gradient */}
      <div className="absolute inset-0 bg-gradient-to-br from-primary/5 via-transparent to-transparent pointer-events-none" />
      
      <div className="relative max-w-[1400px] mx-auto px-6 sm:px-10 lg:px-16 pt-20 sm:pt-28 lg:pt-36 pb-16 sm:pb-24">
        
        {/* Hero: Left Text, Right Image */}
        <div className="grid lg:grid-cols-2 gap-12 lg:gap-16 items-center">
          
          {/* Left: Text */}
          <div className="order-2 lg:order-1">
            <p className="inline-block text-[10px] sm:text-xs uppercase tracking-[0.25em] text-primary/80 font-medium mb-4 sm:mb-6 px-3 py-1.5 rounded-full border border-primary/20 bg-primary/5">
              Research Assistant
            </p>
            
            <h1 className="text-4xl sm:text-5xl lg:text-6xl font-black text-foreground leading-[1.1] tracking-tight mb-5 sm:mb-6">
              研究を、
              <span className="block text-primary mt-1">もっと前へ。</span>
            </h1>
            
            <p className="text-base sm:text-lg lg:text-xl text-muted-foreground leading-relaxed mb-8 max-w-lg">
              論文調査から新アイデアの壁打ち、研究の高度化まで。
              対話AIがあなたの研究を加速させる。
            </p>
            
            <div className="flex flex-col sm:flex-row gap-4">
              <Link to="/explorer">
                <Button size="lg" className="gap-2 text-base px-8 w-full sm:w-auto">
                  Explorerを開く
                  <ArrowRight className="w-5 h-5" />
                </Button>
              </Link>
              <Button variant="outline" size="lg" className="gap-2 text-base px-8">
                デモを見る
              </Button>
            </div>
          </div>
          
          {/* Right: Image */}
          <div className="order-1 lg:order-2">
            <div className="relative rounded-2xl overflow-hidden aspect-[4/3] shadow-2xl ring-1 ring-border/50">
              <img 
                src={researchHeroImage} 
                alt="AI-powered research visualization"
                className="w-full h-full object-cover"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-background/60 via-transparent to-transparent" />
            </div>
          </div>
        </div>
        
      </div>
    </section>
  );
}
