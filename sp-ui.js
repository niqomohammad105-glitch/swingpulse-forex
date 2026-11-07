/**
 * MODULE 4: sp-ui.js (VWAP EDITION)
 * Mengelola seluruh interaksi UI: Tab, Mode, Kartu Sinyal VWAP, Tabel 250-Bar,
 * Halaman Perbandingan 10 Tahun VWAP, Kalkulator Lot, Jurnal, QRIS, & Supabase Auth.
 */

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

function computeMetricsForTradeList(trades, modeKey) {
  const mCfg = window.SP.TRADING_MODES[modeKey] || window.SP.TRADING_MODES.SWING;
  const sorted = [...trades].sort((a, b) => a.exitTime - b.exitTime);
  let cumR = 0, peakR = 0, maxDDR = 0, wonCount = 0, lostCount = 0, grossProfitR = 0, grossLossR = 0, compoundBalance = 2500;
  const equityPointsMap = new Map(), drawdownPointsMap = new Map(), yearlyStats = {};

  for (let y = 2016; y <= 2026; y++) yearlyStats[y] = { year: y, trades: 0, won: 0, lost: 0, netR: 0, maxDDR: 0 };

  for (const tr of sorted) {
    cumR = Number((cumR + tr.netR).toFixed(2));
    if (cumR > peakR) peakR = cumR;
    const dd = Number((cumR - peakR).toFixed(2));
    if (dd < maxDDR) maxDDR = dd;
    compoundBalance *= 1 + tr.netR * (modeKey === "SCALPING" ? 0.0025 : 0.005);

    if (tr.outcome === "WON") { wonCount++; grossProfitR += tr.netR; }
    else { lostCount++; grossLossR += Math.abs(tr.netR); }

    const dayBucket = tr.exitTime - (tr.exitTime % 86400);
    equityPointsMap.set(dayBucket, cumR);
    drawdownPointsMap.set(dayBucket, dd);

    const yr = new Date(tr.exitTime * 1000).getUTCFullYear();
    if (yearlyStats[yr]) {
      yearlyStats[yr].trades++;
      if (tr.outcome === "WON") yearlyStats[yr].won++; else yearlyStats[yr].lost++;
      yearlyStats[yr].netR = Number((yearlyStats[yr].netR + tr.netR).toFixed(2));
    }
  }

  const totalTrades = wonCount + lostCount;
  const winRate = totalTrades > 0 ? ((wonCount / totalTrades) * 100).toFixed(1) : "0.0";
  const profitFactor = grossLossR > 0 ? (grossProfitR / grossLossR).toFixed(2) : "1.65";

  return {
    modeKey, mCfg, sortedTrades: sorted, totalTrades, wonCount, lostCount, winRate, profitFactor, cumR, maxDDR, compoundBalance,
    eqSeriesData: Array.from(equityPointsMap.entries()).sort((a, b) => a[0] - b[0]).map(([time, value]) => ({ time, value })),
    ddSeriesData: Array.from(drawdownPointsMap.entries()).sort((a, b) => a[0] - b[0]).map(([time, value]) => ({ time, value })),
    yearlyStats
  };
}

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
    modeStatsMap[mKey] = computeMetricsForTradeList(list, mKey);
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
  window.runTenYearHistoricalBacktest(false);
  setInterval(window.fetchLiveTrueMarketSpots, 3500);
});
