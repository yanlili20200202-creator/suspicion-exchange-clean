import { STORAGE_KEYS } from "./storage-keys.js";

const ACTION_TYPES = [
  "Buy Doubt",
  "Sell Trust",
  "Short Human Originality",
  "Support Appeal",
];

const TRUST_CHIPS_POOLS = [
  {
    actionType: "Buy Doubt",
    poolName: "Buy Doubt Pool",
    leadingPoolMessage:
      "Most Trust Chips are flowing into doubt. Suspicion is becoming the strongest market force.",
  },
  {
    actionType: "Sell Trust",
    poolName: "Sell Trust Pool",
    leadingPoolMessage:
      "Most Trust Chips are leaving trust. Public trust is being liquidated.",
  },
  {
    actionType: "Short Human Originality",
    poolName: "Short Human Originality Pool",
    leadingPoolMessage:
      "Most Trust Chips are betting against human originality. Creator testimony is under market pressure.",
  },
  {
    actionType: "Support Appeal",
    poolName: "Appeal Support Pool",
    leadingPoolMessage:
      "Most Trust Chips are entering appeal support. Resistance is visible, but still processed as data.",
  },
];

export function getSessionDate(date = new Date()) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export function toCurrentMarketState(state) {
  const indices = state?.indices ?? state ?? {};
  const actionLog = state?.logs ?? state?.actionLog ?? [];

  return {
    humanOriginality: indices.humanOriginality ?? 0,
    aiSuspicion: indices.aiSuspicion ?? 0,
    publicTrust: indices.publicTrust ?? 0,
    appealFailure: indices.appealFailure ?? 0,
    platformAuthority: indices.platformAuthority ?? 0,
    lastAction:
      state?.lastAction ?? actionLog[0]?.actionName ?? actionLog[0]?.action ?? null,
    lastMessage: state?.lastMessage ?? state?.feedback ?? "",
    actionLog,
  };
}

export function recordAccountRegistration(user, marketState) {
  const session = ensureDailySession(marketState);
  session.currentMarketState = toCurrentMarketState(marketState);
  session.dailySummary = buildDailySummary(
    session.allBetsToday,
    session.currentMarketState,
    session.sessionDate,
  );
  saveCurrentMarketState(session.currentMarketState);
  saveDailySession(session);
  return user;
}

export function recordBetForDailySession(bet, marketState) {
  appendBetToAccount(bet);

  const session = ensureDailySession(marketState);
  const currentMarketState = toCurrentMarketState(marketState);
  session.currentMarketState = currentMarketState;
  session.endMarketState = currentMarketState;
  session.allBetsToday = [...session.allBetsToday, bet];
  session.marketSnapshots = [
    ...session.marketSnapshots,
    createSnapshot("bet", currentMarketState, bet.timestamp, bet),
  ];
  session.dailySummary = buildDailySummary(
    session.allBetsToday,
    currentMarketState,
    session.sessionDate,
  );

  saveCurrentMarketState(currentMarketState);
  saveDailySession(session);
  return session;
}

export function recordMarketState(marketState, snapshotType = "market-update") {
  const session = ensureDailySession(marketState);
  const currentMarketState = toCurrentMarketState(marketState);
  const timestamp = new Date().toISOString();

  session.currentMarketState = currentMarketState;
  session.marketSnapshots = [
    ...session.marketSnapshots,
    createSnapshot(snapshotType, currentMarketState, timestamp),
  ];
  session.dailySummary = buildDailySummary(
    session.allBetsToday,
    currentMarketState,
    session.sessionDate,
  );

  saveCurrentMarketState(currentMarketState);
  saveDailySession(session);
  return session;
}

export function getDailySession(sessionDate = getSessionDate()) {
  const currentSession = readJson(STORAGE_KEYS.dailySession, null);
  if (currentSession?.sessionDate === sessionDate) return currentSession;

  const dailySessions = readJson(STORAGE_KEYS.dailySessions, {});
  return dailySessions?.[sessionDate] ?? null;
}

export function calculateTodayTrustChipsFlow() {
  const bets = getDailySession()?.allBetsToday ?? [];
  const pools = TRUST_CHIPS_POOLS.map((pool) => {
    const poolBets = bets.filter((bet) => bet.actionType === pool.actionType);
    return {
      actionType: pool.actionType,
      poolName: pool.poolName,
      totalChips: poolBets.reduce(
        (total, bet) =>
          total + (Number.isFinite(bet.chipCost) ? bet.chipCost : 0),
        0,
      ),
      betCount: poolBets.length,
    };
  });
  const highestTotal = Math.max(...pools.map((pool) => pool.totalChips));
  const leadingPool =
    highestTotal > 0
      ? pools.find((pool) => pool.totalChips === highestTotal)
      : null;
  const leadingDefinition = leadingPool
    ? TRUST_CHIPS_POOLS.find(
        (pool) => pool.actionType === leadingPool.actionType,
      )
    : null;

  return {
    pools,
    leadingPool,
    leadingPoolMessage: leadingDefinition?.leadingPoolMessage ?? "",
  };
}

