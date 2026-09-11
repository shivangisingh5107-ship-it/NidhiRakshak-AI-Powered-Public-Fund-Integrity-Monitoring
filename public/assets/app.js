/* NidhiRakshak — shared utilities (no external chart/UI libraries: fully offline-safe) */

/*
 * Real-world validation cases — publicly documented MPLADS fraud/misuse cases (sourced from
 * CAG audit reports, court filings and news reporting; see case_source on each record). These
 * are NOT synthetic and NOT the output of this prototype's detection pipeline — they are shown
 * only in "Real data" mode, mapped against the flag catalog, so the detection logic can be
 * validated against real precedent instead of a fabricated ledger. Model-only fields (Isolation
 * Forest scores, cost/lag ratios, agency concentration) are left null since they were never
 * computed against real telemetry for these cases.
 */
const REAL_CASE_EXTRA_REASONS = {
  INELIGIBLE_WORK_CATEGORY: {
    label: "Ineligible work category",
    detail: "Funds appear directed at a category the scheme guidelines prohibit outright (e.g. a religious structure), rather than an approved durable community asset.",
    weight: 15,
  },
};
const REAL_DOCUMENTED_CASES = [
  {
    work_id: "RC001", mp_id: "REALCASE-GJ-ANAND",
    mp_name: "Smriti Irani (nodal district: Anand, Gujarat)",
    state: "Gujarat", district: "Anand", constituency: "Anand (RS nodal district)",
    work_category: "Panchayat Building Renovation",
    work_description: "Renovation of a panchayat building at Maghrol village, claimed for a second consecutive year against the same asset.",
    implementing_agency: "Sharda Majdoor Kamdar Sahkari Mandli (cooperative society)",
    sanction_date: "2016-08-01", cost_sanctioned: 4520000, expenditure: 4520000, utilization_ratio: 1.0,
    completion_date: null, completion_lag_days: null,
    status: "Marked Complete — disputed; field inspection found the work not executed",
    risk_score: 92, risk_band: "Critical",
    all_reason_codes: ["SHELL_AGENCY_PATTERN", "DUPLICATE_DESCRIPTION", "STALLED_STATUS"],
    cost_ratio_to_category_median: null, lag_ratio_to_category_median: null,
    agency_concentration: null, anomaly_score_normalized: null, is_statistical_anomaly: null,
    record_source: "REAL_DOCUMENTED_CASE",
    case_status_badge: "3 officials chargesheeted",
    case_source: "CAG Report No. 4 of 2018; Gujarat govt. affidavit reported by Deccan Herald & National Herald India",
    case_summary: "Audit found this cooperative society engaged without the required competitive tendering, reportedly on instruction from the MP's office — a breach of the rule barring MPs from selecting implementing agencies. The same renovation was billed again a year after an earlier claim, and site inspection found several sanctioned works, including this one, had not actually been executed despite being marked complete. Three district officials were later chargesheeted and bank accounts holding close to ₹86 lakh were attached.",
  },
  {
    work_id: "RC002", mp_id: "REALCASE-KL-ERNAKULAM",
    mp_name: "K. V. Thomas (nodal district: Ernakulam, Kerala)",
    state: "Kerala", district: "Ernakulam", constituency: "N/A (Rajya Sabha nodal district)",
    work_category: "Temple Pond Renovation (alleged, ineligible category)",
    work_description: "Renovation of a temple pond, with an on-site plaque crediting MPLADS and municipal-corporation funds for work petitioners allege was actually funded by devotee donations.",
    implementing_agency: "Not disclosed in public reporting",
    sanction_date: null, cost_sanctioned: 3000000, expenditure: null, utilization_ratio: null,
    completion_date: null, completion_lag_days: null,
    status: "Under inquiry / sub judice — Kerala High Court, 2025",
    risk_score: 46, risk_band: "High",
    all_reason_codes: ["ROUND_NUMBER_COST", "INELIGIBLE_WORK_CATEGORY"],
    cost_ratio_to_category_median: null, lag_ratio_to_category_median: null,
    agency_concentration: null, anomaly_score_normalized: null, is_statistical_anomaly: null,
    record_source: "REAL_DOCUMENTED_CASE",
    case_status_badge: "Sub judice · Kerala HC, 2025",
    case_source: "The Print, March 2025, reporting on a pending Kerala High Court petition",
    case_summary: "A public-interest petition alleges the pond renovation was actually funded by devotee donations, while a stone plaque credited roughly ₹30 lakh and ₹20 lakh to MPLADS and municipal funds respectively — spending that would itself breach guidelines, since MPLADS funds cannot legally be used for religious structures. A CBI and district-vigilance review is reported to have found prima facie irregularities; no formal sanction for prosecution had been granted as of the report date. This remains an allegation under inquiry, not an established finding.",
  },
  {
    work_id: "RC003", mp_id: "REALCASE-MULTI-CAG",
    mp_name: "Multiple MPs — CAG multi-state audit sample",
    state: "Multiple (WB, Jharkhand, Bihar, Mizoram)", district: "Multiple districts (audit sample)",
    constituency: "Not applicable — aggregate audit sample",
    work_category: "Road / Community Asset (untraceable on field verification)",
    work_description: "Assets recorded as completed that CAG field surveyors could not physically locate, plus at least one road stretch billed under both MPLADS and a similarly-purposed state legislator scheme in the same period.",
    implementing_agency: "Multiple (district-designated agencies)",
    sanction_date: null, cost_sanctioned: null, expenditure: null, utilization_ratio: null,
    completion_date: null, completion_lag_days: null,
    status: "Marked Complete — disputed; untraceable on physical verification",
    risk_score: 81, risk_band: "Critical",
    all_reason_codes: ["STALLED_STATUS", "CROSS_SCHEME_DUPLICATE", "DUPLICATE_DESCRIPTION"],
    cost_ratio_to_category_median: null, lag_ratio_to_category_median: null,
    agency_concentration: null, anomaly_score_normalized: null, is_statistical_anomaly: null,
    record_source: "REAL_DOCUMENTED_CASE",
    case_status_badge: "CAG Report No. 31 of 2010 & 2001 audit",
    case_source: "CAG performance audits of MPLADS, as summarised in Factly's 2018 analysis of the scheme",
    case_summary: "Field-verification samples across West Bengal, Jharkhand, Bihar and Mizoram found assets recorded as completed that surveyors could not physically locate, community halls built inside religious complexes in violation of guidelines, school computers diverted to private commercial use, and at least one road stretch billed under both MPLADS and a similarly-purposed state legislator scheme in the same period. This record represents the pattern found across the audit sample, not one single named work.",
  },
];

