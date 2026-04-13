'use strict';

// ─── DOM ──────────────────────────────────────────────────────────────────────
const tmInput         = document.getElementById('tm-input');
const validationMsg   = document.getElementById('validation-msg');
const runBtn          = document.getElementById('run-btn');
const resetBtn        = document.getElementById('reset-btn');
const tapeContainer   = document.getElementById('tape-container');
const stateFlowEl     = document.getElementById('state-flow');
const colIndicatorEl  = document.getElementById('col-indicator');
const playbackCtrls   = document.getElementById('playback-controls');
const progressWrap    = document.getElementById('progress-bar-wrap');
const progressBar     = document.getElementById('progress-bar');
const metaStep        = document.getElementById('meta-step');
const explainBox      = document.getElementById('explain-box');
const explainMain     = document.getElementById('explain-main');
const explainDetail   = document.getElementById('explain-detail');
const explainPhase    = document.getElementById('explain-phase');
const explainIcon     = document.getElementById('explain-icon');
const btnFirst        = document.getElementById('btn-first');
const btnPrev         = document.getElementById('btn-prev');
const btnPlay         = document.getElementById('btn-play');
const btnNext         = document.getElementById('btn-next');
const btnLast         = document.getElementById('btn-last');
const speedSlider     = document.getElementById('speed-slider');
const speedValue      = document.getElementById('speed-value');
const transitionsCard = document.getElementById('transitions-card');
const transitionsBody = document.getElementById('transitions-body');
const transitionsCount= document.getElementById('transitions-count');
const tableWrap       = document.querySelector('.table-wrap');
const resultCard      = document.getElementById('result-card');
const arithDisplay    = document.getElementById('arith-display');
const resultBinary    = document.getElementById('result-binary');
const resultDecimal   = document.getElementById('result-decimal');
const resultStatus    = document.getElementById('result-status');
const loadingOverlay  = document.getElementById('loading-overlay');
const operandCount    = document.getElementById('operand-count');
const operandFields   = document.getElementById('operand-fields');
const previewValue    = document.getElementById('preview-value');
const intermediateEl  = document.getElementById('intermediate-results');
const modalHelp       = document.getElementById('modal-help');
const modalPhases     = document.getElementById('modal-phases');
const btnHelp         = document.getElementById('btn-help');
const btnPhases       = document.getElementById('btn-phases');

// ─── STATE ────────────────────────────────────────────────────────────────────
let simSteps    = [];
let currentStep = -1;
let isPlaying   = false;
let playTimer   = null;
let simResult   = null;
let validateDebounce = null;
let arithColEls = [];
let prevHead    = -1;
let tapeZones   = null;

// ─── DYNAMIC OPERAND INPUT BUILDER ───────────────────────────────────────────
function buildOperandInputs(count) {
  operandFields.innerHTML = '';
  for (let i = 0; i < count; i++) {
    // Operator selector (between operands)
    if (i > 0) {
      const opWrap = document.createElement('div');
      opWrap.className = 'operator-selector';
      opWrap.innerHTML = `
        <select class="op-select" data-op-index="${i - 1}" aria-label="Operator ${i}">
          <option value="+">+</option>
          <option value="-">−</option>
        </select>
      `;
      operandFields.appendChild(opWrap);
    }
    // Operand input
    const fieldWrap = document.createElement('div');
    fieldWrap.className = 'operand-input-wrap';
    fieldWrap.innerHTML = `
      <label class="operand-label" for="operand-${i}">
        <span class="operand-number">${i + 1}</span>
      </label>
      <input
        id="operand-${i}"
        type="text"
        class="operand-input"
        placeholder="e.g. ${['101','11','10','1','110','100','111','1010','1100','1001'][i] || '101'}"
        spellcheck="false"
        autocomplete="off"
        data-operand-index="${i}"
      />
    `;
    operandFields.appendChild(fieldWrap);
  }

  // Add event listeners to all new inputs and selects
  operandFields.querySelectorAll('.operand-input').forEach(inp => {
    inp.addEventListener('input', onOperandChange);
    inp.addEventListener('keydown', e => { if (e.key === 'Enter') runSimulation(); });
  });
  operandFields.querySelectorAll('.op-select').forEach(sel => {
    sel.addEventListener('change', onOperandChange);
  });

  onOperandChange();
}

