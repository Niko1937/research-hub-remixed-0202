import researchHeroImage from "@/assets/research-hero.jpg";

export function HeroSection() {
  return (
    <section className="relative overflow-hidden bg-gradient-to-b from-primary/5 to-transparent">
      <div className="max-w-5xl mx-auto px-4 sm:px-6 pt-12 sm:pt-16 md:pt-20 pb-6 sm:pb-8">
        <div className="text-center mb-6 sm:mb-8 animate-fade-in">
          <p className="text-xs sm:text-sm uppercase tracking-widest text-primary mb-3">
            Research Assistant AI
          </p>
          <h1 className="text-3xl sm:text-4xl md:text-5xl font-extrabold text-foreground leading-tight mb-4">
            研究に集中できる時間を、
            <br className="hidden sm:block" />
            <span className="text-primary">もっと。</span>
          </h1>
          <p className="text-base sm:text-lg text-muted-foreground max-w-2xl mx-auto leading-relaxed">
            論文調査・理解・専門家探しを対話的AIが支援。
            <br className="hidden sm:block" />
            「調べる」から「理解する」「つながる」へ。
          </p>
        </div>
        
        {/* Hero Image */}
        <div className="relative rounded-xl overflow-hidden aspect-[21/9] animate-fade-in shadow-xl max-w-4xl mx-auto">
          <img 
            src={researchHeroImage} 
            alt="AI-powered research visualization"
            className="w-full h-full object-cover"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-background/60 via-transparent to-transparent" />
        </div>
      </div>
    </section>
  );
}