const D = window.MPLADS;
const RAW_DATA = {
  national: D.national,
  states: D.states,
  districts: D.districts,
  mps: D.mps,
  worksFlagged: D.worksFlagged,
  worksAll: D.worksAll,
  crossScheme: D.crossScheme,
  realMps: D.realMps || [],
  esakshi: D.esakshi || null,
};

/*
 * The prototype deliberately keeps the three data views explicit:
 * - demo: synthetic work-level ledger
 * - real: official Lok Sabha + Rajya Sabha allocation rosters plus public eSAKSHI aggregate snapshots
 * - combined: the current joined prototype view
 *
 * Switching is persisted in localStorage so every page stays on the same view.
 */
const DATA_MODE_META = {
  demo: {
    label: "Demo data",
    short: "DEMO",
    description: "Synthetic work ledger using the real 774-MP identity layer",
  },
  real: {
    label: "Real data",
    short: "REAL",
    description: "Published 774-MP roster, allocation limits and eSAKSHI aggregates",
  },
  combined: {
    label: "Combined view",
    short: "COMBINED",
    description: "Real 774-MP roster joined with synthetic risk records",
  },
};

function getDataMode(){
  const stored = localStorage.getItem("nidhirakshak-data-mode");
  return DATA_MODE_META[stored] ? stored : "combined";
}

function buildRealRoster(){
  return (RAW_DATA.realMps || []).map(m => ({
    ...m,
    works: 0,
    total_sanctioned: 0,
    total_expenditure: 0,
    flagged: 0,
    critical: 0,
    avg_risk: 0,
    max_risk: 0,
    utilization_pct: 0,
    record_source: "REAL_GOVT_DATA",
  }));
}

function buildJoinedRoster(){
  const statsById = new Map((RAW_DATA.mps || []).map(m => [m.mp_id, m]));
  return (RAW_DATA.realMps || []).map(real => {
    const stats = statsById.get(real.mp_id) || {};
    return {
      ...real,
      works: Number(stats.works || 0),
      total_sanctioned: Number(stats.total_sanctioned || 0),
      total_expenditure: Number(stats.total_expenditure || 0),
      flagged: Number(stats.flagged || 0),
      critical: Number(stats.critical || 0),
      avg_risk: Number(stats.avg_risk || 0),
      max_risk: Number(stats.max_risk || 0),
      utilization_pct: Number(stats.utilization_pct || 0),
      record_source: "REAL_GOVT_IDENTITY_PLUS_SYNTHETIC_WORK_STATS",
    };
  });
}

function configureDataMode(){
  if(getDataMode() !== "real"){
    const joined = buildJoinedRoster();
    const stateMap = {};
    joined.forEach(m => {
      if(!stateMap[m.state]) stateMap[m.state] = {state:m.state, mps:0, works:0, total_sanctioned:0, total_expenditure:0, flagged:0, critical:0, avg_risk:0, utilization_pct:0};
      const st = stateMap[m.state];
      st.mps += 1;
      st.works += Number(m.works || 0);
      st.total_sanctioned += Number(m.total_sanctioned || 0);
      st.total_expenditure += Number(m.total_expenditure || 0);
      st.flagged += Number(m.flagged || 0);
      st.critical += Number(m.critical || 0);
    });
    Object.values(stateMap).forEach(st => {
      st.avg_risk = st.works ? Number(((joined.filter(m=>m.state===st.state).reduce((a,m)=>a+Number(m.avg_risk||0)*Number(m.works||0),0))/st.works).toFixed(1)) : 0;
      st.utilization_pct = st.total_sanctioned ? Number((st.total_expenditure/st.total_sanctioned*100).toFixed(1)) : 0;
    });
    const states = Object.values(stateMap).sort((a,b)=>a.state.localeCompare(b.state));
    const flaggedMps = joined.filter(m => Number(m.flagged||0) > 0).length;
    Object.assign(D, {
      mps: joined,
      states,
      national: {
        ...RAW_DATA.national,
        total_mps: joined.length,
        total_states: states.length,
        flagged_mps: flaggedMps,
      },
      realMps: RAW_DATA.realMps,
      esakshi: RAW_DATA.esakshi,
    });
    return;
  }

  const realMps = buildRealRoster();
  const stateMap = {};
  realMps.forEach(m => {
    if(!stateMap[m.state]) stateMap[m.state] = {state:m.state, mps:0, works:0, total_sanctioned:0, total_expenditure:0, flagged:0, critical:0, avg_risk:0, utilization_pct:0};
    stateMap[m.state].mps += 1;
  });
  const states = Object.values(stateMap).sort((a,b)=>a.state.localeCompare(b.state));

  const realCases = REAL_DOCUMENTED_CASES;
  const sanctionedSum = realCases.reduce((a,w) => a + (Number(w.cost_sanctioned) || 0), 0);
  const expenditureSum = realCases.reduce((a,w) => a + (Number(w.expenditure) || 0), 0);
  const criticalCount = realCases.filter(w => w.risk_band === "Critical").length;
  const highCount = realCases.filter(w => w.risk_band === "High").length;
  const namedMpCount = new Set(realCases.filter(w => !w.mp_id.includes("MULTI")).map(w => w.mp_id)).size;
  const catBreakdownMap = {};
  realCases.forEach(w => {
    if(!catBreakdownMap[w.work_category]) catBreakdownMap[w.work_category] = {work_category: w.work_category, flagged: 0, total: 0};
    catBreakdownMap[w.work_category].flagged += 1;
    catBreakdownMap[w.work_category].total += 1;
  });

  Object.assign(D, {
    mps: realMps,
    states,
    districts: [],
    worksAll: realCases,
    worksFlagged: realCases,
    crossScheme: {records: [], summary: {total_scheme_records: 0, matched_records: 0, schemes_covered: [], note: RAW_DATA.crossScheme?.summary?.note || ""}},
    realMps: RAW_DATA.realMps,
    esakshi: RAW_DATA.esakshi,
    national: {
      total_mps: realMps.length,
      total_states: states.length,
      total_works: realCases.length,
      total_sanctioned: sanctionedSum,
      total_expenditure: expenditureSum,
      overall_utilization_pct: sanctionedSum ? Number((expenditureSum/sanctionedSum*100).toFixed(1)) : 0,
      flagged_works: realCases.length,
      critical_works: criticalCount,
      high_works: highCount,
      medium_works: 0,
      low_works: 0,
      flagged_mps: namedMpCount,
      avg_risk_score: Number((realCases.reduce((a,w)=>a+w.risk_score,0)/realCases.length).toFixed(1)),
      monthly_trend: [],
      category_breakdown: Object.values(catBreakdownMap),
    },
  });
  if(D.reasons && D.reasons.catalog){
    Object.assign(D.reasons.catalog, REAL_CASE_EXTRA_REASONS);
  }
}

