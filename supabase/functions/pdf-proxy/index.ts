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
    const url = new URL(req.url);
    const pdfUrl = url.searchParams.get("url");

    if (!pdfUrl) {
      return new Response(JSON.stringify({ error: "Missing URL parameter" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    console.log("Fetching PDF from:", pdfUrl);

    // Fetch the PDF from the external source
    const pdfResponse = await fetch(pdfUrl, {
      headers: {
        "User-Agent": "Research-Hub/1.0",
      },
    });

    if (!pdfResponse.ok) {
      console.error("Failed to fetch PDF:", pdfResponse.status, pdfResponse.statusText);
      return new Response(JSON.stringify({ error: "Failed to fetch PDF" }), {
        status: pdfResponse.status,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const pdfData = await pdfResponse.arrayBuffer();

    return new Response(pdfData, {
      headers: {
        ...corsHeaders,
        "Content-Type": "application/pdf",
        "Content-Length": pdfData.byteLength.toString(),
      },
    });
  } catch (error) {
    console.error("PDF proxy error:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
