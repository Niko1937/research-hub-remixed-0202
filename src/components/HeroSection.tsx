import researchHeroImage from "@/assets/research-hero.jpg";

export function HeroSection() {
  return (
    <section className="relative overflow-hidden">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 md:px-8 pt-8 sm:pt-10 md:pt-12 pb-3 sm:pb-4 md:pb-6">
        <div className="grid grid-cols-1 lg:grid-cols-[30%_70%] gap-4 sm:gap-5 lg:gap-8 items-center">
          {/* Left: Description */}
          <div className="space-y-2 sm:space-y-3 text-left animate-fade-in">
            <p className="text-sm sm:text-base md:text-lg lg:text-xl text-muted-foreground leading-relaxed">
              対話的な研究支援AIの
            </p>
            <p className="text-xl sm:text-2xl md:text-3xl lg:text-4xl font-extrabold text-primary leading-tight">
              拡張性を示す
            </p>
            <p className="text-base sm:text-lg md:text-xl lg:text-2xl text-foreground font-semibold">
              AgentChatプロトタイプ
            </p>
          </div>
          
          {/* Right: Research Image */}
          <div className="relative rounded-lg sm:rounded-xl overflow-hidden aspect-[21/9] animate-fade-in shadow-md sm:shadow-lg">
            <img 
              src={researchHeroImage} 
              alt="AI-powered research visualization with holographic data displays"
              className="w-full h-full object-cover"
            />
          </div>
        </div>
      </div>
    </section>
  );
}
