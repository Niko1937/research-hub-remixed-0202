import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { searchQuery, maxResults = 7 } = await req.json();

    if (!searchQuery) {
      return new Response(
        JSON.stringify({ error: "searchQuery is required" }),
        { 
          status: 400, 
          headers: { ...corsHeaders, "Content-Type": "application/json" } 
        }
      );
    }

    console.log(`Fetching arXiv papers for query: ${searchQuery}`);

    const arxivUrl = `https://export.arxiv.org/api/query?search_query=all:${encodeURIComponent(searchQuery)}&start=0&max_results=${maxResults}`;
    
    const response = await fetch(arxivUrl);
    
    if (!response.ok) {
      throw new Error(`arXiv API returned status ${response.status}`);
    }

    const xmlText = await response.text();

    return new Response(
      JSON.stringify({ xmlData: xmlText }),
      { 
        status: 200, 
        headers: { ...corsHeaders, "Content-Type": "application/json" } 
      }
    );

  } catch (error) {
    console.error("Error in arxiv-proxy:", error);
    const errorMessage = error instanceof Error ? error.message : "Failed to fetch from arXiv API";
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { 
        status: 500, 
        headers: { ...corsHeaders, "Content-Type": "application/json" } 
      }
    );
  }
});