configureDataMode();
const ACTIVE_DATA_MODE = getDataMode();

/* ---------------- SIH demo roles + pre-disbursement guardrail ---------------- */
const ROLE_META = {
  mp: {
    label: "MP",
    eyebrow: "CONSTITUENCY VIEW",
    description: "See the works in one constituency that need attention first.",
  },
  state: {
    label: "State Nodal Authority",
    eyebrow: "STATE MONITORING VIEW",
    description: "Compare districts and focus intervention where risk is concentrated.",
  },
  district: {
    label: "District Authority",
    eyebrow: "OPERATIONAL WORK VIEW",
    description: "Review individual works and evaluate a milestone before disbursement.",
  },
  mospi: {
    label: "MoSPI",
    eyebrow: "NATIONAL MONITORING VIEW",
    description: "Monitor national patterns, state concentration and the high-risk queue.",
  },
};

function getActiveRole(){
  const role = new URLSearchParams(location.search).get("role");
  return ROLE_META[role] ? role : "mospi";
}

function roleSwitcher(){
  const active = getActiveRole();
  return `
    <div class="role-switcher" aria-label="Demo role switcher">
      <span class="role-switcher-label">DEMO ROLE</span>
      ${Object.entries(ROLE_META).map(([key, meta]) => `
        <a class="${active===key ? "active" : ""}" href="index.html?role=${key}" title="${meta.description}">
          ${meta.label}
        </a>`).join("")}
    </div>`;
}

function clamp(value, min, max){
  return Math.min(max, Math.max(min, Number(value) || 0));
}

function workPhysicalProgress(work){
  if(!work) return 0;
  const util = clamp(Number(work.utilization_ratio || 0) * 100, 0, 100);
  if(work.status === "Completed") return 100;
  if(work.status === "Sanctioned - Not Started") return 0;
  if(work.status === "Stalled") return Number(clamp(util * 0.58, 5, 62).toFixed(1));
  return Number(clamp(util * 0.88, 8, 92).toFixed(1));
}

function datePlusDays(dateString, days){
  const date = dateString ? new Date(dateString) : new Date();
  if(Number.isNaN(date.getTime())) return new Date();
  date.setDate(date.getDate() + Number(days || 0));
  return date;
}

function isoDate(date){
  return date.toISOString().slice(0,10);
}

function expectedCompletionFor(work){
  if(!work) return isoDate(new Date());
  if(work.status === "Completed" && work.completion_date) return work.completion_date;
  const baseline = Number(work.lag_ratio_to_category_median || 1);
  return isoDate(datePlusDays(work.sanction_date, Math.round(210 * clamp(baseline, .7, 3))));
}

function operationalFields(work){
  if(!work) return {};
  const expenditure = Number(work.expenditure || 0);
  const sanctioned = Number(work.cost_sanctioned || 0);
  const progress = workPhysicalProgress(work);
  const delay = Math.max(0, Number(work.completion_lag_days || 0) - 210);
  return {
    fund_released: expenditure,
    physical_progress: progress,
    expected_completion: expectedCompletionFor(work),
    delay_days: delay,
    expenditure_ratio: sanctioned ? Number((expenditure / sanctioned * 100).toFixed(1)) : 0,
    payment_status: work.status === "Completed" ? "Milestone complete" : "Milestone pending",
    inspection_status: work.status === "Completed" ? "Recorded" : "Pending field verification",
  };
}

function guardrailBand(score){
  if(score >= 55) return "high";
  if(score >= 25) return "medium";
  return "low";
}

function guardrailBandLabel(band){
  return {high:"HIGH RISK", medium:"MEDIUM RISK", low:"LOW RISK"}[band] || band;
}

function guardrailRecommendation(band){
  return {
    high: "Hold for authority review before disbursement.",
    medium: "Additional review recommended before normal processing.",
    low: "Proceed for normal processing, subject to routine controls.",
  }[band];
}

function peerCostMedian(work){
  const peers = (D.worksAll || []).filter(candidate =>
    candidate.work_category === work.work_category &&
    candidate.state === work.state &&
    Number(candidate.cost_sanctioned) > 0
  ).map(candidate => Number(candidate.cost_sanctioned)).sort((a,b)=>a-b);
  if(!peers.length) return Number(work.cost_sanctioned || 0);
  return peers[Math.floor(peers.length / 2)];
}

/*
 * This evaluator is intentionally small and deterministic. It consumes the same
 * work-level records and existing anomaly/rule outputs as the dashboards, then
 * evaluates the proposed milestone in front of the user.
 */
function evaluateGuardrail(work, input={}){
  const base = operationalFields(work);
  const requested = clamp(input.requested_amount, 0, Number(work?.cost_sanctioned || 0));
  const physical = clamp(input.physical_progress ?? base.physical_progress, 0, 100);
  const verification = input.verification_status || "pending";
  const dueDate = input.due_date || base.expected_completion;
  const due = new Date(dueDate);
  const today = new Date();
  const overdueDays = Number.isNaN(due.getTime()) ? 0 : Math.max(0, Math.floor((today - due) / 86400000));
  const sanctioned = Number(work?.cost_sanctioned || 0);
  const currentExpenditure = Number(work?.expenditure || 0);
  const projectedExpenditure = currentExpenditure + requested;
  const projectedUtilization = sanctioned ? projectedExpenditure / sanctioned : 0;
  const peerMedian = peerCostMedian(work || {});
  const costVariance = peerMedian ? (sanctioned / peerMedian - 1) * 100 : 0;
  const reasons = [];
  let score = 0;

  function signal(points, title, detail){
    score += points;
    reasons.push({points, title, detail});
  }

  if(projectedUtilization * 100 > physical + 20){
    signal(28, "Payment / progress mismatch",
      `${Math.round(projectedUtilization*100)}% projected expenditure against ${Math.round(physical)}% physical progress.`);
  }
  if(costVariance > 35){
    signal(20, "Cost variance outside peer range",
      `Sanctioned cost is ${Math.round(costVariance)}% above the ${work.work_category} peer median.`);
  } else if(costVariance > 20){
    signal(10, "Cost variance merits review",
      `Sanctioned cost is ${Math.round(costVariance)}% above the comparable peer median.`);
  }
  if(overdueDays > 0){
    signal(overdueDays > 60 ? 18 : 10, "Milestone overdue",
      `The proposed milestone date is ${overdueDays} day${overdueDays===1?"":"s"} overdue.`);
  }
  if(sanctioned && requested / sanctioned > .30){
    signal(12, "Unusually large milestone request",
      `${Math.round(requested/sanctioned*100)}% of the sanctioned amount is requested in this milestone.`);
  }
  if(physical < 70 && projectedUtilization > .75){
    signal(16, "Incomplete work with high expenditure",
      `The work remains below 70% physical progress while projected expenditure exceeds 75%.`);
  }
  if(verification !== "verified"){
    signal(12, "Verification evidence is not complete",
      verification === "pending"
        ? "Field inspection or completion evidence is still pending."
        : "Submitted evidence needs clarification before release.");
  }
  if((work?.all_reason_codes || []).some(code => ["DUPLICATE_DESCRIPTION","CROSS_SCHEME_DUPLICATE"].includes(code)) || crossSchemeMatchFor(work?.work_id)){
    signal(16, "Possible duplicate — requires verification",
      "A description or cross-scheme match suggests the same physical asset may need a second check.");
  }
  if(work?.is_statistical_anomaly || Number(work?.anomaly_score_normalized || 0) > .72){
    signal(10, "Anomaly score is elevated",
      "The existing unsupervised anomaly layer found an unusual combination of work features.");
  }
  if(work?.status === "Stalled" || work?.status === "Sanctioned - Not Started"){
    signal(10, "Work is not progressing normally",
      `Current status is “${work.status}”; review the milestone evidence before advancing funds.`);
  }

  if(!reasons.length){
    reasons.push({points:0, title:"No material guardrail signal detected", detail:"The proposed milestone is within the supplied work and peer-group checks."});
  }
  const scoreOut = Math.round(clamp(score, 0, 100));
  const band = guardrailBand(scoreOut);
  return {
    score: scoreOut,
    band,
    bandLabel: guardrailBandLabel(band),
    recommendation: guardrailRecommendation(band),
    reasons,
    inputs: {
      requested_amount: requested,
      physical_progress: physical,
      due_date: dueDate,
      verification_status: verification,
      projected_utilization: Number((projectedUtilization*100).toFixed(1)),
      peer_median: peerMedian,
      cost_variance: Number(costVariance.toFixed(1)),
      overdue_days: overdueDays,
    },
  };
}

