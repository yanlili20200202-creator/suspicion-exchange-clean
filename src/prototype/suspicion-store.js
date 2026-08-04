import {
  recordBetForDailySession,
  recordMarketState,
} from "./exhibition-data-store.js";
import { STORAGE_KEYS } from "./storage-keys.js";

const STORAGE_KEY = STORAGE_KEYS.marketPrototype;
const CHANNEL_NAME = "suspicion-exchange-live";

export const INITIAL_STATE = {
  indices: {
    humanOriginality: 64,
    aiSuspicion: 51,
    publicTrust: 42,
    appealFailure: 73,
    platformAuthority: 81,
  },
  movement: [42, 58, 49, 68, 62, 76, 55, 71, 65, 82, 74, 79],
  warning:
    "Market stable. Audience judgement is waiting to be converted into platform value.",
  cnWarning: "市场暂时稳定。观众判断正在等待被转换为平台价值。",
  prediction:
    "Human originality remains tradable, but confidence is weakening.",
  feedback:
    "Choose a market action. Your judgement will become system input.",
  cnFeedback: "选择一项市场操作。你的判断将成为系统输入。",
  detail:
    "No final authorship claim is available. Every action changes the market before it changes the truth.",
  cnDetail:
    "目前没有最终的作者身份结论。每一次操作都会先改变市场，然后才轮到真相。",
  logs: [
    {
      id: "initial",
      time: "--:--:--",
      action: "MARKET OPENED",
      cnAction: "市场已开放",
      change: "Baseline indices loaded",
      cnChange: "基准指数已载入",
    },
  ],
};

const ACTIONS = {
  "Buy Doubt": {
    delta: {
      humanOriginality: -1,
      aiSuspicion: 3,
      publicTrust: -2,
      appealFailure: 1,
      platformAuthority: 1,
    },
    feedback:
      "Your doubt has been recorded as market input. AI Suspicion rises.",
    cnFeedback: "你的怀疑已被记录为市场输入。AI 怀疑指数上升。",
    detail:
      "The platform reads your uncertainty as evidence that the content requires stronger intervention.",
    cnDetail:
      "平台把你的不确定性读取为证据，认为该内容需要更强的干预。",
    warning: "AI Suspicion Index rising: public doubt is reinforcing the label.",
    cnWarning: "AI 怀疑指数正在上升：公众怀疑正在强化平台标签。",
    prediction: "Suspicion will outperform verification in the next cycle.",
  },
  "Sell Trust": {
    delta: {
      humanOriginality: -1,
      aiSuspicion: 2,
      publicTrust: -3,
      appealFailure: 1,
      platformAuthority: 2,
    },
    feedback:
      "Trust has been sold. Public trust is converted into market loss.",
    cnFeedback: "信任已被卖出。公众信任被转化为市场损失。",
    detail:
      "Reduced public trust does not weaken the system; it increases demand for system judgement.",
    cnDetail:
      "公众信任下降并不会削弱系统；它反而增加了对系统判断的需求。",
    warning: "Public Trust Index falling below a stable social threshold.",
    cnWarning: "公众信任指数正在跌破稳定的社会阈值。",
    prediction: "Users will rely more heavily on labels while trusting them less.",
  },
  "Short Human Originality": {
    delta: {
      humanOriginality: -4,
      aiSuspicion: 3,
      publicTrust: -1,
      appealFailure: 2,
      platformAuthority: 1,
    },
    feedback:
      "Human originality has been shorted. The system treats suspicion as value.",
    cnFeedback: "人类原创性已被做空。系统将怀疑视为价值。",
    detail:
      "Ambiguous evidence is being priced as a future failure of human verification.",
    cnDetail:
      "模糊证据正在被定价为未来人类验证失败的可能性。",
    warning: "Human Originality Index under coordinated speculative pressure.",
    cnWarning: "人类原创性指数正承受协同投机压力。",
    prediction: "Creator evidence will lose value faster than suspicion spreads.",
  },
  "Support Appeal": {
    delta: {
      humanOriginality: 3,
      aiSuspicion: -2,
      publicTrust: 2,
      appealFailure: -3,
      platformAuthority: -1,
    },
    feedback:
      "Appeal support recorded. Resistance is also processed as data.",
    cnFeedback: "申诉支持已被记录。抵抗同样会被处理为数据。",
    detail:
      "The creator response enters the system as contested evidence, not as proof.",
    cnDetail:
      "创作者回应以争议证据而非证明的身份进入系统。",
    warning: "Appeal activity detected: platform label is being challenged.",
    cnWarning: "检测到申诉活动：平台标签正在受到挑战。",
    prediction: "A temporary trust recovery is possible, pending platform review.",
  },
};

