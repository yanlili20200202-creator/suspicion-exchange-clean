import {
  getSessionDate,
  recordAccountRegistration,
} from "./exhibition-data-store.js";
import { STORAGE_KEYS } from "./storage-keys.js";

const VISIBLE_COSTS = [0, 5, 8, 10, 12, 15, 18, 20, 25, 30];
const ACTUAL_BALANCE_CHANGES = [
  -40,
  -30,
  -25,
  -20,
  -18,
  -15,
  -12,
  -10,
  -8,
  -5,
  0,
  0,
  0,
  5,
  8,
  10,
  12,
  15,
  18,
  20,
];

export function getRandomVisibleCost() {
  return VISIBLE_COSTS[Math.floor(Math.random() * VISIBLE_COSTS.length)];
}

export function getRandomActualBalanceChange() {
  return ACTUAL_BALANCE_CHANGES[
    Math.floor(Math.random() * ACTUAL_BALANCE_CHANGES.length)
  ];
}

export function getCurrentUser() {
  try {
    const savedUser = localStorage.getItem(STORAGE_KEYS.currentUser);
    if (!savedUser) return null;

    const user = normalizeUser(JSON.parse(savedUser));
    localStorage.setItem(STORAGE_KEYS.currentUser, JSON.stringify(user));

    const savedUsers = getUsers();
    const users = savedUsers.map((savedAccount) =>
      savedAccount.accountNumber === user.accountNumber ? user : savedAccount,
    );
    if (!users.some((savedAccount) => savedAccount.accountNumber === user.accountNumber)) {
      users.push(user);
    }
    localStorage.setItem(STORAGE_KEYS.users, JSON.stringify(users));
    return user;
  } catch {
    return null;
  }
}

export function createAccount(nickname, marketState = null) {
  const cleanNickname = nickname.trim();
  if (!cleanNickname) return null;

  const nextNumber = getNextAccountNumber();
  const user = {
    nickname: cleanNickname,
    accountNumber: `Account No. ${String(nextNumber).padStart(3, "0")}`,
    createdAt: new Date().toISOString(),
    sessionDate: getSessionDate(),
    trustChips: 100,
    bets: [],
  };

  try {
    const users = getUsers();
    localStorage.setItem(STORAGE_KEYS.currentUser, JSON.stringify(user));
    localStorage.setItem(STORAGE_KEYS.users, JSON.stringify([...users, user]));
    localStorage.setItem(
      STORAGE_KEYS.nextAccountNumber,
      String(nextNumber + 1),
    );
    recordAccountRegistration(user, marketState);
  } catch {
    // Return the account so the current session can still continue.
  }

  return user;
}

export function clearCurrentUser() {
  try {
    localStorage.removeItem(STORAGE_KEYS.currentUser);
  } catch {
    // The in-memory React state still returns to registration.
  }
}

export function spendTrustChips(accountNumber, actualBalanceChange) {
  if (!accountNumber || !Number.isFinite(actualBalanceChange)) {
    return { ok: false, user: null };
  }

  try {
    const users = getUsers();
    const account = users.find(
      (user) => user.accountNumber === accountNumber,
    );
    if (!account) {
      return { ok: false, user: account ?? null };
    }

    const chipsBefore = account.trustChips;
    const chipsAfter = chipsBefore + actualBalanceChange;
    const updatedUser = {
      ...account,
      trustChips: chipsAfter,
    };
    const updatedUsers = users.map((user) =>
      user.accountNumber === accountNumber ? updatedUser : user,
    );
    localStorage.setItem(STORAGE_KEYS.users, JSON.stringify(updatedUsers));

    const currentUser = JSON.parse(
      localStorage.getItem(STORAGE_KEYS.currentUser) ?? "null",
    );
    if (currentUser?.accountNumber === accountNumber) {
      localStorage.setItem(
        STORAGE_KEYS.currentUser,
        JSON.stringify(updatedUser),
      );
    }

    return {
      ok: true,
      user: updatedUser,
      chipsBefore,
      actualBalanceChange,
      chipsAfter,
    };
  } catch {
    return { ok: false, user: null };
  }
}

function getUsers() {
  try {
    const savedUsers = JSON.parse(
      localStorage.getItem(STORAGE_KEYS.users) ?? "[]",
    );
    return Array.isArray(savedUsers) ? savedUsers.map(normalizeUser) : [];
  } catch {
    return [];
  }
}

function normalizeUser(user) {
  const createdDate = new Date(user.createdAt);
  const sessionDate = Number.isNaN(createdDate.getTime())
    ? getSessionDate()
    : getSessionDate(createdDate);

  return {
    ...user,
    sessionDate: user.sessionDate ?? sessionDate,
    trustChips: Number.isFinite(user.trustChips) ? user.trustChips : 100,
    bets: Array.isArray(user.bets) ? user.bets : [],
  };
}

function getNextAccountNumber() {
  const savedNumber = Number.parseInt(
    localStorage.getItem(STORAGE_KEYS.nextAccountNumber) ?? "1",
    10,
  );

  return Number.isInteger(savedNumber) && savedNumber > 0 ? savedNumber : 1;
}