export function createExhibitionBackup(currentGlobalMarketState = null) {
  const currentSession = readJson(STORAGE_KEYS.dailySession, null);
  const savedDailySessions = readJson(STORAGE_KEYS.dailySessions, {});
  const dailySessions = { ...savedDailySessions };
  const savedGlobalMarketState = readJson(STORAGE_KEYS.marketPrototype, null);
  const globalMarketState =
    currentGlobalMarketState ?? savedGlobalMarketState;
  const currentMarketState =
    readJson(STORAGE_KEYS.currentMarketState, null) ??
    (globalMarketState ? toCurrentMarketState(globalMarketState) : null);
  if (currentSession?.sessionDate) {
    dailySessions[currentSession.sessionDate] = currentSession;
  }

  const backup = {
    version: 1,
    exportedAt: new Date().toISOString(),
    accounts: readJson(STORAGE_KEYS.users, []),
    currentAccount: readJson(STORAGE_KEYS.currentUser, null),
    nextAccountNumber: Number.parseInt(
      localStorage.getItem(STORAGE_KEYS.nextAccountNumber) ?? "1",
      10,
    ),
    marketPrototype: globalMarketState,
    currentMarketState,
    currentDailySession: currentSession,
    dailySessions,
  };

  return removeNicknameFields(backup);
}

export function downloadExhibitionBackup(currentGlobalMarketState = null) {
  if (typeof document === "undefined" || typeof URL === "undefined") {
    return false;
  }

  const backup = createExhibitionBackup(currentGlobalMarketState);
  const blob = new Blob([JSON.stringify(backup, null, 2)], {
    type: "application/json",
  });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `suspicion-exchange-backup-${getSessionDate()}.json`;
  link.click();
  URL.revokeObjectURL(url);
  return true;
}

export function importExhibitionBackup(backup) {
  if (!backup || typeof backup !== "object") {
    throw new Error("Invalid exhibition backup.");
  }
  if (!Array.isArray(backup.accounts)) {
    throw new Error("Backup accounts must be an array.");
  }
  if (!backup.dailySessions || typeof backup.dailySessions !== "object") {
    throw new Error("Backup daily sessions are missing.");
  }
  const globalMarketState =
    backup.marketPrototype ?? backup.currentMarketState;
  if (!globalMarketState || typeof globalMarketState !== "object") {
    throw new Error("Backup global market state is missing.");
  }
  const currentMarketState =
    backup.currentMarketState ?? toCurrentMarketState(globalMarketState);

  const nextAccountNumber = Number.parseInt(backup.nextAccountNumber, 10);
  if (!Number.isInteger(nextAccountNumber) || nextAccountNumber < 1) {
    throw new Error("Backup account counter is invalid.");
  }

  writeJson(STORAGE_KEYS.users, backup.accounts);
  writeOptionalJson(STORAGE_KEYS.currentUser, backup.currentAccount);
  localStorage.setItem(
    STORAGE_KEYS.nextAccountNumber,
    String(nextAccountNumber),
  );
  writeJson(STORAGE_KEYS.marketPrototype, globalMarketState);
  writeJson(STORAGE_KEYS.currentMarketState, currentMarketState);
  writeJson(STORAGE_KEYS.dailySessions, backup.dailySessions);
  writeOptionalJson(
    STORAGE_KEYS.dailySession,
    backup.currentDailySession,
  );

  return {
    marketPrototype: globalMarketState,
    currentMarketState,
    currentAccount: backup.currentAccount,
  };
}

export function clearExhibitionData() {
  Object.values(STORAGE_KEYS).forEach((key) => localStorage.removeItem(key));
}