function getExpression() {
  const count = parseInt(operandCount.value);
  const operands = [];
  const operators = [];

  for (let i = 0; i < count; i++) {
    const inp = document.getElementById(`operand-${i}`);
    operands.push(inp ? inp.value.trim() : '');
  }
  operandFields.querySelectorAll('.op-select').forEach(sel => {
    operators.push(sel.value === '-' ? '-' : '+');
  });

  let expr = operands[0] || '';
  for (let i = 0; i < operators.length; i++) {
    expr += operators[i] + (operands[i + 1] || '');
  }
  return expr;
}

function onOperandChange() {
  const expr = getExpression();
  tmInput.value = expr;
  previewValue.textContent = expr || '—';

  // Add animation class
  previewValue.classList.remove('preview-flash');
  void previewValue.offsetWidth;
  previewValue.classList.add('preview-flash');

  clearTimeout(validateDebounce);
  validateDebounce = setTimeout(() => validateInput(expr), 350);
}

// Initialize with default count
operandCount.addEventListener('change', () => {
  buildOperandInputs(parseInt(operandCount.value));
});
buildOperandInputs(2);

// ─── HEADER MODALS (How it works / Machine phases) ───────────────────────────
function openModal(el) {
  if (!el) return;
  [modalHelp, modalPhases].forEach(m => {
    if (m && m !== el && !m.hidden) closeModal(m);
  });
  el.hidden = false;
  el.setAttribute('aria-hidden', 'false');
  document.body.classList.add('modal-open');
}
function closeModal(el) {
  if (!el) return;
  el.hidden = true;
  el.setAttribute('aria-hidden', 'true');
  if (modalHelp?.hidden && modalPhases?.hidden)
    document.body.classList.remove('modal-open');
}
function closeAllModals() {
  closeModal(modalHelp);
  closeModal(modalPhases);
  document.body.classList.remove('modal-open');
}

btnHelp?.addEventListener('click', () => openModal(modalHelp));
btnPhases?.addEventListener('click', () => openModal(modalPhases));
document.querySelectorAll('[data-modal-close]').forEach(btn => {
  btn.addEventListener('click', () => {
    const id = btn.getAttribute('data-modal-close');
    const m = id ? document.getElementById(id) : null;
    if (m) closeModal(m);
  });
});
[modalHelp, modalPhases].forEach(m => {
  m?.addEventListener('click', e => { if (e.target === m) closeModal(m); });
});

// ─── PHASE FLOW DEFINITION ────────────────────────────────────────────────────
const PHASES = [
  { id:'scan',  label:'Scan',     icon:'👁️',  states:['q0'] },
  { id:'find',  label:'Find Op',  icon:'🔍',  states:['q_find_op'] },
  { id:'pos',   label:'Position', icon:'📍',  states:['q_add_start','q_sub_start'] },
  { id:'calc',  label:'Calculate',icon:'⚡',  states:['q_add','q_carry','q_subtract','q_borrow'] },
  { id:'write', label:'Write',    icon:'✍️',  states:['q_cleanup'] },
  { id:'done',  label:'Done',     icon:'🎉',  states:['q_accept'] },
];
const REJECT_STATES = ['q_reject'];

function phaseOf(state) {
  if (REJECT_STATES.includes(state)) return 'scan';
  return PHASES.find(p => p.states.includes(state))?.id ?? null;
}
function phaseIndex(id) { return PHASES.findIndex(p => p.id === id); }

// ─── STATE FLOW BUILDER ───────────────────────────────────────────────────────
function buildStateFlow() {
  if (!stateFlowEl) return;
  let html = '<div class="sf-wrap">';
  PHASES.forEach((ph, i) => {
    html += `<div class="sf-node" data-phase="${ph.id}">
               <span class="sf-icon">${ph.icon}</span>
               <span class="sf-label">${ph.label}</span>
             </div>`;
    if (i < PHASES.length - 1)
      html += `<div class="sf-arrow">›</div>`;
  });
  html += '</div>';
  stateFlowEl.innerHTML = html;
  stateFlowEl.hidden = false;
}

