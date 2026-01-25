import researchHeroImage from "@/assets/research-hero.jpg";

export function HeroSection() {
  return (
    <section className="relative overflow-hidden">
      {/* Background gradient */}
      <div className="absolute inset-0 bg-gradient-to-b from-primary/5 via-transparent to-transparent pointer-events-none" />
      
      <div className="relative max-w-[1400px] mx-auto px-6 sm:px-10 lg:px-16 pt-16 sm:pt-24 lg:pt-32 pb-8 sm:pb-12">
        {/* Text Content */}
        <div className="text-center max-w-3xl mx-auto mb-8 sm:mb-12">
          <p className="inline-block text-[10px] sm:text-xs uppercase tracking-[0.25em] text-primary/80 font-medium mb-4 sm:mb-6 px-3 py-1.5 rounded-full border border-primary/20 bg-primary/5">
            Research Assistant
          </p>
          
          <h1 className="text-4xl sm:text-5xl lg:text-6xl font-black text-foreground leading-[1.1] tracking-tight mb-5 sm:mb-6">
            研究を、
            <span className="block text-primary mt-1">もっと前へ。</span>
          </h1>
          
          <p className="text-base sm:text-lg lg:text-xl text-muted-foreground leading-relaxed max-w-xl mx-auto">
            論文調査から新アイデアの壁打ち、研究の高度化まで。
            <span className="hidden sm:inline"><br /></span>
            対話AIがあなたの研究を加速させる。
          </p>
        </div>
        
        {/* Hero Image */}
        <div className="relative max-w-5xl mx-auto">
          <div className="relative rounded-2xl overflow-hidden aspect-[2.4/1] shadow-2xl ring-1 ring-white/10">
            <img 
              src={researchHeroImage} 
              alt="AI-powered research visualization"
              className="w-full h-full object-cover"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-background via-background/20 to-transparent" />
          </div>
        </div>
      </div>
    </section>
  );
}
