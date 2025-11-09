export function HeroSection() {
  return (
    <section className="relative overflow-hidden">
      <div className="max-w-7xl mx-auto px-4 md:px-6 lg:px-8 py-8 md:py-12">
        <div className="grid grid-cols-1 lg:grid-cols-[30%_70%] gap-8 lg:gap-12 items-center">
          {/* Left: Description */}
          <div className="space-y-4 text-left animate-fade-in">
            <p className="text-lg md:text-xl lg:text-2xl text-muted-foreground leading-relaxed">
              対話的な研究支援AIの
            </p>
            <p className="text-3xl md:text-4xl lg:text-5xl font-extrabold text-primary leading-tight">
              拡張性を示す
            </p>
            <p className="text-xl md:text-2xl lg:text-3xl text-foreground font-semibold">
              AgentChatプロトタイプ
            </p>
          </div>
          
          {/* Right: Research Image */}
          <div className="relative rounded-2xl overflow-hidden aspect-video bg-gradient-to-br from-primary/10 via-accent/5 to-background animate-fade-in">
            <div className="absolute inset-0 flex items-center justify-center">
              <div className="text-center space-y-4 p-8">
                <div className="inline-flex items-center justify-center w-20 h-20 rounded-full bg-primary/20 mb-4">
                  <svg xmlns="http://www.w3.org/2000/svg" className="w-10 h-10 text-primary" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 3v2m6-2v2M9 19v2m6-2v2M5 9H3m2 6H3m18-6h-2m2 6h-2M7 19h10a2 2 0 002-2V7a2 2 0 00-2-2H7a2 2 0 00-2 2v10a2 2 0 002 2zM9 9h6v6H9V9z" />
                  </svg>
                </div>
                <h3 className="text-xl md:text-2xl font-bold text-foreground">
                  AI-Powered Research
                </h3>
                <p className="text-sm md:text-base text-muted-foreground max-w-md">
                  エージェントベースの研究支援システム
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
