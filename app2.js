/**
 * SWINGPULSE 100% PURE REAL-TIME MARKET READER & EYE-CARE UI (app2.js)
 * - Mematikan seluruh generator sintetis & Math.random() dari app.js
 * - Menarik 100% OHLCV asli dari Pyth Institutional Oracle (dengan Staggered Queue + Cross Leg Synthesis)
 * - Menghitung ulang EMA, Wilder ADX, Wilder ATR, dan 5-Gate Setup setiap kali tick harga pasar masuk
 */

(function initPureRealTimeMarketEngine() {
  // ==========================================================================
  // 1. KONFIGURASI PALET 3-WARNA RAMAH MATA (ANTI-SILAU)
  // ==========================================================================
  const PALETTES = {
    sage: {
      bg: "#0b0e11",
      surface: "#12171d",
      grid: "#141a21",
      border: "#1e2631",
      text: "#d8e0e8",
      muted: "#64748b",
      accent: "#2dd4bf",
      accentFillTop: "rgba(45, 212, 191, 0.14)",
      accentFillBot: "rgba(45, 212, 191, 0.02)",
      slFillTop: "rgba(100, 116, 139, 0.16)",
      slFillBot: "rgba(100, 116, 139, 0.03)"
    },
    graphite: {
      bg: "#0c0c0e",
      surface: "#141418",
      grid: "#16161b",
      border: "#24242c",
      text: "#d4d4d8",
      muted: "#71717a",
      accent: "#a1a1aa",
      accentFillTop: "rgba(161, 161, 170, 0.14)",
      accentFillBot: "rgba(161, 161, 170, 0.02)",
      slFillTop: "rgba(82, 82, 91, 0.18)",
      slFillBot: "rgba(82, 82, 91, 0.03)"
    },
    amber: {
      bg: "#0e0c0a",
      surface: "#171411",
      grid: "#1a1613",
      border: "#29231e",
      text: "#e7e2dd",
      muted: "#78716c",
      accent: "#f59e0b",
      accentFillTop: "rgba(245, 158, 11, 0.14)",
      accentFillBot: "rgba(245, 158, 11, 0.02)",
      slFillTop: "rgba(120, 113, 108, 0.16)",
      slFillBot: "rgba(120, 113, 108, 0.03)"
    }
  };

  let activePaletteKey = localStorage.getItem("sp_eye_palette") || "sage";
  let lastOracleTickTimeMap = {};
  let continuousScannerTimer = null;
  let rotatingPairIndex = 0;

  function getPal() {
    return PALETTES[activePaletteKey] || PALETTES.sage;
  }

  window.setEyePalette = function setEyePalette(key) {
    if (!PALETTES[key]) return;
    activePaletteKey = key;
    localStorage.setItem("sp_eye_palette", key);
    document.body.setAttribute("data-palette", key);

    ["sage", "graphite", "amber"].forEach((k) => {
      const btn = document.getElementById(`pal-${k}`);
      if (btn) {
        btn.className =
          k === key
            ? "px-2 py-1 rounded bg-white text-black font-semibold transition"
            : "px-2 py-1 rounded text-zinc-400 hover:text-white transition";
      }
    });

    applyEyeCareChartTheme();
    if (window.selectedSignal) {
      window.drawSignalPriceLines(window.selectedSignal);
    }
    window.renderSignals();
  };

  function applyEyeCareChartTheme() {
    const pal = getPal();
    if (window.tvChart) {
      window.tvChart.applyOptions({
        layout: { background: { type: "solid", color: pal.bg }, textColor: pal.muted, fontSize: 11 },
        grid: { vertLines: { color: pal.grid }, horzLines: { color: pal.grid } },
        rightPriceScale: { borderColor: pal.border },
        timeScale: { borderColor: pal.border }
      });
    }
    if (window.candleSeries) {
      window.candleSeries.applyOptions({
        upColor: pal.accent,
        downColor: pal.muted,
        borderUpColor: pal.accent,
        borderDownColor: pal.muted,
        wickUpColor: pal.accent,
        wickDownColor: pal.muted
      });
    }
    if (window.ema50Series) window.ema50Series.applyOptions({ color: pal.text, lineWidth: 1 });
    if (window.ema200Series) window.ema200Series.applyOptions({ color: pal.muted, lineWidth: 1 });
    if (window.tpZoneSeries) {
      window.tpZoneSeries.applyOptions({
        topFillColor1: pal.accentFillTop,
        topFillColor2: pal.accentFillBot,
        topLineColor: pal.accent,
        bottomFillColor1: pal.accentFillBot,
        bottomFillColor2: pal.accentFillTop,
        bottomLineColor: pal.accent
      });
    }
    if (window.slZoneSeries) {
      window.slZoneSeries.applyOptions({
        topFillColor1: pal.slFillTop,
        topFillColor2: pal.slFillBot,
        topLineColor: pal.muted,
        bottomFillColor1: pal.slFillBot,
        bottomFillColor2: pal.slFillTop,
        bottomLineColor: pal.muted
      });
    }
    if (window.tyChart) {
      window.tyChart.applyOptions({
        layout: { background: { type: "solid", color: pal.bg }, textColor: pal.muted },
        grid: { vertLines: { color: pal.grid }, horzLines: { color: pal.grid } },
        rightPriceScale: { borderColor: pal.border },
        timeScale: { borderColor: pal.border }
      });
    }
    if (window.tyEquitySeries) {
      window.tyEquitySeries.applyOptions({
        lineColor: pal.accent,
        topColor: pal.accentFillTop,
        bottomColor: pal.accentFillBot
      });
    }
    if (window.tySwingOverlaySeries) window.tySwingOverlaySeries.applyOptions({ color: pal.text });
    if (window.tyPositionOverlaySeries) window.tyPositionOverlaySeries.applyOptions({ color: pal.muted });
  }

  // ==========================================================================
  // 2. MATIKAN TOTAL GENERATOR SINTETIS & DETAK ACAK (MATH.RANDOM) DARI APP.JS
  // ==========================================================================
  window.startLiveCandleHeartbeat = function disableFakeHeartbeat() {
    if (window.microTickTimer) {
      clearInterval(window.microTickTimer);
      window.microTickTimer = null;
    }
  };

  window.runInstantZeroLatencyBootstrap = function disableFakeBootstrap() {
    const container = document.getElementById("signalsContainer");
    if (container) {
      container.innerHTML = `
        <div class="p-10 text-center space-y-3 rounded-lg border border-zinc-900 panel-surface font-mono">
          <div class="text-sm font-bold text-white animate-pulse">MENARIK DATA CANDLESTICK REAL-TIME DARI PYTH ORACLE...</div>
          <p class="text-xs text-zinc-400 font-sans">
            Menghitung EMA, Wilder ADX, ATR(14), dan struktur Breakout langsung dari pasar spot global tanpa data sintetis.
          </p>
        </div>`;
    }
  };

  // ==========================================================================
  // 3. MESIN PENARIK OHLCV REAL-TIME PYTH (DENGAN RETRY & SINTESIS CROSS PAIR)
  // ==========================================================================
  async function fetchPurePythBars(pythSymbol, resolution, countBars = 250, retries = 2) {
    const nowSec = Math.floor(Date.now() / 1000);
    const resSec = resolution === "D" ? 86400 : parseInt(resolution, 10) * 60;
    // Rentang waktu diperlebar 5x agar tetap mendapat 250 bar penuh meski melewati hari libur/akhir pekan pasar Forex
    const fromSec = nowSec - Math.max(countBars * resSec * 5, 86400 * 5);
    const url = `https://benchmarks.pyth.network/v1/shims/tradingview/history?symbol=${encodeURIComponent(
      pythSymbol
    )}&resolution=${resolution}&from=${fromSec}&to=${nowSec}`;

    for (let attempt = 0; attempt <= retries; attempt++) {
      const ctrl = new AbortController();
      const timer = setTimeout(() => ctrl.abort(), 4500);
      try {
        const res = await fetch(url, { signal: ctrl.signal });
        clearTimeout(timer);
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = await res.json();
        if (data.s !== "ok" || !data.t || data.t.length < 30) {
          throw new Error("Empty bars from Pyth");
        }
        const bars = [];
        for (let i = 0; i < data.t.length; i++) {
          bars.push({
            time: Number(data.t[i]),
            open: Number(data.o[i]),
            high: Number(data.h[i]),
            low: Number(data.l[i]),
            close: Number(data.c[i])
          });
        }
        return window.sanitizeAndDedupeBars(bars).slice(-countBars);
      } catch (err) {
        clearTimeout(timer);
        if (attempt === retries) throw err;
        await new Promise((r) => setTimeout(r, 250 * (attempt + 1)));
      }
    }
  }

  // Override fetchRealSpotCandles: Murni dari Pyth (Direct atau Sintesis Leg A & Leg B untuk Cross Pair)
  window.fetchRealSpotCandles = async function fetchPureRealMarketCandles(symbol, resolution, countBars = 250) {
    const cfg = window.PYTH_FEED_CONFIG[symbol];
    const decimals = window.getPairDecimals(symbol);

    // 1. Coba tarik langsung dari feed Pyth Symbol
    try {
      const directBars = await fetchPurePythBars(cfg.pythSymbol, resolution, countBars);
      if (directBars && directBars.length >= 40) {
        lastOracleTickTimeMap[symbol] = new Date().toLocaleTimeString("id-ID", { hour12: false });
        return directBars.map((b) => ({
          time: b.time,
          open: Number(b.open.toFixed(decimals)),
          high: Number(b.high.toFixed(decimals)),
          low: Number(b.low.toFixed(decimals)),
          close: Number(b.close.toFixed(decimals))
        }));
      }
    } catch (directErr) {
      // 2. Jika pair Cross (GBPJPY, EURJPY, AUDJPY, EURGBP) butuh sintesis dari 2 Major Leg asli Pyth
      if (cfg.legA && cfg.legB) {
        const [barsA, barsB] = await Promise.all([
          fetchPurePythBars(cfg.legA, resolution, countBars),
          fetchPurePythBars(cfg.legB, resolution, countBars)
        ]);

        const mapB = new Map(barsB.map((b) => [b.time, b]));
        const synthesized = [];
        let lastKnownB = barsB[0];

        for (const a of barsA) {
          const b = mapB.get(a.time) || lastKnownB;
          if (!b) continue;
          lastKnownB = b;
          const calc = (v1, v2) => (cfg.op === "MUL" ? v1 * v2 : v1 / v2);
          const o = Number(calc(a.open, b.open).toFixed(decimals));
          const c = Number(calc(a.close, b.close).toFixed(decimals));
          const h1 = Number(calc(a.high, b.high).toFixed(decimals));
          const l1 = Number(calc(a.low, b.low).toFixed(decimals));

          synthesized.push({
            time: a.time,
            open: o,
            high: Math.max(o, c, h1, l1),
            low: Math.min(o, c, h1, l1),
            close: c
          });
        }
        lastOracleTickTimeMap[symbol] = new Date().toLocaleTimeString("id-ID", { hour12: false });
        return window.sanitizeAndDedupeBars(synthesized).slice(-countBars);
      }
      throw directErr;
    }
  };

  // ==========================================================================
  // 4. ANALISIS REAL-TIME MURNI DARI CANDLE PASAR SAAT INI (TANPA REKAYASA)
  // ==========================================================================
  window.analyzePairLiveState = function analyzePureMarketState(symbol, bars) {
    const cfg = window.PYTH_FEED_CONFIG[symbol];
    const mCfg = window.getModeCfg();
    const decimals = cfg.decimals;
    const tfLabel = window.getResolutionLabel(window.currentResolution);

    if (!bars || bars.length < 40) return null;

    const emaFastArr = window.calcEMAArray(bars, mCfg.emaFast);
    const emaSlowArr = window.calcEMAArray(bars, mCfg.emaSlow);
    const atrArr = window.calcWilderATRArray(bars, 14);
    const adxArr = window.calcWilderADXArray(bars, mCfg.adxPeriod);

    const latestIdx = bars.length - 1;
    const latestBar = bars[latestIdx];
    const spotPrice = Number(latestBar.close.toFixed(decimals));
    window.livePricesMap[symbol] = spotPrice;

    // Evaluasi kondisi teknikal murni pada bar paling kanan (live candle) dan 1 bar yang baru saja close
    const liveBarEval = window.evaluateBarSetup(bars, latestIdx, emaFastArr, emaSlowArr, atrArr, adxArr, mCfg);
    const closedBarEval = window.evaluateBarSetup(bars, latestIdx - 1, emaFastArr, emaSlowArr, atrArr, adxArr, mCfg);

    // Cek apakah dalam jendela aktif ada setup asli yang terpicu dan belum terkena SL maupun TP2
    let activeSetupEval = null;
    let triggerBarIdx = latestIdx;
    let currentStatus = "MONITORING MARKET";

    // Prioritaskan setup yang terpicu pada candle live atau candle yang baru saja tutup
    if (liveBarEval && (liveBarEval.grade === "A++" || liveBarEval.grade === "A")) {
      activeSetupEval = liveBarEval;
      triggerBarIdx = latestIdx;
      currentStatus = "LIVE BREAKOUT / RETEST";
    } else if (closedBarEval && (closedBarEval.grade === "A++" || closedBarEval.grade === "A")) {
      activeSetupEval = closedBarEval;
      triggerBarIdx = latestIdx - 1;
      currentStatus = "CONFIRMED CLOSE SETUP";
    } else {
      // Periksa apakah ada posisi A++ / A dari beberapa candle terakhir yang sedang berjalan (floating active)
      const lookbackWindow = mCfg.key === "SCALPING" ? 18 : mCfg.key === "SWING" ? 24 : 30;
      for (let idx = latestIdx - 2; idx >= Math.max(25, latestIdx - lookbackWindow); idx--) {
        const candidate = window.evaluateBarSetup(bars, idx, emaFastArr, emaSlowArr, atrArr, adxArr, mCfg);
        if (candidate && (candidate.grade === "A++" || candidate.grade === "A")) {
          const baseEntry = bars[idx].close;
          const stopDist = Math.max(candidate.atr * mCfg.slAtrMult, baseEntry * 0.0008);
          const isLong = candidate.direction === "LONG";
          const sl = isLong ? baseEntry - stopDist : baseEntry + stopDist;
          const tp1 = isLong ? baseEntry + stopDist * mCfg.tp1RR : baseEntry - stopDist * mCfg.tp1RR;
          const tp2 = isLong ? baseEntry + stopDist * mCfg.tp2RR : baseEntry - stopDist * mCfg.tp2RR;

          let hitSl = false,
            hitTp2 = false,
            hitTp1 = false;
          for (let k = idx + 1; k <= latestIdx; k++) {
            if (isLong) {
              if (bars[k].low <= sl) {
                hitSl = true;
                break;
              }
              if (bars[k].high >= tp2) {
                hitTp2 = true;
                break;
              }
              if (bars[k].high >= tp1) hitTp1 = true;
            } else {
              if (bars[k].high >= sl) {
                hitSl = true;
                break;
              }
              if (bars[k].low <= tp2) {
                hitTp2 = true;
                break;
              }
              if (bars[k].low <= tp1) hitTp1 = true;
            }
          }

          // Hanya tampilkan jika posisinya benar-benar masih hidup di pasar saat ini
          if (!hitSl && !hitTp2) {
            activeSetupEval = candidate;
            triggerBarIdx = idx;
            const barsAgo = latestIdx - idx;
            currentStatus = hitTp1 ? `RUNNING (+TP1 HIT · ${barsAgo}b ago)` : `RUNNING (${barsAgo} bars ago)`;
            break;
          }
        }
      }
    }

    const displayEval = activeSetupEval || liveBarEval;
    const btStats = window.pairBacktestCache[symbol] || { winRate: 0, setups: 0, netR: 0 };
    const isQualified = Boolean(activeSetupEval && (activeSetupEval.grade === "A++" || activeSetupEval.grade === "A"));

    const curEmaFast = Number(emaFastArr[latestIdx].toFixed(decimals));
    const curEmaSlow = Number(emaSlowArr[latestIdx].toFixed(decimals));
    const curAtr = Number(atrArr[latestIdx].toFixed(decimals));
    const curAdx = Number(adxArr[latestIdx].toFixed(1));

    let entryPrice = null,
      stopLoss = null,
      tp1Price = null,
      tp2Price = null;
    let aiSummary = "";

    if (isQualified) {
      const baseEntry = bars[triggerBarIdx].close;
      const stopDist = Math.max(displayEval.atr * mCfg.slAtrMult, baseEntry * 0.0008);
      const isLong = displayEval.direction === "LONG";

      entryPrice = Number(baseEntry.toFixed(decimals));
      stopLoss = Number((isLong ? entryPrice - stopDist : entryPrice + stopDist).toFixed(decimals));
      tp1Price = Number((isLong ? entryPrice + stopDist * mCfg.tp1RR : entryPrice - stopDist * mCfg.tp1RR).toFixed(decimals));
      tp2Price = Number((isLong ? entryPrice + stopDist * mCfg.tp2RR : entryPrice - stopDist * mCfg.tp2RR).toFixed(decimals));

      aiSummary = `[LIVE MARKET READ — ${mCfg.shortLabel} ${tfLabel}] EMA(${mCfg.emaFast}) = ${curEmaFast}, EMA(${mCfg.emaSlow}) = ${curEmaSlow}, ADX = ${curAdx}, ATR(14) = ${curAtr}. Trigger ${displayEval.setupType} terdeteksi pada harga ${entryPrice}.`;
    } else {
      const failedGates = displayEval.gates
        .filter((g) => !g.pass)
        .map((g) => g.label.split(".")[1].trim())
        .join(", ");
      aiSummary = `[REAL-TIME STANDBY — Skor ${displayEval.score}%] Pasar ${symbol} saat ini berada di ${spotPrice} (EMA${mCfg.emaFast}: ${curEmaFast}, EMA${mCfg.emaSlow}: ${curEmaSlow}, ADX: ${curAdx}). Menunggu syarat terpenuhi: ${
        failedGates || "Trigger Breakout/Retest"
      }.`;
    }

    return {
      id: symbol,
      symbol,
      pair_category: cfg.category,
      timeframe: tfLabel,
      mode: mCfg.shortLabel,
      grade: isQualified ? displayEval.grade : "BELOW_A",
      isQualified,
      triggerBarTime: bars[triggerBarIdx].time,
      direction: displayEval.direction,
      setup_type: isQualified ? displayEval.setupType : "STANDBY",
      entry_price: entryPrice,
      stop_loss: stopLoss,
      tp1_price: tp1Price,
      tp2_price: tp2Price,
      confluence_score: displayEval.score,
      volume_ratio: displayEval.impulseRatio,
      adx_val: curAdx,
      liveIndicators: {
        emaFast: curEmaFast,
        emaSlow: curEmaSlow,
        atr: curAtr,
        adx: curAdx,
        lastTick: lastOracleTickTimeMap[symbol] || "LIVE"
      },
      trend_alignment: `${tfLabel} EMA ${mCfg.emaFast}/${mCfg.emaSlow} (${curEmaFast} / ${curEmaSlow}) · ADX ${curAdx}`,
      ai_summary: aiSummary,
      gates: displayEval.gates,
      backtest: btStats,
      is_pro_only: false,
      status: currentStatus
    };
  };

  // ==========================================================================
  // 5. STAGGERED PORTFOLIO SCANNER (BEBAS RATE-LIMIT & 100% REAL DATA)
  // ==========================================================================
  window.runFullPortfolioBacktest = async function runPureRealPortfolioScan() {
    const mCfg = window.getModeCfg();
    const statusEl = document.getElementById("wsStatusText");
    if (statusEl) statusEl.textContent = `SCANNING PYTH (${mCfg.shortLabel})...`;

    const liveResults = [];
    // Ambil dalam 3 gelombang (@ 4 pair) agar 100% request diterima mulus oleh server Pyth
    const batchSize = 4;
    for (let i = 0; i < window.PAIR_LIST.length; i += batchSize) {
      const batch = window.PAIR_LIST.slice(i, i + batchSize);
      await Promise.all(
        batch.map(async (sym) => {
          try {
            const bars = await window.fetchRealSpotCandles(sym, window.currentResolution, 250);
            if (bars && bars.length >= 40) {
              window.pairCandlesCache[sym] = bars;
              window.pairBacktestCache[sym] = window.simulateStrategyOnBars(sym, bars, mCfg);
              const sigState = window.analyzePairLiveState(sym, bars);
              if (sigState) liveResults.push(sigState);
            }
          } catch (e) {
            // Jika gagal jaringan sesaat, gunakan cache asli terakhir jika ada
            if (window.pairCandlesCache[sym] && window.pairCandlesCache[sym].length >= 40) {
              const cachedBars = window.pairCandlesCache[sym];
              window.pairBacktestCache[sym] = window.simulateStrategyOnBars(sym, cachedBars, mCfg);
              const sigState = window.analyzePairLiveState(sym, cachedBars);
              if (sigState) liveResults.push(sigState);
            }
          }
        })
      );
      if (i + batchSize < window.PAIR_LIST.length) {
        await new Promise((r) => setTimeout(r, 110));
      }
    }

    if (liveResults.length > 0) {
      liveResults.sort((a, b) => b.confluence_score - a.confluence_score);
      window.allSignals = liveResults;
      const curSym = window.selectedSignal?.symbol;
      window.selectedSignal =
        window.allSignals.find((s) => s.symbol === curSym) ||
        window.allSignals.find((s) => s.isQualified) ||
        window.allSignals[0];

      window.updatePortfolioTelemetryUI();
      window.renderBacktestTable();
      window.renderSignals();
      window.renderSelectedDetail();
      window.updateRiskCalc();

      if (window.selectedSignal && window.pairCandlesCache[window.selectedSignal.symbol]) {
        window.renderCandlesAndLinesOnChart(
          window.selectedSignal,
          window.pairCandlesCache[window.selectedSignal.symbol]
        );
      }
    }

    if (statusEl) statusEl.textContent = `PYTH ORACLE LIVE (${mCfg.shortLabel})`;
  };

  // ==========================================================================
  // 6. REAL-TIME TICK-TO-SIGNAL ENGINE (MENGHITUNG ULANG INDIKATOR TIAP TICK)
  // ==========================================================================
  function updatePairWithLiveMarketTick(symbol, cleanPrice, tickTimeSec) {
    const decimals = window.getPairDecimals(symbol);
    const prevPrice = window.livePricesMap[symbol] || cleanPrice;
    window.livePricesMap[symbol] = cleanPrice;
    lastOracleTickTimeMap[symbol] = new Date().toLocaleTimeString("id-ID", { hour12: false });

    const cardLiveEl = document.getElementById(`card-live-${symbol}`);
    if (cardLiveEl) cardLiveEl.textContent = cleanPrice.toFixed(decimals);

    const bars = window.pairCandlesCache[symbol];
    if (!bars || bars.length < 40) return;

    const resSec = parseInt(window.currentResolution, 10) * 60;
    const bucketTime = tickTimeSec - (tickTimeSec % resSec);
    const lastIdx = bars.length - 1;
    const lastBar = { ...bars[lastIdx] };

    if (bucketTime > lastBar.time) {
      bars.push({
        time: bucketTime,
        open: lastBar.close,
        high: Math.max(lastBar.close, cleanPrice),
        low: Math.min(lastBar.close, cleanPrice),
        close: cleanPrice
      });
      if (bars.length > 260) bars.shift();
    } else {
      lastBar.close = cleanPrice;
      if (cleanPrice > lastBar.high) lastBar.high = cleanPrice;
      if (cleanPrice < lastBar.low) lastBar.low = cleanPrice;
      bars[lastIdx] = lastBar;
    }

    // HITUNG ULANG INDIKATOR (EMA, ADX, ATR, 5-GATE) DARI CANDLE PASAR TERBARU!
    const prevSignal = window.allSignals.find((s) => s.symbol === symbol);
    const wasQualified = prevSignal ? prevSignal.isQualified : false;
    const updatedSig = window.analyzePairLiveState(symbol, bars);

    if (updatedSig) {
      const idx = window.allSignals.findIndex((s) => s.symbol === symbol);
      if (idx !== -1) window.allSignals[idx] = updatedSig;

      // Jika pair baru saja menembus syarat Grade A++ / A secara real-time, beri notifikasi!
      if (!wasQualified && updatedSig.isQualified) {
        window.playAlertSound("win");
        window.showToast(`⚡ NEW REAL-TIME ${updatedSig.grade} SETUP: ${symbol} (${updatedSig.direction})`);
        window.renderSignals();
      }

      // Jika pair ini sedang dipilih di grafik kanan, perbarui candle, kurva EMA, dan audit 5-Gate secara live
      if (window.selectedSignal && window.selectedSignal.symbol === symbol) {
        window.selectedSignal = updatedSig;
        if (window.candleSeries) {
          window.candleSeries.update(bars[bars.length - 1]);
          window.updateEmaSeries();
        }
        window.updateLivePriceUI(cleanPrice, cleanPrice - prevPrice, decimals);
        window.renderSelectedDetail();
        if (updatedSig.isQualified) {
          window.checkAutoHitTpSl(updatedSig, cleanPrice);
        }
      }
    }
  }

  // Override handleIncomingPythTick agar tidak sekadar mengubah teks, tapi memicu evaluasi indikator real-time
  window.handleIncomingPythTick = function handleRealTimeOracleTick(pythId, rawPrice, tickTimeSec) {
    const nowSec = tickTimeSec || Math.floor(Date.now() / 1000);

    for (const [sym, cfg] of Object.entries(window.PYTH_FEED_CONFIG)) {
      if (cfg.pythSymbol === pythId) {
        const cleanPrice = Number(rawPrice.toFixed(cfg.decimals));
        updatePairWithLiveMarketTick(sym, cleanPrice, nowSec);

        // Hitung ulang juga Cross Pair secara real-time setiap kali Major Leg-nya bergerak
        if (window.livePricesMap.GBPUSD && window.livePricesMap.USDJPY) {
          updatePairWithLiveMarketTick(
            "GBPJPY",
            Number((window.livePricesMap.GBPUSD * window.livePricesMap.USDJPY).toFixed(3)),
            nowSec
          );
        }
        if (window.livePricesMap.EURUSD && window.livePricesMap.USDJPY) {
          updatePairWithLiveMarketTick(
            "EURJPY",
            Number((window.livePricesMap.EURUSD * window.livePricesMap.USDJPY).toFixed(3)),
            nowSec
          );
        }
        if (window.livePricesMap.AUDUSD && window.livePricesMap.USDJPY) {
          updatePairWithLiveMarketTick(
            "AUDJPY",
            Number((window.livePricesMap.AUDUSD * window.livePricesMap.USDJPY).toFixed(3)),
            nowSec
          );
        }
        if (window.livePricesMap.EURUSD && window.livePricesMap.GBPUSD) {
          updatePairWithLiveMarketTick(
            "EURGBP",
            Number((window.livePricesMap.EURUSD / window.livePricesMap.GBPUSD).toFixed(5)),
            nowSec
          );
        }
      }
    }
  };

  // Pemindai Kontinu Latar Belakang (Memastikan Candle & Indikator Terus Ditarik dari Pyth Setiap 3.5 Detik)
  function startContinuousRealMarketScanner() {
    if (continuousScannerTimer) clearInterval(continuousScannerTimer);
    continuousScannerTimer = setInterval(async () => {
      try {
        // 1. Selalu segarkan pair yang sedang aktif dibuka di chart
        if (window.selectedSignal) {
          const activeSym = window.selectedSignal.symbol;
          const latestBars = await window.fetchRealSpotCandles(activeSym, window.currentResolution, 5);
          if (latestBars && latestBars.length > 0) {
            const newest = latestBars[latestBars.length - 1];
            updatePairWithLiveMarketTick(activeSym, newest.close, newest.time);
          }
        }

        // 2. Putar pemindaian ke pair berikutnya di daftar 12 pair agar sinyal seluruh pasar selalu segar
        const rotSym = window.PAIR_LIST[rotatingPairIndex % window.PAIR_LIST.length];
        rotatingPairIndex++;
        if (!window.selectedSignal || rotSym !== window.selectedSignal.symbol) {
          const rotBars = await window.fetchRealSpotCandles(rotSym, window.currentResolution, 5);
          if (rotBars && rotBars.length > 0) {
            const newestRot = rotBars[rotBars.length - 1];
            updatePairWithLiveMarketTick(rotSym, newestRot.close, newestRot.time);
          }
        }
      } catch (e) {}
    }, 3500);
  }

  // ==========================================================================
  // 7. RENDER KARTU SINYAL DENGAN DATA INDIKATOR REAL-TIME TRANSPARAN
  // ==========================================================================
  window.renderSignals = function renderPureRealTimeSignals() {
    const container = document.getElementById("signalsContainer");
    if (!container) return;

    const filtered = window.allSignals.filter((s) => {
      const matchGrade =
        window.gradeFilter === "QUALIFIED"
          ? s.isQualified
          : window.gradeFilter === "A_PLUS_PLUS"
          ? s.grade === "A++"
          : true;
      const matchCat =
        window.currentFilterCategory === "ALL"
          ? true
          : s.pair_category === window.currentFilterCategory;
      return matchGrade && matchCat;
    });

    if (filtered.length === 0) {
      container.innerHTML = `
        <div class="p-8 text-center space-y-3 rounded-lg border border-zinc-900 panel-surface">
          <div class="text-sm font-semibold text-white">Tidak Ada Pair yang Sedang Memenuhi Kualifikasi Grade A++ / A Detik Ini</div>
          <p class="text-xs text-zinc-400 max-w-md mx-auto">
            Karena pembacaan pasar kini 100% real-time murni tanpa rekayasa, sinyal hanya muncul ketika harga pasar asli benar-benar menembus struktur Breakout atau menguji EMA dengan ADX yang valid.
          </p>
          <div class="flex flex-wrap justify-center gap-2 pt-2">
            <button onclick="setGradeFilter('ALL')" class="tactile-btn px-3.5 py-1.5 bg-white text-black font-semibold text-xs">
              Lihat Pembacaan Indikator 12 Pair Saat Ini
            </button>
            <button onclick="changeScanTimeframe(currentResolution === '5' ? '15' : '5')" class="tactile-btn px-3.5 py-1.5 border border-zinc-800 text-xs text-white">
              Cek Timeframe ${window.currentResolution === "5" ? "M15" : "M5"}
            </button>
          </div>
        </div>`;
      return;
    }

    const mCfg = window.getModeCfg();

    container.innerHTML = filtered
      .map((sig) => {
        const isLocked = sig.is_pro_only && !window.isProView;
        const isSelected = window.selectedSignal && String(window.selectedSignal.id) === String(sig.id);
        const isLong = sig.direction === "LONG";
        const decimals = window.getPairDecimals(sig.symbol);
        const pipSize = window.getPipSize(sig.symbol);
        const liveVal = window.livePricesMap[sig.symbol]
          ? Number(window.livePricesMap[sig.symbol]).toFixed(decimals)
          : "---";

        let slPips = 0,
          tp1Pips = 0;
        if (sig.isQualified && sig.entry_price) {
          slPips = Math.round(Math.abs(sig.entry_price - sig.stop_loss) / pipSize);
          tp1Pips = Math.round(Math.abs(sig.tp1_price - sig.entry_price) / pipSize);
        }

        const activeCardStyle = isSelected ? "border-2 border-white" : "border border-zinc-900";

        const gradeBadge =
          sig.grade === "A++"
            ? `<span class="text-xs font-mono font-bold px-2.5 py-0.5 rounded bg-white text-black">★ Grade A++ (${sig.confluence_score}%)</span>`
            : sig.grade === "A"
            ? `<span class="text-xs font-mono font-semibold px-2.5 py-0.5 rounded border border-white text-white">Grade A (${sig.confluence_score}%)</span>`
            : `<span class="text-xs font-mono px-2.5 py-0.5 rounded border border-zinc-800 text-zinc-400">Standby (${sig.confluence_score}%)</span>`;

        const ind = sig.liveIndicators || {};
        const telemetryBar = `
          <div class="mt-2.5 pt-2 border-t border-zinc-900/70 flex flex-wrap items-center justify-between gap-2 text-[11px] font-mono text-zinc-400 num-lock">
            <span>EMA ${mCfg.emaFast}/${mCfg.emaSlow}: <strong class="text-white">${ind.emaFast || "-"}</strong> / ${ind.emaSlow || "-"}</span>
            <span>ADX: <strong class="text-white">${ind.adx || sig.adx_val}</strong></span>
            <span>ATR: ${ind.atr || "-"}</span>
            <span>Oracle: ${ind.lastTick || "LIVE"}</span>
          </div>
        `;

        const levelsGrid = sig.isQualified
          ? `
          <div class="grid grid-cols-4 gap-2 pt-3 mt-3 border-t border-zinc-900 num-lock text-center">
            <div class="p-2 rounded bg-black border border-zinc-900">
              <span class="text-[10px] text-zinc-400 block">Entry</span>
              <span class="text-xs sm:text-sm font-mono font-bold text-white mt-0.5 block ${
                isLocked ? "blur-sm select-none" : ""
              }">
                ${isLocked ? "1.0000" : Number(sig.entry_price).toFixed(decimals)}
              </span>
            </div>
            <div class="p-2 rounded bg-black border border-zinc-900">
              <span class="text-[10px] text-zinc-400 block">SL (-${slPips}p)</span>
              <span class="text-xs sm:text-sm font-mono text-zinc-400 mt-0.5 block ${
                isLocked ? "blur-sm select-none" : ""
              }">
                ${isLocked ? "1.0000" : Number(sig.stop_loss).toFixed(decimals)}
              </span>
            </div>
            <div class="p-2 rounded bg-black border border-zinc-900">
              <span class="text-[10px] text-zinc-400 block">TP 1 (+${tp1Pips}p)</span>
              <span class="text-xs sm:text-sm font-mono font-bold text-white mt-0.5 block ${
                isLocked ? "blur-sm select-none" : ""
              }">
                ${isLocked ? "1.0000" : Number(sig.tp1_price).toFixed(decimals)}
              </span>
            </div>
            <div class="p-2 rounded bg-black border border-zinc-900">
              <span class="text-[10px] text-zinc-400 block">TP 2 (1:${mCfg.tp2RR})</span>
              <span class="text-xs sm:text-sm font-mono font-bold text-white mt-0.5 block ${
                isLocked ? "blur-sm select-none" : ""
              }">
                ${isLocked ? "1.0000" : Number(sig.tp2_price).toFixed(decimals)}
              </span>
            </div>
          </div>
          ${telemetryBar}
        `
          : `
          ${telemetryBar}
          <div class="pt-2 mt-2 flex items-center justify-between text-xs text-zinc-400">
            <span>Status: ${sig.ai_summary}</span>
          </div>
        `;

        return `
          <div onclick="selectSignal('${sig.id}')" class="signal-card p-4 cursor-pointer ${activeCardStyle}">
            <div class="flex flex-wrap items-center justify-between gap-2">
              <div class="flex items-center gap-2.5">
                <span class="text-base font-bold font-mono text-white">${sig.symbol}</span>
                <span class="text-xs font-mono px-2 py-0.5 rounded bg-black border border-zinc-800 text-zinc-400 num-lock">
                  Spot: <strong id="card-live-${sig.symbol}" class="text-white">${liveVal}</strong>
                </span>
                ${
                  sig.isQualified
                    ? `<span class="text-xs font-mono font-semibold px-2 py-0.5 rounded ${
                        isLong ? "bg-white text-black" : "border border-white text-white"
                      }">
                        ${isLong ? "▲ LONG" : "▼ SHORT"} · ${sig.setup_type}
                      </span>`
                    : `<span class="text-[11px] font-mono text-zinc-400">${sig.direction} BIAS</span>`
                }
              </div>
              <div>${gradeBadge}</div>
            </div>
            ${levelsGrid}
          </div>
        `;
      })
      .join("");
  };

  // ==========================================================================
  // 8. INISIALISASI SAAT HALAMAN DIMUAT
  // ==========================================================================
  window.addEventListener("DOMContentLoaded", () => {
    window.startLiveCandleHeartbeat(); // Matikan timer acak bawaan app.js
    setTimeout(async () => {
      window.setEyePalette(activePaletteKey);
      await window.runFullPortfolioBacktest();
      startContinuousRealMarketScanner();
    }, 120);
  });
})();
