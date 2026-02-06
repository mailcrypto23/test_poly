import dotenv from "dotenv";
dotenv.config();

export const CONFIG = {
  // ---- Secrets (Railway variables)
  PRIVATE_KEY: process.env.PRIVATE_KEY,
  RPC_URL: process.env.RPC_URL,

  // ---- Polymarket
  CLOB_HOST: String(process.env.CLOB_HOST || "https://clob.polymarket.com"),
  GAMMA_API: String(process.env.GAMMA_API || "https://gamma-api.polymarket.com"),
  CHAIN_ID: 137,

  // ---- Trading mode
  LIVE_TRADING: String(process.env.LIVE_TRADING).toLowerCase() === "true",
  BET_AMOUNT_USDC: Number(process.env.BET_AMOUNT_USDC || 1),

  // ---- Risk controls
  MAX_DAILY_LOSS_USDC: Number(process.env.MAX_DAILY_LOSS_USDC || 5),
  MAX_TRADES_PER_DAY: Number(process.env.MAX_TRADES_PER_DAY || 10),

  // ---- Rate limiting
  LOOP_DELAY_MS: Number(process.env.LOOP_DELAY_MS || 30_000),
  API_TIMEOUT_MS: Number(process.env.API_TIMEOUT_MS || 10_000),
};