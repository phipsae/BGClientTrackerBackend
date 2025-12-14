import "dotenv/config";
import express from "express";
import {
  createPublicClient,
  http,
  isAddress,
  formatUnits,
  Address,
} from "viem";
import { base, mainnet } from "viem/chains";
import { normalize } from "viem/ens";

const app = express();

const ALCHEMY_API_KEY = process.env.ALCHEMY_API_KEY!;
const BGBRD_TOKEN = "0xF9206cA52a336Fba43264bc6822046D60aEdfc3C" as const;

const baseClient = createPublicClient({
  chain: base,
  transport: http(`https://base-mainnet.g.alchemy.com/v2/${ALCHEMY_API_KEY}`),
});

const mainnetClient = createPublicClient({
  chain: mainnet,
  transport: http(`https://eth-mainnet.g.alchemy.com/v2/${ALCHEMY_API_KEY}`),
});

const ERC20_ABI = [
  {
    inputs: [{ name: "owner", type: "address" }],
    name: "balanceOf",
    outputs: [{ name: "", type: "uint256" }],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [],
    name: "decimals",
    outputs: [{ name: "", type: "uint8" }],
    stateMutability: "view",
    type: "function",
  },
] as const;

async function resolveAddress(input: string): Promise<Address> {
  if (input.endsWith(".eth")) {
    const resolved = await mainnetClient.getEnsAddress({
      name: normalize(input),
    });
    if (!resolved) throw new Error(`Could not resolve ENS: ${input}`);
    return resolved;
  }
  if (isAddress(input)) return input;
  throw new Error(`Invalid address: ${input}`);
}

app.get("/balance", async (req, res) => {
  const { address } = req.query;
  if (!address || typeof address !== "string") {
    return res.status(400).json({ error: "Missing address parameter" });
  }

  try {
    const resolved = await resolveAddress(address);
    const [balance, decimals] = await Promise.all([
      baseClient.readContract({
        address: BGBRD_TOKEN,
        abi: ERC20_ABI,
        functionName: "balanceOf",
        args: [resolved],
      }),
      baseClient.readContract({
        address: BGBRD_TOKEN,
        abi: ERC20_ABI,
        functionName: "decimals",
      }),
    ]);

    res.json({
      address: resolved,
      balance: formatUnits(balance, decimals),
    });
  } catch (e) {
    res
      .status(500)
      .json({ error: e instanceof Error ? e.message : "Unknown error" });
  }
});

app.listen(3000, () => console.log("http://localhost:3000"));