let memoryState = loadState();
const listeners = new Set();
const channel =
  typeof BroadcastChannel === "undefined"
    ? null
    : new BroadcastChannel(CHANNEL_NAME);

function cloneInitialState() {
  return JSON.parse(JSON.stringify(INITIAL_STATE));
}

function loadState() {
  try {
    const savedGlobalState = localStorage.getItem(STORAGE_KEY);
    const savedCurrentState = localStorage.getItem(
      STORAGE_KEYS.currentMarketState,
    );
    if (!savedGlobalState && !savedCurrentState) return cloneInitialState();

    const initialState = cloneInitialState();
    const parsedState = savedGlobalState
      ? JSON.parse(savedGlobalState)
      : JSON.parse(savedCurrentState);
    const savedLogs = parsedState.logs ?? parsedState.actionLog;
    const migratedLogs = (savedLogs ?? initialState.logs).map((log) => ({
      ...log,
      cnAction: log.cnAction ?? getChineseAction(log.action),
      cnChange: log.cnChange ?? "指数变化已记录",
    }));

    return {
      ...initialState,
      ...parsedState,
      indices: {
        ...initialState.indices,
        ...(parsedState.indices ?? parsedState),
      },
      logs: migratedLogs,
    };
  } catch {
    return cloneInitialState();
  }
}

function clamp(value) {
  return Math.max(0, Math.min(100, value));
}

export function calculateMovementPoint(indices) {
  const suspicionPressure =
    indices.aiSuspicion +
    indices.platformAuthority +
    indices.appealFailure +
    (100 - indices.publicTrust) +
    (100 - indices.humanOriginality);

  return clamp(Math.round(suspicionPressure / 5));
}

function notify(state) {
  memoryState = state;
  listeners.forEach((listener) => listener(state));
}

function saveAndBroadcast(state) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch {
    // The prototype still works in memory if storage is unavailable.
  }
  broadcastAndNotify(state);
}

function broadcastAndNotify(state) {
  channel?.postMessage(state);
  notify(state);
}

channel?.addEventListener("message", (event) => notify(event.data));

if (typeof window !== "undefined") {
  window.addEventListener("storage", (event) => {
    if (event.key === STORAGE_KEY && event.newValue) {
      notify(JSON.parse(event.newValue));
    }
  });
}

export function getSnapshot() {
  return memoryState;
}