function guardrailWorkOptions(){
  const all = [...(D.worksAll || [])].sort((a,b)=>b.risk_score-a.risk_score);
  const selected = [...all.filter(w=>w.risk_band==="Critical" || w.risk_band==="High").slice(0,100)];
  selected.push(...all.filter(w=>w.risk_band==="Low").slice(0,20));
  return [...new Map(selected.map(w=>[w.work_id,w])).values()];
}

window.guardrailBand = guardrailBand;
window.guardrailBandLabel = guardrailBandLabel;
window.evaluateGuardrail = evaluateGuardrail;
window.operationalFields = operationalFields;
window.guardrailWorkOptions = guardrailWorkOptions;

function dataModeMeta(){
  return DATA_MODE_META[ACTIVE_DATA_MODE];
}

window.setDataMode = function(mode, destination){
  if(!DATA_MODE_META[mode]) return;
  localStorage.setItem("nidhirakshak-data-mode", mode);
  location.href = destination || "index.html";
};

function dataModeControl(){
  return `
    <div class="data-mode-control" aria-label="Data view">
      <span class="data-mode-label">DATA VIEW</span>
      ${Object.entries(DATA_MODE_META).map(([key, meta]) => `
        <button class="${ACTIVE_DATA_MODE===key ? "active" : ""}" onclick="setDataMode('${key}')">${meta.label}</button>
      `).join("")}
    </div>`;
}

function restrictedAccessBadge(){
  return `
    <div class="access-badge" role="status" aria-label="Restricted access: authorized users only">
      <span class="access-badge-icon">${ICONS.user}</span>
      <span><b>Restricted access</b><small>Authorized users only · not public</small></span>
    </div>`;
}

/* ---------------- human feedback loop ---------------- */
const FEEDBACK_KEY = "nidhirakshak-human-feedback-v1";
function getFeedback(){
  try { return JSON.parse(localStorage.getItem(FEEDBACK_KEY) || "{}"); }
  catch { return {}; }
}
function feedbackFor(workId){ return getFeedback()[workId] || null; }
function feedbackStats(){
  const values = Object.values(getFeedback());
  return {
    reviewed: values.filter(v=>v.status==="reviewed").length,
    falsePositive: values.filter(v=>v.status==="false_positive").length,
    total: values.length,
  };
}
function isSuppressedFlag(workId){
  return feedbackFor(workId)?.status === "false_positive";
}
function activeFlagged(works){
  return works.filter(w => !isSuppressedFlag(w.work_id));
}
function feedbackBadge(workId){
  const fb = feedbackFor(workId);
  if(!fb) return "";
  if(fb.status === "false_positive") return `<span class="feedback-badge false-positive">False positive · hidden</span>`;
  return `<span class="feedback-badge reviewed">Reviewed</span>`;
}
function feedbackActions(workId){
  const fb = feedbackFor(workId);
  if(fb?.status === "false_positive"){
    return `<div class="feedback-actions" onclick="event.stopPropagation()">
      <span class="feedback-badge false-positive">Removed from flagged view</span>
      <button class="btn feedback-restore" onclick="handleFeedback(event,'${workId}','restore')">Restore flag</button>
    </div>`;
  }
  return `<div class="feedback-actions" onclick="event.stopPropagation()">
    <button class="btn feedback-reviewed ${fb?.status==="reviewed" ? "is-done" : ""}" onclick="handleFeedback(event,'${workId}','reviewed')">${fb?.status==="reviewed" ? "✓ Reviewed" : "Mark Reviewed"}</button>
    <button class="btn feedback-false" onclick="handleFeedback(event,'${workId}','false_positive')">False Positive</button>
  </div>`;
}
window.handleFeedback = function(event, workId, status){
  if(event) event.stopPropagation();
  const feedback = getFeedback();
  if(status === "restore") delete feedback[workId];
  else feedback[workId] = {status, updated_at: new Date().toISOString()};
  localStorage.setItem(FEEDBACK_KEY, JSON.stringify(feedback));
  location.reload();
};

