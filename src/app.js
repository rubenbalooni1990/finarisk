async function loadConfig(){
  const res = await fetch('./config/config.json');
  return await res.json();
}

// ===== Validation helpers =====
const re10 = /^\d{10}$/;
const re15 = /^\d{15}$/;

function setError(el, errEl, msg){
  if(!el) return;
  if(msg){
    el.classList.add('error-border');
    if(errEl){ errEl.textContent = msg; }
  }else{
    el.classList.remove('error-border');
    if(errEl){ errEl.textContent = ''; }
  }
}

function validateCustomerSection(){
  const cr = document.getElementById('crNumber');
  const uni = document.getElementById('unifiedNumber');
  const vat = document.getElementById('vatNumber');
  const avg = document.getElementById('avgSales');

  let ok = true;

  if(!re10.test((cr.value||'').trim())){
    setError(cr, document.getElementById('err_crNumber'), 'CR Number must be exactly 10 digits.');
    ok = false;
  }else setError(cr, document.getElementById('err_crNumber'), '');

  if(!re10.test((uni.value||'').trim())){
    setError(uni, document.getElementById('err_unifiedNumber'), 'Unified Number must be exactly 10 digits.');
    ok = false;
  }else setError(uni, document.getElementById('err_unifiedNumber'), '');

  if(!re15.test((vat.value||'').trim())){
    setError(vat, document.getElementById('err_vatNumber'), 'VAT Registration Number must be exactly 15 digits.');
    ok = false;
  }else setError(vat, document.getElementById('err_vatNumber'), '');

  if(avg.value !== '' && Number(avg.value) < 0){
    setError(avg, document.getElementById('err_avgSales'), 'Average Monthly Sales must be zero or positive.');
    ok = false;
  }else setError(avg, document.getElementById('err_avgSales'), '');

  document.getElementById('tierSelect').disabled = !ok;
  const paramsSection = document.getElementById('paramsSection');
  if(ok) paramsSection.classList.remove('disabled'); else paramsSection.classList.add('disabled');

  document.getElementById('exportJsonBtn').disabled = !ok;
  document.getElementById('printBtn').disabled = !ok;

  document.getElementById('tierLockNote').style.display = ok ? 'none' : 'block';

  if(!ok){
    document.getElementById('totalWeightedScore').textContent = '—';
    document.getElementById('scoreOut').textContent = '—';
    document.getElementById('limitOut').textContent = '—';
  }
  return ok;
}

// ===== Scoring =====
function computeScore(tierDef, selections){
  let total = 0;
  for(const [param, def] of Object.entries(tierDef)){
    const w = Number(def.weight ?? 0);
    const choice = selections[param];
    const s = Number(def.options[choice] ?? 0);
    total += (s * (w/100));
  }
  return total; // 0..10
}

// ===== Limit logic =====
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

// ===== Parameter ordering =====
const ORDER_T1 = [
  'Business Age (Months)',
  'CR Status (Active/Expired)',
  'Legal Structure',
  'Owner–Manager Match',
  'Relationship with Sary/SilQ (Based on No. of Transactions Only)',
  'Last Transaction Recency with Sary/SilQ'
];

const ORDER_T2 = [
  'Business Age (Months)',
  'CR Status (Active/Expired)',
  'Document Expiry Risk',
  'Legal Structure',
  'National Address Match',
  'Owner–Manager Match',
  'SIMAH (Business) – Defaults',
  'SIMAH (Business) – Facility-to-Lender Ratio',
  'Debt Capacity-to-Sales Ratio',
  'SIMAH (Owner) – Score',
  'Relationship with Sary/SilQ (Based on No. of Transactions Only)',
  'Last Transaction Recency with Sary/SilQ'
];

const ORDER_T3 = [
  'Business Age (Months)',
  'CR Status (Active/Expired)',
  'Document Expiry Risk',
  'Legal Structure',
  'National Address Match',
  'Saudization Band',
  'Owner–Manager Match',
  'Relationship with Sary/SilQ (Based on No. of Transactions Only)',
  'Last Transaction Recency with Sary/SilQ',
  'SIMAH (Business) – Defaults',
  'SIMAH (Business) – Facility-to-Lender Ratio',
  'SIMAH (Owner) – Score',
  'Debt Capacity-to-Sales Ratio',
  'Gross Profit Margin (GPM) - Financial Statements',
  'Net Profit Margin (NPM) - Financial Statements'
];

