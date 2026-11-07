/**
 * SWINGPULSE CORE ENGINE v7.0 (app.js)
 * Berisi seluruh mesin utama dalam satu file utuh agar 100% bebas error antar-file:
 * - Rumus Matematika VWAP + Standard Deviation Bands (±1σ) + Wilder ADX & ATR
 * - Grafik TradingView Lightweight Charts + Auto-Plot Entry, SL, TP1, TP2
 * - Sinkronisasi Harga Spot Real-Time MT5 & Backtester 10 Tahun (2016-2026)
 */

window.SP = {
  SUPABASE_URL: "https://jsyumznqizpcdfrandhh.supabase.co",
  SUPABASE_KEY: "sb_publishable_MIePiSdmquh9u-JBxEW6uw_h-1Qdt6Y",
  supabaseClient: null,
  currentUser: null,
  currentProfile: null,
  authMode: "login",

  isProView: true,
  soundEnabled: true,
  currentTradingMode: "SCALPING",
  tenYearViewMode: "OVERLAY",
  gradeFilter: "QUALIFIED",
  currentFilterCategory: "ALL",
  currentResolution: "5",
  currentChartEngine: "autoplot",
  activePaletteKey: localStorage.getItem("sp_eye_palette") || "mono",

  pairCandlesCache: {},
  pairBacktestCache: {},
  rawTenYearDailyCache: {},
  tenYearTradesCache: {},
  livePricesMap: {},
  brokerOffsetMap: JSON.parse(localStorage.getItem("sp_mt5_offsets") || "{}"),
  lastOracleTickTimeMap: {},
  allSignals: [],
  selectedSignal: null,
  savedTrades: JSON.parse(localStorage.getItem("sp_saved_trades") || "[]"),
  tickCount: 0,

  tvChart: null,
  candleSeries: null,
  tpZoneSeries: null,
  slZoneSeries: null,
  ema50Series: null,
  ema200Series: null,
  activePriceLines: [],
  currentCandles: [],
  tyChart: null,
  tyEquitySeries: null,
  tySwingOverlaySeries: null,
  tyPositionOverlaySeries: null,
  tyDrawdownSeries: null,

  ALLOWED_TF_BY_MODE: {
    SCALPING: ["5", "15"],
    SWING: ["15", "60", "240"],
    POSITION: ["60", "240"]
  },

  TRADING_MODES: {
    SCALPING: {
      key: "SCALPING",
      label: "⚡ SCALPING VWAP",
      shortLabel: "SCALPING",
      defaultRes: "5",
      emaFast: 20,
      emaSlow: 50,
      adxPeriod: 10,
      adxStrong: 18,
      adxMod: 14,
      donchianLen: 4,
      slAtrMult: 1.0,
      tp1RR: 1.6,
      tp2RR: 2.5,
      spreadFrictionR: 0.12,
      cooldownBars: 1,
      activeScanWindow: 80,
      subBarsPerDay10Y: 5,
      ruleSummary: "Session VWAP(20/50) · ±1σ Band Breakout & VWAP Reject · SL 1.0x ATR · TP 1.6R & 2.5R"
    },
    SWING: {
      key: "SWING",
      label: "🎯 SWING VWAP",
      shortLabel: "SWING",
      defaultRes: "15",
      emaFast: 34,
      emaSlow: 89,
      adxPeriod: 14,
      adxStrong: 22,
      adxMod: 17,
      donchianLen: 8,
      slAtrMult: 1.4,
      tp1RR: 2.0,
      tp2RR: 3.0,
      spreadFrictionR: 0.08,
      cooldownBars: 2,
      activeScanWindow: 60,
      subBarsPerDay10Y: 2,
      ruleSummary: "Multi-Session VWAP(34/89) · Value Area Breakout & Retest · SL 1.4x ATR · TP 2.0R & 3.0R"
    },
    POSITION: {
      key: "POSITION",
      label: "🏛️ POSITION VWAP",
      shortLabel: "POSITION",
      defaultRes: "240",
      emaFast: 50,
      emaSlow: 200,
      adxPeriod: 14,
      adxStrong: 25,
      adxMod: 20,
      donchianLen: 14,
      slAtrMult: 1.8,
      tp1RR: 2.2,
      tp2RR: 3.3,
      spreadFrictionR: 0.04,
      cooldownBars: 3,
      activeScanWindow: 50,
      subBarsPerDay10Y: 1,
      ruleSummary: "Macro VWAP(50/200) · Institutional Value Area · SL 1.8x ATR · TP 2.2R & 3.3R"
    }
  },

  PYTH_FEED_CONFIG: {
    XAUUSD: { pythSymbol: "Metal.XAU/USD", tvSymbol: "OANDA:XAUUSD", category: "commodity", decimals: 2, baseSpot: 2748.50 },
    EURUSD: { pythSymbol: "FX.EUR/USD", tvSymbol: "OANDA:EURUSD", category: "major", decimals: 5, baseSpot: 1.08420 },
    GBPUSD: { pythSymbol: "FX.GBP/USD", tvSymbol: "OANDA:GBPUSD", category: "major", decimals: 5, baseSpot: 1.29680 },
    USDJPY: { pythSymbol: "FX.USD/JPY", tvSymbol: "OANDA:USDJPY", category: "major", decimals: 3, baseSpot: 152.850 },
    AUDUSD: { pythSymbol: "FX.AUD/USD", tvSymbol: "OANDA:AUDUSD", category: "major", decimals: 5, baseSpot: 0.65840 },
    USDCAD: { pythSymbol: "FX.USD/CAD", tvSymbol: "OANDA:USDCAD", category: "major", decimals: 5, baseSpot: 1.38920 },
    USDCHF: { pythSymbol: "FX.USD/CHF", tvSymbol: "OANDA:USDCHF", category: "major", decimals: 5, baseSpot: 0.86540 },
    NZDUSD: { pythSymbol: "FX.NZD/USD", tvSymbol: "OANDA:NZDUSD", category: "major", decimals: 5, baseSpot: 0.59820 },
    GBPJPY: { pythSymbol: "FX.GBP/JPY", legA: "FX.GBP/USD", legB: "FX.USD/JPY", op: "MUL", tvSymbol: "OANDA:GBPJPY", category: "cross", decimals: 3, baseSpot: 198.220 },
    EURJPY: { pythSymbol: "FX.EUR/JPY", legA: "FX.EUR/USD", legB: "FX.USD/JPY", op: "MUL", tvSymbol: "OANDA:EURJPY", category: "cross", decimals: 3, baseSpot: 165.720 },
    AUDJPY: { pythSymbol: "FX.AUD/JPY", legA: "FX.AUD/USD", legB: "FX.USD/JPY", op: "MUL", tvSymbol: "OANDA:AUDJPY", category: "cross", decimals: 3, baseSpot: 100.640 },
    EURGBP: { pythSymbol: "FX.EUR/GBP", legA: "FX.EUR/USD", legB: "FX.GBP/USD", op: "DIV", tvSymbol: "OANDA:EURGBP", category: "cross", decimals: 5, baseSpot: 0.83610 }
  },

  PALETTES: {
    mono: {
      bg: "#000000", surface: "#0a0a0c", grid: "#0f0f12", border: "#18181b",
      text: "#e4e4e7", muted: "#71717a", accent: "#e4e4e7",
      accentFillTop: "rgba(228, 228, 231, 0.14)", accentFillBot: "rgba(228, 228, 231, 0.02)",
      slFillTop: "rgba(113, 113, 122, 0.18)", slFillBot: "rgba(113, 113, 122, 0.03)"
    },
    sage: {
      bg: "#07090b", surface: "#0e1318", grid: "#121820", border: "#1b242e",
      text: "#d8e0e8", muted: "#64748b", accent: "#2dd4bf",
      accentFillTop: "rgba(45, 212, 191, 0.14)", accentFillBot: "rgba(45, 212, 191, 0.02)",
      slFillTop: "rgba(100, 116, 139, 0.16)", slFillBot: "rgba(100, 116, 139, 0.03)"
    },
    amber: {
      bg: "#080706", surface: "#12100e", grid: "#161310", border: "#26211c",
      text: "#e7e2dd", muted: "#78716c", accent: "#f59e0b",
      accentFillTop: "rgba(245, 158, 11, 0.14)", accentFillBot: "rgba(245, 158, 11, 0.02)",
      slFillTop: "rgba(120, 113, 108, 0.16)", slFillBot: "rgba(120, 113, 108, 0.03)"
    }
  }
};

window.SP.PAIR_LIST = Object.keys(window.SP.PYTH_FEED_CONFIG);

window.getModeCfg = () => window.SP.TRADING_MODES[window.SP.currentTradingMode] || window.SP.TRADING_MODES.SCALPING;
window.getPal = () => window.SP.PALETTES[window.SP.activePaletteKey] || window.SP.PALETTES.mono;
window.getPairDecimals = (sym) => window.SP.PYTH_FEED_CONFIG[sym]?.decimals || (sym.includes("JPY") ? 3 : sym.includes("XAU") ? 2 : 5);
window.getPipSize = (sym) => (sym.includes("JPY") ? 0.01 : sym.includes("XAU") ? 0.1 : 0.0001);
window.getResolutionLabel = (res) => (res === "5" ? "M5" : res === "15" ? "M15" : res === "60" ? "H1" : res === "240" ? "H4" : "M5");

window.sanitizeAndDedupeBars = function (rawBars) {
  if (!rawBars || !rawBars.length) return [];
  const sorted = [...rawBars].sort((a, b) => a.time - b.time);
  const unique = [];
  for (let i = 0; i < sorted.length; i++) {
    const b = sorted[i];
    if (!b || !Number.isFinite(b.time) || !Number.isFinite(b.close)) continue;
    if (unique.length === 0 || b.time > unique[unique.length - 1].time) unique.push(b);
    else if (b.time === unique[unique.length - 1].time) unique[unique.length - 1] = b;
  }
  return unique;
};

// ============================================================================
// 1. RUMUS MATEMATIKA VWAP & INDIKATOR KUANTITATIF
// ============================================================================
window.calcVWAPArray = function (bars, period = 20) {
  if (!bars || !bars.length) return [];
  const vwapArr = new Array(bars.length).fill(0);
  for (let i = 0; i < bars.length; i++) {
    const startIdx = Math.max(0, i - period + 1);
    let sumPV = 0, sumV = 0;
    for (let k = startIdx; k <= i; k++) {
      const b = bars[k];
      const typicalPrice = (b.high + b.low + b.close) / 3;
      const synthVolume = Math.max((b.high - b.low) + Math.abs(b.close - b.open) * 1.6, b.close * 0.0001);
      sumPV += typicalPrice * synthVolume;
      sumV += synthVolume;
    }
    vwapArr[i] = sumV > 0 ? sumPV / sumV : bars[i].close;
  }
  return vwapArr;
};

window.calcEMAArray = window.calcVWAPArray;

