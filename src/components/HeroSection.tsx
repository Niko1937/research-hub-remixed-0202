export function HeroSection() {
  return (
    <section className="relative overflow-hidden border-b border-border">
      <div className="max-w-6xl mx-auto px-6 py-6">
        <div className="text-center space-y-3">
          <h1 className="text-2xl md:text-3xl font-bold text-foreground leading-tight">
            対話的な研究支援の「拡張性」を示す、<br className="hidden md:block" />
            AgentChatプロトタイプ
          </h1>
          
          <p className="text-sm text-muted-foreground max-w-3xl mx-auto leading-relaxed">
            将来の<strong className="text-foreground">対話的な研究活動支援（AgentChat）がいかに拡張できるか</strong>を示すためのToyAppです。
            現在は論文API＋Lovable AI（gemini 2.5 flash）の最小構成ですが、本質は裏のAgent設計にあります。
          </p>
        </div>
      </div>
    </section>
  );
}
