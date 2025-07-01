// supabase/functions/multisig-info.ts
import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { ethers } from "npm:ethers";

const API_KEY = Deno.env.get("INFURA_API_KEY");

const safeSetupEvent = {
  anonymous: false,
  name: "SafeSetup",
  type: "event",
  inputs: [
    { indexed: true, name: "initiator", type: "address" },
    { indexed: false, name: "owners", type: "address[]" },
    { indexed: false, name: "threshold", type: "uint256" },
    { indexed: false, name: "initializer", type: "address" },
    { indexed: false, name: "fallbackHandler", type: "address" }
  ]
};

const changedMasterCopyEvent = {
  anonymous: false,
  name: "ChangedMasterCopy",
  type: "event",
  inputs: [{ indexed: false, name: "masterCopy", type: "address" }]
};

const proxyCreationEvent = {
  anonymous: false,
  name: "ProxyCreation",
  type: "event",
  inputs: [
    { indexed: true, name: "proxy", type: "address" },
    { indexed: false, name: "singleton", type: "address" }
  ]
};

const safeAbi = [
  "function getOwners() view returns (address[])",
  "function getThreshold() view returns (uint256)",
  "function getGuard() view returns (address)",
  "function getModulesPaginated(address, uint256) view returns (address[] array, address next)",
  "function getFallbackHandler() view returns (address)",
  "function VERSION() view returns (string)"
];

const L2_MASTER_COPIES: Record<string, string> = {
  "0x3e5c63644e683549055b9be8653de26e0b4cd36e": "Safe: Master Copy 1.3.0 (L2)",
  "0x29fcb43b46531bca003ddc8fcb67ffe91900c762": "Safe: Master Copy 1.4.1 (L2)",
  "0xfb1bffc9d739b8d520daf37df666da4c687191ea": "Safe: Master Copy 1.3.0 (L2 Alt)",
  "0x69f4d1788e39c87893c980c06edf4b7f686e2938": "Safe: Master Copy 1.3.0 (zkSync)"
};

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS"
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: corsHeaders });
  }

  try {
    const { txhash, network } = await req.json();

    if (!txhash || typeof txhash !== "string" || !network || typeof network !== "string") {
      return new Response(JSON.stringify({ error: "Missing or invalid 'txhash' or 'network'" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" }
      });
    }

    const INFURA_URL = `https://${network}.infura.io/v3/${API_KEY}`;
    const provider = new ethers.JsonRpcProvider(INFURA_URL);
    const receipt = await provider.getTransactionReceipt(txhash);

    const iface = new ethers.Interface([
      safeSetupEvent,
      changedMasterCopyEvent,
      proxyCreationEvent
    ]);

    const result: Record<string, unknown> = {
      creator: receipt.from
    };

    let proxyAddress: string | undefined;

    for (const log of receipt.logs) {
      try {
        const parsed = iface.parseLog(log);
        switch (parsed.name) {
          case "SafeSetup":
            result.initializer = parsed.args.initializer;
            result.fallbackHandler = parsed.args.fallbackHandler;
            result.initiator = parsed.args.initiator;
            break;
          case "ChangedMasterCopy":
            result.masterCopy = parsed.args.masterCopy;
            break;
          case "ProxyCreation":
            result.proxy = parsed.args.proxy;
            result.proxyFactory = log.address;
            proxyAddress = parsed.args.proxy;
            break;
        }
      } catch {
        continue;
      }
    }

    if (!proxyAddress) {
      proxyAddress = receipt.contractAddress || receipt.to || undefined;
      if (proxyAddress) {
        result.proxy = proxyAddress;
      }
    }

    if (proxyAddress) {
      const contract = new ethers.Contract(proxyAddress, safeAbi, provider);

      try {
        result.owners = await contract.getOwners();
      } catch {
        result.owners = [];
      }

      try {
        result.threshold = (await contract.getThreshold()).toString();
      } catch {
        result.threshold = null;
      }

      try {
        result.guard = await contract.getGuard();
      } catch {
        result.guard = null;
      }

      try {
        result.fallbackHandlerRuntime = await contract.getFallbackHandler();
      } catch {
        result.fallbackHandlerRuntime = null;
      }

      try {
        const [modules] = await contract.getModulesPaginated(ethers.ZeroAddress, 100);
        result.modules = modules;
      } catch {
        result.modules = [];
      }

      try {
        const version = await contract.VERSION();
        result.version = version;

        const masterCopy = (result.masterCopy as string | undefined)?.toLowerCase();
        if (masterCopy && L2_MASTER_COPIES[masterCopy] && !version.includes("+L2")) {
          result.version = version + "+L2";
        }
      } catch {
        result.version = null;
      }
    }

    return new Response(JSON.stringify(result), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" }
    });

  } catch (err) {
    return new Response(JSON.stringify({
      error: "Internal error",
      detail: String(err)
    }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" }
    });
  }
});