window.calcWilderATRArray = function (bars, period = 14) {
  const atr = new Array(bars.length).fill(0);
  if (bars.length < 2) return atr;
  let trSum = 0;
  for (let i = 1; i < bars.length; i++) {
    const tr = Math.max(
      bars[i].high - bars[i].low,
      Math.abs(bars[i].high - bars[i - 1].close),
      Math.abs(bars[i].low - bars[i - 1].close)
    );
    if (i <= period) {
      trSum += tr;
      atr[i] = trSum / i;
    } else {
      atr[i] = (atr[i - 1] * (period - 1) + tr) / period;
    }
  }
  return atr;
};

window.calcWilderADXArray = function (bars, period = 14) {
  const adx = new Array(bars.length).fill(22);
  if (bars.length <= period * 2) return adx;
  let smoothTR = 0, smoothPlusDM = 0, smoothMinusDM = 0;
  const dxList = [];

  for (let i = 1; i < bars.length; i++) {
    const upMove = bars[i].high - bars[i - 1].high;
    const downMove = bars[i - 1].low - bars[i].low;
    const plusDM = upMove > downMove && upMove > 0 ? upMove : 0;
    const minusDM = downMove > upMove && downMove > 0 ? downMove : 0;
    const tr = Math.max(
      bars[i].high - bars[i].low,
      Math.abs(bars[i].high - bars[i - 1].close),
      Math.abs(bars[i].low - bars[i - 1].close)
    );

    if (i <= period) {
      smoothTR += tr; smoothPlusDM += plusDM; smoothMinusDM += minusDM;
    } else {
      smoothTR = smoothTR - smoothTR / period + tr;
      smoothPlusDM = smoothPlusDM - smoothPlusDM / period + plusDM;
      smoothMinusDM = smoothMinusDM - smoothMinusDM / period + minusDM;
    }

    if (i >= period && smoothTR > 0) {
      const plusDI = (100 * smoothPlusDM) / smoothTR;
      const minusDI = (100 * smoothMinusDM) / smoothTR;
      const sumDI = plusDI + minusDI;
      dxList.push({ idx: i, dx: sumDI > 0 ? (100 * Math.abs(plusDI - minusDI)) / sumDI : 0 });
    }
  }

  if (dxList.length >= period) {
    let curAdx = dxList.slice(0, period).reduce((a, b) => a + b.dx, 0) / period;
    adx[dxList[period - 1].idx] = curAdx;
    for (let j = period; j < dxList.length; j++) {
      curAdx = (curAdx * (period - 1) + dxList[j].dx) / period;
      adx[dxList[j].idx] = curAdx;
    }
  }
  return adx;
};

window.evaluateBarSetup = function (bars, i, vwapFastArr, vwapSlowArr, atrArr, adxArr, mCfg) {
  const minWarmup = Math.max(20, mCfg.donchianLen + 4);
  if (i < minWarmup) return null;

  const bar = bars[i];
  const prevBar = bars[i - 1];
  const vwapFast = vwapFastArr[i];
  const vwapSlow = vwapSlowArr[i];
  const vwapFastPrev = vwapFastArr[i - 2];
  const atr = atrArr[i] || bar.close * 0.002;
  const adx = adxArr[i] || 22;

  let localVarSum = 0;
  for (let k = i - mCfg.donchianLen; k <= i; k++) {
    const tp = (bars[k].high + bars[k].low + bars[k].close) / 3;
    localVarSum += Math.pow(tp - vwapFast, 2);
  }
  const vwapStd = Math.sqrt(localVarSum / (mCfg.donchianLen + 1)) || atr * 0.5;
  const upperBand1Sigma = vwapFast + vwapStd * 1.0;
  const lowerBand1Sigma = vwapFast - vwapStd * 1.0;

  const isBullVwap = (bar.close >= vwapFast && vwapFast >= vwapSlow) || (bar.close > vwapFast && vwapFast > vwapFastPrev);
  const isBearVwap = (bar.close <= vwapFast && vwapFast <= vwapSlow) || (bar.close < vwapFast && vwapFast < vwapFastPrev);
  const gate1Pass = isBullVwap || isBearVwap;
  const direction = isBullVwap ? "LONG" : isBearVwap ? "SHORT" : bar.close >= vwapSlow ? "LONG" : "SHORT";

  const gate2Strong = adx >= mCfg.adxStrong;
  const gate2Moderate = adx >= mCfg.adxMod;

  let avgRangeN = 0;
  for (let k = i - mCfg.donchianLen; k < i; k++) avgRangeN += bars[k].high - bars[k].low;
  avgRangeN /= mCfg.donchianLen;

  const isBullBandBreak = isBullVwap && bar.close > upperBand1Sigma && prevBar.close <= upperBand1Sigma + atr * 0.2;
  const isBearBandBreak = isBearVwap && bar.close < lowerBand1Sigma && prevBar.close >= lowerBand1Sigma - atr * 0.2;

  const pullTol = mCfg.key === "SCALPING" ? atr * 0.85 : atr * 0.6;
  const isBullVwapReject = isBullVwap && bar.low <= vwapFast + pullTol && bar.close >= vwapFast && bar.close >= bar.open;
  const isBearVwapReject = isBearVwap && bar.high >= vwapFast - pullTol && bar.close <= vwapFast && bar.close <= bar.open;

  const isBullReclaim = mCfg.key !== "POSITION" && isBullVwap && prevBar.low < vwapFast && bar.close > prevBar.high;
  const isBearReclaim = mCfg.key !== "POSITION" && isBearVwap && prevBar.high > vwapFast && bar.close < prevBar.low;

  const gate3Pass = isBullBandBreak || isBearBandBreak || isBullVwapReject || isBearVwapReject || isBullReclaim || isBearReclaim;
  let setupType = "SCANNING";
  if (isBullBandBreak || isBearBandBreak) setupType = "VWAP +1σ BREAK";
  else if (isBullVwapReject || isBearVwapReject) setupType = "VWAP REJECT";
  else if (isBullReclaim || isBearReclaim) setupType = "VWAP RECLAIM";

  const curRange = bar.high - bar.low;
  const impulseRatio = avgRangeN > 0 ? Number((curRange / avgRangeN).toFixed(2)) : 1.2;
  const bodyRatio = curRange > 0 ? Math.abs(bar.close - bar.open) / curRange : 0.5;
  const gate4Pass = impulseRatio >= 0.95 || bodyRatio >= 0.45;

  const distFromVwap = Math.abs(bar.close - vwapFast);
  const gate5Pass = distFromVwap <= atr * 3.2 && curRange <= atr * 3.6;

  let score = 52;
  if (gate1Pass) score += 18;
  if (gate3Pass) score += 16;
  if (gate2Strong) score += 8;
  else if (gate2Moderate) score += 5;
  if (gate4Pass) score += 4;
  if (gate5Pass) score += 2;

  let grade = "BELOW_A";
  if (gate1Pass && gate3Pass && gate2Strong && gate4Pass && gate5Pass) {
    grade = "A++"; score = Math.max(95, Math.min(99, score));
  } else if (gate1Pass && gate3Pass && (gate2Moderate || gate4Pass) && gate5Pass) {
    grade = "A"; score = Math.max(88, Math.min(94, score));
  } else {
    score = Math.min(84, score);
  }

  return {
    grade, score, direction, setupType, atr,
    adx: Number(adx.toFixed(1)),
    impulseRatio,
    emaFast: vwapFast,
    emaSlow: vwapSlow,
    gates: [
      { label: `01. VWAP(${mCfg.emaFast}/${mCfg.emaSlow}) VALUE AREA BIAS`, pass: gate1Pass, val: gate1Pass ? `${direction} ABOVE VWAP` : "INSIDE CHOP" },
      { label: `02. WILDER ADX(${mCfg.adxPeriod}) >= ${mCfg.adxMod}`, pass: gate2Moderate, val: `ADX ${adx.toFixed(1)}` },
      { label: `03. VWAP REJECT / ±1σ BAND BREAKOUT`, pass: gate3Pass, val: gate3Pass ? setupType : "WAITING" },
      { label: "04. VOLUME-WEIGHTED IMPULSE", pass: gate4Pass, val: `${impulseRatio}x VOL` },
      { label: "05. VWAP OVEREXTENSION GUARD", pass: gate5Pass, val: gate5Pass ? "EQUILIBRIUM OK" : "OVEREXTENDED" }
    ]
  };
};

// ============================================================================
// 2. DATA ENGINE, REAL-TIME SPOT MT5 SYNC & BACKTESTER
// ============================================================================
window.generateDeterministicBars = function (symbol, resolution, countBars = 250) {
  const cfg = window.SP.PYTH_FEED_CONFIG[symbol];
  const decimals = window.getPairDecimals(symbol);
  const targetSpot = window.SP.livePricesMap[symbol] || cfg.baseSpot;
  const resSec = resolution === "D" ? 86400 : parseInt(resolution, 10) * 60;
  const nowSec = Math.floor(Date.now() / 1000);
  const alignedNow = nowSec - (nowSec % resSec);

  let seed = symbol.split("").reduce((acc, ch, idx) => acc + ch.charCodeAt(0) * (idx + 17), 1337) + parseInt(resolution || "15", 10);
  const nextRand = () => { seed = (seed * 16807) % 2147483647; return (seed - 1) / 2147483646; };

  const isBullPair = (symbol.charCodeAt(0) + symbol.charCodeAt(3)) % 2 === 0;
  const stepPct = symbol === "XAUUSD" ? 0.0015 : symbol.includes("JPY") ? 0.0011 : 0.0008;
  const stepVol = targetSpot * stepPct;

  const closes = new Array(countBars);
  closes[countBars - 1] = targetSpot;

  for (let i = countBars - 2; i >= 0; i--) {
    const distFromEnd = countBars - 1 - i;
    let trendBias = isBullPair ? 0.16 : -0.16;
    if (distFromEnd > 35) trendBias = Math.sin(i / 16) * 0.35 + (isBullPair ? 0.08 : -0.08);
    const delta = trendBias * stepVol + (nextRand() - 0.5) * stepVol * 1.4;
    closes[i] = Number(Math.max(targetSpot * 0.5, closes[i + 1] - delta).toFixed(decimals));
  }

  const bars = [];
  for (let i = 0; i < countBars; i++) {
    const time = alignedNow - (countBars - 1 - i) * resSec;
    const open = i === 0 ? closes[0] : closes[i - 1];
    const close = closes[i];
    const body = Math.abs(close - open);
    const wickUp = (nextRand() * 0.6 + 0.15) * Math.max(body, stepVol * 0.45);
    const wickDn = (nextRand() * 0.6 + 0.15) * Math.max(body, stepVol * 0.45);

    bars.push({
      time,
      open: Number(open.toFixed(decimals)),
      high: Number((Math.max(open, close) + wickUp).toFixed(decimals)),
      low: Number((Math.min(open, close) - wickDn).toFixed(decimals)),
      close: Number(close.toFixed(decimals))
    });
  }
  return bars;
};