function updateStateFlow(state) {
  if (!stateFlowEl) return;
  const isReject  = REJECT_STATES.includes(state);
  const curPhase  = phaseOf(state);
  const curIdx    = phaseIndex(curPhase);

  stateFlowEl.querySelectorAll('.sf-node').forEach(node => {
    const pid  = node.dataset.phase;
    const pidx = phaseIndex(pid);
    node.classList.remove('sf-active','sf-done','sf-error');
    if (pid === curPhase && isReject)  node.classList.add('sf-error');
    else if (pid === curPhase)         node.classList.add('sf-active');
    else if (pidx < curIdx)            node.classList.add('sf-done');
  });
}

// ─── HELPERS ──────────────────────────────────────────────────────────────────
const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));
const mk = (cls, tag = 'div') => { const e = document.createElement(tag); e.className = cls.trim(); return e; };
const getDelay = () => Math.round(1200 - (parseInt(speedSlider.value) - 1) * (1120 / 9));
const showLoading = s => { loadingOverlay.hidden = !s; };

// ─── PLAIN-ENGLISH DESCRIPTIONS ───────────────────────────────────────────────
function describe(step, result) {
  const { state, read, write, move } = step;
  const moveName = move==='R'?'right':move==='L'?'left':'staying put';
  const op = result?.operator==='+' ? 'adding' : 'subtracting';
  const sym = s => s==='B' ? 'blank space' : `"${s}"`;

  if (state==='q_accept')   return { icon:'🎉', phase:'Done!',         phaseClass:'phase-done',
    main:'All done! Machine finished successfully.',
    detail:`Final answer on the tape: ${result?.result ?? ''}` };
  if (state==='q_reject')   return { icon:'⛔', phase:'Error',         phaseClass:'phase-error',
    main:'Input rejected — expression not valid.',
    detail: result?.error ?? 'Could not process this input.' };
  if (state==='q0') {
    if (read==='+'||read==='-') return { icon:'🔍', phase:'Scanning', phaseClass:'phase-scan',
      main:`Found "${read}" — operator detected.`,
      detail:`Moving ${moveName} to continue scanning.` };
    return { icon:'👁️', phase:'Scanning', phaseClass:'phase-scan',
      main:`Reading input — saw ${sym(read)} at position ${step.head}.`,
      detail:`Moving ${moveName}.` };
  }
  if (state==='q_find_op')  return { icon:'🔍', phase:'Scanning',     phaseClass:'phase-scan',
    main:`Scanning operand — reading ${sym(read)}.`,
    detail:`Moving ${moveName} to reach the end.` };
  if (state==='q_add_start'||state==='q_sub_start') return { icon:'📍', phase:'Positioning', phaseClass:'phase-scan',
    main:'Positioning head at rightmost bit to start calculation.',
    detail:'Binary arithmetic always starts from the rightmost digit — just like paper math!' };
  if (state==='q_add')      return { icon:'➕', phase:'Adding',        phaseClass:'phase-calc',
    main:`Adding bits — read "${read}", writing result "${write}".`,
    detail:`Bit-by-bit addition from right to left. Moving ${moveName}.` };
  if (state==='q_carry')    return { icon:'↗️', phase:'Carry!',        phaseClass:'phase-carry',
    main:'Carry! 1+1 = 10 in binary — carrying +1 to the next column.',
    detail:'Just like in normal addition: 9+1=10, carry the 1.' };
  if (state==='q_subtract') return { icon:'➖', phase:'Subtracting',   phaseClass:'phase-calc',
    main:`Subtracting bits — read "${read}", result bit "${write}".`,
    detail:`Bit-by-bit subtraction. Moving ${moveName}.` };
  if (state==='q_borrow')   return { icon:'↙️', phase:'Borrow!',       phaseClass:'phase-carry',
    main:'Borrow! Cannot subtract — borrowing 1 from the next position.',
    detail:"Like long subtraction: borrow from the digit to the left." };
  if (state==='q_cleanup')  return { icon:'✍️', phase:'Writing Answer', phaseClass:'phase-clean',
    main:`Writing answer — placing "${read}" on the tape.`,
    detail:'Operator and extra symbols removed. Clean binary result remains.' };
  return { icon:'⚙️', phase:state, phaseClass:'',
    main:`State "${state}": read ${sym(read)}, wrote ${sym(write)}, moved ${moveName}.`,
    detail:`Next: ${step.next_state}` };
}

