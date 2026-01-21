import researchHeroImage from "@/assets/research-hero.jpg";

export function HeroSection() {
  return (
    <section className="relative overflow-hidden">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 md:px-8 pt-8 sm:pt-10 md:pt-12 pb-3 sm:pb-4 md:pb-6">
        <div className="grid grid-cols-1 lg:grid-cols-[35%_65%] gap-4 sm:gap-5 lg:gap-8 items-center">
          {/* Left: Title and Subtitle */}
          <div className="space-y-2 sm:space-y-3 text-left animate-fade-in">
            <h1 className="text-2xl sm:text-3xl md:text-4xl lg:text-5xl font-extrabold text-primary leading-tight">
              対話的な研究支援AI
            </h1>
            <p className="text-sm sm:text-base md:text-lg lg:text-xl text-muted-foreground leading-relaxed">
              「調べる」から「理解する」「つながる」へ
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