/* ---------------- project geodata (demo-safe, not a claim of official coordinates) ---------------- */
const STATE_CENTROIDS = {
  "Andhra Pradesh":[15.91,79.74],"Arunachal Pradesh":[28.22,94.73],"Assam":[26.20,92.94],
  "Bihar":[25.10,85.31],"Chhattisgarh":[21.28,81.87],"Delhi":[28.70,77.10],
  "Goa":[15.30,74.12],"Gujarat":[22.25,71.19],"Haryana":[29.06,76.08],
  "Himachal Pradesh":[31.10,77.17],"Jammu And Kashmir":[33.78,76.58],"Jharkhand":[23.61,85.27],
  "Karnataka":[15.32,75.71],"Kerala":[10.85,76.27],"Madhya Pradesh":[23.47,77.95],
  "Maharashtra":[19.75,75.71],"Manipur":[24.66,93.91],"Meghalaya":[25.47,91.37],
  "Mizoram":[23.16,92.94],"Nagaland":[26.16,94.56],"Odisha":[20.94,84.80],
  "Punjab":[31.15,75.34],"Rajasthan":[27.02,74.22],"Sikkim":[27.53,88.51],
  "Tamil Nadu":[11.12,78.65],"Telangana":[18.11,79.02],"Tripura":[23.94,91.99],
  "Uttar Pradesh":[26.85,80.91],"Uttarakhand":[30.06,79.02],"West Bengal":[22.98,87.85],
  "Andaman And Nicobar Islands":[11.74,92.66],"Chandigarh":[30.73,76.78],
  "Dadra And Nagar Haveli And Daman And Diu":[20.18,73.02],"Ladakh":[34.15,77.58],
  "Lakshadweep":[10.57,72.64],"Puducherry":[11.94,79.81],
};
function stableHash(value){
  return [...String(value||"")].reduce((n,c)=>(n*31+c.charCodeAt(0))%9973, 7);
}
function geoForWork(work){
  const center = STATE_CENTROIDS[work.state] || [22.6,79.1];
  const h = stableHash(work.work_id);
  return {lat:center[0] + ((h%37)-18)/100, lon:center[1] + (((Math.floor(h/37))%43)-21)/100};
}

/* ---------------- cross-scheme integration (MGNREGS / state schemes) ----------------
 * Simulated overlap feed — see data/cross_scheme.json / pipeline/detect_anomalies.py.
 * Real deployment would replace this lookup with a live API join once data-sharing
 * access from MGNREGS and state nodal departments is granted. */
const CROSS_SCHEME = (D.crossScheme && D.crossScheme.records) || [];
const CROSS_SCHEME_BY_WORK = CROSS_SCHEME.reduce((map, r) => {
  if (r.matched_mplads_work_id) map[r.matched_mplads_work_id] = r;
  return map;
}, {});
function crossSchemeMatchFor(workId){ return CROSS_SCHEME_BY_WORK[workId] || null; }

const SATELLITE_LARGE_WORK_THRESHOLD = 1000000;
/* Deterministic per-work satellite verification simulation — same idea as geoForWork's
 * demo coordinates: stable across reloads, not a live imagery call. Marked clearly as
 * a prototype layer everywhere it renders. */
function satelliteVerificationFor(work){
  if (Number(work.cost_sanctioned) < SATELLITE_LARGE_WORK_THRESHOLD) return null;
  const h = stableHash(work.work_id + "|sat") / 9973;
  let status, confidence;
  if (work.status === "Stalled" || h < 0.12) { status = "mismatch"; confidence = 0.55 + h * 0.3; }
  else if (work.status === "Completed" && h > 0.25) { status = "confirmed"; confidence = 0.80 + h * 0.18; }
  else { status = "pending"; confidence = 0.40 + h * 0.2; }
  return {status, confidence: Math.min(0.99, confidence)};
}
function satelliteStatusMeta(status){
  return {
    confirmed: {label:"Asset confirmed on imagery", badge:"low"},
    mismatch:  {label:"Mismatch — asset not visible", badge:"crit"},
    pending:   {label:"Scan queued · pending", badge:"med"},
  }[status];
}

function geoPanel(work, compact=false){
  const geo = geoForWork(work);
  const safeId = String(work.work_id).replace(/[^a-zA-Z0-9_-]/g,"");
  const xScheme = crossSchemeMatchFor(work.work_id);
  const sat = satelliteVerificationFor(work);
  return `<div class="geo-panel ${compact ? "compact" : ""}">
    <div class="panel-head">
      <div>
        <div class="panel-title">Geo verification &amp; asset registry</div>
        <div class="panel-note">Project location layer · demo overlay</div>
      </div>
      <span class="badge med">Needs field verification</span>
    </div>
    <div class="geo-map" id="geo-map-${safeId}" data-layer="registry">
      <div class="map-grid"></div>
      <div class="map-river"></div>
      <div class="map-pin" aria-label="Approximate project location">●</div>
      <div class="map-label" id="geo-label-${safeId}">Asset registry layer</div>
      <div class="map-scale">10 km</div>
    </div>
    <div class="map-layer-buttons" data-geo="${safeId}">
      <button class="active" onclick="selectGeoLayer(event,'${safeId}','registry')">Asset registry</button>
      <button onclick="selectGeoLayer(event,'${safeId}','satellite')">Satellite preview</button>
      <button onclick="selectGeoLayer(event,'${safeId}','boundary')">Boundaries</button>
      <button onclick="selectGeoLayer(event,'${safeId}','risk')">Risk heatmap</button>
    </div>
    <div class="geo-facts">
      <div><span>Approx. coordinates</span><b>${geo.lat.toFixed(4)}°, ${geo.lon.toFixed(4)}°</b></div>
      <div><span>Cross-scheme match</span><b class="${xScheme ? "text-red" : "text-amber"}">${xScheme ? `${xScheme.scheme} · ${(xScheme.match_confidence*100).toFixed(0)}% match` : "No overlap found in demo feed"}</b></div>
      <div><span>Satellite check</span><b>${sat ? satelliteStatusMeta(sat.status).label : "Below large-work threshold"}</b></div>
    </div>
    ${sat ? `<div class="sat-verify-row"><span class="badge ${satelliteStatusMeta(sat.status).badge}">${satelliteStatusMeta(sat.status).label}</span><span class="muted" style="font-size:11px;">${(sat.confidence*100).toFixed(0)}% confidence · simulated imagery pass, large civil work (≥ ${fmtRupee(SATELLITE_LARGE_WORK_THRESHOLD)})</span></div>` : ""}
    ${xScheme ? `<div class="sat-verify-row"><span class="badge crit">Possible duplicate funding</span><span class="muted" style="font-size:11px;">Also appears in ${xScheme.scheme} · sanctioned ${fmtDate(xScheme.sanction_date)} at ${fmtRupee(xScheme.cost)} · <a href="data.html#cross-scheme">view cross-scheme feed →</a></span></div>` : ""}
    ${compact ? "" : `<div class="geo-disclaimer">Coordinates, satellite status and cross-scheme matches are deterministic demo overlays derived from the project record. Connect official geo-tagged assets, a live imagery contract and MGNREGS/state APIs before using this as evidence.</div>`}
  </div>`;
}
window.selectGeoLayer = function(event, safeId, layer){
  if(event) event.stopPropagation();
  const map = document.getElementById("geo-map-"+safeId);
  const label = document.getElementById("geo-label-"+safeId);
  if(!map) return;
  map.dataset.layer = layer;
  label.textContent = {registry:"Asset registry layer", satellite:"Satellite preview · demo", boundary:"Administrative boundary layer", risk:"Risk heatmap · demo"}[layer];
  const buttons = document.querySelector(`[data-geo="${safeId}"]`);
  if(buttons) [...buttons.querySelectorAll("button")].forEach(b=>b.classList.toggle("active", b.textContent.toLowerCase().startsWith(layer==="registry" ? "asset" : layer)));
};