function updateExplainBox(step) {
  if (!step) { explainBox.hidden = true; return; }
  const d = describe(step, simResult);
  explainBox.hidden = false;
  explainBox.className = 'explain-box ' + (d.phaseClass || '');
  explainIcon.textContent = d.icon;
  explainMain.textContent = d.main;
  explainDetail.textContent = d.detail;
  explainPhase.textContent = d.phase;
}

// ─── VALIDATION ───────────────────────────────────────────────────────────────
async function validateInput(val) {
  if (!val.trim()) { setVal('', null); return; }
  try {
    const r = await fetch('/validate', { method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify({input:val.trim()}) });
    const d = await r.json();
    if (d.valid) { setVal('✓ Valid binary expression','valid'); }
    else         { setVal('✗ '+d.message,'invalid'); }
  } catch { setVal('',null); }
}
function setVal(msg, type) {
  validationMsg.textContent = msg;
  validationMsg.className = 'validation-msg'+(type?' '+type:'');
}

// ─── QUICK EXAMPLES (chips) ──────────────────────────────────────────────────
document.querySelectorAll('.chip').forEach(chip =>
  chip.addEventListener('click', () => {
    const expr = chip.dataset.example;
    const count = parseInt(chip.dataset.count) || 2;

    // Parse the expression to extract operands and operators
    const tokens = expr.split(/(\+|\-)/);
    const operands = [];
    const operators = [];
    tokens.forEach((t, i) => {
      if (i % 2 === 0) operands.push(t);
      else operators.push(t);
    });

    // Set count
    operandCount.value = count;
    buildOperandInputs(count);

    // Fill in values
    operands.forEach((op, i) => {
      const inp = document.getElementById(`operand-${i}`);
      if (inp) inp.value = op;
    });
    operators.forEach((op, i) => {
      const sel = operandFields.querySelectorAll('.op-select')[i];
      if (sel) sel.value = op;
    });

    onOperandChange();
  })
);

// ─── RUN ──────────────────────────────────────────────────────────────────────
runBtn.addEventListener('click', runSimulation);
async function runSimulation() {
  const input = tmInput.value.trim();
  if (!input) { setVal('✗ Please enter binary values in all fields.','invalid'); return; }
  stopPlayback(); showLoading(true); runBtn.disabled=true; prevHead=-1;

  try {
    const res = await fetch('/simulate', { method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify({input}) });
    const data = await res.json();
    if (data.status==='error') { setVal('✗ '+data.error,'invalid'); return; }

    simResult = data; simSteps = data.steps || [];

    // Compute tape zones (use left_operand and right_operand for compatibility)
    if (data.left_operand && data.right_operand) {
      const ll = data.left_operand.length;
      const rl = data.right_operand.length;
      tapeZones = { leftEnd: ll-1, opIdx: ll, rightStart: ll+1, rightEnd: ll+rl };
    }

    buildTransitionTable(simSteps);
    playbackCtrls.hidden=false; progressWrap.hidden=false; transitionsCard.hidden=false;
    resetBtn.disabled=false; updateBtns();

    if (data.status==='accepted') {
      resultBinary.textContent = data.result;
      resultDecimal.textContent = parseInt(data.result, 2);
      resultStatus.textContent  = '✓ Machine Accepted — q_accept reached';
      resultStatus.className    = 'result-status accepted';
      buildArithDisplay(data);

      // Show intermediate results for multi-operand
      if (data.operands && data.operands.length > 2 && data.intermediate_results) {
        showIntermediateResults(data);
      } else {
        intermediateEl.hidden = true;
      }
    } else {
      resultBinary.textContent = '—'; resultDecimal.textContent = '—';
      resultStatus.textContent = '✗ Machine Rejected — '+data.error;
      resultStatus.className   = 'result-status rejected';
      arithDisplay.innerHTML  = ''; arithColEls = [];
      intermediateEl.hidden = true;
    }
    resultCard.hidden = false;
    buildStateFlow();
    goToStep(0);
  } catch (err) { setVal('✗ Server error. Is Flask running?','invalid'); console.error(err); }
  finally { showLoading(false); runBtn.disabled=false; }
}

