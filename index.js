import axios from "axios";
import { ethers } from "ethers";
import "dotenv/config";
import { CONFIG } from "./config.js";
import { decideTrade } from "./strategy.js";

/* =========================
   PROVIDER & WALLET
========================= */

const provider = new ethers.providers.JsonRpcProvider(CONFIG.RPC_URL);
const wallet = new ethers.Wallet(CONFIG.PRIVATE_KEY, provider);

console.log("Wallet:", wallet.address);
console.log("LIVE:", CONFIG.LIVE_TRADING);

/* =========================
   STATE
========================= */

let realizedPnL = 0;
let tradesToday = 0;
let killSwitch = false;

/* =========================
   AXIOS
========================= */

const api = axios.create({
  timeout: CONFIG.API_TIMEOUT_MS,
});

async function fetchWithRetry(url, retries = 3) {
  for (let i = 0; i < retries; i++) {
    try {
      return await api.get(url);
    } catch {
      await sleep(1000 * (i + 1));
    }
  }
  throw new Error("API failed");
}

/* =========================
   FETCH MARKETS
========================= */

async function fetchMarkets() {
  const res = await fetchWithRetry(
    `${CONFIG.GAMMA_API}/v1/markets?active=true&closed=false`
  );
  return res.data.markets || [];
}

/* =========================
   FETCH ORDERBOOK
========================= */

async function fetchOrderbook(tokenId) {
  const res = await fetchWithRetry(`${CONFIG.CLOB_HOST}/books/${tokenId}`);
  return res.data;
}

/* =========================
   FETCH FILLS (PnL)
========================= */

async function fetchFills() {
  const res = await fetchWithRetry(
    `${CONFIG.CLOB_HOST}/fills?maker=${wallet.address}`
  );
  return res.data || [];
}

/* =========================
   KILL SWITCH
========================= */

function checkKillSwitch() {
  if (realizedPnL <= -CONFIG.MAX_DAILY_LOSS_USDC) killSwitch = true;
  if (tradesToday >= CONFIG.MAX_TRADES_PER_DAY) killSwitch = true;
}

/* =========================
   SIGN ORDER
========================= */

async function signOrder({ tokenId, price, amount }) {
  const domain = {
    name: "Polymarket CLOB",
    version: "1",
    chainId: CONFIG.CHAIN_ID,
    verifyingContract: CONFIG.CLOB_CONTRACT,
  };

  const types = {
    Order: [
      { name: "tokenId", type: "uint256" },
      { name: "price", type: "uint256" },
      { name: "amount", type: "uint256" },
      { name: "side", type: "uint8" },
      { name: "nonce", type: "uint256" },
      { name: "maker", type: "address" },
    ],
  };

  const value = {
    tokenId,
    price,
    amount,
    side: 0,
    nonce: Date.now(),
    maker: wallet.address,
  };

  const signature = await wallet._signTypedData(domain, types, value);
  return { ...value, signature };
}

/* =========================
   MAIN LOOP
========================= */

async function main() {
  while (true) {
    if (killSwitch) break;

    try {
      const markets = await fetchMarkets();
      const market = markets.find(m => m.active && m.clobTokenIds?.length === 2);
      if (!market) continue;

      const decision = decideTrade({
        yesPrice: Number(market.outcomePrices[0]),
        noPrice: Number(market.outcomePrices[1]),
      });
      if (!decision) continue;

      const tokenId =
        decision.side === "YES"
          ? market.clobTokenIds[0]
          : market.clobTokenIds[1];

      const book = await fetchOrderbook(tokenId);
      const bestAsk = book.asks?.[0];
      const bestBid = book.bids?.[0];

      if (!bestAsk || !bestBid) continue;

      // ---- Spread filter
      const spreadPct =
        ((bestAsk.price - bestBid.price) / bestAsk.price) * 100;
      if (spreadPct > CONFIG.MAX_SPREAD_PCT) continue;

      // ---- Liquidity filter
      if (bestAsk.size < CONFIG.MIN_LIQUIDITY_USDC) continue;

      if (!CONFIG.LIVE_TRADING) {
        console.log("PAPER BUY @", bestAsk.price);
        continue;
      }

      const signed = await signOrder({
        tokenId,
        price: bestAsk.price,
        amount: CONFIG.BET_AMOUNT_USDC,
      });

      await api.post(`${CONFIG.CLOB_HOST}/orders`, signed);
      tradesToday++;

      // ---- Update PnL
      const fills = await fetchFills();
      realizedPnL = fills.reduce(
        (p, f) => p + (f.side === "BUY" ? -f.cost : f.proceeds),
        0
      );

      checkKillSwitch();
    } catch (err) {
      console.error(err.message);
    }

    await sleep(CONFIG.LOOP_DELAY_MS);
  }
}

function sleep(ms) {
  return new Promise(r => setTimeout(r, ms));
}

main();