export function subscribe(listener) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function applyAudienceAction(actionName, caseLabel = "", audience = null) {
  const action = ACTIONS[actionName];
  if (!action) return memoryState;

  const nextIndices = Object.fromEntries(
    Object.entries(memoryState.indices).map(([key, value]) => [
      key,
      clamp(value + (action.delta[key] ?? 0)),
    ]),
  );

  const movementPoint = calculateMovementPoint(nextIndices);
  const timestamp = new Date();
  const betId = `BET-${timestamp.getTime()}-${actionName
    .toUpperCase()
    .replaceAll(" ", "-")}`;
  const changedIndexes = Object.fromEntries(
    Object.keys(nextIndices).map((key) => [
      key,
      {
        before: memoryState.indices[key],
        change: action.delta[key] ?? 0,
        after: nextIndices[key],
      },
    ]),
  );
  const bet = {
    betId,
    accountNumber: audience?.accountNumber ?? "",
    nickname: audience?.nickname ?? "",
    caseNumber: caseLabel,
    actionType: actionName,
    chipsBefore: audience?.chipsBefore ?? null,
    chipCost: audience?.chipCost ?? null,
    chipsAfter: audience?.chipsAfter ?? null,
    trustChipsAfterBet: audience?.trustChipsAfterBet ?? null,
    opaqueResult: audience?.opaqueResult ?? "under review",
    beforeMarketState: { ...memoryState.indices },
    afterMarketState: { ...nextIndices },
    delta: { ...action.delta },
    systemMessage: action.feedback,
    timestamp: timestamp.toISOString(),
  };
  const log = {
    id: betId,
    betId,
    timestamp: timestamp.toISOString(),
    time: timestamp.toLocaleTimeString("en-GB"),
    accountNumber: audience?.accountNumber ?? "",
    nickname: audience?.nickname ?? "",
    caseNumber: caseLabel,
    actionName,
    action: actionName.toUpperCase(),
    cnAction: getChineseAction(actionName),
    changedIndexes,
    systemMessage: action.feedback,
    change: `${caseLabel ? `${caseLabel} / ` : ""}AI ${formatDelta(action.delta.aiSuspicion)} / TRUST ${formatDelta(action.delta.publicTrust)}`,
    cnChange: `${caseLabel ? `${caseLabel.replace("Case", "案例")} / ` : ""}AI ${formatDelta(action.delta.aiSuspicion)} / 信任 ${formatDelta(action.delta.publicTrust)}`,
  };

  const nextState = {
    ...memoryState,
    indices: nextIndices,
    movement: [...memoryState.movement.slice(-11), movementPoint],
    warning: action.warning,
    cnWarning: action.cnWarning,
    prediction: action.prediction,
    feedback: action.feedback,
    cnFeedback: action.cnFeedback,
    detail: action.detail,
    cnDetail: action.cnDetail,
    logs: [log, ...memoryState.logs].slice(0, 12),
  };

  saveAndBroadcast(nextState);
  try {
    recordBetForDailySession(bet, nextState);
  } catch {
    // The live market remains usable if exhibition data storage is unavailable.
  }
  return nextState;
}

export function restoreMarketState(savedState) {
  if (!savedState || typeof savedState !== "object") return memoryState;

  const initialState = cloneInitialState();
  const savedIndices = savedState.indices ?? savedState;
  const savedLogs = savedState.logs ?? savedState.actionLog;
  const restoredState = {
    ...initialState,
    ...savedState,
    indices: {
      ...initialState.indices,
      ...savedIndices,
    },
    logs: Array.isArray(savedLogs) ? savedLogs : [],
  };
  saveAndBroadcast(restoredState);
  return restoredState;
}

export function resetMarketState(
  { persist = true, recordSession = true } = {},
) {
  const resetState = {
    ...memoryState,
    indices: { ...INITIAL_STATE.indices },
    logs: [],
  };
  if (persist) {
    saveAndBroadcast(resetState);
  } else {
    broadcastAndNotify(resetState);
  }
  if (recordSession) {
    try {
      recordMarketState(resetState, "market-reset");
    } catch {
      // The live market remains usable if exhibition data storage is unavailable.
    }
  }
  return resetState;
}

export function clearMarketState() {
  const clearedState = cloneInitialState();
  clearedState.logs = [];
  broadcastAndNotify(clearedState);
  return clearedState;
}

function formatDelta(value) {
  return value > 0 ? `+${value}` : `${value}`;
}

function getChineseAction(actionName) {
  const translations = {
    "BUY DOUBT": "买入怀疑",
    "SELL TRUST": "卖出信任",
    "SHORT HUMAN ORIGINALITY": "做空人类原创性",
    "SUPPORT APPEAL": "支持申诉",
    "MARKET OPENED": "市场已开放",
  };

  return translations[actionName.toUpperCase()] ?? "操作已记录";
}