function showIntermediateResults(data) {
  const { operands, operators, intermediate_results } = data;
  let html = '<div class="intermediate-title">Step-by-step Computation:</div>';
  html += '<div class="intermediate-steps">';

  let expr = '';
  for (let i = 0; i < operands.length; i++) {
    if (i > 0) {
      expr += ` ${operators[i-1] === '-' ? '−' : '+'} `;
    }
    expr += operands[i];

    if (i > 0) {
      const dec = parseInt(intermediate_results[i], 2);
      html += `<div class="inter-step">
        <span class="inter-expr">${expr}</span>
        <span class="inter-arrow">→</span>
        <span class="inter-result mono">${intermediate_results[i]}</span>
        <span class="inter-dec">(${dec})</span>
      </div>`;
    }
  }
  html += '</div>';
  intermediateEl.innerHTML = html;
  intermediateEl.hidden = false;
}

// ─── BUBBLES ──────────────────────────────────────────────────────────────────
function spawnBubble(parentEl, text, cls) {
  parentEl.querySelectorAll('.'+cls).forEach(b=>b.remove());
  const b = document.createElement('span');
  b.className=cls; b.textContent=text;
  parentEl.appendChild(b);
  void b.offsetWidth;
  b.classList.add('bubble-animate');
  b.addEventListener('animationend', ()=>b.remove(), {once:true});
}

// ─── ARITHMETIC COLUMN DISPLAY (result card) ──────────────────────────────────
function annotateCalcColumns(steps) {
  let col = -1;
  steps.forEach(step => {
    const s = step.state;
    const firstCalc = (s==='q_add_start'||s==='q_sub_start') && step.write!==step.read;
    const ongoing   = s==='q_add'||s==='q_carry'||s==='q_subtract'||s==='q_borrow';
    const nav       = (s==='q_add_start'||s==='q_sub_start') && step.write===step.read;
    if (firstCalc||ongoing) { col++; step._calcCol=col; }
    else if (nav)           { step._calcCol=0; }
    else                    { step._calcCol=-1; }
  });
}

function buildArithDisplay(data) {
  arithColEls = [];
  const { left_operand:left, right_operand:right, result, operator:op } = data;
  if (!left || !right || !result) return;
  const fullLen = Math.max(left.length, right.length, result.length);
  const fLeft   = left.padStart(fullLen,'0');
  const fRight  = right.padStart(fullLen,'0');
  const fRes    = result.padStart(fullLen,'0');
  annotateCalcColumns(simSteps);

  arithDisplay.innerHTML = '';
  const wrap = mk('arith-wrap');
  const cRow = mk('arith-row arith-carry-row');
  const tRow = mk('arith-row arith-top-row');
  const bRow = mk('arith-row arith-op-row');
  const rRow = mk('arith-row arith-res-row');

  const pfx = (row, extra='') => { const d=mk('arith-col arith-op-prefix'+(extra?' '+extra:'')); row.appendChild(d); return d; };
  pfx(cRow); pfx(tRow);
  pfx(bRow,'arith-op-symbol').textContent = op==='+' ? '+' : '−';
  pfx(rRow,'arith-op-equals').textContent = '=';

  for (let col=fullLen-1; col>=0; col--) {
    const i = fullLen-1-col;
    const cc = mk('arith-col arith-carry-cell'); cRow.appendChild(cc);
    const tc = mk('arith-col arith-bit-cell');   tc.textContent=fLeft[i];  tRow.appendChild(tc);
    const bc = mk('arith-col arith-bit-cell');   bc.textContent=fRight[i]; bRow.appendChild(bc);
    const rc = mk('arith-col arith-bit-cell arith-res-bit'); rc.textContent=fRes[i]; rRow.appendChild(rc);
    arithColEls.push({ carry:cc, top:tc, bot:bc, res:rc });
  }
  [cRow, tRow, bRow, mk('arith-divider'), rRow].forEach(r=>wrap.appendChild(r));
  arithDisplay.appendChild(wrap);
}