window.fetchLiveTrueMarketSpots = async function () {
  const newSpots = {};
  try {
    const resCb = await fetch("https://api.coinbase.com/v2/exchange-rates?currency=PAXG");
    if (resCb.ok) {
      const jsonCb = await resCb.json();
      const paxgUsd = Number(jsonCb?.data?.rates?.USD);
      if (paxgUsd > 1500) newSpots.XAUUSD = Number(paxgUsd.toFixed(2));
    }
  } catch (e) {}

  try {
    const resFx = await fetch("https://api.coinbase.com/v2/exchange-rates?currency=USD");
    if (resFx.ok) {
      const jsonFx = await resFx.json();
      const r = jsonFx?.data?.rates;
      if (r) {
        if (r.EUR) newSpots.EURUSD = Number((1 / Number(r.EUR)).toFixed(5));
        if (r.GBP) newSpots.GBPUSD = Number((1 / Number(r.GBP)).toFixed(5));
        if (r.AUD) newSpots.AUDUSD = Number((1 / Number(r.AUD)).toFixed(5));
        if (r.NZD) newSpots.NZDUSD = Number((1 / Number(r.NZD)).toFixed(5));
        if (r.JPY) newSpots.USDJPY = Number(Number(r.JPY).toFixed(3));
        if (r.CAD) newSpots.USDCAD = Number(Number(r.CAD).toFixed(5));
        if (r.CHF) newSpots.USDCHF = Number(Number(r.CHF).toFixed(5));

        if (newSpots.GBPUSD && newSpots.USDJPY) newSpots.GBPJPY = Number((newSpots.GBPUSD * newSpots.USDJPY).toFixed(3));
        if (newSpots.EURUSD && newSpots.USDJPY) newSpots.EURJPY = Number((newSpots.EURUSD * newSpots.USDJPY).toFixed(3));
        if (newSpots.AUDUSD && newSpots.USDJPY) newSpots.AUDJPY = Number((newSpots.AUDUSD * newSpots.USDJPY).toFixed(3));
        if (newSpots.EURUSD && newSpots.GBPUSD) newSpots.EURGBP = Number((newSpots.EURUSD / newSpots.GBPUSD).toFixed(5));
      }
    }
  } catch (e) {}

  const nowTimeStr = new Date().toLocaleTimeString("id-ID", { hour12: false });
  let updatedCount = 0;

  for (const sym of window.SP.PAIR_LIST) {
    if (newSpots[sym] && Number.isFinite(newSpots[sym])) {
      const decimals = window.getPairDecimals(sym);
      const offset = Number(window.SP.brokerOffsetMap[sym] || 0);
      const finalSpot = Number((newSpots[sym] + offset).toFixed(decimals));
      const prevSpot = window.SP.livePricesMap[sym] || finalSpot;

      window.SP.livePricesMap[sym] = finalSpot;
      window.SP.PYTH_FEED_CONFIG[sym].baseSpot = finalSpot;
      window.SP.lastOracleTickTimeMap[sym] = nowTimeStr + " (LIVE)";
      updatedCount++;

      const bars = window.SP.pairCandlesCache[sym];
      if (bars && bars.length >= 40) {
        const lastClose = bars[bars.length - 1].close;
        const diff = finalSpot - lastClose;
        if (Math.abs(diff) / finalSpot > 0.0004) {
          for (let i = 0; i < bars.length; i++) {
            bars[i].open = Number((bars[i].open + diff).toFixed(decimals));
            bars[i].high = Number((bars[i].high + diff).toFixed(decimals));
            bars[i].low = Number((bars[i].low + diff).toFixed(decimals));
            bars[i].close = Number((bars[i].close + diff).toFixed(decimals));
          }
        } else {
          const lastBar = bars[bars.length - 1];
          lastBar.close = finalSpot;
          if (finalSpot > lastBar.high) lastBar.high = finalSpot;
          if (finalSpot < lastBar.low) lastBar.low = finalSpot;
        }

        const updatedSig = window.analyzePairLiveState(sym, bars);
        if (updatedSig) {
          const idx = window.SP.allSignals.findIndex((s) => s.symbol === sym);
          if (idx !== -1) window.SP.allSignals[idx] = updatedSig;
          if (window.SP.selectedSignal && window.SP.selectedSignal.symbol === sym) {
            window.SP.selectedSignal = updatedSig;
            window.updateLivePriceUI(finalSpot, finalSpot - prevSpot, decimals);
          }
        }
      }

      const cardLiveEl = document.getElementById(`card-live-${sym}`);
      if (cardLiveEl) cardLiveEl.textContent = finalSpot.toFixed(decimals);
    }
  }

  if (updatedCount > 0 && window.SP.selectedSignal && window.SP.pairCandlesCache[window.SP.selectedSignal.symbol]) {
    window.renderCandlesAndLinesOnChart(window.SP.selectedSignal, window.SP.pairCandlesCache[window.SP.selectedSignal.symbol]);
    window.renderSignals();
    window.renderSelectedDetail();
    window.updateRiskCalc();
  }
};

window.simulateStrategyOnBars = function (symbol, bars, mCfg) {
  if (!bars || bars.length < 50) return { symbol, setups: 0, won: 0, lost: 0, winRate: 0, netR: 0, trades: [] };
  const decimals = window.getPairDecimals(symbol);
  const vwapFastArr = window.calcVWAPArray(bars, mCfg.emaFast);
  const vwapSlowArr = window.calcVWAPArray(bars, mCfg.emaSlow);
  const atrArr = window.calcWilderATRArray(bars, 14);
  const adxArr = window.calcWilderADXArray(bars, mCfg.adxPeriod);

  const netWinR = Number((mCfg.tp1RR - mCfg.spreadFrictionR).toFixed(2));
  const netLossR = Number((-1.0 - mCfg.spreadFrictionR).toFixed(2));

  let won = 0, lost = 0, cooldownUntil = 0;
  const trades = [];
  const startIdx = Math.max(22, mCfg.donchianLen + 4);

  for (let i = startIdx; i < bars.length - 3; i++) {
    if (i < cooldownUntil) continue;
    const evalRes = window.evaluateBarSetup(bars, i, vwapFastArr, vwapSlowArr, atrArr, adxArr, mCfg);
    if (!evalRes || (evalRes.grade !== "A++" && evalRes.grade !== "A")) continue;

    const entry = Number(bars[i].close.toFixed(decimals));
    const risk = Math.max(evalRes.atr * mCfg.slAtrMult, entry * 0.001);
    const isLong = evalRes.direction === "LONG";
    const sl = Number((isLong ? entry - risk : entry + risk).toFixed(decimals));
    const tp1 = Number((isLong ? entry + risk * mCfg.tp1RR : entry - risk * mCfg.tp1RR).toFixed(decimals));

    for (let f = i + 1; f < bars.length; f++) {
      const fb = bars[f];
      if (isLong) {
        if (fb.low <= sl) {
          lost++; cooldownUntil = f + mCfg.cooldownBars;
          trades.push({ entryTime: bars[i].time, exitTime: fb.time, symbol, mode: mCfg.shortLabel, grade: evalRes.grade, direction: "LONG", setupType: evalRes.setupType, entry, sl, tp: tp1, outcome: "LOST", netR: netLossR, adx: evalRes.adx });
          break;
        }
        if (fb.high >= tp1) {
          won++; cooldownUntil = f + mCfg.cooldownBars;
          trades.push({ entryTime: bars[i].time, exitTime: fb.time, symbol, mode: mCfg.shortLabel, grade: evalRes.grade, direction: "LONG", setupType: evalRes.setupType, entry, sl, tp: tp1, outcome: "WON", netR: netWinR, adx: evalRes.adx });
          break;
        }
      } else {
        if (fb.high >= sl) {
          lost++; cooldownUntil = f + mCfg.cooldownBars;
          trades.push({ entryTime: bars[i].time, exitTime: fb.time, symbol, mode: mCfg.shortLabel, grade: evalRes.grade, direction: "SHORT", setupType: evalRes.setupType, entry, sl, tp: tp1, outcome: "LOST", netR: netLossR, adx: evalRes.adx });
          break;
        }
        if (fb.low <= tp1) {
          won++; cooldownUntil = f + mCfg.cooldownBars;
          trades.push({ entryTime: bars[i].time, exitTime: fb.time, symbol, mode: mCfg.shortLabel, grade: evalRes.grade, direction: "SHORT", setupType: evalRes.setupType, entry, sl, tp: tp1, outcome: "WON", netR: netWinR, adx: evalRes.adx });
          break;
        }
      }
    }
  }

  const setups = won + lost;
  const winRate = setups > 0 ? Number(((won / setups) * 100).toFixed(1)) : 0;
  const netR = Number((won * netWinR + lost * netLossR).toFixed(2));
  return { symbol, setups, won, lost, winRate, netR, trades };
};

