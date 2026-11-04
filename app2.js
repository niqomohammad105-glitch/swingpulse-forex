/**
 * SWINGPULSE EYE-CARE 3-COLOR ENGINE (app2.js)
 * Menghilangkan silau putih (#FFFFFF) pada grafik & kartu sinyal,
 * membedakan warna candlestick dan garis SL/TP dengan 3 warna lembut,
 * serta menyediakan sakelar 3-Palet Ramah Mata (Sage / Graphite / Amber).
 */

(function initEyeCareTerminal() {
  // Definisi 3 Palet (Masing-Masing Ketat Maksimal 3 Keluarga Warna: Base, Soft Text/Muted, & Calm Accent)
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

  function getPal() {
    return PALETTES[activePaletteKey] || PALETTES.sage;
  }

  // Fungsi Ganti Palet 3-Warna dari Navbar
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

  // 1. Terapkan Warna Teduh ke Grafik Utama & Grafik 10 Tahun
  function applyEyeCareChartTheme() {
    const pal = getPal();

    if (window.tvChart) {
      window.tvChart.applyOptions({
        layout: {
          background: { type: "solid", color: pal.bg },
          textColor: pal.muted,
          fontSize: 11
        },
        grid: {
          vertLines: { color: pal.grid },
          horzLines: { color: pal.grid }
        },
        rightPriceScale: { borderColor: pal.border },
        timeScale: { borderColor: pal.border }
      });
    }

    if (window.candleSeries) {
      // Candlestick Bullish memakai Warna 3 (Accent), Bearish memakai Warna 2 (Muted Slate)
      window.candleSeries.applyOptions({
        upColor: pal.accent,
        downColor: pal.muted,
        borderUpColor: pal.accent,
        borderDownColor: pal.muted,
        wickUpColor: pal.accent,
        wickDownColor: pal.muted
      });
    }

    if (window.ema50Series) {
      window.ema50Series.applyOptions({ color: pal.text, lineWidth: 1 });
    }
    if (window.ema200Series) {
      window.ema200Series.applyOptions({ color: pal.muted, lineWidth: 1 });
    }

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
        layout: {
          background: { type: "solid", color: pal.bg },
          textColor: pal.muted
        },
        grid: {
          vertLines: { color: pal.grid },
          horzLines: { color: pal.grid }
        },
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
    if (window.tySwingOverlaySeries) {
      window.tySwingOverlaySeries.applyOptions({ color: pal.text });
    }
    if (window.tyPositionOverlaySeries) {
      window.tyPositionOverlaySeries.applyOptions({ color: pal.muted });
    }
  }

  // 2. Override drawSignalPriceLines agar Garis Entry, SL, dan TP Tidak Menyilaukan Mata
  window.drawSignalPriceLines = function drawEyeCarePriceLines(sig) {
    if (!window.candleSeries || !sig) return;
    const pal = getPal();

    window.activePriceLines.forEach((line) => {
      try {
        window.candleSeries.removePriceLine(line);
      } catch (e) {}
    });
    window.activePriceLines = [];
    try {
      window.candleSeries.setMarkers([]);
    } catch (e) {}
    if (window.tpZoneSeries) window.tpZoneSeries.setData([]);
    if (window.slZoneSeries) window.slZoneSeries.setData([]);

    const isLocked = sig.is_pro_only && !window.isProView;
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

    const mCfg = window.getModeCfg();
    const decimals = window.getPairDecimals(sig.symbol);
    const pipSize = window.getPipSize(sig.symbol);
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

    // Garis TP menggunakan Warna 3 (Accent), Garis Entry menggunakan Warna 2 (Soft Alabaster), Garis SL menggunakan Muted Slate
    window.activePriceLines.push(
      window.candleSeries.createPriceLine({
        price: tp2,
        color: pal.accent,
        lineWidth: 2,
        lineStyle: LightweightCharts.LineStyle.Solid,
        axisLabelVisible: true,
        title: `TP2 (1:${mCfg.tp2RR}) +${tp2Pips}p`
      }),
      window.candleSeries.createPriceLine({
        price: tp1,
        color: pal.accent,
        lineWidth: 1,
        lineStyle: LightweightCharts.LineStyle.Dashed,
        axisLabelVisible: true,
        title: `TP1 (1:${mCfg.tp1RR}) +${tp1Pips}p`
      }),
      window.candleSeries.createPriceLine({
        price: entry,
        color: pal.text,
        lineWidth: 2,
        lineStyle: LightweightCharts.LineStyle.Solid,
        axisLabelVisible: true,
        title: `ENTRY ${sig.direction}`
      }),
      window.candleSeries.createPriceLine({
        price: sl,
        color: pal.muted,
        lineWidth: 1,
        lineStyle: LightweightCharts.LineStyle.Dashed,
        axisLabelVisible: true,
        title: `SL -${slPips}p`
      })
    );

    const triggerTime =
      sig.triggerBarTime ||
      (window.currentCandles.length > 6
        ? window.currentCandles[window.currentCandles.length - 5].time
        : window.currentCandles[0].time);

    try {
      window.candleSeries.setMarkers([
        {
          time: triggerTime,
          position: sig.direction === "LONG" ? "belowBar" : "aboveBar",
          color: pal.accent,
          shape: sig.direction === "LONG" ? "arrowUp" : "arrowDown",
          text: `${sig.direction} ${sig.grade}`
        }
      ]);
    } catch (e) {}

    if (window.tpZoneSeries && window.slZoneSeries && window.currentCandles.length >= 2) {
      window.tpZoneSeries.applyOptions({ baseValue: { type: "price", price: entry } });
      window.slZoneSeries.applyOptions({ baseValue: { type: "price", price: entry } });

      const zoneCandles = window.currentCandles.filter((c) => c.time >= triggerTime);
      const targetSlice = zoneCandles.length >= 2 ? zoneCandles : window.currentCandles.slice(-12);

      window.tpZoneSeries.setData(targetSlice.map((c) => ({ time: c.time, value: tp2 })));
      window.slZoneSeries.setData(targetSlice.map((c) => ({ time: c.time, value: sl })));
    }
  };

  // 3. Override renderSignals() agar Kartu Sinyal Bersih, Rapi, dan Nyaman Dipindai
  window.renderSignals = function renderEyeCareSignals() {
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
        <div class="p-10 text-center space-y-3 rounded-lg border border-zinc-900 panel-surface">
          <div class="text-sm font-semibold text-white">Belum Ada Setup A++ / A pada Filter Ini</div>
          <p class="text-xs text-zinc-400 max-w-sm mx-auto">
            Sistem menahan sinyal di bawah skor 88% untuk menjaga akurasi.
          </p>
          <div class="flex justify-center gap-2 pt-2">
            <button onclick="setGradeFilter('QUALIFIED'); setFilterCategory('ALL');" class="tactile-btn px-3.5 py-1.5 bg-white text-black font-semibold text-xs">
              Tampilkan Semua A++ & A
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

        const activeCardStyle = isSelected
          ? "border-2 border-white"
          : "border border-zinc-900";

        const gradeBadge =
          sig.grade === "A++"
            ? `<span class="text-xs font-mono font-bold px-2.5 py-0.5 rounded bg-white text-black">★ Grade A++ (${sig.confluence_score}%)</span>`
            : sig.grade === "A"
            ? `<span class="text-xs font-mono font-semibold px-2.5 py-0.5 rounded border border-white text-white">Grade A (${sig.confluence_score}%)</span>`
            : `<span class="text-xs font-mono px-2.5 py-0.5 rounded border border-zinc-800 text-zinc-400">Standby (${sig.confluence_score}%)</span>`;

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
        `
          : `
          <div class="pt-3 mt-3 border-t border-zinc-900 flex items-center justify-between text-xs text-zinc-400">
            <span>Menunggu konfirmasi penuh 5-Gerbang untuk merilis level harga.</span>
            <span class="font-mono">ADX ${sig.adx_val}</span>
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
                    : ""
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

  // Inisialisasi otomatis setelah DOM & app.js siap
  window.addEventListener("DOMContentLoaded", () => {
    setTimeout(() => {
      window.setEyePalette(activePaletteKey);
    }, 90);
  });
})();