function syncResultCol(step) {
  if (!arithColEls.length) return;
  arithColEls.forEach(c => ['col-active','col-carry','col-borrow'].forEach(cl => {
    c.carry.classList.remove(cl); c.top.classList.remove(cl); c.bot.classList.remove(cl); c.res.classList.remove(cl);
  }));
  if (!step||step._calcCol===undefined||step._calcCol<0) return;
  const elIdx = arithColEls.length-1-step._calcCol;
  if (elIdx<0||elIdx>=arithColEls.length) return;
  const el=arithColEls[elIdx], st=step.state;
  const cls = st==='q_carry'?'col-carry':st==='q_borrow'?'col-borrow':'col-active';
  el.top.classList.add(cls); el.bot.classList.add(cls); el.res.classList.add(cls); el.carry.classList.add(cls);
  if (st==='q_carry'||st==='q_borrow')
    spawnBubble(el.carry, st==='q_carry'?'+1':'−1', st==='q_carry'?'carry-bubble':'borrow-bubble');
}

// ─── COLUMN INDICATOR ─────────────────────────────────────────────────────────
function updateColIndicator(step) {
  if (!colIndicatorEl) return;
  const calcStates = ['q_add_start','q_sub_start','q_add','q_carry','q_subtract','q_borrow'];
  if (!calcStates.includes(step.state) || !simResult) {
    colIndicatorEl.hidden = true;
    return;
  }
  const col = step._calcCol ?? 0;
  const totalCols = Math.max(
    simResult.left_operand?.length || 0,
    simResult.right_operand?.length || 0,
    simResult.result?.length || 0
  );
  if (totalCols === 0) { colIndicatorEl.hidden = true; return; }

  const isCarry  = step.state === 'q_carry';
  const isBorrow = step.state === 'q_borrow';
  const nav      = step.write === step.read;

  let html = `<div class="ci-header">
    <span class="ci-label">Bit Position</span>
    <span class="ci-desc">${nav ? 'Moving to LSB…' : isCarry ? '↗ Carry propagating' : isBorrow ? '↙ Borrow propagating' : `Processing bit <strong>${col}</strong> from right`}</span>
  </div>
  <div class="ci-cols">`;

  for (let c = totalCols-1; c >= 0; c--) {
    let cls = 'ci-col';
    if (c < col)  cls += ' ci-done';
    if (c === col) cls += isCarry ? ' ci-carry' : isBorrow ? ' ci-borrow' : ' ci-active';
    html += `<div class="${cls}">${c}</div>`;
  }
  html += '</div>';
  colIndicatorEl.innerHTML = html;
  colIndicatorEl.hidden = false;
}

// ─── TAPE RENDERING ───────────────────────────────────────────────────────────
function getTapeZoneCls(idx, state) {
  if (!tapeZones) return '';
  const { leftEnd, opIdx, rightStart, rightEnd } = tapeZones;
  if (state === 'q_cleanup' || state === 'q_accept') return 'zone-result';
  if (idx <= leftEnd)                return 'zone-left';
  if (idx === opIdx)                 return 'zone-op';
  if (idx >= rightStart && idx <= rightEnd) return 'zone-right';
  return '';
}

