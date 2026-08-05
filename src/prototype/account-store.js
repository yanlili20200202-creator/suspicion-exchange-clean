import {
  getSessionDate,
  recordAccountRegistration,
} from "./exhibition-data-store.js";
import { STORAGE_KEYS } from "./storage-keys.js";
import { supabase } from "./supabase-client.js";

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

export async function getOrCreateParticipant(nickname) {
  const cleanNickname = nickname.trim();
  if (!cleanNickname) return null;

  if (!supabase) {
    throw new Error("Supabase client is not configured.");
  }

  const {
    data: { user: existingAuthUser },
    error: getUserError,
  } = await supabase.auth.getUser();

  if (getUserError && getUserError.name !== "AuthSessionMissingError") {
    throw getUserError;
  }

  let authUser = existingAuthUser;
  if (!authUser) {
    const { data, error } = await supabase.auth.signInAnonymously();
    if (error) throw error;
    authUser = data.user;
  }

  if (!authUser) {
    throw new Error("Supabase anonymous user is unavailable.");
  }

  const participantColumns = "account_number,nickname,created_at";
  const { data: existingParticipant, error: participantLookupError } =
    await supabase
      .from("participants")
      .select(participantColumns)
      .eq("user_id", authUser.id)
      .maybeSingle();

  if (participantLookupError) throw participantLookupError;

  if (existingParticipant) {
    return { ...existingParticipant, userId: authUser.id };
  }

  const { data: insertedParticipant, error: participantInsertError } =
    await supabase
      .from("participants")
      .insert({ user_id: authUser.id, nickname: cleanNickname })
      .select(participantColumns)
      .single();

  if (participantInsertError) {
    if (participantInsertError.code === "23505") {
      const { data: concurrentParticipant, error: concurrentLookupError } =
        await supabase
          .from("participants")
          .select(participantColumns)
          .eq("user_id", authUser.id)
          .single();
      if (concurrentLookupError) throw concurrentLookupError;
      return { ...concurrentParticipant, userId: authUser.id };
    }
    throw participantInsertError;
  }

  return { ...insertedParticipant, userId: authUser.id };
}

function formatSupabaseAccountNumber(accountNumber) {
  return `Account No. ${String(accountNumber).padStart(3, "0")}`;
}

export async function createAccount(nickname, marketState = null) {
  const cleanNickname = nickname.trim();
  if (!cleanNickname) return null;

  const participant = await getOrCreateParticipant(cleanNickname);
  if (!participant || participant.account_number == null) {
    throw new Error("Supabase participant did not return an account number.");
  }

  const accountNumber = formatSupabaseAccountNumber(
    participant.account_number,
  );
  const users = getUsers();
  const existingUser = users.find(
    (user) =>
      user.supabaseUserId === participant.userId ||
      user.accountNumber === accountNumber,
  );
  const createdAt = participant.created_at ?? new Date().toISOString();
  const user = normalizeUser({
    ...existingUser,
    nickname: participant.nickname ?? cleanNickname,
    accountNumber,
    createdAt,
    sessionDate: existingUser?.sessionDate ?? getSessionDate(new Date(createdAt)),
    trustChips: existingUser?.trustChips ?? 100,
    bets: existingUser?.bets ?? [],
    supabaseUserId: participant.userId,
    supabaseAccountNumber: participant.account_number,
  });

  try {
    const updatedUsers = existingUser
      ? users.map((savedUser) =>
          savedUser === existingUser ? user : savedUser,
        )
      : [...users, user];
    localStorage.setItem(STORAGE_KEYS.currentUser, JSON.stringify(user));
    localStorage.setItem(STORAGE_KEYS.users, JSON.stringify(updatedUsers));
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
