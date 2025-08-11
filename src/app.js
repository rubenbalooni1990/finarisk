async function loadConfig(){
  const res = await fetch('./config/config.json');
  return await res.json();
}

// Compute weighted score (0..10)
function computeScore(tierDef, selections){
  let total = 0;
  for(const [param, def] of Object.entries(tierDef)){
    const w = Number(def.weight ?? 0);
    const choice = selections[param];
    const s = Number(def.options[choice] ?? 0);
    total += (s * (w/100));
  }
  return total; // already 0..10 if options are 0..10 and weights ~100
}

// Limit logic
function assignLimit(tierName, score, avgMonthlySales){
  const sales = Number(avgMonthlySales||0);
  const s = Number(score||0);
  const t = String(tierName).toLowerCase();

  if(t.includes('tier 1') || t.includes('100k')){
    if(s <= 4) return 0;
    const candidate = 10000 + 0.5 * sales;
    return Math.min(100000, candidate);
  }
  if(t.includes('tier 2') || t.includes('1m')){
    if(s < 5) return 0;
    const maxLimit = Math.min(1000000, 0.5 * sales);
    return (s/10) * maxLimit;
  }
  if(t.includes('tier 3') || t.includes('above 1m') || t.includes('> 1m')){
    if(s < 5) return 0;
    const candidate = (s/10) * (0.5 * sales);
    return Math.min(2500000, candidate);
  }
  if(t.includes('tier 4') || t.includes('edp')){
    if(s < 5) return 0;
    return NaN; // Manual
  }
  return NaN;
}

function formatSAR(x){
  if(Number.isNaN(x)) return 'N/A';
  return new Intl.NumberFormat('en-SA', {maximumFractionDigits:0}).format(x);
}

function buildParamsTable(tierDef){
  const tbody = document.getElementById('paramRows');
  tbody.innerHTML = '';

  for(const [param, def] of Object.entries(tierDef)){
    const tr = document.createElement('tr');

    // Parameter
    const tdParam = document.createElement('td');
    tdParam.textContent = param;
    tr.appendChild(tdParam);

    // Weight
    const tdW = document.createElement('td');
    tdW.textContent = def.weight ?? '—';
    tdW.className = 'right';
    tr.appendChild(tdW);

    // Option select
    const tdOpt = document.createElement('td');
    const sel = document.createElement('select');
    sel.dataset.param = param;

    const placeholder = document.createElement('option');
    placeholder.value = '';
    placeholder.textContent = '— Select —';
    sel.appendChild(placeholder);

    for(const [k,v] of Object.entries(def.options || {})){
      const o = document.createElement('option');
      o.value = k;
      o.textContent = k;
      sel.appendChild(o);
    }
    tdOpt.appendChild(sel);
    tr.appendChild(tdOpt);

    // Score (per-option)
    const tdScore = document.createElement('td');
    tdScore.className = 'right';
    tdScore.textContent = '—';
    tr.appendChild(tdScore);

    // Weighted Score (per row)
    const tdWScore = document.createElement('td');
    tdWScore.className = 'right';
    tdWScore.textContent = '—';
    tr.appendChild(tdWScore);

    // change handler
    sel.addEventListener('change', () => {
      const choice = sel.value;
      const optScore = Number(def.options[choice] ?? 0);
      tdScore.textContent = (choice === '' ? '—' : optScore.toFixed(2));
      const w = Number(def.weight ?? 0);
      const wscore = (optScore * (w/100));
      tdWScore.textContent = (choice === '' ? '—' : wscore.toFixed(2));
      recalcTotals();
    });

    tbody.appendChild(tr);
  }
}

function gatherSelections(){
  const selections = {};
  document.querySelectorAll('select[data-param]').forEach(sel => {
    selections[sel.dataset.param] = sel.value;
  });
  return selections;
}

function recalcTotals(){
  const cfg = window.__CFG__;
  const tier = document.getElementById('tierSelect').value;
  const tDef = cfg.tiers[tier];
  const avg = Number(document.getElementById('avgSales').value||0);
  const selections = gatherSelections();

  const score = computeScore(tDef, selections);
  document.getElementById('totalWeightedScore').textContent = score.toFixed(2);
  document.getElementById('scoreOut').textContent = score.toFixed(2);
  const limit = assignLimit(tier, score, avg);
  document.getElementById('limitOut').textContent = formatSAR(limit);
}

(async function init(){
  const cfg = await loadConfig();
  window.__CFG__ = cfg;
  const tiers = cfg.tiers || {};
  const tierSelect = document.getElementById('tierSelect');

  // Populate tier dropdown
  Object.keys(tiers).forEach(name => {
    const opt = document.createElement('option');
    opt.value = name;
    opt.textContent = name;
    tierSelect.appendChild(opt);
  });

  function onTierChange(){
    const tDef = tiers[tierSelect.value];
    buildParamsTable(tDef);
    recalcTotals();
  }

  tierSelect.addEventListener('change', onTierChange);

  // Recalc on avg sales input
  document.getElementById('avgSales').addEventListener('input', recalcTotals);

  // Actions
  document.getElementById('exportJsonBtn').addEventListener('click', () => {
    const payload = {
      customerName: document.getElementById('custName').value,
      crNumber: document.getElementById('crNumber').value,
      unifiedNumber: document.getElementById('unifiedNumber').value,
      vatRegistrationNumber: document.getElementById('vatNumber').value,
      avgMonthlySales: Number(document.getElementById('avgSales').value||0),
      tier: tierSelect.value,
      selections: gatherSelections(),
      weightedScore: Number(document.getElementById('scoreOut').textContent || 0),
      assignedLimit: document.getElementById('limitOut').textContent
    };
    const blob = new Blob([JSON.stringify(payload, null, 2)], {type:'application/json'});
    const url = URL.createObjectURL(blob);
    const a = document.getElementById('downloadLink');
    a.href = url; a.download = 'risk-score-output.json'; a.click();
    setTimeout(()=>URL.revokeObjectURL(url), 4000);
  });

  // Print to PDF (browser's native Save as PDF)
  document.getElementById('printBtn').addEventListener('click', () => {
    window.print();
  });

  // Initial build
  tierSelect.value = Object.keys(tiers)[0];
  onTierChange();
})();