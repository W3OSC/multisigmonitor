import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { ethers } from "npm:ethers";
const API_KEY = Deno.env.get("INFURA_API_KEY");
const INFURA_URL = "https://sepolia.infura.io/v3/" + API_KEY;
const safeSetupEvent = {
  anonymous: false,
  inputs: [
    {
      indexed: true,
      name: "initiator",
      type: "address"
    },
    {
      indexed: false,
      name: "owners",
      type: "address[]"
    },
    {
      indexed: false,
      name: "threshold",
      type: "uint256"
    },
    {
      indexed: false,
      name: "initializer",
      type: "address"
    },
    {
      indexed: false,
      name: "fallbackHandler",
      type: "address"
    }
  ],
  name: "SafeSetup",
  type: "event"
};
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS"
};
serve(async (req)=>{
  // Handle preflight CORS
  if (req.method === "OPTIONS") {
    return new Response(null, {
      status: 204,
      headers: corsHeaders
    });
  }
  try {
    const { txhash } = await req.json();
    if (!txhash || typeof txhash !== "string") {
      return new Response(JSON.stringify({
        error: "Missing or invalid 'txhash'"
      }), {
        status: 400,
        headers: {
          ...corsHeaders,
          "Content-Type": "application/json"
        }
      });
    }
    const provider = new ethers.JsonRpcProvider(INFURA_URL);
    const receipt = await provider.getTransactionReceipt(txhash);
    const iface = new ethers.Interface([
      safeSetupEvent
    ]);
    for (const log of receipt.logs){
      try {
        const parsed = iface.parseLog(log);
        if (parsed.name === "SafeSetup") {
          return new Response(JSON.stringify({
            initializer: parsed.args.initializer
          }), {
            status: 200,
            headers: {
              ...corsHeaders,
              "Content-Type": "application/json"
            }
          });
        }
      } catch  {
        continue;
      }
    }
    return new Response(JSON.stringify({
      error: "SafeSetup event not found"
    }), {
      status: 404,
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