function renderTape(step) {
  const { tape, head, state, step:stepNum, read, write } = step;
  const total = simSteps.length;

  metaStep.textContent = `Step: ${stepNum+1} / ${total}`;
  updateExplainBox(step);
  progressBar.style.width = `${((stepNum+1)/total)*100}%`;

  const isCarry  = state === 'q_carry';
  const isBorrow = state === 'q_borrow';
  const rail     = mk('tape-rail');

  tape.forEach((sym, idx) => {
    const isActive  = idx === head;
    const wasActive = idx === prevHead && idx !== head;
    const zoneCls   = getTapeZoneCls(idx, state);

    let cls = 'tape-cell';
    if (sym==='B')     cls += ' blank';
    if (zoneCls)       cls += ' '+zoneCls;
    if (isActive)      cls += ' cell-active';
    if (isActive && isCarry)  cls += ' cell-carry';
    if (isActive && isBorrow) cls += ' cell-borrow';
    if (write && write!==read && isActive) cls += ' cell-written';
    if (wasActive)     cls += ' cell-trail';

    const cell = mk(cls);
    cell.appendChild(document.createTextNode(sym==='B'?'B':sym));
    const lbl = mk('cell-index','span'); lbl.textContent = idx; cell.appendChild(lbl);

    if (isActive && (isCarry || isBorrow)) {
      const bub = document.createElement('span');
      bub.className = isCarry ? 'carry-bubble' : 'borrow-bubble';
      bub.textContent = isCarry ? '+1' : '−1';
      cell.appendChild(bub);
      void bub.offsetWidth;
      bub.classList.add('bubble-animate');
      bub.addEventListener('animationend', ()=>bub.remove(), {once:true});
    }
    rail.appendChild(cell);
  });

  const ell = mk('tape-cell blank'); ell.textContent='…'; rail.appendChild(ell);
  tapeContainer.innerHTML = '';
  tapeContainer.appendChild(rail);

  requestAnimationFrame(() => {
    const ac = tapeContainer.querySelector('.cell-active');
    if (ac) ac.scrollIntoView({ behavior:'smooth', block:'nearest', inline:'center' });
  });

  prevHead = head;
  highlightRow(stepNum);
  syncResultCol(step);
  updateStateFlow(state);
  updateColIndicator(step);

  document.querySelectorAll('.state-pill').forEach(p =>
    p.classList.toggle('active', p.dataset.state===state));
}

// ─── STEP LOG ─────────────────────────────────────────────────────────────────
function highlightRow(stepNum) {
  document.querySelectorAll('#transitions-body tr').forEach(r=>r.classList.remove('row-active'));
  const row = transitionsBody.querySelector(`tr[data-step="${stepNum}"]`);
  if (!row) return;
  row.classList.add('row-active');
  if (tableWrap) {
    const rowTop = row.offsetTop;
    tableWrap.scrollTo({ top: Math.max(0, rowTop - tableWrap.clientHeight/2 + row.clientHeight/2), behavior:'smooth' });
  }
}

function buildTransitionTable(steps) {
  transitionsBody.innerHTML = '';
  transitionsCount.textContent = `${steps.length} steps`;
  steps.forEach((s, i) => {
    const tr = document.createElement('tr');
    tr.dataset.step = i;
    tr.innerHTML = `
      <td>${i+1}</td>
      <td>${stateTag(s.state)}</td>
      <td>${symCell(s.read)}</td>
      <td>${symCell(s.write)}</td>
      <td>${moveCell(s.move)}</td>
      <td>${stateTag(s.next_state)}</td>
      <td class="td-simple">${esc(describe(s, simResult).main)}</td>`;
    transitionsBody.appendChild(tr);
  });
}

const esc = str => String(str).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
function stateTag(s) {
  if (!s) return '<span class="state-tag">—</span>';
  let c='state-tag'; if(s==='q_accept')c+=' accept'; if(s==='q_reject')c+=' reject';
  return `<span class="${c}">${esc(s)}</span>`;
}
function symCell(sym) {
  if (!sym) return '<span class="sym-blank">—</span>';
  if (sym==='B') return '<span class="sym-blank">B</span>';
  if (sym==='+'||sym==='-') return `<span class="sym-op">${sym}</span>`;
  return `<span class="sym-bit">${sym}</span>`;
}
function moveCell(m) {
  if (!m) return '—';
  if (m==='L') return `<span class="sym-move-l">◀ L</span>`;
  if (m==='R') return `<span class="sym-move-r">R ▶</span>`;
  return `<span class="sym-move-s">S</span>`;
}

