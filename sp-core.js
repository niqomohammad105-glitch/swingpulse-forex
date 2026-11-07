/**
 * MODULE 1: sp-core.js (VWAP INSTITUTIONAL EDITION)
 * Menyimpan State Global (window.SP), Konfigurasi 12 Pair, Parameter 3 Mode VWAP,
 * dan Rumus Matematika VWAP (Volume Weighted Average Price + Standard Deviation Bands).
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
  ema50Series: null,  // Digunakan untuk memplot Garis Utama Session VWAP di Chart
  ema200Series: null, // Digunakan untuk memplot Garis Macro VWAP / Anchor Baseline di Chart
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
      emaFast: 20, // Session VWAP (20-Bar Window)
      emaSlow: 50, // Anchor VWAP Baseline (50-Bar Window)
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
      emaFast: 34, // Multi-Session VWAP (34-Bar Window)
      emaSlow: 89, // Structural VWAP (89-Bar Window)
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
      emaFast: 50,  // Macro VWAP (50-Bar Window)
      emaSlow: 200, // Institutional Yearly/Quarterly VWAP (200-Bar Window)
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
// RUMUS MATEMATIKA VWAP (VOLUME WEIGHTED AVERAGE PRICE) & DEVIATION BANDS
// ============================================================================
window.calcVWAPArray = function (bars, period = 20) {
  if (!bars || !bars.length) return [];
  const vwapArr = new Array(bars.length).fill(0);

  for (let i = 0; i < bars.length; i++) {
    const startIdx = Math.max(0, i - period + 1);
    let sumPV = 0;
    let sumV = 0;

    for (let k = startIdx; k <= i; k++) {
      const b = bars[k];
      const typicalPrice = (b.high + b.low + b.close) / 3;
      // Bobot Tick-Volume Institusional dari aktivitas rentang & body candle
      const bodyExpansion = Math.abs(b.close - b.open) * 1.6;
      const rangeActivity = b.high - b.low;
      const synthVolume = Math.max(rangeActivity + bodyExpansion, b.close * 0.0001);

      sumPV += typicalPrice * synthVolume;
      sumV += synthVolume;
    }

    vwapArr[i] = sumV > 0 ? sumPV / sumV : bars[i].close;
  }
  return vwapArr;
};

// Hitung Simpangan Baku (Standard Deviation σ) di Sekitar VWAP untuk Value Area Bands
window.calcVWAPStdDevArray = function (bars, vwapArr, period = 20) {
  if (!bars || !bars.length) return [];
  const stdArr = new Array(bars.length).fill(0);

  for (let i = 0; i < bars.length; i++) {
    const startIdx = Math.max(0, i - period + 1);
    const meanVwap = vwapArr[i];
    let sumWeightedVar = 0;
    let sumV = 0;

    for (let k = startIdx; k <= i; k++) {
      const b = bars[k];
      const typicalPrice = (b.high + b.low + b.close) / 3;
      const synthVolume = Math.max((b.high - b.low) + Math.abs(b.close - b.open) * 1.6, b.close * 0.0001);
      const diff = typicalPrice - meanVwap;

      sumWeightedVar += synthVolume * (diff * diff);
      sumV += synthVolume;
    }

    stdArr[i] = sumV > 0 ? Math.sqrt(sumWeightedVar / sumV) : 0;
  }
  return stdArr;
};

// Alias ke calcEMAArray agar sp-chart.js otomatis menggambar kurva VWAP tanpa perlu diubah
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

// ============================================================================
// EVALUATOR 5-GATE BERBASIS INSTITUTIONAL VWAP & DEVIATION BANDS
// ============================================================================
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

  // Hitung simpangan baku lokal (1σ) terhadap Session VWAP
  let localVarSum = 0;
  for (let k = i - mCfg.donchianLen; k <= i; k++) {
    const tp = (bars[k].high + bars[k].low + bars[k].close) / 3;
    localVarSum += Math.pow(tp - vwapFast, 2);
  }
  const vwapStd = Math.sqrt(localVarSum / (mCfg.donchianLen + 1)) || atr * 0.5;
  const upperBand1Sigma = vwapFast + vwapStd * 1.0;
  const lowerBand1Sigma = vwapFast - vwapStd * 1.0;

  // Gate 1: Posisi Harga terhadap Session VWAP & Anchor VWAP + Slope VWAP
  const isBullVwap = (bar.close >= vwapFast && vwapFast >= vwapSlow) || (bar.close > vwapFast && vwapFast > vwapFastPrev);
  const isBearVwap = (bar.close <= vwapFast && vwapFast <= vwapSlow) || (bar.close < vwapFast && vwapFast < vwapFastPrev);
  const gate1Pass = isBullVwap || isBearVwap;
  const direction = isBullVwap ? "LONG" : isBearVwap ? "SHORT" : bar.close >= vwapSlow ? "LONG" : "SHORT";

  // Gate 2: Wilder ADX Strength
  const gate2Strong = adx >= mCfg.adxStrong;
  const gate2Moderate = adx >= mCfg.adxMod;

  // Gate 3: VWAP Institutional Triggers (Band Breakout, VWAP Dynamic Reject, atau VWAP Reclaim)
  let avgRangeN = 0;
  for (let k = i - mCfg.donchianLen; k < i; k++) {
    avgRangeN += bars[k].high - bars[k].low;
  }
  avgRangeN /= mCfg.donchianLen;

  // Trigger A: Penembusan Value Area (±1σ VWAP Band Breakout)
  const isBullBandBreak = isBullVwap && bar.close > upperBand1Sigma && prevBar.close <= upperBand1Sigma + atr * 0.2;
  const isBearBandBreak = isBearVwap && bar.close < lowerBand1Sigma && prevBar.close >= lowerBand1Sigma - atr * 0.2;

  // Trigger B: Pullback & Penolakan Presisi di Garis Session VWAP (VWAP Tap & Reject)
  const pullTol = mCfg.key === "SCALPING" ? atr * 0.85 : atr * 0.6;
  const isBullVwapReject = isBullVwap && bar.low <= vwapFast + pullTol && bar.close >= vwapFast && bar.close >= bar.open;
  const isBearVwapReject = isBearVwap && bar.high >= vwapFast - pullTol && bar.close <= vwapFast && bar.close <= bar.open;

  // Trigger C: VWAP Reclaim / Momentum Continuation
  const isBullReclaim = mCfg.key !== "POSITION" && isBullVwap && prevBar.low < vwapFast && bar.close > prevBar.high;
  const isBearReclaim = mCfg.key !== "POSITION" && isBearVwap && prevBar.high > vwapFast && bar.close < prevBar.low;

  const gate3Pass = isBullBandBreak || isBearBandBreak || isBullVwapReject || isBearVwapReject || isBullReclaim || isBearReclaim;
  let setupType = "SCANNING";
  if (isBullBandBreak || isBearBandBreak) setupType = "VWAP +1σ BREAK";
  else if (isBullVwapReject || isBearVwapReject) setupType = "VWAP REJECT";
  else if (isBullReclaim || isBearReclaim) setupType = "VWAP RECLAIM";

  // Gate 4: Volume-Weighted Impulse Conviction
  const curRange = bar.high - bar.low;
  const impulseRatio = avgRangeN > 0 ? Number((curRange / avgRangeN).toFixed(2)) : 1.2;
  const bodyRatio = curRange > 0 ? Math.abs(bar.close - bar.open) / curRange : 0.5;
  const gate4Pass = impulseRatio >= 0.95 || bodyRatio >= 0.45;

  // Gate 5: VWAP Overextension Guard (Jangan kejar harga jika sudah terlalu jauh > 3.2x ATR dari VWAP)
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
