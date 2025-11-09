import researchHeroImage from "@/assets/research-hero.jpg";

export function HeroSection() {
  return (
    <section className="relative overflow-hidden">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 md:px-8 py-6 sm:py-8 md:py-12">
        <div className="grid grid-cols-1 lg:grid-cols-[30%_70%] gap-6 sm:gap-8 lg:gap-12 items-center">
          {/* Left: Description */}
          <div className="space-y-3 sm:space-y-4 text-left animate-fade-in">
            <p className="text-base sm:text-lg md:text-xl lg:text-2xl text-muted-foreground leading-relaxed">
              対話的な研究支援AIの
            </p>
            <p className="text-2xl sm:text-3xl md:text-4xl lg:text-5xl font-extrabold text-primary leading-tight">
              拡張性を示す
            </p>
            <p className="text-lg sm:text-xl md:text-2xl lg:text-3xl text-foreground font-semibold">
              AgentChatプロトタイプ
            </p>
          </div>
          
          {/* Right: Research Image */}
          <div className="relative rounded-xl sm:rounded-2xl overflow-hidden aspect-video animate-fade-in shadow-lg sm:shadow-2xl">
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