// ─── PLAYBACK ─────────────────────────────────────────────────────────────────
function goToStep(idx) {
  currentStep = clamp(idx, 0, simSteps.length-1);
  renderTape(simSteps[currentStep]);
  updateBtns();
}
function updateBtns() {
  const ok = simSteps.length > 0;
  btnFirst.disabled = !ok || currentStep<=0;
  btnPrev.disabled  = !ok || currentStep<=0;
  btnNext.disabled  = !ok || currentStep>=simSteps.length-1;
  btnLast.disabled  = !ok || currentStep>=simSteps.length-1;
  btnPlay.textContent = isPlaying ? '⏸' : '▶';
}
btnFirst.addEventListener('click', ()=>{ stopPlayback(); goToStep(0); });
btnPrev.addEventListener('click',  ()=>{ stopPlayback(); goToStep(currentStep-1); });
btnNext.addEventListener('click',  ()=>{ stopPlayback(); goToStep(currentStep+1); });
btnLast.addEventListener('click',  ()=>{ stopPlayback(); goToStep(simSteps.length-1); });
btnPlay.addEventListener('click',  ()=>{ isPlaying ? stopPlayback() : startPlayback(); });
function startPlayback() {
  if (currentStep>=simSteps.length-1) goToStep(0);
  isPlaying=true; updateBtns(); tick();
}
function tick() {
  if (!isPlaying) return;
  if (currentStep>=simSteps.length-1) { stopPlayback(); return; }
  goToStep(currentStep+1); playTimer=setTimeout(tick, getDelay());
}
function stopPlayback() { isPlaying=false; clearTimeout(playTimer); updateBtns(); }
speedSlider.addEventListener('input', ()=>{ speedValue.textContent=speedSlider.value+'x'; });

// ─── RESET ────────────────────────────────────────────────────────────────────
resetBtn.addEventListener('click', resetAll);
function resetAll() {
  stopPlayback();
  simSteps=[]; simResult=null; currentStep=-1; arithColEls=[]; prevHead=-1; tapeZones=null;
  playbackCtrls.hidden=true; progressWrap.hidden=true;
  transitionsCard.hidden=true; resultCard.hidden=true; explainBox.hidden=true;
  if (stateFlowEl)    { stateFlowEl.innerHTML=''; stateFlowEl.hidden=true; }
  if (colIndicatorEl) colIndicatorEl.hidden=true;
  tapeContainer.innerHTML=`
    <div class="tape-placeholder">
      <div class="placeholder-icon">⚙️</div>
      <p>Enter binary values, select operators, and click <strong>Run Simulation</strong> to start.</p>
    </div>`;
  metaStep.textContent='Step: 0 / 0';
  progressBar.style.width='0%';
  transitionsBody.innerHTML='';
  if (arithDisplay) arithDisplay.innerHTML='';
  if (intermediateEl) intermediateEl.hidden=true;
  document.querySelectorAll('.state-pill').forEach(p=>p.classList.remove('active'));
  resetBtn.disabled=true;
  setVal('',null);

  // Clear operand inputs
  operandFields.querySelectorAll('.operand-input').forEach(inp => inp.value = '');
  previewValue.textContent = '—';
  tmInput.value = '';
}

// ─── KEYBOARD ─────────────────────────────────────────────────────────────────
document.addEventListener('keydown', e => {
  if (e.key === 'Escape') {
    if (modalHelp && !modalHelp.hidden) { closeModal(modalHelp); e.preventDefault(); return; }
    if (modalPhases && !modalPhases.hidden) { closeModal(modalPhases); e.preventDefault(); return; }
  }
  if (document.activeElement && (document.activeElement.tagName === 'INPUT' || document.activeElement.tagName === 'SELECT')) return;
  switch(e.key) {
    case 'ArrowLeft': case 'ArrowUp':
      e.preventDefault(); stopPlayback(); goToStep(currentStep-1); break;
    case 'ArrowRight': case 'ArrowDown':
      e.preventDefault(); stopPlayback(); goToStep(currentStep+1); break;
    case ' ':    e.preventDefault(); btnPlay.click(); break;
    case 'Home': e.preventDefault(); stopPlayback(); goToStep(0); break;
    case 'End':  e.preventDefault(); stopPlayback(); goToStep(simSteps.length-1); break;
  }
});
