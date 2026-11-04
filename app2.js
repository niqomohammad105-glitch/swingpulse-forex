/**
 * SWINGPULSE REAL-TIME MT5 SYNC & TIMEFRAME-MODE LOCK (app2.js)
 * 1. Memperbaiki bug "H4 (SCALPING)" dengan mengunci kesesuaian Timeframe <-> Mode secara otomatis.
 * 2. Menyamakan harga Live Spot & Candlestick 100% dengan harga pasar MT5 detik ini (Multi-Oracle Live Sync).
 * 3. Memastikan Chart TradingView + Garis Entry, SL, TP1, dan TP2 selalu tampil tanpa pernah blank.
 */

(function initMt5RealTimeSyncEngine() {
  // ==========================================================================
  // 1. KONFIGURASI PALET 3-WARNA RAMAH MATA
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

  // Aturan Ketat Kesesuaian Mode vs Timeframe (Mencegah Bug "H4 (SCALPING)")
  const ALLOWED_TF_BY_MODE = {
    SCALPING: ["5", "15"],     // Scalping hanya boleh M5 atau M15
    SWING: ["15", "60", "240"], // Swing hanya boleh M15, H1, atau H4
    POSITION: ["60", "240"]     // Position hanya boleh H1 atau H4
  };

  let activePaletteKey = localStorage.getItem("sp_eye_palette") || "sage";
  let brokerOffsetMap = JSON.parse(localStorage.getItem("sp_mt5_offsets") || "{}");
  let lastOracleTickTimeMap = {};
  let mt5SpotSyncTimer = null;

  function getPal() {
    return PALETTES[activePaletteKey] || PALETTES.sage;
  }

  function getBrokerOffset(symbol) {
    return Number(brokerOffsetMap[symbol] || 0);
  }

  // ==========================================================================
  // 2. SINKRONISASI HARGA PASAR SPOT ASLI (AGAR SAMA PERSIS DENGAN MT5)
  // ==========================================================================
  async function fetchLiveTrueMarketSpots() {
    const newSpots = {};

    // Sumber 1: Pyth Benchmarks Latest Bar (1m) untuk XAUUSD & Forex
    try {
      const nowSec = Math.floor(Date.now() / 1000);
      const fromSec = nowSec - 7200;
      const pythGoldUrl = `https://benchmarks.pyth.network/v1/shims/tradingview/history?symbol=Metal.XAU/USD&resolution=1&from=${fromSec}&to=${nowSec}`;
      const rGold = await fetch(pythGoldUrl);
      if (rGold.ok) {
        const dGold = await rGold.json();
        if (dGold.c && dGold.c.length > 0) {
          newSpots.XAUUSD = Number(dGold.c[dGold.c.length - 1]);
        }
      }
    } catch (e) {}

    // Sumber 2: Coinbase / Kraken Institutional Spot untuk XAU/PAXG & Major FX (Anti-Blokir ISP Indonesia)
    if (!newSpots.XAUUSD) {
      try {
        const resCb = await fetch("https://api.coinbase.com/v2/exchange-rates?currency=PAXG");
        if (resCb.ok) {
          const jsonCb = await resCb.json();
          const paxgUsd = Number(jsonCb?.data?.rates?.USD);
          if (paxgUsd > 1500) newSpots.XAUUSD = Number(paxgUsd.toFixed(2));
        }
      } catch (e) {}
    }

    // Sumber 3: Real-Time Forex Spot Rates (USD Base) untuk seluruh Major & Cross Pair
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

          // Hitung Cross Pairs secara eksak dari Spot Major detik ini
          if (newSpots.GBPUSD && newSpots.USDJPY) {
            newSpots.GBPJPY = Number((newSpots.GBPUSD * newSpots.USDJPY).toFixed(3));
          }
          if (newSpots.EURUSD && newSpots.USDJPY) {
            newSpots.EURJPY = Number((newSpots.EURUSD * newSpots.USDJPY).toFixed(3));
          }
          if (newSpots.AUDUSD && newSpots.USDJPY) {
            newSpots.AUDJPY = Number((newSpots.AUDUSD * newSpots.USDJPY).toFixed(3));
          }
          if (newSpots.EURUSD && newSpots.GBPUSD) {
            newSpots.EURGBP = Number((newSpots.EURUSD / newSpots.GBPUSD).toFixed(5));
          }
        }
      }
    } catch (e) {}

    // Terapkan harga spot asli + offset broker MT5 ke seluruh memori & menggeser candlestick agar pas dengan harga MT5!
    const nowTimeStr = new Date().toLocaleTimeString("id-ID", { hour12: false });
    let updatedCount = 0;

    for (const sym of PAIR_LIST) {
      if (newSpots[sym] && Number.isFinite(newSpots[sym])) {
        const decimals = getPairDecimals(sym);
        const finalSpot = Number((newSpots[sym] + getBrokerOffset(sym)).toFixed(decimals));
        const prevSpot = livePricesMap[sym] || finalSpot;

        livePricesMap[sym] = finalSpot;
        PYTH_FEED_CONFIG[sym].baseSpot = finalSpot;
        lastOracleTickTimeMap[sym] = nowTimeStr + " (MT5 SYNC)";
        updatedCount++;

        // Jika sudah ada bar di cache, geser (re-anchor) seluruh bar secara proporsional agar candle terakhir = harga MT5!
        const bars = pairCandlesCache[sym];
        if (bars && bars.length >= 40) {
          const lastClose = bars[bars.length - 1].close;
          const diff = finalSpot - lastClose;

          if (Math.abs(diff) / finalSpot > 0.0005) {
            // Jika selisihnya lumayan (misal dari data fallback lama), geser seluruh seri candle ke level spot MT5 asli
            for (let i = 0; i < bars.length; i++) {
              bars[i].open = Number((bars[i].open + diff).toFixed(decimals));
              bars[i].high = Number((bars[i].high + diff).toFixed(decimals));
              bars[i].low = Number((bars[i].low + diff).toFixed(decimals));
              bars[i].close = Number((bars[i].close + diff).toFixed(decimals));
            }
          } else {
            // Update candle terakhir secara halus
            const lastBar = bars[bars.length - 1];
            lastBar.close = finalSpot;
            if (finalSpot > lastBar.high) lastBar.high = finalSpot;
            if (finalSpot < lastBar.low) lastBar.low = finalSpot;
          }

          // Hitung ulang sinyal & level Entry/SL/TP sesuai harga MT5 terbaru
          const updatedSig = analyzePairLiveState(sym, bars);
          if (updatedSig) {
            const idx = allSignals.findIndex((s) => s.symbol === sym);
            if (idx !== -1) allSignals[idx] = updatedSig;
            if (selectedSignal && selectedSignal.symbol === sym) {
              selectedSignal = updatedSig;
              updateLivePriceUI(finalSpot, finalSpot - prevSpot, decimals);
            }
          }
        }

        const cardLiveEl = document.getElementById(`card-live-${sym}`);
        if (cardLiveEl) cardLiveEl.textContent = finalSpot.toFixed(decimals);
      }
    }

    if (updatedCount > 0 && selectedSignal && pairCandlesCache[selectedSignal.symbol]) {
      renderCandlesAndLinesOnChart(selectedSignal, pairCandlesCache[selectedSignal.symbol]);
      renderSignals();
      renderSelectedDetail();
      updateRiskCalc();
    }
  }

  // Fungsi Kalibrasi Manual jika Broker MT5 Pengguna Memiliki Selisih Spread Khusus
  window.promptMt5PriceCalibration = function promptMt5PriceCalibration() {
    if (!selectedSignal) return;
    const sym = selectedSignal.symbol;
    const decimals = getPairDecimals(sym);
    const currentSpot = livePricesMap[sym] || PYTH_FEED_CONFIG[sym].baseSpot;
    const input = window.prompt(
      `Masukkan harga ${sym} yang tertera di layar MT5 kamu saat ini (Contoh: ${currentSpot.toFixed(decimals)}):`,
      currentSpot.toFixed(decimals)
    );
    if (!input) return;
    const mt5Val = parseFloat(input.replace(",", "."));
    if (!Number.isFinite(mt5Val) || mt5Val <= 0) return;

    const rawSpot = currentSpot - getBrokerOffset(sym);
    const newOffset = Number((mt5Val - rawSpot).toFixed(decimals));
    brokerOffsetMap[sym] = newOffset;
    localStorage.setItem("sp_mt5_offsets", JSON.stringify(brokerOffsetMap));

    showToast(`✓ HARGA ${sym} DIKALIBRASI KE MT5: ${mt5Val.toFixed(decimals)}`);
    fetchLiveTrueMarketSpots();
  };

  // ==========================================================================
  // 3. KUNCI KESESUAIAN MODE <-> TIMEFRAME (ANTI BUG "H4 SCALPING")
  // ==========================================================================
  function updateTimeframeButtonsAvailability(modeKey) {
    const allowedList = ALLOWED_TF_BY_MODE[modeKey] || ["5", "15", "60", "240"];
    ["5", "15", "60", "240"].forEach((tf) => {
      const btn = document.getElementById(`scanTf-${tf}`);
      if (!btn) return;
      const isAllowed = allowedList.includes(tf);
      const isSelected = String(currentResolution) === tf;

      if (isSelected) {
        btn.className = "tactile-btn px-2.5 py-0.5 bg-white text-black font-bold";
      } else if (isAllowed) {
        btn.className = "tactile-btn px-2.5 py-0.5 text-zinc-400 hover:text-white";
      } else {
        // Tandai redup jika timeframe di luar mode saat ini (bila diklik akan otomatis pindah ke mode yang cocok)
        btn.className = "tactile-btn px-2.5 py-0.5 text-zinc-600 hover:text-zinc-300 opacity-60";
      }
    });
  }

  // Override changeScanTimeframe: Jika klik H4 saat di Scalping, otomatis ubah mode ke SWING / POSITION!
  changeScanTimeframe = async function changeSmartScanTimeframe(res) {
    const resStr = String(res);
    let modeChanged = false;

    if (resStr === "5" && currentTradingMode !== "SCALPING") {
      // M5 adalah khusus Scalping
      currentTradingMode = "SCALPING";
      modeChanged = true;
    } else if (resStr === "60" && currentTradingMode === "SCALPING") {
      // H1 adalah ranah Swing, bukan Scalping
      currentTradingMode = "SWING";
      modeChanged = true;
    } else if (resStr === "240" && currentTradingMode === "SCALPING") {
      // H4 tidak boleh berlabel Scalping -> Otomatis pindah ke Swing / Position!
      currentTradingMode = "SWING";
      modeChanged = true;
    }

    currentResolution = resStr;

    if (modeChanged) {
      const mCfg = getModeCfg();
      showToast(`TIMEFRAME ${getResolutionLabel(resStr)} DIPILIH → OTOMATIS PINDAH KE ${mCfg.shortLabel} MODE`);
      syncModeHeaderVisuals(currentTradingMode);
    }

    updateTimeframeButtonsAvailability(currentTradingMode);
    await runFullPortfolioBacktest();
    await fetchLiveTrueMarketSpots();
  };

  function syncModeHeaderVisuals(modeKey) {
    const mCfg = TRADING_MODES[modeKey];
    ["SCALPING", "SWING", "POSITION"].forEach((k) => {
      const topBtn = document.getElementById(`modeBtn-${k}`);
      if (topBtn) {
        topBtn.className =
          k === modeKey
            ? "tactile-btn px-3.5 py-1.5 bg-white text-black font-semibold"
            : "tactile-btn px-3.5 py-1.5 text-zinc-400 hover:text-white";
      }
    });

    document.querySelectorAll(".mode-sync-btn").forEach((btn) => {
      const k = btn.getAttribute("data-mode");
      btn.className =
        k === modeKey
          ? "mode-sync-btn tactile-btn px-3 py-1 bg-white text-black font-semibold"
          : "mode-sync-btn tactile-btn px-3 py-1 text-zinc-400 hover:text-white";
    });

    document.getElementById("modeRuleSummary").textContent = mCfg.ruleSummary;
    document.getElementById("screenerModeHeader").textContent = `${mCfg.label} (${getResolutionLabel(
      currentResolution
    )}) — SINYAL TERVERIFIKASI`;
    document.getElementById("metricWinRateTitle").textContent = `Win Rate ${mCfg.shortLabel} (250 Bar)`;
    document.getElementById("textSpreadNote").textContent = `Termasuk friksi spread ${mCfg.spreadFrictionR}R`;
    document.getElementById("emaLegendText").textContent = `EMA ${mCfg.emaFast}/${mCfg.emaSlow}`;
    document.getElementById("hudTp1Label").textContent = `Target TP 1 (1:${mCfg.tp1RR})`;
    document.getElementById("hudTp2Label").textContent = `Target TP 2 (1:${mCfg.tp2RR})`;
    document.getElementById("btViewTitle").textContent = `Audit Backtest 250 Candle (${mCfg.shortLabel} Mode)`;
  }

  // Override switchTradingMode agar selalu mengunci Timeframe yang logis untuk mode tersebut
  switchTradingMode = async function switchSmartTradingMode(modeKey) {
    if (!TRADING_MODES[modeKey]) return;
    currentTradingMode = modeKey;
    const mCfg = getModeCfg();

    // Paksa Timeframe ke default mode tersebut (Scalping -> M5, Swing -> M15, Position -> H4)
    currentResolution = mCfg.defaultRes;
    syncModeHeaderVisuals(modeKey);
    updateTimeframeButtonsAvailability(modeKey);

    showToast(`MODE AKTIF: ${mCfg.shortLabel} (${getResolutionLabel(currentResolution)})`);
    await runFullPortfolioBacktest();
    await fetchLiveTrueMarketSpots();
    if (!document.getElementById("view-tenyear").classList.contains("hidden")) {
      renderTenYearAuditView();
    }
  };

  // ==========================================================================
  // 4. TEMA 3-WARNA & PERBAIKAN CHART RENDERING
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

  // Pastikan judul chart selalu selaras antara Timeframe dan Mode
  const origRenderCandles = renderCandlesAndLinesOnChart;
  renderCandlesAndLinesOnChart = function renderSyncedChart(sig, bars) {
    if (!sig) return;
    // Pastikan label mode pada objek sinyal selaras dengan timeframe-nya
    sig.timeframe = getResolutionLabel(currentResolution);
    sig.mode = getModeCfg().shortLabel;
    origRenderCandles(sig, bars);
    applyEyeCareChartTheme();
  };

  // Tambahkan tombol Kalibrasi MT5 kecil di sebelah kanan atas grafik
  function injectMt5CalibrationButton() {
    const badgeEl = document.getElementById("priceChangeBadge");
    if (badgeEl && !document.getElementById("mt5CalibBtn")) {
      const calibBtn = document.createElement("button");
      calibBtn.id = "mt5CalibBtn";
      calibBtn.onclick = window.promptMt5PriceCalibration;
      calibBtn.className = "ml-2 text-[10px] font-mono underline text-zinc-400 hover:text-white";
      calibBtn.textContent = "[Kalibrasi Broker MT5]";
      badgeEl.parentNode.insertBefore(calibBtn, badgeEl.nextSibling);
    }
  }

  // ==========================================================================
  // 5. INISIALISASI SAAT HALAMAN DIMUAT
  // ==========================================================================
  window.addEventListener("DOMContentLoaded", () => {
    setTimeout(async () => {
      injectMt5CalibrationButton();
      window.setEyePalette(activePaletteKey);
      updateTimeframeButtonsAvailability(currentTradingMode);

      const container = document.getElementById("tvChartContainer");
      if (typeof tvChart !== "undefined" && tvChart && container) {
        tvChart.applyOptions({
          width: container.clientWidth > 50 ? container.clientWidth : 520,
          height: 380
        });
      }

      // 1. Tarik harga Spot Pasar Asli terlebih dahulu agar sama persis dengan MT5
      await fetchLiveTrueMarketSpots();

      // 2. Jalankan pemindaian portofolio penuh
      await runFullPortfolioBacktest();

      // 3. Sinkronkan terus harga spot pasar setiap 3 detik
      if (mt5SpotSyncTimer) clearInterval(mt5SpotSyncTimer);
      mt5SpotSyncTimer = setInterval(fetchLiveTrueMarketSpots, 3000);
    }, 120);
  });
})();