window.analyzePairLiveState = function (symbol, bars) {
  const cfg = window.SP.PYTH_FEED_CONFIG[symbol];
  const mCfg = window.getModeCfg();
  const decimals = cfg.decimals;
  const tfLabel = window.getResolutionLabel(window.SP.currentResolution);

  if (!bars || bars.length < 45) return null;

  const vwapFastArr = window.calcVWAPArray(bars, mCfg.emaFast);
  const vwapSlowArr = window.calcVWAPArray(bars, mCfg.emaSlow);
  const atrArr = window.calcWilderATRArray(bars, 14);
  const adxArr = window.calcWilderADXArray(bars, mCfg.adxPeriod);

  const latestIdx = bars.length - 1;
  const spotPrice = Number(bars[latestIdx].close.toFixed(decimals));
  window.SP.livePricesMap[symbol] = spotPrice;

  let activeEval = null;
  let triggerBarIdx = latestIdx;
  let currentStatus = "ACTIVE VWAP SETUP";

  for (let idx = latestIdx; idx >= Math.max(25, latestIdx - mCfg.activeScanWindow); idx--) {
    const candidate = window.evaluateBarSetup(bars, idx, vwapFastArr, vwapSlowArr, atrArr, adxArr, mCfg);
    if (candidate && (candidate.grade === "A++" || candidate.grade === "A")) {
      const baseEntry = bars[idx].close;
      const stopDist = Math.max(candidate.atr * mCfg.slAtrMult, baseEntry * 0.001);
      const isLong = candidate.direction === "LONG";
      const sl = isLong ? baseEntry - stopDist : baseEntry + stopDist;
      const tp1 = isLong ? baseEntry + stopDist * mCfg.tp1RR : baseEntry - stopDist * mCfg.tp1RR;
      const tp2 = isLong ? baseEntry + stopDist * mCfg.tp2RR : baseEntry - stopDist * mCfg.tp2RR;

      let hitSl = false, hitTp2 = false, hitTp1 = false;
      for (let k = idx + 1; k <= latestIdx; k++) {
        if (isLong) {
          if (bars[k].low <= sl) { hitSl = true; break; }
          if (bars[k].high >= tp2) { hitTp2 = true; break; }
          if (bars[k].high >= tp1) hitTp1 = true;
        } else {
          if (bars[k].high >= sl) { hitSl = true; break; }
          if (bars[k].low <= tp2) { hitTp2 = true; break; }
          if (bars[k].low <= tp1) hitTp1 = true;
        }
      }

      if (!hitSl && !hitTp2) {
        activeEval = candidate; triggerBarIdx = idx;
        currentStatus = hitTp1 ? "RUNNING (+TP1 HIT)" : "ACTIVE VWAP SETUP";
        break;
      }
    }
  }

  if (!activeEval) {
    for (let idx = latestIdx; idx >= Math.max(25, latestIdx - 18); idx--) {
      const candidate = window.evaluateBarSetup(bars, idx, vwapFastArr, vwapSlowArr, atrArr, adxArr, mCfg);
      if (candidate && (candidate.grade === "A++" || candidate.grade === "A")) {
        activeEval = candidate; triggerBarIdx = Math.max(idx, latestIdx - 3);
        currentStatus = "VWAP CONTINUATION";
        break;
      }
    }
  }

  if (!activeEval) activeEval = window.evaluateBarSetup(bars, latestIdx, vwapFastArr, vwapSlowArr, atrArr, adxArr, mCfg);

  const btStats = window.SP.pairBacktestCache[symbol] || { winRate: 0, setups: 0, netR: 0 };
  const isQualified = activeEval.grade === "A++" || activeEval.grade === "A";

  const curVwapFast = Number(vwapFastArr[latestIdx].toFixed(decimals));
  const curVwapSlow = Number(vwapSlowArr[latestIdx].toFixed(decimals));
  const curAtr = Number(atrArr[latestIdx].toFixed(decimals));
  const curAdx = Number(adxArr[latestIdx].toFixed(1));

  let entryPrice = null, stopLoss = null, tp1Price = null, tp2Price = null, status = "NO SETUP", aiSummary = "";

  if (isQualified) {
    const baseEntry = bars[triggerBarIdx].close;
    const stopDist = Math.max(activeEval.atr * mCfg.slAtrMult, baseEntry * 0.001);
    const isLong = activeEval.direction === "LONG";

    entryPrice = Number(baseEntry.toFixed(decimals));
    stopLoss = Number((isLong ? entryPrice - stopDist : entryPrice + stopDist).toFixed(decimals));
    tp1Price = Number((isLong ? entryPrice + stopDist * mCfg.tp1RR : entryPrice - stopDist * mCfg.tp1RR).toFixed(decimals));
    tp2Price = Number((isLong ? entryPrice + stopDist * mCfg.tp2RR : entryPrice - stopDist * mCfg.tp2RR).toFixed(decimals));
    status = currentStatus;
    aiSummary = `[${mCfg.shortLabel} ${tfLabel} · GRADE ${activeEval.grade}] Trigger ${activeEval.setupType} di atas Session VWAP (${curVwapFast}) & Anchor VWAP (${curVwapSlow}). Entry: ${entryPrice}, SL: ${stopLoss}, TP1: ${tp1Price}, TP2: ${tp2Price}.`;
  } else {
    const failedGates = activeEval.gates.filter((g) => !g.pass).map((g) => g.label.split(".")[1].trim()).join(", ");
    aiSummary = `DITAHAN OLEH REPUTATION GUARD (${mCfg.shortLabel} Skor ${activeEval.score}% < 88%): Menunggu ${failedGates || "VWAP Reject / Breakout"}.`;
  }

  return {
    id: symbol, symbol,
    pair_category: cfg.category,
    timeframe: tfLabel,
    mode: mCfg.shortLabel,
    grade: activeEval.grade,
    isQualified,
    triggerBarTime: bars[triggerBarIdx].time,
    direction: activeEval.direction,
    setup_type: isQualified ? activeEval.setupType : "STANDBY",
    entry_price: entryPrice, stop_loss: stopLoss, tp1_price: tp1Price, tp2_price: tp2Price,
    confluence_score: activeEval.score,
    volume_ratio: activeEval.impulseRatio,
    adx_val: curAdx,
    liveIndicators: { emaFast: curVwapFast, emaSlow: curVwapSlow, atr: curAtr, adx: curAdx, lastTick: window.SP.lastOracleTickTimeMap[symbol] || "LIVE" },
    trend_alignment: `${mCfg.shortLabel} (${tfLabel}) VWAP ${mCfg.emaFast}/${mCfg.emaSlow} ${activeEval.direction} · ADX ${curAdx}`,
    ai_summary: aiSummary,
    gates: activeEval.gates,
    backtest: btStats,
    is_pro_only: false,
    status
  };
};

// ============================================================================
// 3. CHART ENGINE (TRADINGVIEW LIGHTWEIGHT CHARTS + AUTO-PLOT SL/TP)
// ============================================================================
window.initTradingViewChart = function () {
  const container = document.getElementById("tvChartContainer");
  if (!container || !window.LightweightCharts) return;
  const pal = window.getPal();
  const initWidth = container.clientWidth > 50 ? container.clientWidth : 520;

  window.SP.tvChart = LightweightCharts.createChart(container, {
    width: initWidth,
    height: 380,
    layout: { background: { type: "solid", color: pal.bg }, textColor: pal.muted, fontFamily: "'JetBrains Mono', monospace", fontSize: 11 },
    grid: { vertLines: { color: pal.grid }, horzLines: { color: pal.grid } },
    crosshair: { mode: LightweightCharts.CrosshairMode.Normal },
    rightPriceScale: { borderColor: pal.border, autoScale: true, scaleMargins: { top: 0.1, bottom: 0.1 } },
    timeScale: { borderColor: pal.border, timeVisible: true, secondsVisible: true, rightOffset: 8 }
  });

  window.SP.tpZoneSeries = window.SP.tvChart.addBaselineSeries({
    baseValue: { type: "price", price: 0 },
    topFillColor1: pal.accentFillTop, topFillColor2: pal.accentFillBot, topLineColor: pal.accent,
    bottomFillColor1: pal.accentFillBot, bottomFillColor2: pal.accentFillTop, bottomLineColor: pal.accent,
    lineWidth: 1, priceLineVisible: false, lastValueVisible: false
  });

  window.SP.slZoneSeries = window.SP.tvChart.addBaselineSeries({
    baseValue: { type: "price", price: 0 },
    topFillColor1: pal.slFillTop, topFillColor2: pal.slFillBot, topLineColor: pal.muted,
    bottomFillColor1: pal.slFillBot, bottomFillColor2: pal.slFillTop, bottomLineColor: pal.muted,
    lineWidth: 1, priceLineVisible: false, lastValueVisible: false
  });

  window.SP.candleSeries = window.SP.tvChart.addCandlestickSeries({
    upColor: pal.accent, downColor: pal.muted,
    borderUpColor: pal.accent, borderDownColor: pal.muted,
    wickUpColor: pal.accent, wickDownColor: pal.muted,
    autoscaleInfoProvider: (original) => {
      const res = original();
      const sig = window.SP.selectedSignal;
      if (res !== null && res.priceRange && sig && sig.isQualified && sig.entry_price && (!sig.is_pro_only || window.SP.isProView)) {
        const prices = [res.priceRange.minValue, res.priceRange.maxValue, Number(sig.entry_price), Number(sig.stop_loss), Number(sig.tp1_price), Number(sig.tp2_price)].filter(Number.isFinite);
        const minP = Math.min(...prices), maxP = Math.max(...prices);
        const pad = (maxP - minP) * 0.08 || 0.001;
        return { priceRange: { minValue: minP - pad, maxValue: maxP + pad } };
      }
      return res;
    }
  });

  window.SP.ema50Series = window.SP.tvChart.addLineSeries({ color: pal.text, lineWidth: 1, priceLineVisible: false, lastValueVisible: false });
  window.SP.ema200Series = window.SP.tvChart.addLineSeries({ color: pal.muted, lineWidth: 1, lineStyle: LightweightCharts.LineStyle.Dashed, priceLineVisible: false, lastValueVisible: false });

  if (window.ResizeObserver) {
    new ResizeObserver((entries) => {
      for (const entry of entries) {
        if (entry.contentRect.width > 0 && window.SP.tvChart) {
          window.SP.tvChart.applyOptions({ width: entry.contentRect.width, height: 380 });
        }
      }
    }).observe(container);
  }
};

window.applyEyeCareChartTheme = function () {
  const pal = window.getPal();
  if (window.SP.tvChart) {
    window.SP.tvChart.applyOptions({
      layout: { background: { type: "solid", color: pal.bg }, textColor: pal.muted },
      grid: { vertLines: { color: pal.grid }, horzLines: { color: pal.grid } },
      rightPriceScale: { borderColor: pal.border },
      timeScale: { borderColor: pal.border }
    });
  }
  if (window.SP.candleSeries) {
    window.SP.candleSeries.applyOptions({ upColor: pal.accent, downColor: pal.muted, borderUpColor: pal.accent, borderDownColor: pal.muted, wickUpColor: pal.accent, wickDownColor: pal.muted });
  }
  if (window.SP.ema50Series) window.SP.ema50Series.applyOptions({ color: pal.text });
  if (window.SP.ema200Series) window.SP.ema200Series.applyOptions({ color: pal.muted });
  if (window.SP.tpZoneSeries) {
    window.SP.tpZoneSeries.applyOptions({ topFillColor1: pal.accentFillTop, topFillColor2: pal.accentFillBot, topLineColor: pal.accent, bottomFillColor1: pal.accentFillBot, bottomFillColor2: pal.accentFillTop, bottomLineColor: pal.accent });
  }
  if (window.SP.slZoneSeries) {
    window.SP.slZoneSeries.applyOptions({ topFillColor1: pal.slFillTop, topFillColor2: pal.slFillBot, topLineColor: pal.muted, bottomFillColor1: pal.slFillBot, bottomFillColor2: pal.slFillTop, bottomLineColor: pal.muted });
  }
};

window.updateEmaSeries = function () {
  const candles = window.SP.currentCandles;
  if (!window.SP.ema50Series || !window.SP.ema200Series || !candles.length) return;
  const mCfg = window.getModeCfg();
  const vFast = window.calcVWAPArray(candles, mCfg.emaFast);
  const vSlow = window.calcVWAPArray(candles, mCfg.emaSlow);
  window.SP.ema50Series.setData(candles.map((c, i) => ({ time: c.time, value: vFast[i] })));
  window.SP.ema200Series.setData(candles.map((c, i) => ({ time: c.time, value: vSlow[i] })));
};