function ensureDailySession(marketState) {
  const sessionDate = getSessionDate();
  const currentSession = readJson(STORAGE_KEYS.dailySession, null);
  if (
    currentSession?.sessionDate &&
    currentSession.sessionDate !== sessionDate
  ) {
    saveSessionToHistory(currentSession);
  }

  const savedSession = getDailySession(sessionDate);
  if (savedSession?.sessionDate === sessionDate) {
    const savedStartMarketState =
      savedSession.startMarketState ??
      savedSession.marketSnapshots?.[0]?.marketStateAfterAction ??
      savedSession.currentMarketState;
    const savedEndMarketState =
      savedSession.endMarketState ?? savedSession.currentMarketState;
    return {
      ...savedSession,
      startMarketState: savedStartMarketState,
      endMarketState: savedEndMarketState,
      allBetsToday: savedSession.allBetsToday ?? [],
      marketSnapshots: savedSession.marketSnapshots ?? [],
    };
  }

  const currentMarketState = toCurrentMarketState(marketState);
  const openedAt = new Date().toISOString();
  return {
    sessionDate,
    openedAt,
    startMarketState: currentMarketState,
    endMarketState: currentMarketState,
    currentMarketState,
    allBetsToday: [],
    marketSnapshots: [
      createSnapshot("session-open", currentMarketState, openedAt),
    ],
    dailySummary: buildDailySummary([], currentMarketState, sessionDate),
  };
}

function appendBetToAccount(bet) {
  if (!bet.accountNumber) return;

  const users = readJson(STORAGE_KEYS.users, []);
  const updatedUsers = (Array.isArray(users) ? users : []).map((user) =>
    user.accountNumber === bet.accountNumber
      ? { ...user, bets: [...(user.bets ?? []), bet] }
      : user,
  );
  localStorage.setItem(STORAGE_KEYS.users, JSON.stringify(updatedUsers));

  const currentUser = readJson(STORAGE_KEYS.currentUser, null);
  if (currentUser?.accountNumber === bet.accountNumber) {
    localStorage.setItem(
      STORAGE_KEYS.currentUser,
      JSON.stringify({
        ...currentUser,
        bets: [...(currentUser.bets ?? []), bet],
      }),
    );
  }
}

function buildDailySummary(bets, finalMarketState, sessionDate) {
  const counts = Object.fromEntries(
    ACTION_TYPES.map((actionType) => [
      actionType,
      bets.filter((bet) => bet.actionType === actionType).length,
    ]),
  );
  const users = readJson(STORAGE_KEYS.users, []);
  const accountNumbersToday = new Set(
    (Array.isArray(users) ? users : [])
      .filter((user) => {
        if (user.sessionDate) return user.sessionDate === sessionDate;
        if (!user.createdAt) return false;

        const createdDate = new Date(user.createdAt);
        return (
          !Number.isNaN(createdDate.getTime()) &&
          getSessionDate(createdDate) === sessionDate
        );
      })
      .map((user) => user.accountNumber),
  );

  return {
    totalAccountsToday: accountNumbersToday.size,
    totalBetsToday: bets.length,
    buyDoubtCount: counts["Buy Doubt"],
    sellTrustCount: counts["Sell Trust"],
    shortHumanOriginalityCount: counts["Short Human Originality"],
    supportAppealCount: counts["Support Appeal"],
    finalMarketState,
  };
}

function createSnapshot(type, marketState, timestamp, bet = null) {
  return {
    snapshotId: `SNAPSHOT-${timestamp}-${type}`,
    type,
    betId: bet?.betId ?? null,
    timestamp,
    accountNumber: bet?.accountNumber ?? null,
    actionType: bet?.actionType ?? null,
    caseNumber: bet?.caseNumber ?? null,
    marketStateAfterAction: marketState,
  };
}

function saveCurrentMarketState(marketState) {
  localStorage.setItem(
    STORAGE_KEYS.currentMarketState,
    JSON.stringify(marketState),
  );
}

function saveDailySession(session) {
  localStorage.setItem(STORAGE_KEYS.dailySession, JSON.stringify(session));
  saveSessionToHistory(session);
}

function saveSessionToHistory(session) {
  const dailySessions = readJson(STORAGE_KEYS.dailySessions, {});
  localStorage.setItem(
    STORAGE_KEYS.dailySessions,
    JSON.stringify({
      ...dailySessions,
      [session.sessionDate]: session,
    }),
  );
}

function readJson(key, fallback) {
  try {
    const value = localStorage.getItem(key);
    return value ? JSON.parse(value) : fallback;
  } catch {
    return fallback;
  }
}

function writeJson(key, value) {
  localStorage.setItem(key, JSON.stringify(value));
}

function writeOptionalJson(key, value) {
  if (value === null || value === undefined) {
    localStorage.removeItem(key);
    return;
  }
  writeJson(key, value);
}

function removeNicknameFields(value) {
  if (Array.isArray(value)) {
    return value.map(removeNicknameFields);
  }
  if (!value || typeof value !== "object") {
    return value;
  }

  return Object.fromEntries(
    Object.entries(value)
      .filter(([key]) => key !== "nickname")
      .map(([key, nestedValue]) => [
        key,
        removeNicknameFields(nestedValue),
      ]),
  );
}