/* ---------------- formatting ---------------- */
function fmtCr(v){
  const cr = v / 1e7;
  if (Math.abs(cr) >= 100) return cr.toFixed(0) + " Cr";
  if (Math.abs(cr) >= 10) return cr.toFixed(1) + " Cr";
  return cr.toFixed(2) + " Cr";
}
function fmtRupee(v){
  if(v === null || v === undefined || Number.isNaN(Number(v))) return "—";
  return "₹" + Number(v).toLocaleString("en-IN", {maximumFractionDigits:0});
}
function fmtNum(v){ return Number(v).toLocaleString("en-IN"); }
function fmtPct(v){ return Number(v).toFixed(1) + "%"; }
function fmtDate(s){
  if(!s) return "—";
  const d = new Date(s);
  return d.toLocaleDateString("en-IN", {day:"2-digit", month:"short", year:"numeric"});
}

function riskBand(score){
  if (score >= 55) return "crit";
  if (score >= 35) return "high";
  if (score >= 18) return "med";
  return "low";
}
function riskBandLabel(band){
  return {crit:"Critical", high:"High", med:"Medium", low:"Low"}[band] || band;
}

/* ---------------- nav shell ---------------- */
const NAV_ITEMS = [
  {href:"index.html",       label:"Overview",  icon:"grid"},
  {href:"state.html",       label:"State &amp; District", icon:"map"},
  {href:"mp.html",          label:"MP Dashboard",       icon:"user"},
  {href:"investigation.html", label:"Investigation Queue", icon:"flag"},
  {href:"guardrail.html",   label:"Pre-Disbursement Guardrail", icon:"shield"},
  {href:"geo.html",         label:"Geo Registry",        icon:"pin"},
  {href:"data.html",        label:"Data Sources",        icon:"database"},
  {href:"ingest.html",      label:"PDF Ingestion",       icon:"upload"},
  {href:"feedback.html",    label:"Feedback Log",        icon:"check"},
  {href:"methodology.html", label:"Model &amp; Accuracy", icon:"cpu"},
];

const ICONS = {
  grid:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6"><rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/></svg>',
  map:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6"><path d="M9 3 3 5v16l6-2 6 2 6-2V3l-6 2-6-2Z"/><path d="M9 3v16M15 5v16"/></svg>',
  user:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6"><circle cx="12" cy="8" r="3.4"/><path d="M4.5 20c1.6-4 4.4-6 7.5-6s5.9 2 7.5 6"/></svg>',
  flag:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6"><path d="M5 3v18"/><path d="M5 4h11l-2.5 3.5L16 11H5"/></svg>',
  pin:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6"><path d="M20 10c0 5-8 11-8 11S4 15 4 10a8 8 0 1 1 16 0Z"/><circle cx="12" cy="10" r="2.5"/></svg>',
  database:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6"><ellipse cx="12" cy="5" rx="7" ry="3"/><path d="M5 5v7c0 1.7 3.1 3 7 3s7-1.3 7-3V5M5 12v7c0 1.7 3.1 3 7 3s7-1.3 7-3v-7"/></svg>',
  check:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6"><circle cx="12" cy="12" r="8.5"/><path d="m8 12 2.6 2.6L16.5 9"/></svg>',
  cpu:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6"><rect x="6" y="6" width="12" height="12" rx="1.5"/><path d="M9 3v3M15 3v3M9 18v3M15 18v3M3 9h3M3 15h3M18 9h3M18 15h3"/></svg>',
  upload:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6"><path d="M12 15V4M12 4 7.5 8.5M12 4l4.5 4.5"/><path d="M4 15v3a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-3"/></svg>',
  shield:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6"><path d="M12 3 20 6v5c0 5-3.2 8.5-8 10-4.8-1.5-8-5-8-10V6l8-3Z"/><path d="m8.5 12 2.2 2.2 4.8-5"/></svg>',
};

function renderShell(activeHref, pageBuilder){
  const app = document.getElementById("app");
  const nav = NAV_ITEMS.map(it => `
    <a href="${it.href}" class="${it.href===activeHref?'active':''}">
      <span class="n-ico">${ICONS[it.icon]}</span>${it.label}
    </a>`).join("");

  app.innerHTML = `
    <div class="shell">
      ${restrictedAccessBadge()}
      <aside class="sidebar">
        <div class="brand">
           <div class="brand-kicker">MoSPI · MPLADS MONITORING</div>
          <div class="mark">
            <div class="brand-mark" aria-label="NidhiRakshak product mark">NR</div>
            <div>
              <div class="brand-name">NidhiRakshak</div>
               <div class="brand-sub">Pre-Disbursement Risk Prioritization &amp; Milestone Guardrail</div>
            </div>
          </div>
          <div class="status-label">AI MONITORING ACTIVE</div>
          ${dataModeControl()}
        </div>
        <nav class="nav">${nav}</nav>
      ${roleSwitcher()}
       <div class="prototype-stamp"><strong>PROTOTYPE DEMO</strong><br/>Representative work records for demonstration. Not an official Government of India service.</div>
        <div class="sidebar-foot">
           <b>${fmtNum(D.national.total_mps)}</b> MPs tracked · <b>${fmtNum(D.national.total_works)}</b> representative risk records<br/>
           MP identity &amp; allocation limits: real published data.<br/>
           <b>Current view:</b> ${dataModeMeta().label}.<br/>
          <b>Prototype demo:</b> work-level ledger is synthetic data. Not an official Government of India service.
        </div>
      </aside>
      <main class="main" id="main"></main>
      <footer class="site-footer">
        <div class="site-footer-inner">
          <div>
            <div class="site-footer-name">NidhiRakshak</div>
             <div class="site-footer-tagline">Pre-Disbursement Risk Prioritization &amp; Milestone Guardrail</div>
          </div>
          <div class="site-footer-note"><strong>Prototype / Hackathon Demonstration</strong><br/>Work-level records shown in this demonstration may contain synthetic demo data.</div>
        </div>
      </footer>
    </div>
  `;
  pageBuilder(document.getElementById("main"));
}

/* ---------------- reason chips ---------------- */
function reasonChips(codes, limit){
  const cat = D.reasons.catalog;
  const list = (codes||[]).slice(0, limit || codes.length);
  return list.map(c => `<span class="chip" title="${(cat[c]||{}).detail||''}"><b>${(cat[c]||{}).label || c}</b></span>`).join("");
}

/* =========================================================================
   Dependency-free SVG chart helpers
   ========================================================================= */
