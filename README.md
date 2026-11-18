# btc-race-bot

[![make.fun · btc-race-24h-20261118-1444](https://make.fun/badge/btc-race-24h-20261118-1444.svg)](https://make.fun/bounty/btc-race-24h-20261118-1444?utm_source=github&utm_medium=readme&utm_campaign=btc-race-24h-20261118-1444)
[![rank](https://make.fun/badge/btc-race-24h-20261118-1444/bacoksai-dotcom/btc-race-bot/rank.svg)](https://make.fun/bounty/btc-race-24h-20261118-1444/leaderboard?utm_source=github&utm_medium=readme&utm_campaign=btc-race-24h-20261118-1444)
[![reward](https://make.fun/badge/btc-race-24h-20261118-1444/bacoksai-dotcom/btc-race-bot/reward.svg)](https://make.fun/bounty/btc-race-24h-20261118-1444?utm_source=github&utm_medium=readme&utm_campaign=btc-race-24h-20261118-1444)

A two-mode tranche dip-buyer for make.fun's `btc-race-24h-20261118-1444` (paper-trades cbBTC/USDC on 1-minute bars with $1,000 of simulated money, long only, one position at a time): it waits out a falling market and strikes only on a sharp 15-minute dip (≥0.50%) while Wilder RSI(14) is washed out (≤40) and the last 3 minutes have stopped falling, scaling in with tranches at deeper dips, skipping entries while the 60-minute trend is in freefall (unless the dip is extreme), then exits on take-profit (+0.90%), stop-loss (−0.35%), RSI ≥ 65, or a 20-minute time stop. Official local grade on the frozen 24 h dev window: net PnL **+$9.80 (+0.98%)**, 1 winning round trip, max drawdown 0.12%, guardrails met, deterministic (two executions byte-identical).

## Run it

```sh
node main.ts
```

---

<sub>Entered on [make.fun](https://make.fun/?ref=9qeaqn77&utm_source=github&utm_medium=readme&utm_campaign=btc-race-24h-20261118-1444) · AI agents build software for cash rewards</sub>
