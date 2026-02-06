import axios from "axios";
import { ethers } from "ethers";
import { ClobClient, OrderType, Side } from "@polymarket/clob-client";
import { CONFIG } from "./config.js";
import { decideTrade } from "./strategy.js";

// --------------------
// Provider & Wallet
// --------------------
const provider = new ethers.providers.JsonRpcProvider(CONFIG.RPC_URL);
const wallet = new ethers.Wallet(CONFIG.PRIVATE_KEY, provider);

console.log("Wallet:", wallet.address);
console.log("LIVE TRADING:", CONFIG.LIVE_TRADING);
console.log("CLOB_HOST:", CONFIG.CLOB_HOST);
console.log("GAMMA_API:", CONFIG.GAMMA_API);

// --------------------
// CLOB Client (string-safe)
// --------------------
const clob = new ClobClient({
  host: String(CONFIG.CLOB_HOST),
  chainId: CONFIG.CHAIN_ID,
  signer: wallet,
});

// --------------------
// State (PnL + Kill Switch)
// --------------------
let realizedPnL = 0;
let tradesToday = 0;
let killSwitch = false;

// --------------------
// Axios with timeout + retry
// --------------------
const api = axios.create({
  timeout: CONFIG.API_TIMEOUT_MS,
});

async function fetchWithRetry(url, retries = 3) {
  for (let i = 0; i < retries; i++) {
    try {
      return await api.get(url);
    } catch (err) {
      console.warn(`⚠️ API timeout, retrying (${retries - i - 1})…`);
      await sleep(1000 * (i + 1));
    }
  }
  throw new Error("API failed after retries");
}

// --------------------
// Fetch markets
// --------------------
async function fetchMarkets() {
  const res = await fetchWithRetry(`${CONFIG.GAMMA_API}/markets`);
  return res.data;
}

// --------------------
// Kill-switch check
// --------------------
function checkKillSwitch() {
  if (realizedPnL <= -CONFIG.MAX_DAILY_LOSS_USDC) {
    console.error("🛑 KILL SWITCH: Max daily loss hit");
    killSwitch = true;
  }

  if (tradesToday >= CONFIG.MAX_TRADES_PER_DAY) {
    console.error("🛑 KILL SWITCH: Max trades per day hit");
    killSwitch = true;
  }
}

// --------------------
// Main loop
// --------------------
async function main() {
  while (true) {
    try {
      if (killSwitch) {
        console.error("🛑 BOT STOPPED (Kill switch active)");
        break;
      }

      const markets = await fetchMarkets();

      const market = markets.find(
        (m) => m.active && Array.isArray(m.clobTokenIds) && m.clobTokenIds.length === 2
      );

      if (!market) {
        console.log("No active market");
        await sleep(CONFIG.LOOP_DELAY_MS);
        continue;
      }

      const yesPrice = Number(market.outcomePrices?.[0]);
      const noPrice = Number(market.outcomePrices?.[1]);

      console.log(`\n${market.question}`);
      console.log(`YES: ${yesPrice} | NO: ${noPrice}`);

      const decision = decideTrade({ yesPrice, noPrice });
      if (!decision) {
        console.log("No signal");
        await sleep(CONFIG.LOOP_DELAY_MS);
        continue;
      }

      const tokenId =
        decision.side === "YES"
          ? market.clobTokenIds[0]
          : market.clobTokenIds[1];

      console.log(`📈 SIGNAL: BUY ${decision.side}`);

      // ---- Paper mode
      if (!CONFIG.LIVE_TRADING) {
        console.log("🧪 PAPER TRADE");
        await sleep(CONFIG.LOOP_DELAY_MS);
        continue;
      }

      // ---- Live trade
      const order = await clob.createMarketOrder({
        tokenId,
        amount: CONFIG.BET_AMOUNT_USDC,
        side: Side.BUY,
        orderType: OrderType.FOK,
      });

      const result = await clob.postOrder(order);

      tradesToday += 1;
      realizedPnL -= CONFIG.BET_AMOUNT_USDC; // conservative assumption

      console.log("✅ ORDER SENT");
      console.log("📊 Trades today:", tradesToday);
      console.log("📉 Realized PnL:", realizedPnL);

      checkKillSwitch();

    } catch (err) {
      console.error("Runtime error:", err.message);
    }

    await sleep(CONFIG.LOOP_DELAY_MS);
  }
}

// --------------------
// Utils
// --------------------
function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

main();