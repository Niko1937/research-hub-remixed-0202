import { Button } from "@/components/ui/button";

interface PromptSamplesProps {
  onPromptClick: (prompt: string) => void;
}

const samplePrompts = [
  "LLMの最新研究動向を教えて",
  "この研究アイデアの新規性を評価して",
  "RAGとファインチューニングの違いは？",
  "Vision-Languageモデルの主要手法を比較して",
];

export function PromptSamples({ onPromptClick }: PromptSamplesProps) {
  return (
    <div className="flex flex-wrap gap-2 justify-center mt-6 max-w-2xl mx-auto">
      {samplePrompts.map((prompt, index) => (
        <Button
          key={index}
          variant="outline"
          size="sm"
          className="text-xs sm:text-sm h-auto py-2 px-3 text-muted-foreground hover:text-foreground hover:border-primary/50 transition-all"
          onClick={() => onPromptClick(prompt)}
        >
          {prompt}
        </Button>
      ))}
    </div>
  );
}
