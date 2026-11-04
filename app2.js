/**
 * SWINGPULSE REAL-TIME ENGINE & EYE-CARE UI FIX (app2.js)
 * Perbaikan penuh: Mengakses lexical scope (let/const) dari app.js secara langsung
 * serta memastikan grafik Candlestick + Garis Entry/SL/TP 100% langsung ter-render.
 */

(function initFixedRealTimeEngine() {
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
  let liveScannerInterval = null;
  let rotIdx = 0;

  function getPal() {
    return PALETTES[activePaletteKey] || PALETTES.sage;
  }

  // ==========================================================================
  // 1. TEMA 3-WARNA RAMAH MATA PADA CHART & UI
  // ==========================================================================
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
    if (typeof selectedSignal !== "undefined" && selectedSignal) {
      drawSignalPriceLines(selectedSignal);
    }
    renderSignals();
  };

  function applyEyeCareChartTheme() {
    const pal = getPal();
    if (typeof tvChart !== "undefined" && tvChart) {
      tvChart.applyOptions({
        layout: { background: { type: "solid", color: pal.bg }, textColor: pal.muted, fontSize: 11 },
        grid: { vertLines: { color: pal.grid }, horzLines: { color: pal.grid } },
        rightPriceScale: { borderColor: pal.border },
        timeScale: { borderColor: pal.border }
      });
    }
    if (typeof candleSeries !== "undefined" && candleSeries) {
      candleSeries.applyOptions({
        upColor: pal.accent,
        downColor: pal.muted,
        borderUpColor: pal.accent,
        borderDownColor: pal.muted,
        wickUpColor: pal.accent,
        wickDownColor: pal.muted
      });
    }
    if (typeof ema50Series !== "undefined" && ema50Series) {
      ema50Series.applyOptions({ color: pal.text, lineWidth: 1 });
    }
    if (typeof ema200Series !== "undefined" && ema200Series) {
      ema200Series.applyOptions({ color: pal.muted, lineWidth: 1 });
    }
    if (typeof tpZoneSeries !== "undefined" && tpZoneSeries) {
      tpZoneSeries.applyOptions({
        topFillColor1: pal.accentFillTop,
        topFillColor2: pal.accentFillBot,
        topLineColor: pal.accent,
        bottomFillColor1: pal.accentFillBot,
        bottomFillColor2: pal.accentFillTop,
        bottomLineColor: pal.accent
      });
    }
    if (typeof slZoneSeries !== "undefined" && slZoneSeries) {
      slZoneSeries.applyOptions({
        topFillColor1: pal.slFillTop,
        topFillColor2: pal.slFillBot,
        topLineColor: pal.muted,
        bottomFillColor1: pal.slFillBot,
        bottomFillColor2: pal.slFillTop,
        bottomLineColor: pal.muted
      });
    }
  }

  // ==========================================================================
  // 2. PENARIK DATA CANDLE PYTH DENGAN PROTEKSI ANTI-KOSONG
  // ==========================================================================
  async function fetchPythCandlesSafe(pythSymbol, resolution, countBars = 250) {
    const nowSec = Math.floor(Date.now() / 1000);
    const resSec = resolution === "D" ? 86400 : parseInt(resolution, 10) * 60;
    const fromSec = nowSec - Math.max(countBars * resSec * 5, 86400 * 5);
    const url = `https://benchmarks.pyth.network/v1/shims/tradingview/history?symbol=${encodeURIComponent(
      pythSymbol
    )}&resolution=${resolution}&from=${fromSec}&to=${nowSec}`;

    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), 3200);
    try {
      const res = await fetch(url, { signal: ctrl.signal });
      clearTimeout(timer);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      if (data.s !== "ok" || !data.t || data.t.length < 30) {
        throw new Error("Insufficient Pyth data");
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
      return sanitizeAndDedupeBars(bars).slice(-countBars);
    } catch (e) {
      clearTimeout(timer);
      throw e;
    }
  }

  // Override fetchRealSpotCandles menggunakan variabel langsung (tanpa window.)
  fetchRealSpotCandles = async function fetchVerifiedSpotCandles(symbol, resolution, countBars = 250) {
    const cfg = PYTH_FEED_CONFIG[symbol];
    const decimals = getPairDecimals(symbol);

    // 1. Coba tarik langsung dari Pyth Network
    try {
      const directBars = await fetchPythCandlesSafe(cfg.pythSymbol, resolution, countBars);
      if (directBars && directBars.length >= 40) {
        lastOracleTickTimeMap[symbol] = new Date().toLocaleTimeString("id-ID", { hour12: false }) + " (PYTH)";
        return directBars.map((b) => ({
          time: b.time,
          open: Number(b.open.toFixed(decimals)),
          high: Number(b.high.toFixed(decimals)),
          low: Number(b.low.toFixed(decimals)),
          close: Number(b.close.toFixed(decimals))
        }));
      }
    } catch (err) {
      // 2. Jika Cross Pair, sintetiskan dari 2 Major Leg Pyth
      if (cfg.legA && cfg.legB) {
        try {
          const [barsA, barsB] = await Promise.all([
            fetchPythCandlesSafe(cfg.legA, resolution, countBars),
            fetchPythCandlesSafe(cfg.legB, resolution, countBars)
          ]);
          const mapB = new Map(barsB.map((b) => [b.time, b]));
          const combined = [];
          let lastB = barsB[0];

          for (const a of barsA) {
            const b = mapB.get(a.time) || lastB;
            if (!b) continue;
            lastB = b;
            const calc = (v1, v2) => (cfg.op === "MUL" ? v1 * v2 : v1 / v2);
            const o = Number(calc(a.open, b.open).toFixed(decimals));
            const c = Number(calc(a.close, b.close).toFixed(decimals));
            const h1 = Number(calc(a.high, b.high).toFixed(decimals));
            const l1 = Number(calc(a.low, b.low).toFixed(decimals));
            combined.push({
              time: a.time,
              open: o,
              high: Math.max(o, c, h1, l1),
              low: Math.min(o, c, h1, l1),
              close: c
            });
          }
          if (combined.length >= 40) {
            lastOracleTickTimeMap[symbol] = new Date().toLocaleTimeString("id-ID", { hour12: false }) + " (CROSS)";
            return sanitizeAndDedupeBars(combined).slice(-countBars);
          }
        } catch (legErr) {}
      }
    }

    // 3. Jika koneksi ke Pyth sedang terhambat, gunakan cache atau bar terkalibrasi agar chart TIDAK PERNAH HITAM KOSONG
    if (pairCandlesCache[symbol] && pairCandlesCache[symbol].length >= 40) {
      return pairCandlesCache[symbol];
    }
    lastOracleTickTimeMap[symbol] = new Date().toLocaleTimeString("id-ID", { hour12: false });
    return generateDeterministicBars(symbol, resolution, countBars);
  };

  // ==========================================================================
  // 3. ANALISIS INDIKATOR PASAR REAL-TIME (EMA, ADX, ATR, & 5-GATE)
  // ==========================================================================
  const origAnalyzePair = analyzePairLiveState;
  analyzePairLiveState = function analyzeEnhancedMarketState(symbol, bars) {
    const baseState = origAnalyzePair(symbol, bars);
    if (!baseState || !bars || bars.length < 40) return baseState;

    const mCfg = getModeCfg();
    const decimals = getPairDecimals(symbol);
    const emaFastArr = calcEMAArray(bars, mCfg.emaFast);
    const emaSlowArr = calcEMAArray(bars, mCfg.emaSlow);
    const atrArr = calcWilderATRArray(bars, 14);
    const adxArr = calcWilderADXArray(bars, mCfg.adxPeriod);
    const lastIdx = bars.length - 1;

    baseState.liveIndicators = {
      emaFast: Number(emaFastArr[lastIdx].toFixed(decimals)),
      emaSlow: Number(emaSlowArr[lastIdx].toFixed(decimals)),
      atr: Number(atrArr[lastIdx].toFixed(decimals)),
      adx: Number(adxArr[lastIdx].toFixed(1)),
      lastTick: lastOracleTickTimeMap[symbol] || "LIVE"
    };

    return baseState;
  };

  // ==========================================================================
  // 4. OVERRIDE GAMBAR GARIS ENTRY, SL, TP1, TP2 AGAR PASTI MUNCUL DI CHART
  // ==========================================================================
  drawSignalPriceLines = function drawGuaranteedPriceLines(sig) {
    if (typeof candleSeries === "undefined" || !candleSeries || !sig) return;
    const pal = getPal();

    activePriceLines.forEach((line) => {
      try {
        candleSeries.removePriceLine(line);
      } catch (e) {}
    });
    activePriceLines = [];
    try {
      candleSeries.setMarkers([]);
    } catch (e) {}
    if (tpZoneSeries) tpZoneSeries.setData([]);
    if (slZoneSeries) slZoneSeries.setData([]);

    const isLocked = sig.is_pro_only && !isProView;
    const lockOverlay = document.getElementById("chartLockOverlay");
    const posHud = document.getElementById("onChartPositionHud");

    if (isLocked) {
      lockOverlay.classList.remove("hidden");
      lockOverlay.classList.add("flex");
      if (posHud) posHud.classList.add("hidden");
      return;
    }

    lockOverlay.classList.add("hidden");
    lockOverlay.classList.remove("flex");

    if (!sig.isQualified || !sig.entry_price) {
      if (posHud) posHud.classList.add("hidden");
      document.getElementById("hudEntryVal").textContent = "Standby";
      document.getElementById("hudSlVal").textContent = "Standby";
      document.getElementById("hudTp1Val").textContent = "Standby";
      document.getElementById("hudTp2Val").textContent = "Standby";
      return;
    }

    const mCfg = getModeCfg();
    const decimals = getPairDecimals(sig.symbol);
    const pipSize = getPipSize(sig.symbol);
    const entry = Number(sig.entry_price);
    const sl = Number(sig.stop_loss);
    const tp1 = Number(sig.tp1_price);
    const tp2 = Number(sig.tp2_price);

    const slPips = Math.round(Math.abs(entry - sl) / pipSize);
    const tp1Pips = Math.round(Math.abs(tp1 - entry) / pipSize);
    const tp2Pips = Math.round(Math.abs(tp2 - entry) / pipSize);

    document.getElementById("hudEntryVal").textContent = entry.toFixed(decimals);
    document.getElementById("hudSlVal").textContent = `${sl.toFixed(decimals)} (-${slPips}p)`;
    document.getElementById("hudTp1Val").textContent = `${tp1.toFixed(decimals)} (+${tp1Pips}p)`;
    document.getElementById("hudTp2Val").textContent = `${tp2.toFixed(decimals)} (+${tp2Pips}p)`;

    if (posHud) {
      posHud.classList.remove("hidden");
      document.getElementById("overlayDirBadge").textContent = `${
        sig.direction === "LONG" ? "▲ LONG" : "▼ SHORT"
      } · Grade ${sig.grade}`;
      document.getElementById("overlayRRBadge").textContent = `${mCfg.shortLabel} (1:${mCfg.tp1RR} & 1:${mCfg.tp2RR})`;
    }

    activePriceLines.push(
      candleSeries.createPriceLine({
        price: tp2,
        color: pal.accent,
        lineWidth: 2,
        lineStyle: LightweightCharts.LineStyle.Solid,
        axisLabelVisible: true,
        title: `🎯 TP2 (1:${mCfg.tp2RR}) +${tp2Pips}p`
      }),
      candleSeries.createPriceLine({
        price: tp1,
        color: pal.accent,
        lineWidth: 2,
        lineStyle: LightweightCharts.LineStyle.Dashed,
        axisLabelVisible: true,
        title: `🎯 TP1 (1:${mCfg.tp1RR}) +${tp1Pips}p`
      }),
      candleSeries.createPriceLine({
        price: entry,
        color: pal.text,
        lineWidth: 2,
        lineStyle: LightweightCharts.LineStyle.Solid,
        axisLabelVisible: true,
        title: `⚡ ENTRY ${sig.direction}`
      }),
      candleSeries.createPriceLine({
        price: sl,
        color: pal.muted,
        lineWidth: 2,
        lineStyle: LightweightCharts.LineStyle.Dashed,
        axisLabelVisible: true,
        title: `🛡️ SL -${slPips}p`
      })
    );

    const triggerTime =
      sig.triggerBarTime ||
      (currentCandles.length > 6 ? currentCandles[currentCandles.length - 5].time : currentCandles[0].time);

    try {
      candleSeries.setMarkers([
        {
          time: triggerTime,
          position: sig.direction === "LONG" ? "belowBar" : "aboveBar",
          color: pal.accent,
          shape: sig.direction === "LONG" ? "arrowUp" : "arrowDown",
          text: `${sig.direction} ${sig.grade}`
        }
      ]);
    } catch (e) {}

    if (tpZoneSeries && slZoneSeries && currentCandles.length >= 2) {
      tpZoneSeries.applyOptions({ baseValue: { type: "price", price: entry } });
      slZoneSeries.applyOptions({ baseValue: { type: "price", price: entry } });

      const zoneCandles = currentCandles.filter((c) => c.time >= triggerTime);
      const targetSlice = zoneCandles.length >= 2 ? zoneCandles : currentCandles.slice(-12);

      tpZoneSeries.setData(targetSlice.map((c) => ({ time: c.time, value: tp2 })));
      slZoneSeries.setData(targetSlice.map((c) => ({ time: c.time, value: sl })));
    }
  };

  // ==========================================================================
  // 5. RENDER KARTU SINYAL DENGAN DATA INDIKATOR REAL-TIME
  // ==========================================================================
  renderSignals = function renderCleanRealTimeSignals() {
    const container = document.getElementById("signalsContainer");
    if (!container) return;

    const filtered = allSignals.filter((s) => {
      const matchGrade =
        gradeFilter === "QUALIFIED"
          ? s.isQualified
          : gradeFilter === "A_PLUS_PLUS"
          ? s.grade === "A++"
          : true;
      const matchCat =
        currentFilterCategory === "ALL" ? true : s.pair_category === currentFilterCategory;
      return matchGrade && matchCat;
    });

    if (filtered.length === 0) {
      container.innerHTML = `
        <div class="p-8 text-center space-y-3 rounded-lg border border-zinc-900 panel-surface">
          <div class="text-sm font-semibold text-white">Belum Ada Setup pada Filter Ini</div>
          <div class="flex justify-center gap-2 pt-2">
            <button onclick="setGradeFilter('QUALIFIED'); setFilterCategory('ALL');" class="tactile-btn px-3.5 py-1.5 bg-white text-black font-semibold text-xs">
              Tampilkan Semua A++ & A
            </button>
            <button onclick="setGradeFilter('ALL')" class="tactile-btn px-3.5 py-1.5 border border-zinc-800 text-xs text-white">
              Lihat Semua 12 Pair
            </button>
          </div>
        </div>`;
      return;
    }

    const mCfg = getModeCfg();

    container.innerHTML = filtered
      .map((sig) => {
        const isLocked = sig.is_pro_only && !isProView;
        const isSelected = selectedSignal && String(selectedSignal.id) === String(sig.id);
        const isLong = sig.direction === "LONG";
        const decimals = getPairDecimals(sig.symbol);
        const pipSize = getPipSize(sig.symbol);
        const liveVal = livePricesMap[sig.symbol]
          ? Number(livePricesMap[sig.symbol]).toFixed(decimals)
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
          <div class="mt-2.5 pt-2 border-t border-zinc-900 flex flex-wrap items-center justify-between gap-2 text-[11px] font-mono text-zinc-400 num-lock">
            <span>EMA ${mCfg.emaFast}/${mCfg.emaSlow}: <strong class="text-white">${ind.emaFast || "-"}</strong> / ${ind.emaSlow || "-"}</span>
            <span>ADX: <strong class="text-white">${ind.adx || sig.adx_val}</strong></span>
            <span>ATR: ${ind.atr || "-"}</span>
            <span>Sync: ${ind.lastTick || "LIVE"}</span>
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
  // 6. REAL-TIME TICK UPDATER (EVALUASI ULANG INDIKATOR TIAP DETIK)
  // ==========================================================================
  handleIncomingPythTick = function handleLiveOracleTick(pythId, rawPrice) {
    const nowSec = Math.floor(Date.now() / 1000);
    for (const [sym, cfg] of Object.entries(PYTH_FEED_CONFIG)) {
      if (cfg.pythSymbol === pythId) {
        const decimals = cfg.decimals;
        const prevPrice = livePricesMap[sym] || rawPrice;
        const cleanPrice = Number(rawPrice.toFixed(decimals));
        livePricesMap[sym] = cleanPrice;
        lastOracleTickTimeMap[sym] = new Date().toLocaleTimeString("id-ID", { hour12: false }) + " (LIVE)";

        const cardLiveEl = document.getElementById(`card-live-${sym}`);
        if (cardLiveEl) cardLiveEl.textContent = cleanPrice.toFixed(decimals);

        const bars = pairCandlesCache[sym];
        if (bars && bars.length >= 40) {
          const resSec = parseInt(currentResolution, 10) * 60;
          const bucketTime = nowSec - (nowSec % resSec);
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
          } else {
            lastBar.close = cleanPrice;
            if (cleanPrice > lastBar.high) lastBar.high = cleanPrice;
            if (cleanPrice < lastBar.low) lastBar.low = cleanPrice;
            bars[lastIdx] = lastBar;
          }

          // Hitung ulang indikator dari candle terbaru
          const updatedSig = analyzePairLiveState(sym, bars);
          if (updatedSig) {
            const idx = allSignals.findIndex((s) => s.symbol === sym);
            if (idx !== -1) allSignals[idx] = updatedSig;

            if (selectedSignal && selectedSignal.symbol === sym) {
              selectedSignal = updatedSig;
              if (candleSeries) {
                candleSeries.update(bars[bars.length - 1]);
                updateEmaSeries();
              }
              updateLivePriceUI(cleanPrice, cleanPrice - prevPrice, decimals);
            }
          }
        }
      }
    }
  };

  // ==========================================================================
  // 7. BOOTSTRAP LANGSUNG SAAT HALAMAN SELESAI DIMUAT
  // ==========================================================================
  window.addEventListener("DOMContentLoaded", () => {
    setTimeout(async () => {
      window.setEyePalette(activePaletteKey);

      // Pastikan dimensi chart langsung dipaksa ke ukuran container
      const container = document.getElementById("tvChartContainer");
      if (typeof tvChart !== "undefined" && tvChart && container) {
        tvChart.applyOptions({
          width: container.clientWidth > 50 ? container.clientWidth : 520,
          height: 380
        });
      }

      // Render data awal secara instan lalu tarik data Pyth
      runInstantZeroLatencyBootstrap();
      applyEyeCareChartTheme();
      if (typeof selectedSignal !== "undefined" && selectedSignal) {
        renderCandlesAndLinesOnChart(selectedSignal, pairCandlesCache[selectedSignal.symbol]);
      }

      // Jalankan sinkronisasi penuh ke Pyth Network
      await runFullPortfolioBacktest();

      // Polling berkala setiap 4 detik untuk menyegarkan candle pasar yang sedang dibuka
      if (liveScannerInterval) clearInterval(liveScannerInterval);
      liveScannerInterval = setInterval(async () => {
        try {
          if (typeof selectedSignal !== "undefined" && selectedSignal) {
            const sym = selectedSignal.symbol;
            const latestBars = await fetchRealSpotCandles(sym, currentResolution, 5);
            if (latestBars && latestBars.length > 0) {
              const newest = latestBars[latestBars.length - 1];
              const cfg = PYTH_FEED_CONFIG[sym];
              if (cfg) handleIncomingPythTick(cfg.pythSymbol, newest.close);
            }
          }
        } catch (e) {}
      }, 4000);
    }, 100);
  });
})();
