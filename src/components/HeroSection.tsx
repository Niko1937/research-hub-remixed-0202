import { Button } from "@/components/ui/button";

export function HeroSection() {
  const scrollToChat = () => {
    const chatInput = document.querySelector('textarea');
    chatInput?.focus();
  };

  const scrollToConcept = () => {
    const conceptSection = document.getElementById('concept-section');
    conceptSection?.scrollIntoView({ behavior: 'smooth' });
  };

  return (
    <section className="relative overflow-hidden border-b border-border">
      <div className="max-w-6xl mx-auto px-6 py-8">
        <div className="text-center space-y-4">
          <h1 className="text-3xl md:text-4xl font-bold text-foreground leading-tight">
            対話的な研究支援の「拡張性」を示す、<br className="hidden md:block" />
            AgentChatプロトタイプ
          </h1>
          
          <p className="text-sm md:text-base text-muted-foreground max-w-3xl mx-auto leading-relaxed">
            将来の<strong className="text-foreground">対話的な研究活動支援（AgentChat）がいかに拡張できるか</strong>を示すためのToyAppです。
            現在は論文API＋Lovable AI（gemini 2.5 flash）の最小構成ですが、本質は裏のAgent設計にあります。
          </p>

          <div className="flex flex-col sm:flex-row gap-3 justify-center pt-2">
            <Button 
              variant="default" 
              size="lg"
              onClick={scrollToConcept}
              className="font-medium"
            >
              拡張性のコンセプトを読む
            </Button>
            <Button 
              variant="outline" 
              size="lg"
              onClick={scrollToChat}
              className="font-medium"
            >
              今の機能で試してみる
            </Button>
          </div>
        </div>
      </div>
    </section>
  );
}
