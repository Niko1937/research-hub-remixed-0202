import { ResearchData } from "@/hooks/useResearchChat";
import { CitedAnswer } from "@/components/CitedAnswer";

interface Paper {
  id?: number;
  title: string;
  abstract: string;
  authors: string[];
  year: string;
  source: string;
  url: string;
  citations?: number;
}

interface ResearchResultsProps {
  data: ResearchData;
  onPdfClick?: (paper: { url: string; title: string; authors?: string[]; source?: string }) => void;
  onDeepDive?: (paper: Paper) => void;
  onResearchIdClick?: (researchId: string) => void;
  selectedResearchIds?: string[];
}

export function ResearchResults({ data, onPdfClick, onDeepDive }: ResearchResultsProps) {
  return (
    <div className="space-y-4">
      {/* Answer section */}
      {data.summary && data.external.length > 0 && (
        <CitedAnswer
          summary={data.summary}
          papers={data.external}
          onPaperClick={onPdfClick}
          onDeepDive={onDeepDive}
        />
      )}
    </div>
  );
}