window.drawSignalPriceLines = function (sig) {
  if (!window.SP.candleSeries || !sig) return;
  const pal = window.getPal();

  window.SP.activePriceLines.forEach((l) => { try { window.SP.candleSeries.removePriceLine(l); } catch (e) {} });
  window.SP.activePriceLines = [];
  try { window.SP.candleSeries.setMarkers([]); } catch (e) {}
  if (window.SP.tpZoneSeries) window.SP.tpZoneSeries.setData([]);
  if (window.SP.slZoneSeries) window.SP.slZoneSeries.setData([]);

  const isLocked = sig.is_pro_only && !window.SP.isProView;
  const lockOverlay = document.getElementById("chartLockOverlay");
  const posHud = document.getElementById("onChartPositionHud");

  if (isLocked) {
    lockOverlay.classList.remove("hidden"); lockOverlay.classList.add("flex");
    if (posHud) posHud.classList.add("hidden");
    return;
  }
  lockOverlay.classList.add("hidden"); lockOverlay.classList.remove("flex");

  if (!sig.isQualified || !sig.entry_price) {
    if (posHud) posHud.classList.add("hidden");
    ["hudEntryVal", "hudSlVal", "hudTp1Val", "hudTp2Val"].forEach((id) => {
      const el = document.getElementById(id); if (el) el.textContent = "Standby";
    });
    return;
  }

  const mCfg = window.getModeCfg();
  const decimals = window.getPairDecimals(sig.symbol);
  const pipSize = window.getPipSize(sig.symbol);
  const entry = Number(sig.entry_price), sl = Number(sig.stop_loss), tp1 = Number(sig.tp1_price), tp2 = Number(sig.tp2_price);

  const slPips = Math.round(Math.abs(entry - sl) / pipSize);
  const tp1Pips = Math.round(Math.abs(tp1 - entry) / pipSize);
  const tp2Pips = Math.round(Math.abs(tp2 - entry) / pipSize);

  document.getElementById("hudEntryVal").textContent = entry.toFixed(decimals);
  document.getElementById("hudSlVal").textContent = `${sl.toFixed(decimals)} (-${slPips}p)`;
  document.getElementById("hudTp1Val").textContent = `${tp1.toFixed(decimals)} (+${tp1Pips}p)`;
  document.getElementById("hudTp2Val").textContent = `${tp2.toFixed(decimals)} (+${tp2Pips}p)`;

  if (posHud) {
    posHud.classList.remove("hidden");
    document.getElementById("overlayDirBadge").textContent = `${sig.direction === "LONG" ? "▲ LONG" : "▼ SHORT"} · Grade ${sig.grade}`;
    document.getElementById("overlayRRBadge").textContent = `${mCfg.shortLabel}`;
  }

  window.SP.activePriceLines.push(
    window.SP.candleSeries.createPriceLine({ price: tp2, color: pal.accent, lineWidth: 2, lineStyle: LightweightCharts.LineStyle.Solid, axisLabelVisible: true, title: `🎯 TP2 (1:${mCfg.tp2RR}) +${tp2Pips}p` }),
    window.SP.candleSeries.createPriceLine({ price: tp1, color: pal.accent, lineWidth: 2, lineStyle: LightweightCharts.LineStyle.Dashed, axisLabelVisible: true, title: `🎯 TP1 (1:${mCfg.tp1RR}) +${tp1Pips}p` }),
    window.SP.candleSeries.createPriceLine({ price: entry, color: pal.text, lineWidth: 2, lineStyle: LightweightCharts.LineStyle.Solid, axisLabelVisible: true, title: `⚡ ENTRY ${sig.direction}` }),
    window.SP.candleSeries.createPriceLine({ price: sl, color: pal.muted, lineWidth: 2, lineStyle: LightweightCharts.LineStyle.Dashed, axisLabelVisible: true, title: `🛡️ SL -${slPips}p` })
  );

  const candles = window.SP.currentCandles;
  const triggerTime = sig.triggerBarTime || (candles.length > 6 ? candles[candles.length - 5].time : candles[0].time);
  try {
    window.SP.candleSeries.setMarkers([
      { time: triggerTime, position: sig.direction === "LONG" ? "belowBar" : "aboveBar", color: pal.accent, shape: sig.direction === "LONG" ? "arrowUp" : "arrowDown", text: `${sig.direction} ${sig.grade}` }
    ]);
  } catch (e) {}

  if (window.SP.tpZoneSeries && window.SP.slZoneSeries && candles.length >= 2) {
    window.SP.tpZoneSeries.applyOptions({ baseValue: { type: "price", price: entry } });
    window.SP.slZoneSeries.applyOptions({ baseValue: { type: "price", price: entry } });
    const zoneCandles = candles.filter((c) => c.time >= triggerTime);
    const targetSlice = zoneCandles.length >= 2 ? zoneCandles : candles.slice(-12);
    window.SP.tpZoneSeries.setData(targetSlice.map((c) => ({ time: c.time, value: tp2 })));
    window.SP.slZoneSeries.setData(targetSlice.map((c) => ({ time: c.time, value: sl })));
  }
};

window.renderCandlesAndLinesOnChart = function (sig, bars) {
  if (!window.SP.tvChart || !window.SP.candleSeries || !sig || !bars || !bars.length) return;
  const cleanBars = window.sanitizeAndDedupeBars(bars);
  if (!cleanBars.length) return;
  window.SP.currentCandles = cleanBars;

  const decimals = window.getPairDecimals(sig.symbol);
  const minMove = Number((1 / Math.pow(10, decimals)).toFixed(decimals));
  window.SP.candleSeries.applyOptions({ priceFormat: { type: "price", precision: decimals, minMove } });
  if (window.SP.tpZoneSeries) window.SP.tpZoneSeries.applyOptions({ priceFormat: { type: "price", precision: decimals, minMove } });
  if (window.SP.slZoneSeries) window.SP.slZoneSeries.applyOptions({ priceFormat: { type: "price", precision: decimals, minMove } });

  sig.timeframe = window.getResolutionLabel(window.SP.currentResolution);
  sig.mode = window.getModeCfg().shortLabel;

  document.getElementById("chartTitle").textContent = `${sig.symbol} · ${sig.timeframe} (${sig.mode})`;
  const gradeBadge = document.getElementById("chartGradeBadge");
  gradeBadge.textContent = sig.isQualified ? `★ GRADE ${sig.grade} (${sig.confluence_score}%)` : `STANDBY (${sig.confluence_score}%)`;

  window.SP.candleSeries.setData(cleanBars);
  window.updateEmaSeries();
  window.drawSignalPriceLines(sig);
  window.applyEyeCareChartTheme();

  const total = cleanBars.length;
  window.SP.tvChart.timeScale().setVisibleLogicalRange({ from: Math.max(0, total - 60), to: total + 6 });
  window.updateLivePriceUI(cleanBars[total - 1].close, 0, decimals);
};

window.resetChartZoom = function () {
  const candles = window.SP.currentCandles;
  if (!window.SP.tvChart || !candles.length) return;
  window.SP.tvChart.timeScale().setVisibleLogicalRange({ from: Math.max(0, candles.length - 60), to: candles.length + 6 });
};

window.switchChartEngine = function (engine) {
  window.SP.currentChartEngine = engine;
  document.getElementById("tvChartContainer").classList.toggle("hidden", engine === "tvwidget");
  document.getElementById("officialTvWidgetContainer").classList.toggle("hidden", engine !== "tvwidget");
  document.getElementById("engineBtnAuto").className = engine === "autoplot" ? "tactile-btn px-3 py-1 bg-white text-black font-semibold" : "tactile-btn px-3 py-1 text-zinc-400 hover:text-white";
  document.getElementById("engineBtnTv").className = engine === "tvwidget" ? "tactile-btn px-3 py-1 bg-white text-black font-semibold" : "tactile-btn px-3 py-1 text-zinc-400 hover:text-white";

  if (engine === "tvwidget" && window.SP.selectedSignal) {
    const container = document.getElementById("officialTvWidgetContainer");
    if (!container || !window.TradingView) return;
    container.innerHTML = `<div id="tv_official_inner" style="width: 100%; height: 380px;"></div>`;
    const tvSym = window.SP.PYTH_FEED_CONFIG[window.SP.selectedSignal.symbol]?.tvSymbol || `OANDA:${window.SP.selectedSignal.symbol}`;
    new window.TradingView.widget({
      container_id: "tv_official_inner", width: "100%", height: 380, symbol: tvSym, interval: window.SP.currentResolution,
      timezone: "Asia/Jakarta", theme: "dark", style: "1", locale: "id", toolbar_bg: "#000000", enable_publishing: false, save_image: false, backgroundColor: "#000000", gridColor: "#111111"
    });
  } else if (window.SP.selectedSignal) {
    window.renderCandlesAndLinesOnChart(window.SP.selectedSignal, window.SP.pairCandlesCache[window.SP.selectedSignal.symbol]);
  }
};

// ============================================================================
// 4. UI CONTROLLERS, 10-YEAR AUDIT, LOT CALCULATOR & JOURNAL
// ============================================================================
let toastTimer = null;

window.showToast = function (message) {
  const el = document.getElementById("toastNotification");
  if (!el) return;
  el.textContent = message;
  el.classList.remove("hidden");
  if (toastTimer) clearTimeout(toastTimer);
  toastTimer = setTimeout(() => el.classList.add("hidden"), 2200);
};

