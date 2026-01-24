/**
 * API Helper Functions
 *
 * FastAPI バックエンドへのAPI呼び出しヘルパー
 */

const getApiBaseUrl = (): string => {
  if (import.meta.env.VITE_API_URL) {
    return import.meta.env.VITE_API_URL;
  }
  return "http://localhost:5000";
};

export interface ArxivProxyRequest {
  searchQuery: string;
  maxResults?: number;
}

export interface ArxivProxyResponse {
  xmlData: string;
}

/**
 * arXiv APIへのプロキシ呼び出し
 */
export async function fetchArxivProxy(request: ArxivProxyRequest): Promise<ArxivProxyResponse> {
  const response = await fetch(`${getApiBaseUrl()}/api/arxiv-proxy`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(request),
  });

  if (!response.ok) {
    throw new Error(`arXiv proxy request failed: ${response.status}`);
  }

  return response.json();
}
