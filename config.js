import dotenv from "dotenv";
dotenv.config();

export const CONFIG = {
  // ---- Secrets
  PRIVATE_KEY: process.env.PRIVATE_KEY,
  RPC_URL: process.env.RPC_URL,

  // ---- APIs
  CLOB_HOST: process.env.CLOB_HOST || "https://clob.polymarket.com",
  GAMMA_API: process.env.GAMMA_API || "https://gamma-api.polymarket.com",

  // ---- Chain
  CHAIN_ID: 137,

  // Polymarket CLOB Exchange contract (Polygon)
  // This is REQUIRED for EIP-712 verification
  CLOB_CONTRACT: "0x0000000000000000000000000000000000000000", 
  // ⬆️ Polymarket validates off-chain; contract is placeholder but REQUIRED structurally

  // ---- Trading
  LIVE_TRADING: process.env.LIVE_TRADING === "true",
  BET_AMOUNT_USDC: Number(process.env.BET_AMOUNT_USDC || 1),

  // ---- Risk
  MAX_DAILY_LOSS_USDC: Number(process.env.MAX_DAILY_LOSS_USDC || 5),
  MAX_TRADES_PER_DAY: Number(process.env.MAX_TRADES_PER_DAY || 10),

  // ---- Filters
  MIN_LIQUIDITY_USDC: Number(process.env.MIN_LIQUIDITY_USDC || 20),
  MAX_SPREAD_PCT: Number(process.env.MAX_SPREAD_PCT || 2),

  // ---- Rate limits
  LOOP_DELAY_MS: Number(process.env.LOOP_DELAY_MS || 30_000),
  API_TIMEOUT_MS: Number(process.env.API_TIMEOUT_MS || 10_000),
};

// ---- Hard safety
if (!CONFIG.PRIVATE_KEY) throw new Error("❌ PRIVATE_KEY missing");
if (!CONFIG.RPC_URL) throw new Error("❌ RPC_URL missing");