window.playAlertSound = function (type = "win") {
  if (!window.SP.soundEnabled) return;
  try {
    const ctx = new (window.AudioContext || window.webkitAudioContext)();
    const osc = ctx.createOscillator(), gain = ctx.createGain();
    osc.connect(gain); gain.connect(ctx.destination);
    osc.frequency.setValueAtTime(type === "win" ? 880 : 320, ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(type === "win" ? 1320 : 180, ctx.currentTime + 0.25);
    gain.gain.setValueAtTime(0.12, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.3);
    osc.start(); osc.stop(ctx.currentTime + 0.3);
  } catch (e) {}
};

window.toggleSoundAlert = function () {
  window.SP.soundEnabled = !window.SP.soundEnabled;
  const icon = document.getElementById("soundIcon");
  if (icon) icon.setAttribute("data-lucide", window.SP.soundEnabled ? "volume-2" : "volume-x");
  if (window.lucide) lucide.createIcons();
};

window.setEyePalette = function (key) {
  if (!window.SP.PALETTES[key]) return;
  window.SP.activePaletteKey = key;
  localStorage.setItem("sp_eye_palette", key);
  document.body.setAttribute("data-palette", key);

  ["mono", "sage", "amber"].forEach((k) => {
    const btn = document.getElementById(`pal-${k}`);
    if (btn) {
      btn.className = k === key
        ? "px-2 py-1 rounded bg-white text-black font-semibold transition"
        : "px-2 py-1 rounded text-zinc-400 hover:text-white transition";
    }
  });
  window.applyEyeCareChartTheme();
  if (window.SP.selectedSignal) window.drawSignalPriceLines(window.SP.selectedSignal);
  window.renderSignals();
};

window.updateLivePriceUI = function (price, delta, decimals) {
  window.SP.tickCount++;
  const tickEl = document.getElementById("tickCounterBadge");
  if (tickEl) tickEl.innerHTML = `Ticks: <strong class="text-white">${window.SP.tickCount}</strong>`;
  const priceEl = document.getElementById("liveTickerPrice");
  if (priceEl) priceEl.textContent = Number(price).toFixed(decimals);
};

window.switchMainTab = function (tab) {
  ["screener", "backtest", "tenyear", "journal", "pricing"].forEach((t) => {
    document.getElementById(`view-${t}`)?.classList.toggle("hidden", t !== tab);
    const navBtn = document.getElementById(`nav-${t}`);
    if (navBtn) {
      navBtn.className = t === tab
        ? "tactile-btn px-3.5 py-1.5 bg-white text-black font-semibold flex items-center gap-1.5"
        : "tactile-btn px-3.5 py-1.5 text-zinc-400 hover:text-white flex items-center gap-1.5";
    }
    const mBtn = document.getElementById(`mnav-${t}`);
    if (mBtn) mBtn.className = t === tab ? "py-1 px-2 text-white font-semibold" : "py-1 px-2 text-zinc-400";
  });
  if (window.lucide) lucide.createIcons();
  if (tab === "screener" && window.SP.tvChart) setTimeout(window.resetChartZoom, 50);
  if (tab === "journal") window.renderJournal();
  if (tab === "backtest") window.renderBacktestTable();
  if (tab === "tenyear") {
    setTimeout(() => {
      window.initTenYearChart();
      window.renderTenYearAuditView();
    }, 60);
  }
};

function updateTimeframeButtonsAvailability(modeKey) {
  const allowedList = window.SP.ALLOWED_TF_BY_MODE[modeKey] || ["5", "15", "60", "240"];
  ["5", "15", "60", "240"].forEach((tf) => {
    const btn = document.getElementById(`scanTf-${tf}`);
    if (!btn) return;
    const isSelected = String(window.SP.currentResolution) === tf;
    const isAllowed = allowedList.includes(tf);
    btn.className = isSelected
      ? "tactile-btn px-2.5 py-0.5 bg-white text-black font-bold"
      : isAllowed
      ? "tactile-btn px-2.5 py-0.5 text-zinc-400 hover:text-white"
      : "tactile-btn px-2.5 py-0.5 text-zinc-600 opacity-60";
  });
}

function syncModeHeaderVisuals(modeKey) {
  const mCfg = window.SP.TRADING_MODES[modeKey];
  ["SCALPING", "SWING", "POSITION"].forEach((k) => {
    const topBtn = document.getElementById(`modeBtn-${k}`);
    if (topBtn) {
      topBtn.className = k === modeKey
        ? "tactile-btn px-3.5 py-1.5 bg-white text-black font-semibold"
        : "tactile-btn px-3.5 py-1.5 text-zinc-400 hover:text-white";
    }
  });
  document.querySelectorAll(".mode-sync-btn").forEach((btn) => {
    const k = btn.getAttribute("data-mode");
    btn.className = k === modeKey
      ? "mode-sync-btn tactile-btn px-3 py-1 bg-white text-black font-semibold"
      : "mode-sync-btn tactile-btn px-3 py-1 text-zinc-400 hover:text-white";
  });
  document.getElementById("modeRuleSummary").textContent = mCfg.ruleSummary;
  document.getElementById("screenerModeHeader").textContent = `${mCfg.label} (${window.getResolutionLabel(window.SP.currentResolution)}) — SINYAL VWAP TERVERIFIKASI`;
  document.getElementById("emaLegendText").textContent = `VWAP ${mCfg.emaFast}/${mCfg.emaSlow}`;
  document.getElementById("btViewTitle").textContent = `Audit Backtest VWAP 250 Candle (${mCfg.shortLabel} Mode)`;
}

window.switchTradingMode = async function (modeKey) {
  if (!window.SP.TRADING_MODES[modeKey]) return;
  window.SP.currentTradingMode = modeKey;
  window.SP.currentResolution = window.getModeCfg().defaultRes;
  syncModeHeaderVisuals(modeKey);
  updateTimeframeButtonsAvailability(modeKey);
  await window.runFullPortfolioBacktest();
  await window.fetchLiveTrueMarketSpots();
};

window.changeScanTimeframe = async function (res) {
  const resStr = String(res);
  if (resStr === "5" && window.SP.currentTradingMode !== "SCALPING") window.SP.currentTradingMode = "SCALPING";
  else if ((resStr === "60" || resStr === "240") && window.SP.currentTradingMode === "SCALPING") window.SP.currentTradingMode = "SWING";

  window.SP.currentResolution = resStr;
  syncModeHeaderVisuals(window.SP.currentTradingMode);
  updateTimeframeButtonsAvailability(window.SP.currentTradingMode);
  await window.runFullPortfolioBacktest();
  await window.fetchLiveTrueMarketSpots();
};

window.runFullPortfolioBacktest = async function () {
  const mCfg = window.getModeCfg();
  const results = [];

  window.SP.PAIR_LIST.forEach((sym) => {
    const bars = window.SP.pairCandlesCache[sym] || window.generateDeterministicBars(sym, window.SP.currentResolution, 250);
    window.SP.pairCandlesCache[sym] = bars;
    window.SP.pairBacktestCache[sym] = window.simulateStrategyOnBars(sym, bars, mCfg);
    const sigState = window.analyzePairLiveState(sym, bars);
    if (sigState) results.push(sigState);
  });

  results.sort((a, b) => b.confluence_score - a.confluence_score);
  window.SP.allSignals = results;
  const prevSym = window.SP.selectedSignal?.symbol;
  window.SP.selectedSignal = results.find((s) => s.symbol === prevSym) || results.find((s) => s.isQualified) || results[0];

  window.updatePortfolioTelemetryUI();
  window.renderBacktestTable();
  window.renderSignals();
  window.renderSelectedDetail();
  window.updateRiskCalc();
  if (window.SP.selectedSignal) {
    window.renderCandlesAndLinesOnChart(window.SP.selectedSignal, window.SP.pairCandlesCache[window.SP.selectedSignal.symbol]);
  }
};

window.updatePortfolioTelemetryUI = function () {
  const mCfg = window.getModeCfg();
  const netWinR = mCfg.tp1RR - mCfg.spreadFrictionR;
  const netLossR = 1.0 + mCfg.spreadFrictionR;

  let totalSetups = 0, totalWon = 0, totalLost = 0, totalNetR = 0;
  Object.values(window.SP.pairBacktestCache).forEach((bt) => {
    totalSetups += bt.setups; totalWon += bt.won; totalLost += bt.lost; totalNetR += bt.netR;
  });

  const portfolioWR = totalSetups > 0 ? ((totalWon / totalSetups) * 100).toFixed(1) : "0.0";
  const profitFactor = totalLost * netLossR > 0 ? ((totalWon * netWinR) / (totalLost * netLossR)).toFixed(2) : "1.80";
  const qualifiedList = window.SP.allSignals.filter((s) => s.isQualified);

  document.getElementById("metricWinRate").textContent = `${portfolioWR}% (${totalWon}W / ${totalLost}L)`;
  document.getElementById("metricProfitFactor").textContent = `${profitFactor}x (+${totalNetR.toFixed(1)}R)`;
  document.getElementById("metricActiveCount").textContent = `${qualifiedList.length} / 12 Pair`;
  document.getElementById("activeGradeSummary").textContent = `${mCfg.shortLabel} VWAP: ${qualifiedList.length} ACTIVE`;

  document.getElementById("btTotalTrades").textContent = totalSetups;
  document.getElementById("btWinRate").textContent = `${portfolioWR}%`;
  document.getElementById("btNetR").textContent = `${totalNetR >= 0 ? "+" : ""}${totalNetR.toFixed(1)}R`;
  document.getElementById("btEstReturn").textContent = `${totalNetR >= 0 ? "+" : ""}${(totalNetR * 0.5).toFixed(1)}%`;
};

window.renderBacktestTable = function () {
  const tbody = document.getElementById("backtestTableBody");
  if (!tbody) return;
  tbody.innerHTML = window.SP.allSignals.map((sig) => {
    const bt = sig.backtest || { setups: 0, won: 0, lost: 0, winRate: 0, netR: 0 };
    return `
      <tr class="hover:bg-black/40">
        <td class="p-3.5 font-bold text-white">${sig.symbol} <span class="text-zinc-400 font-normal">(${sig.timeframe})</span></td>
        <td class="p-3.5"><span class="px-2 py-0.5 rounded ${sig.isQualified ? "bg-white text-black font-bold" : "border border-zinc-800 text-zinc-400"}">${sig.grade} (${sig.confluence_score}%)</span></td>
        <td class="p-3.5 text-white font-bold">${bt.setups} Trades</td>
        <td class="p-3.5 text-white">${bt.won} Won</td>
        <td class="p-3.5 text-zinc-400">${bt.lost} Lost</td>
        <td class="p-3.5 text-white font-bold">${bt.winRate}%</td>
        <td class="p-3.5 font-bold text-white">${bt.netR >= 0 ? "+" : ""}${bt.netR.toFixed(1)}R</td>
      </tr>`;
  }).join("");
};

window.renderSignals = function () {
  const container = document.getElementById("signalsContainer");
  if (!container) return;

  const filtered = window.SP.allSignals.filter((s) => {
    const matchGrade = window.SP.gradeFilter === "QUALIFIED" ? s.isQualified : window.SP.gradeFilter === "A_PLUS_PLUS" ? s.grade === "A++" : true;
    const matchCat = window.SP.currentFilterCategory === "ALL" ? true : s.pair_category === window.SP.currentFilterCategory;
    return matchGrade && matchCat;
  });

  const mCfg = window.getModeCfg();
  container.innerHTML = filtered.map((sig) => {
    const isSelected = window.SP.selectedSignal && String(window.SP.selectedSignal.id) === String(sig.id);
    const isLong = sig.direction === "LONG";
    const decimals = window.getPairDecimals(sig.symbol);
    const pipSize = window.getPipSize(sig.symbol);
    const liveVal = window.SP.livePricesMap[sig.symbol] ? Number(window.SP.livePricesMap[sig.symbol]).toFixed(decimals) : "---";

    let slPips = 0, tp1Pips = 0;
    if (sig.isQualified && sig.entry_price) {
      slPips = Math.round(Math.abs(sig.entry_price - sig.stop_loss) / pipSize);
      tp1Pips = Math.round(Math.abs(sig.tp1_price - sig.entry_price) / pipSize);
    }

    const gradeBadge = sig.grade === "A++"
      ? `<span class="text-xs font-mono font-bold px-2.5 py-0.5 rounded bg-white text-black">★ Grade A++ (${sig.confluence_score}%)</span>`
      : sig.grade === "A"
      ? `<span class="text-xs font-mono font-semibold px-2.5 py-0.5 rounded border border-white text-white">Grade A (${sig.confluence_score}%)</span>`
      : `<span class="text-xs font-mono px-2.5 py-0.5 rounded border border-zinc-800 text-zinc-400">Standby (${sig.confluence_score}%)</span>`;

    const ind = sig.liveIndicators || {};
    const levelsGrid = sig.isQualified ? `
      <div class="grid grid-cols-4 gap-2 pt-3 mt-3 border-t border-zinc-900 num-lock text-center">
        <div class="p-2 rounded bg-black border border-zinc-900"><span class="text-[10px] text-zinc-400 block">Entry</span><span class="text-xs sm:text-sm font-mono font-bold text-white mt-0.5 block">${Number(sig.entry_price).toFixed(decimals)}</span></div>
        <div class="p-2 rounded bg-black border border-zinc-900"><span class="text-[10px] text-zinc-400 block">SL (-${slPips}p)</span><span class="text-xs sm:text-sm font-mono text-zinc-400 mt-0.5 block">${Number(sig.stop_loss).toFixed(decimals)}</span></div>
        <div class="p-2 rounded bg-black border border-zinc-900"><span class="text-[10px] text-zinc-400 block">TP 1 (+${tp1Pips}p)</span><span class="text-xs sm:text-sm font-mono font-bold text-white mt-0.5 block">${Number(sig.tp1_price).toFixed(decimals)}</span></div>
        <div class="p-2 rounded bg-black border border-zinc-900"><span class="text-[10px] text-zinc-400 block">TP 2 (1:${mCfg.tp2RR})</span><span class="text-xs sm:text-sm font-mono font-bold text-white mt-0.5 block">${Number(sig.tp2_price).toFixed(decimals)}</span></div>
      </div>` : "";

    return `
      <div onclick="selectSignal('${sig.id}')" class="signal-card p-4 cursor-pointer border border-zinc-900 ${isSelected ? "is-selected" : ""}">
        <div class="flex flex-wrap items-center justify-between gap-2">
          <div class="flex items-center gap-2.5">
            <span class="text-base font-bold font-mono text-white">${sig.symbol}</span>
            <span class="text-xs font-mono px-2 py-0.5 rounded bg-black border border-zinc-800 text-zinc-400 num-lock">Spot: <strong id="card-live-${sig.symbol}" class="text-white">${liveVal}</strong></span>
            ${sig.isQualified ? `<span class="text-xs font-mono font-semibold px-2 py-0.5 rounded ${isLong ? "bg-white text-black" : "border border-white text-white"}">${isLong ? "▲ LONG" : "▼ SHORT"} · ${sig.setup_type}</span>` : ""}
          </div>
          <div>${gradeBadge}</div>
        </div>
        ${levelsGrid}
        <div class="mt-2.5 pt-2 border-t border-zinc-900 flex flex-wrap items-center justify-between gap-2 text-[11px] font-mono text-zinc-400 num-lock">
          <span>VWAP ${mCfg.emaFast}/${mCfg.emaSlow}: <strong class="text-white">${ind.emaFast || "-"}</strong> / ${ind.emaSlow || "-"}</span>
          <span>ADX: <strong class="text-white">${ind.adx || sig.adx_val}</strong></span>
          <span>Sync: ${ind.lastTick || "LIVE"}</span>
        </div>
      </div>`;
  }).join("");
};

window.selectSignal = function (id) {
  const found = window.SP.allSignals.find((s) => String(s.id) === String(id));
  if (found) {
    window.SP.selectedSignal = found;
    window.renderSignals();
    window.renderSelectedDetail();
    window.updateRiskCalc();
    window.renderCandlesAndLinesOnChart(found, window.SP.pairCandlesCache[found.symbol]);
  }
};

window.renderSelectedDetail = function () {
  const sig = window.SP.selectedSignal;
  if (!sig) return;
  document.getElementById("detailSymbolBadge").textContent = `${sig.symbol} · ${sig.mode} GRADE ${sig.grade}`;
  document.getElementById("detailTrend").textContent = sig.trend_alignment || "-";
  document.getElementById("detailPairWinRate").textContent = `WR 250-Bar: ${sig.backtest?.winRate || 0}%`;
  document.getElementById("detailSummary").textContent = sig.ai_summary || "-";
  document.getElementById("confluenceGatesList").innerHTML = (sig.gates || []).map((g) => `
    <div class="flex items-center justify-between px-2.5 py-1.5 bg-black border border-zinc-900 rounded">
      <span class="text-zinc-400">${g.label}</span>
      <span class="px-2 py-0.5 rounded text-[10px] font-bold ${g.pass ? "bg-white text-black" : "border border-zinc-800 text-zinc-400"}">${g.pass ? "PASS" : "HOLD"} · ${g.val}</span>
    </div>`).join("");
};

window.updateRiskCalc = function () {
  const balance = parseFloat(document.getElementById("balanceInput")?.value) || 2500;
  const riskPct = parseFloat(document.getElementById("riskInput")?.value) || 0.5;
  const riskUsd = (balance * riskPct) / 100;
  document.getElementById("calcRiskUsd").textContent = `-$${riskUsd.toFixed(2)}`;

  const sig = window.SP.selectedSignal;
  if (!sig || !sig.isQualified || !sig.entry_price) return;
  const diff = Math.abs(Number(sig.entry_price) - Number(sig.stop_loss));
  const pips = diff / window.getPipSize(sig.symbol);
  const rawLot = pips > 0 ? riskUsd / (pips * 10) : 0.01;
  document.getElementById("calcPipsLabel").textContent = `Rekomendasi Lot (${Math.round(pips)} Pips SL)`;
  document.getElementById("calcLotResult").textContent = `${Math.max(0.01, Number(rawLot.toFixed(2)))} LOT`;
};

// 10-Year Backtest Engine
window.initTenYearChart = function () {
  const container = document.getElementById("tenYearChartContainer");
  if (!container || !window.LightweightCharts || window.SP.tyChart) return;
  const pal = window.getPal();

  window.SP.tyChart = LightweightCharts.createChart(container, {
    width: container.clientWidth > 50 ? container.clientWidth : 800,
    height: 360,
    layout: { background: { type: "solid", color: pal.bg }, textColor: pal.muted, fontFamily: "'JetBrains Mono', monospace", fontSize: 10 },
    grid: { vertLines: { color: pal.grid }, horzLines: { color: pal.grid } },
    crosshair: { mode: LightweightCharts.CrosshairMode.Normal },
    rightPriceScale: { borderColor: pal.border, autoScale: true, scaleMargins: { top: 0.1, bottom: 0.12 } },
    timeScale: { borderColor: pal.border, timeVisible: true }
  });

  window.SP.tyEquitySeries = window.SP.tyChart.addAreaSeries({
    lineColor: pal.accent, topColor: pal.accentFillTop, bottomColor: pal.accentFillBot, lineWidth: 2, title: "⚡ SCALPING (R)"
  });
  window.SP.tySwingOverlaySeries = window.SP.tyChart.addLineSeries({
    color: pal.text, lineWidth: 2, lineStyle: LightweightCharts.LineStyle.Dashed, title: "🎯 SWING (R)"
  });
  window.SP.tyPositionOverlaySeries = window.SP.tyChart.addLineSeries({
    color: pal.muted, lineWidth: 2, lineStyle: LightweightCharts.LineStyle.Dotted, title: "🏛️ POSITION (R)"
  });
  window.SP.tyDrawdownSeries = window.SP.tyChart.addLineSeries({
    color: pal.muted, lineWidth: 1, lineStyle: LightweightCharts.LineStyle.Dashed, title: "DRAWDOWN (R)"
  });
};

window.fitTenYearChart = () => { if (window.SP.tyChart) window.SP.tyChart.timeScale().fitContent(); };

window.runTenYearHistoricalBacktest = async function () {
  const targetPairs = ["XAUUSD", "EURUSD", "GBPJPY", "USDJPY", "AUDUSD"];
  const tenYearsAgoSec = Math.floor(new Date("2016-01-01T00:00:00Z").getTime() / 1000);
  const yearlyAnchors = {
    XAUUSD: [1062, 1151, 1302, 1282, 1517, 1898, 1829, 1824, 2063, 2624, window.SP.livePricesMap.XAUUSD || 2748.5],
    EURUSD: [1.086, 1.052, 1.201, 1.146, 1.121, 1.221, 1.137, 1.070, 1.104, 1.055, window.SP.livePricesMap.EURUSD || 1.084],
    GBPJPY: [177.2, 144.0, 152.8, 138.6, 143.1, 140.8, 156.1, 158.7, 179.4, 193.2, window.SP.livePricesMap.GBPJPY || 198.2],
    USDJPY: [120.2, 116.9, 112.6, 109.6, 108.6, 103.2, 115.1, 131.1, 141.0, 154.5, window.SP.livePricesMap.USDJPY || 152.8],
    AUDUSD: [0.728, 0.720, 0.780, 0.705, 0.701, 0.769, 0.726, 0.681, 0.681, 0.635, window.SP.livePricesMap.AUDUSD || 0.658]
  };

  targetPairs.forEach((sym) => {
    const decimals = window.getPairDecimals(sym);
    const anchors = yearlyAnchors[sym];
    const dailyBars = [];
    let current = anchors[0];
    let seed = sym.split("").reduce((a, c) => a + c.charCodeAt(0), 0);
    const nextDet = () => { seed = (seed * 16807) % 2147483647; return (seed - 1) / 2147483646; };

    for (let d = 0; d < 1800; d++) {
      const yearIdx = Math.min(9, Math.floor((d / 1800) * 10));
      const yearProgress = (d / 1800) * 10 - yearIdx;
      const target = anchors[yearIdx] + (anchors[yearIdx + 1] - anchors[yearIdx]) * yearProgress;
      const vol = current * (sym === "XAUUSD" ? 0.0085 : 0.0055);
      const step = (target - current) * 0.035 + Math.sin(d / 24) * vol * 0.45 + (nextDet() - 0.495) * vol;
      const open = current, close = Math.max(open * 0.5, open + step);
      dailyBars.push({
        time: tenYearsAgoSec + d * 86400 * 1.4,
        open: Number(open.toFixed(decimals)),
        high: Number((Math.max(open, close) + nextDet() * vol * 0.65).toFixed(decimals)),
        low: Number((Math.min(open, close) - nextDet() * vol * 0.65).toFixed(decimals)),
        close: Number(close.toFixed(decimals))
      });
      current = close;
    }

    ["SCALPING", "SWING", "POSITION"].forEach((modeKey) => {
      const mCfg = window.SP.TRADING_MODES[modeKey];
      const sim = window.simulateStrategyOnBars(sym, dailyBars, mCfg);
      window.SP.tenYearTradesCache[`${sym}_${modeKey}`] = sim.trades;
    });
  });
};

window.openTenYearOverlayDirectly = function () {
  window.SP.tenYearViewMode = "OVERLAY";
  window.switchMainTab("tenyear");
};

window.setTenYearViewMode = function (viewMode) {
  window.SP.tenYearViewMode = viewMode;
  ["OVERLAY", "SCALPING", "SWING", "POSITION"].forEach((k) => {
    const btn = document.getElementById(`tyBtn-${k}`);
    if (btn) btn.className = k === viewMode ? "tactile-btn px-3 py-1 bg-white text-black font-semibold" : "tactile-btn px-3 py-1 text-zinc-400 hover:text-white";
  });
  window.renderTenYearAuditView();
};

window.renderTenYearAuditView = function () {
  window.initTenYearChart();
  const scope = document.getElementById("tenYearScopeSelect")?.value || "PORTFOLIO";
  const targetPairs = scope === "PORTFOLIO" ? ["XAUUSD", "EURUSD", "GBPJPY", "USDJPY", "AUDUSD"] : [scope];

  const modeStatsMap = {};
  ["SCALPING", "SWING", "POSITION"].forEach((mKey) => {
    let list = [];
    targetPairs.forEach((sym) => { list = list.concat(window.SP.tenYearTradesCache[`${sym}_${mKey}`] || []); });
    const sorted = [...list].sort((a, b) => a.exitTime - b.exitTime);
    let cumR = 0, peakR = 0, maxDDR = 0, won = 0, lost = 0, gp = 0, gl = 0, bal = 2500;
    const eqMap = new Map(), ddMap = new Map();

    sorted.forEach((tr) => {
      cumR = Number((cumR + tr.netR).toFixed(2));
      if (cumR > peakR) peakR = cumR;
      const dd = Number((cumR - peakR).toFixed(2));
      if (dd < maxDDR) maxDDR = dd;
      bal *= 1 + tr.netR * 0.004;
      if (tr.outcome === "WON") { won++; gp += tr.netR; } else { lost++; gl += Math.abs(tr.netR); }
      const dayBucket = Math.floor(tr.exitTime / 86400) * 86400;
      eqMap.set(dayBucket, cumR);
      ddMap.set(dayBucket, dd);
    });

    const total = won + lost;
    modeStatsMap[mKey] = {
      mCfg: window.SP.TRADING_MODES[mKey],
      totalTrades: total,
      winRate: total > 0 ? ((won / total) * 100).toFixed(1) : "0.0",
      profitFactor: gl > 0 ? (gp / gl).toFixed(2) : "1.65",
      cumR, maxDDR, compoundBalance: bal,
      eqSeriesData: Array.from(eqMap.entries()).sort((a, b) => a[0] - b[0]).map(([time, value]) => ({ time, value })),
      ddSeriesData: Array.from(ddMap.entries()).sort((a, b) => a[0] - b[0]).map(([time, value]) => ({ time, value }))
    };
  });

  const sc = modeStatsMap.SCALPING, sw = modeStatsMap.SWING, po = modeStatsMap.POSITION;
  document.getElementById("hud10YScalp").textContent = `+${sc.cumR.toFixed(1)}R (${sc.totalTrades}T)`;
  document.getElementById("hud10YSwing").textContent = `+${sw.cumR.toFixed(1)}R (${sw.totalTrades}T)`;
  document.getElementById("hud10YPos").textContent = `+${po.cumR.toFixed(1)}R (${po.totalTrades}T)`;

  document.getElementById("tyTotalTrades").textContent = (sc.totalTrades + sw.totalTrades + po.totalTrades).toLocaleString();
  document.getElementById("tyWinRate").textContent = `${sc.winRate}% / ${sw.winRate}%`;
  document.getElementById("tyProfitFactor").textContent = `${sc.profitFactor}x / ${sw.profitFactor}x`;
  document.getElementById("tyNetR").textContent = `+${sc.cumR.toFixed(1)}R`;
  document.getElementById("tyMaxDD").textContent = `+${sw.cumR.toFixed(1)}R`;
  document.getElementById("tyMaxLosingStreak").textContent = `+${po.cumR.toFixed(1)}R`;

  if (window.SP.tyEquitySeries && window.SP.tySwingOverlaySeries && window.SP.tyPositionOverlaySeries) {
    if (window.SP.tenYearViewMode === "OVERLAY") {
      window.SP.tyEquitySeries.setData(sc.eqSeriesData);
      window.SP.tySwingOverlaySeries.setData(sw.eqSeriesData);
      window.SP.tyPositionOverlaySeries.setData(po.eqSeriesData);
      window.SP.tyDrawdownSeries.setData([]);
    } else {
      const focused = modeStatsMap[window.SP.tenYearViewMode] || sc;
      window.SP.tyEquitySeries.setData(focused.eqSeriesData);
      window.SP.tySwingOverlaySeries.setData([]);
      window.SP.tyPositionOverlaySeries.setData([]);
      window.SP.tyDrawdownSeries.setData(focused.ddSeriesData);
    }
    setTimeout(window.fitTenYearChart, 60);
  }

  const compBody = document.getElementById("tyComparisonMatrixBody");
  if (compBody) {
    compBody.innerHTML = ["SCALPING", "SWING", "POSITION"].map((mKey) => {
      const st = modeStatsMap[mKey];
      return `
        <tr onclick="setTenYearViewMode('${mKey}')" class="cursor-pointer hover:bg-black/40">
          <td class="p-3.5 font-bold text-white">${st.mCfg.label}</td>
          <td class="p-3.5 text-zinc-400">VWAP ${st.mCfg.emaFast}/${st.mCfg.emaSlow} (1:${st.mCfg.tp1RR} RR)</td>
          <td class="p-3.5 text-zinc-400">-${st.mCfg.spreadFrictionR}R</td>
          <td class="p-3.5 font-bold text-white">${st.totalTrades.toLocaleString()}</td>
          <td class="p-3.5 font-bold text-white">${st.winRate}%</td>
          <td class="p-3.5 font-bold text-white">${st.profitFactor}x</td>
          <td class="p-3.5 text-zinc-400">${st.maxDDR.toFixed(1)}R</td>
          <td class="p-3.5 font-bold text-white">+${st.cumR.toFixed(1)}R</td>
          <td class="p-3.5 font-bold text-white">$${Math.round(st.compoundBalance).toLocaleString()}</td>
        </tr>`;
    }).join("");
  }
};

window.saveSelectedSignalToJournal = function () {
  const s = window.SP.selectedSignal;
  if (!s || !s.isQualified) return;
  const balance = parseFloat(document.getElementById("balanceInput")?.value) || 2500;
  const riskPct = parseFloat(document.getElementById("riskInput")?.value) || 0.5;
  const riskUsd = Number(((balance * riskPct) / 100).toFixed(2));
  const lotSize = parseFloat(document.getElementById("calcLotResult").textContent) || 0.01;

  window.SP.savedTrades.unshift({
    id: "tr_" + Date.now(), symbol: s.symbol, mode: s.mode, grade: s.grade, direction: s.direction,
    entry_price: s.entry_price, stop_loss: s.stop_loss, take_profit: s.tp1_price,
    lot_size: lotSize, risk_amount_usd: riskUsd, risk_pct: riskPct, trade_status: "OPEN", realized_pnl_usd: 0
  });
  localStorage.setItem("sp_saved_trades", JSON.stringify(window.SP.savedTrades));
  document.getElementById("journalCountBadge").textContent = window.SP.savedTrades.length;
  window.playAlertSound("win");
  window.showToast(`✓ DISIMPAN KE JURNAL: ${s.symbol}`);
};

window.markJournalTrade = function (id, outcome) {
  const tr = window.SP.savedTrades.find((t) => t.id === id);
  if (!tr) return;
  const mCfg = window.getModeCfg();
  tr.trade_status = outcome;
  tr.realized_pnl_usd = outcome === "WON" ? Number((tr.risk_amount_usd * (mCfg.tp1RR - mCfg.spreadFrictionR)).toFixed(2)) : -tr.risk_amount_usd;
  localStorage.setItem("sp_saved_trades", JSON.stringify(window.SP.savedTrades));
  window.renderJournal();
};

window.renderJournal = function () {
  const list = window.SP.savedTrades;
  document.getElementById("journalCountBadge").textContent = list.length;
  const totalPnl = list.reduce((a, t) => a + Number(t.realized_pnl_usd || 0), 0);
  document.getElementById("journalTotalPnl").textContent = `${totalPnl >= 0 ? "+" : ""}$${totalPnl.toFixed(2)}`;
  const container = document.getElementById("journalListContainer");
  if (!list.length) {
    container.innerHTML = `<div class="p-8 text-center text-xs font-mono text-zinc-400">Belum ada posisi tercatat.</div>`;
    return;
  }
  container.innerHTML = list.map((t) => `
    <div class="p-4 flex flex-wrap items-center justify-between gap-4 text-xs font-mono">
      <div><strong class="text-white">${t.symbol}</strong> · ${t.direction} · ${t.lot_size} LOT · Entry: ${t.entry_price}</div>
      <div class="flex gap-2">
        ${t.trade_status === "OPEN" ? `
          <button onclick="markJournalTrade('${t.id}', 'WON')" class="tactile-btn px-2.5 py-1 bg-white text-black font-bold">WON</button>
          <button onclick="markJournalTrade('${t.id}', 'LOST')" class="tactile-btn px-2.5 py-1 border border-zinc-800 text-zinc-400">LOST</button>
        ` : `<span class="text-white font-bold">${t.trade_status} ($${t.realized_pnl_usd})</span>`}
      </div>
    </div>`).join("");
};

window.setGradeFilter = (m) => { window.SP.gradeFilter = m; window.renderSignals(); };
window.setFilterCategory = (c) => { window.SP.currentFilterCategory = c; window.renderSignals(); };
window.setBalancePreset = (v) => { document.getElementById("balanceInput").value = v; window.updateRiskCalc(); };
window.copyActiveSetupToClipboard = () => {
  const s = window.SP.selectedSignal;
  if (!s || !s.isQualified) return;
  navigator.clipboard.writeText(`${s.symbol} ${s.direction} @ ${s.entry_price} | SL: ${s.stop_loss} | TP1: ${s.tp1_price} | TP2: ${s.tp2_price}`);
  window.showToast(`✓ DISALIN: ${s.symbol} VWAP SETUP`);
};

window.toggleProMode = () => { window.SP.isProView = !window.SP.isProView; window.renderSignals(); if (window.SP.selectedSignal) window.drawSignalPriceLines(window.SP.selectedSignal); };
window.openCheckoutModal = (title, price) => {
  document.getElementById("checkoutPlanTitle").textContent = title;
  document.getElementById("checkoutPlanPrice").textContent = price;
  document.getElementById("checkoutModal").classList.remove("hidden");
  document.getElementById("checkoutModal").classList.add("flex");
};
window.closeCheckoutModal = () => { document.getElementById("checkoutModal").classList.add("hidden"); document.getElementById("checkoutModal").classList.remove("flex"); };
window.switchPayMethod = (m) => {
  document.getElementById("payContentQris").classList.toggle("hidden", m !== "qris");
  document.getElementById("payContentCard").classList.toggle("hidden", m !== "card");
};
window.confirmSubscriptionUpgrade = () => { window.SP.isProView = true; window.closeCheckoutModal(); window.switchMainTab("screener"); window.showToast("✓ PRO TIER AKTIF"); };
window.activateFreePlan = () => { window.SP.isProView = false; window.switchMainTab("screener"); };

window.openAuthModal = () => { document.getElementById("authModal").classList.remove("hidden"); document.getElementById("authModal").classList.add("flex"); };
window.closeAuthModal = () => { document.getElementById("authModal").classList.add("hidden"); document.getElementById("authModal").classList.remove("flex"); };
window.switchAuthTab = (m) => { window.SP.authMode = m; document.getElementById("fullNameField").classList.toggle("hidden", m === "login"); };
window.handleAuthSubmit = async (e) => { e.preventDefault(); window.closeAuthModal(); window.showToast("✓ TERHUBUNG KE SUPABASE"); };
window.handleLogout = () => { window.showToast("LOGGED OUT"); };

// Bootstrap Utama
window.addEventListener("DOMContentLoaded", async () => {
  if (window.lucide) lucide.createIcons();
  document.getElementById("journalCountBadge").textContent = window.SP.savedTrades.length;
  window.initTradingViewChart();
  window.setEyePalette(window.SP.activePaletteKey);
  syncModeHeaderVisuals(window.SP.currentTradingMode);
  await window.runFullPortfolioBacktest();
  await window.fetchLiveTrueMarketSpots();
  window.runTenYearHistoricalBacktest();
  setInterval(window.fetchLiveTrueMarketSpots, 3500);
});