const SVGNS = "http://www.w3.org/2000/svg";

function svgEl(tag, attrs){
  const el = document.createElementNS(SVGNS, tag);
  for(const k in attrs) el.setAttribute(k, attrs[k]);
  return el;
}

/** Simple responsive bar chart. data: [{label, value}] */
function barChart(container, data, opts={}){
  const w = opts.width || container.clientWidth || 480;
  const h = opts.height || 220;
  const padL = opts.padL || 34, padB = 46, padT = 14, padR = 10;
  const max = opts.max || Math.max(1, ...data.map(d=>d.value));
  const innerW = w - padL - padR, innerH = h - padT - padB;
  const bw = innerW / data.length;
  const svg = svgEl("svg", {viewBox:`0 0 ${w} ${h}`, width:"100%", height:h, class:"chart-svg"});

  // gridlines
  for(let i=0;i<=4;i++){
    const y = padT + innerH - (innerH*i/4);
    svg.appendChild(svgEl("line", {x1:padL, x2:w-padR, y1:y, y2:y, stroke:"#e2e9f1", "stroke-width":1}));
    const t = svgEl("text", {x:padL-8, y:y+4, fill:"#7d8da3", "font-size":10, "text-anchor":"end"});
    t.textContent = Math.round(max*i/4);
    svg.appendChild(t);
  }

  data.forEach((d,i)=>{
    const barH = (d.value/max) * innerH;
    const x = padL + i*bw + bw*0.18;
    const y = padT + innerH - barH;
    const bwidth = bw*0.64;
    const color = d.color || "var(--brass)";
    const rect = svgEl("rect", {x, y, width:bwidth, height:Math.max(barH,1), fill:color, rx:2});
    svg.appendChild(rect);
    const val = svgEl("text", {x:x+bwidth/2, y:y-6, fill:"#17243a", "font-size":11, "text-anchor":"middle", "font-weight":600});
    val.textContent = opts.fmt ? opts.fmt(d.value) : d.value;
    svg.appendChild(val);
    const lbl = svgEl("text", {x:x+bwidth/2, y:h-padB+16, fill:"#7d8da3", "font-size":10.5, "text-anchor":"middle"});
    const label = String(d.label);
    lbl.textContent = label.length > 14 ? label.slice(0,13)+"…" : label;
    const tt = svgEl("title", {}); tt.textContent = label;
    lbl.appendChild(tt);
    svg.appendChild(lbl);
  });

  container.innerHTML = "";
  container.appendChild(svg);
}

/** Horizontal bar chart (good for long category labels) */
function hBarChart(container, data, opts={}){
  const w = opts.width || container.clientWidth || 480;
  const rowH = opts.rowH || 26;
  const padL = opts.padL || 150, padR = 60, padT = 6;
  const h = data.length * rowH + padT + 6;
  const max = opts.max || Math.max(1, ...data.map(d=>d.value));
  const innerW = w - padL - padR;
  const svg = svgEl("svg", {viewBox:`0 0 ${w} ${h}`, width:"100%", height:h});

  data.forEach((d,i)=>{
    const y = padT + i*rowH;
    const barW = Math.max((d.value/max) * innerW, 2);
    const lbl = svgEl("text", {x:padL-10, y:y+rowH*0.62, fill:"#526984", "font-size":11.5, "text-anchor":"end"});
    lbl.textContent = d.label;
    svg.appendChild(lbl);
    svg.appendChild(svgEl("rect", {x:padL, y:y+4, width:innerW, height:rowH-14, fill:"#edf2f7", rx:2}));
    svg.appendChild(svgEl("rect", {x:padL, y:y+4, width:barW, height:rowH-14, fill:d.color||"var(--brass)", rx:2}));
    const val = svgEl("text", {x:padL+barW+8, y:y+rowH*0.62, fill:"#17243a", "font-size":11, "font-weight":600});
    val.textContent = opts.fmt ? opts.fmt(d.value) : d.value;
    svg.appendChild(val);
  });
  container.innerHTML = "";
  container.appendChild(svg);
}

/** Line/area chart. data: [{x,y}] */
function lineChart(container, series, opts={}){
  const w = opts.width || container.clientWidth || 480;
  const h = opts.height || 220;
  const padL = 40, padR = 16, padT = 16, padB = 30;
  const innerW = w - padL - padR, innerH = h - padT - padB;
  const allY = series.flatMap(s=>s.data.map(d=>d.y));
  const maxY = opts.maxY || Math.max(1, ...allY) * 1.15;
  const n = series[0].data.length;
  const svg = svgEl("svg", {viewBox:`0 0 ${w} ${h}`, width:"100%", height:h});

  for(let i=0;i<=3;i++){
    const y = padT + innerH - (innerH*i/3);
    svg.appendChild(svgEl("line", {x1:padL, x2:w-padR, y1:y, y2:y, stroke:"#e2e9f1", "stroke-width":1}));
    const t = svgEl("text", {x:padL-8, y:y+4, fill:"#7d8da3", "font-size":10, "text-anchor":"end"});
    t.textContent = Math.round(maxY*i/3);
    svg.appendChild(t);
  }

  series.forEach(s=>{
    const pts = s.data.map((d,i)=>{
      const x = padL + (innerW * i/(n-1||1));
      const y = padT + innerH - (d.y/maxY)*innerH;
      return [x,y];
    });
    if (s.area){
      const areaPath = `M${pts[0][0]},${padT+innerH} ` + pts.map(p=>`L${p[0]},${p[1]}`).join(" ") + ` L${pts[pts.length-1][0]},${padT+innerH} Z`;
      svg.appendChild(svgEl("path", {d:areaPath, fill:s.color, opacity:0.14}));
    }
    const linePath = "M" + pts.map(p=>p.join(",")).join(" L");
    svg.appendChild(svgEl("path", {d:linePath, fill:"none", stroke:s.color, "stroke-width":2}));
    pts.forEach((p,i)=>{
      if(i%Math.ceil(n/12)===0 || i===pts.length-1){
        svg.appendChild(svgEl("circle", {cx:p[0], cy:p[1], r:2.6, fill:s.color}));
      }
    });
  });

  // x labels (sparse)
  const step = Math.ceil(n/6);
  series[0].data.forEach((d,i)=>{
    if(i%step===0 || i===n-1){
      const x = padL + (innerW * i/(n-1||1));
      const t = svgEl("text", {x, y:h-8, fill:"#7d8da3", "font-size":10, "text-anchor":"middle"});
      t.textContent = d.x;
      svg.appendChild(t);
    }
  });

  container.innerHTML = "";
  container.appendChild(svg);
}

