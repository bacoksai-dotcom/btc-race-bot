// Dip-Recovery cbBTC bot for make.fun btc-race-24h-20261118-1444.
// TypeScript (Node 22) port of the Python strategy of the same design:
// the local process sandbox grades Node bots only (a Python bot needs
// Docker, which this machine has none of), so this file is the graded
// entry; main.py in the workspace keeps the identical logic.
//
// Strategy (long only, one position, 1-minute cbBTC/USDC bars):
//   * Mean reversion on sharp intraday dips: enter only after a fast
//     decline (DIP_BPS over DIP_MINUTES) while short-term momentum is
//     washed out (Wilder RSI(14) below RSI_MAX) and the tape has stopped
//     falling (the last 3 minutes are flat or up -- bounce confirmation).
//   * Downtrend regime filter: skip entries while the 60-minute return is
//     worse than -REGIME_MAX_DROP_BPS; an extreme dip (below
//     -EXTREME_DIP_BPS) overrides it.
//   * Tight exits, because a full round trip costs ~26 bps and the dev
//     window's 1-minute volatility is only ~7 bps: take profit at +TP_BPS,
//     stop at -SL_BPS, exit on RSI above RSI_EXIT, and a TIME_STOP time stop.
//   * Full-size entries (single position, capped by the harness weight cap),
//     sells before buys, 100 bps max slippage on every order.
//
// Pure deterministic stdlib: no clock, no network, no files, no unseeded
// randomness. Float math on integer bar closes only.

import { runBars, type Bar, type BarsState, type BuyInput, type SellInput } from './vendor/makefun-bars.ts';

const SYMBOL = 'CBBTC';
const MAX_SLIPPAGE_BPS = 100;

// --- Tuned parameters (dev-window fitted; see README) ---
const DIP_BPS = 50;            // dip (bps) over DIP_MINUTES that arms an entry
const DIP_MINUTES = 15;        // window for the dip measurement
const BOUNCE_BPS = -5;         // last-3-min return must be >= this (flat or up)
const EXTREME_DIP_BPS = 120;   // dip this deep overrides the regime filter
const REGIME_MAX_DROP_BPS = 150; // skip entries if 60-min return worse than this
const RSI_BARS = 14;
const RSI_MAX = 40;            // enter only while RSI(14) is washed out
const RSI_EXIT = 65;           // exit when RSI(14) gets hot
const TP_BPS = 90;
const SL_BPS = 35;             // stop loss, bps under entry cost
const TIME_STOP = 20;          // max minutes to hold a position

const closes: number[] = [];   // integer closes, oldest first
const rsiFirst: number[] = []; // first RSI_BARS changes, while averages build
let rsiGain: number | null = null;
let rsiLoss: number | null = null;
let lastClose: number | null = null;
let entrySeq: number | null = null; // seq of the bar the position opened on

function push(close: number): void {
  closes.push(close);
  if (closes.length > 300) closes.splice(0, closes.length - 300);
  if (lastClose !== null) {
    const change = close - lastClose;
    if (rsiGain === null || rsiLoss === null) {
      rsiFirst.push(change);
      if (rsiFirst.length === RSI_BARS) {
        rsiGain = rsiFirst.reduce((a, x) => a + (x > 0 ? x : 0), 0) / RSI_BARS;
        rsiLoss = rsiFirst.reduce((a, x) => a + (x < 0 ? -x : 0), 0) / RSI_BARS;
      }
    } else {
      rsiGain = (rsiGain * (RSI_BARS - 1) + (change > 0 ? change : 0)) / RSI_BARS;
      rsiLoss = (rsiLoss * (RSI_BARS - 1) + (change < 0 ? -change : 0)) / RSI_BARS;
    }
  }
  lastClose = close;
}

function rsi(): number | null {
  if (rsiGain === null || rsiLoss === null) return null;
  const moved = rsiGain + rsiLoss;
  return moved === 0 ? 50 : (100 * rsiGain) / moved;
}

/** Return over the last `minutes` bars, in bps (negative = fell). */
function retBps(minutes: number): number | null {
  if (closes.length <= minutes) return null;
  const now = closes[closes.length - 1];
  const then = closes[closes.length - 1 - minutes];
  if (then === 0) return null;
  return Math.trunc(((now - then) * 10000) / then);
}


await runBars({
  onBatch(state: BarsState, batch: { bars: Bar[] }) {
    for (const bar of batch.bars) {
      if (bar.symbol === SYMBOL) push(Number(bar.c));
    }
    if (state.warmingUp || closes.length < 61) return [];
    const held = state.positions.get(SYMBOL);
    const r = rsi();
    const close = state.close(SYMBOL);
    const orders: (SellInput | BuyInput)[] = [];

    if (held !== undefined) {
      // --- exits: TP / SL / RSI-hot / time stop, whole position ---
      const value = state.value(SYMBOL, held.qty, close);
      const cost = held.cost;
      const pnlBps = cost > 0n ? Number(((value - cost) * 10000n) / cost) : 0;
      const heldMins = entrySeq !== null ? state.seq - entrySeq : 0;
      if (pnlBps >= TP_BPS || pnlBps <= -SL_BPS
        || (r !== null && r >= RSI_EXIT)
        || heldMins >= TIME_STOP) {
        orders.push({ side: 'sell', symbol: SYMBOL, qty: held.qty, max_slippage_bps: MAX_SLIPPAGE_BPS });
        entrySeq = null;
      }
      return orders;
    }

    // --- entries: flat, dip + washed-out RSI + bounce confirmation ---
    const ret15 = retBps(DIP_MINUTES);
    const ret60 = retBps(60);
    if (ret15 === null || ret60 === null || r === null) return [];
    const ret3 = retBps(3);
    const bounce = ret3 !== null && ret3 >= BOUNCE_BPS; // last 3 min flat or up
    const regimeOk = ret60 >= -REGIME_MAX_DROP_BPS;
    const extreme = ret15 <= -EXTREME_DIP_BPS;
    if (ret15 <= -DIP_BPS && r <= RSI_MAX && bounce && (regimeOk || extreme)) {
      let spend = state.cash < state.weightRoom(SYMBOL) ? state.cash : state.weightRoom(SYMBOL);
      const minNotional = BigInt(state.hello.fees?.min_notional_quote_units ?? 0);
      if (spend > minNotional) {
        orders.push({ side: 'buy', symbol: SYMBOL, notional_quote_units: spend, max_slippage_bps: MAX_SLIPPAGE_BPS });
        entrySeq = state.seq;
      }
    }
    return orders;
  },
});