const ORDER_T4 = [
  ...ORDER_T3,
  'Current Ratio (CR) - Financial Statements',
  'Debt-to-Equity Ratio (D/E) - Financial Statements'
];

function detectTierNumberFromKey(key){
  const k = String(key).toLowerCase();
  if(k.includes('tier 1') || k.includes('100k')) return 1;
  if(k.includes('tier 2') || k.includes('1m')) return 2;
  if(k.includes('tier 3') || k.includes('> 1m') || k.includes('above 1m')) return 3;
  if(k.includes('tier 4') || k.includes('edp')) return 4;
  return 0;
}

function orderedParamEntries(tierKey, tierDef){
  const tnum = detectTierNumberFromKey(tierKey);
  let order = [];
  if(tnum === 1) order = ORDER_T1;
  else if(tnum === 2) order = ORDER_T2;
  else if(tnum === 3) order = ORDER_T3;
  else if(tnum === 4) order = ORDER_T4;

  const entries = Object.entries(tierDef);
  if(order.length === 0) return entries;

  const map = new Map(entries);
  const res = [];
  for(const name of order){
    if(map.has(name)) res.push([name, map.get(name)]);
  }
  for(const [k,v] of entries){
    if(!order.includes(k)) res.push([k,v]);
  }
  return res;
}

// ===== UI builders =====
function buildParamsTable(tierKey, tierDef){
  const tbody = document.getElementById('paramRows');
  tbody.innerHTML = '';

  const rows = orderedParamEntries(tierKey, tierDef);

  for(const [param, def] of rows){
    const tr = document.createElement('tr');

    // Parameter
    const tdParam = document.createElement('td');
    tdParam.textContent = param;
    tr.appendChild(tdParam);

    // Weight with %
    const tdW = document.createElement('td');
    const w = (def.weight ?? '');
    tdW.textContent = (w === '' || w === null) ? '—' : `${Number(w).toString()}%`;
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
      const wNum = Number(def.weight ?? 0);
      const wscore = (optScore * (wNum/100));
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
  const tierKey = document.getElementById('tierSelect').value;
  const tDef = cfg.tiers[tierKey];
  const avg = Number(document.getElementById('avgSales').value||0);
  const selections = gatherSelections();

  const score = computeScore(tDef, selections);
  document.getElementById('totalWeightedScore').textContent = score.toFixed(2);
  document.getElementById('scoreOut').textContent = score.toFixed(2);
  const limit = assignLimit(tierKey, score, avg);
  document.getElementById('limitOut').textContent = formatSAR(limit);
}

// ===== Init =====
(async function init(){
  const cfg = await loadConfig();
  window.__CFG__ = cfg;
  const tiers = cfg.tiers || {};
  const tierSelect = document.getElementById('tierSelect');

  // Populate tier dropdown (keep original keys as-is)
  Object.keys(tiers).forEach(name => {
    const opt = document.createElement('option');
    opt.value = name;
    opt.textContent = name;
    tierSelect.appendChild(opt);
  });

  function onTierChange(){
    const key = tierSelect.value;
    const tDef = tiers[key];
    buildParamsTable(key, tDef);
    recalcTotals();
  }
  tierSelect.addEventListener('change', onTierChange);

  // Recalc on avg sales input
  document.getElementById('avgSales').addEventListener('input', () => {
    if(validateCustomerSection()) recalcTotals();
  });

  // Live-validate customer inputs
  ['crNumber','unifiedNumber','vatNumber','avgSales'].forEach(id => {
    const el = document.getElementById(id);
    el.addEventListener('input', () => {
      const ok = validateCustomerSection();
      if(ok) recalcTotals();
    });
  });

  // Export JSON
  document.getElementById('exportJsonBtn').addEventListener('click', () => {
    if(!validateCustomerSection()) return;
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

  // Download PDF (uses browser print dialog)
  document.getElementById('printBtn').addEventListener('click', () => {
    if(!validateCustomerSection()) return;
    window.print();
  });

  // Initial state
  validateCustomerSection();
  // If config has tiers, preselect first (will remain disabled until valid details entered)
  const tierKeys = Object.keys(tiers);
  if(tierKeys.length){
    tierSelect.value = tierKeys[0];
  }
})();