/** Donut chart. data: [{label, value, color}] */
function donutChart(container, data, opts={}){
  const size = opts.size || 180;
  const cx = size/2, cy = size/2, r = size/2 - 14, thickness = opts.thickness || 20;
  const total = data.reduce((a,d)=>a+d.value,0) || 1;
  const svg = svgEl("svg", {viewBox:`0 0 ${size} ${size}`, width:size, height:size});
  let angle = -90;
  data.forEach(d=>{
    const frac = d.value/total;
    const sweep = frac*360;
    const large = sweep > 180 ? 1 : 0;
    const a0 = angle * Math.PI/180, a1 = (angle+sweep) * Math.PI/180;
    const x0 = cx + r*Math.cos(a0), y0 = cy + r*Math.sin(a0);
    const x1 = cx + r*Math.cos(a1), y1 = cy + r*Math.sin(a1);
    const path = svgEl("path", {
      d:`M${x0},${y0} A${r},${r} 0 ${large} 1 ${x1},${y1}`,
      fill:"none", stroke:d.color, "stroke-width":thickness,
    });
    svg.appendChild(path);
    angle += sweep;
  });
  container.innerHTML = "";
  container.appendChild(svg);
}

/** Radial risk gauge 0-100 */
function riskGauge(container, score, band){
  const size = 180, cx = size/2, cy = size/2, r = 70, thickness = 14;
  const colorMap = {crit:"#b44646", high:"#c87917", med:"#b28a21", low:"#247454"};
  const color = colorMap[band] || "#247454";
  const startAngle = -220, sweepTotal = 260;
  const svg = svgEl("svg", {viewBox:`0 0 ${size} ${size}`, width:size, height:size});

  function arcPath(a0deg, a1deg){
    const a0 = a0deg*Math.PI/180, a1 = a1deg*Math.PI/180;
    const x0 = cx + r*Math.cos(a0), y0 = cy + r*Math.sin(a0);
    const x1 = cx + r*Math.cos(a1), y1 = cy + r*Math.sin(a1);
    const large = (a1deg-a0deg) > 180 ? 1 : 0;
    return `M${x0},${y0} A${r},${r} 0 ${large} 1 ${x1},${y1}`;
  }

  svg.appendChild(svgEl("path", {d:arcPath(startAngle, startAngle+sweepTotal), fill:"none", stroke:"#e7edf4", "stroke-width":thickness, "stroke-linecap":"round"}));
  const sweep = sweepTotal * Math.min(score,100)/100;
  svg.appendChild(svgEl("path", {d:arcPath(startAngle, startAngle+sweep), fill:"none", stroke:color, "stroke-width":thickness, "stroke-linecap":"round"}));

  const txt = svgEl("text", {x:cx, y:cy+2, fill:"#10213d", "font-size":30, "font-weight":700, "text-anchor":"middle", "font-family":"'Source Serif 4', serif"});
  txt.textContent = Math.round(score);
  svg.appendChild(txt);
  const sub = svgEl("text", {x:cx, y:cy+22, fill:color, "font-size":11.5, "font-weight":700, "text-anchor":"middle", "letter-spacing":"0.5"});
  sub.textContent = riskBandLabel(band).toUpperCase() + " RISK";
  svg.appendChild(sub);

  container.innerHTML = "";
  container.appendChild(svg);
}

/** ROC curve */
function rocChart(container, fpr, tpr, auc){
  const w = container.clientWidth || 380, h = 260;
  const pad = 36;
  const inner = w - pad*2;
  const svg = svgEl("svg", {viewBox:`0 0 ${w} ${h}`, width:"100%", height:h});

  svg.appendChild(svgEl("line", {x1:pad, y1:h-pad, x2:w-pad, y2:h-pad, stroke:"#cbd7e5"}));
  svg.appendChild(svgEl("line", {x1:pad, y1:pad, x2:pad, y2:h-pad, stroke:"#cbd7e5"}));
  // diagonal reference
  svg.appendChild(svgEl("line", {x1:pad, y1:h-pad, x2:w-pad, y2:pad, stroke:"#cbd7e5", "stroke-dasharray":"4 4"}));

  const pts = fpr.map((f,i)=>[pad + f*inner, (h-pad) - tpr[i]*(h-pad*2)]);
  const path = "M" + pts.map(p=>p.join(",")).join(" L");
  svg.appendChild(svgEl("path", {d:path, fill:"none", stroke:"#c99a3d", "stroke-width":2.4}));
  const areaPath = `M${pad},${h-pad} ` + pts.map(p=>`L${p[0]},${p[1]}`).join(" ") + ` L${w-pad},${h-pad} Z`;
  svg.appendChild(svgEl("path", {d:areaPath, fill:"#c99a3d", opacity:.1}));

  const lx = svgEl("text", {x:w/2, y:h-8, fill:"#7d8da3", "font-size":10.5, "text-anchor":"middle"});
  lx.textContent = "False Positive Rate"; svg.appendChild(lx);
  const ly = svgEl("text", {x:14, y:h/2, fill:"#7d8da3", "font-size":10.5, "text-anchor":"middle", transform:`rotate(-90 14 ${h/2})`});
  ly.textContent = "True Positive Rate"; svg.appendChild(ly);

  const aucT = svgEl("text", {x:w-pad-6, y:pad+16, fill:"#10213d", "font-size":13, "text-anchor":"end", "font-weight":700});
  aucT.textContent = "AUC " + auc.toFixed(3);
  svg.appendChild(aucT);

  container.innerHTML = "";
  container.appendChild(svg);
}

/* ---------------- typeahead ---------------- */
function attachMpTypeahead(inputEl, listEl, onSelect){
  const mps = D.mps;
  function render(items){
    if(!items.length){ listEl.style.display="none"; listEl.innerHTML=""; return; }
    listEl.innerHTML = items.slice(0,12).map(m => `
      <div class="typeahead-item" data-id="${m.mp_id}">
        <div class="tn">${m.mp_name}</div>
        <div class="ts">${m.constituency}, ${m.state} · Risk ${m.avg_risk}</div>
      </div>`).join("");
    listEl.style.display = "block";
  }
  inputEl.addEventListener("input", ()=>{
    const q = inputEl.value.trim().toLowerCase();
    if(q.length < 1){ listEl.style.display="none"; return; }
    const items = mps.filter(m => m.mp_name.toLowerCase().includes(q) || m.constituency.toLowerCase().includes(q) || m.state.toLowerCase().includes(q));
    render(items);
  });
  listEl.addEventListener("click", (e)=>{
    const item = e.target.closest(".typeahead-item");
    if(!item) return;
    onSelect(item.dataset.id);
    listEl.style.display = "none";
  });
  document.addEventListener("click", (e)=>{
    if(!inputEl.contains(e.target) && !listEl.contains(e.target)) listEl.style.display="none";
  });
}
