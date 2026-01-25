import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
const API_KEY = Deno.env.get("CHAINALYSIS_API_KEY");
const CHAINALYSIS_BASE = "https://public.chainalysis.com/api/v1/address";
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS"
};
serve(async (req)=>{
  // Handle preflight
  if (req.method === "OPTIONS") {
    return new Response(null, {
      status: 204,
      headers: corsHeaders
    });
  }
  try {
    const { address } = await req.json();
    if (!address || typeof address !== "string") {
      return new Response(JSON.stringify({
        error: "Missing or invalid 'address'"
      }), {
        status: 400,
        headers: {
          ...corsHeaders,
          "Content-Type": "application/json"
        }
      });
    }
    const url = `${CHAINALYSIS_BASE}/${encodeURIComponent(address)}`;
    const chainalysisRes = await fetch(url, {
      method: "GET",
      headers: {
        "X-API-Key": API_KEY,
        "Accept": "application/json"
      }
    });
    const result = await chainalysisRes.json();
    return new Response(JSON.stringify({
      sanctioned: result.identifications.length > 0,
      data: result.identifications
    }), {
      status: 200,
      headers: {
        ...corsHeaders,
        "Content-Type": "application/json"
      }
    });
  } catch (err) {
    return new Response(JSON.stringify({
      error: "Internal error",
      detail: String(err)
    }), {
      status: 500,
      headers: {
        ...corsHeaders,
        "Content-Type": "application/json"
      }
    });
  }
});
