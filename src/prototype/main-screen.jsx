import {
  Fragment,
  StrictMode,
  useEffect,
  useRef,
  useState,
  useSyncExternalStore,
} from "react";
import { createPortal } from "react-dom";
import { createRoot } from "react-dom/client";
import { toJpeg } from "html-to-image";
import {
  getSnapshot,
  resetMarketState,
  subscribe,
} from "./suspicion-store";
import {
  clearCurrentUser,
  createAccount,
  getCurrentUser,
  getRandomActualBalanceChange,
  getRandomVisibleCost,
  spendTrustChips,
} from "./account-store";
import { createPrototypeCases } from "./prototype-case-data.js";
import { supabase } from "./supabase-client.js";
import { STORAGE_KEYS } from "./storage-keys.js";
import "./prototype.css";

const actions = [
  { name: "Bet Human", cn: "赌人类", internalEffect: "Support Appeal" },
  { name: "Bet AI", cn: "赌 AI", internalEffect: "Buy Doubt" },
  {
    name: "Bet Mixed",
    cn: "赌混合",
    internalEffect: "Short Human Originality",
  },
  { name: "Fold", cn: "放弃这一轮", internalEffect: "Sell Trust" },
  { name: "I Don't Care", cn: "不在乎", internalEffect: "Sell Trust" },
];

const POST_TYPE_LABELS = {
  game: { en: "Game Clip", cn: "游戏视频" },
  "real-body": { en: "Dance Clip", cn: "短视频 / 舞蹈视频" },
  art: { en: "Artwork Post", cn: "艺术作品帖子" },
  pet: { en: "Pet Video", cn: "宠物视频" },
  text: { en: "Text Post", cn: "文字帖子" },
};

const BET_DETAILS = {
  "Buy Doubt": {
    cost: 10,
    risk: "This bet may raise suspicion and weaken public trust.",
    cnRisk: "这一选择可能提高怀疑，并削弱公众信任。",
  },
  "Sell Trust": {
    cost: 8,
    risk: "This choice may increase reliance on platform judgement.",
    cnRisk: "这一选择可能增加对平台判断的依赖。",
  },
  "Short Human Originality": {
    cost: 15,
    risk: "This is a high-risk position against human authorship.",
    cnRisk: "这是针对人类创作身份的高风险仓位。",
  },
  "Support Appeal": {
    cost: 6,
    risk: "This bet may reduce suspicion but remains system data.",
    cnRisk: "这一选择可能降低怀疑，但仍会被系统处理为数据。",
  },
};

const INSUFFICIENT_CHIPS_MESSAGE =
  "Insufficient Trust Chips. Your judgement power has been temporarily suspended.";
const INSUFFICIENT_CHIPS_MESSAGE_CN =
  "信任筹码不足。你的判断权力已被暂时中止。";
const REQUIRED_CONFIRMED_BETS = 5;
const PROTOTYPE_SESSION_RULES_VERSION = 7;

function isSessionComplete(bets) {
  return Array.isArray(bets) && bets.length >= REQUIRED_CONFIRMED_BETS;
}

const FINAL_ACHIEVEMENTS = [
  {
    id: "nothing-happened",
    titleEnglish: "NOTHING HAPPENED BADGE",
    titleChinese: "无事发生徽章",
    descriptionEnglish: "Five judgements were completed. Nothing was resolved.",
    descriptionChinese: "五次判断已经完成。没有任何问题得到解决。",
    statusEnglish: "EMPTY REWARD",
    statusChinese: "空奖励",
  },
  {
    id: "human-detection-license",
    titleEnglish: "ADVANCED HUMAN DETECTION LICENSE",
    titleChinese: "高级人类识别许可证",
    descriptionEnglish:
      "You are qualified to identify humans. Your own status remains unconfirmed.",
    descriptionChinese: "你已有资格识别人类。你自身的身份仍未确认。",
    statusEnglish: "LICENSE ISSUED",
    statusChinese: "许可证已发放",
  },
  {
    id: "public-doubt-debt",
    titleEnglish: "PUBLIC DOUBT DEBT",
    titleChinese: "公共怀疑债务",
    descriptionEnglish:
      "Your remaining Trust Chips have been converted into doubt owed by the user.",
    descriptionChinese:
      "你剩余的 Trust Chips 已被转换为由用户承担的怀疑债务。",
    statusEnglish: "PAYMENT DUE",
    statusChinese: "等待偿还",
  },
  {
    id: "human-society-reentry",
    titleEnglish: "RE-ENTRY PASS TO HUMAN SOCIETY",
    titleChinese: "重返人类社会通行证",
    descriptionEnglish: "Valid until you are asked to judge again.",
    descriptionChinese: "有效期至你下一次被要求作出判断。",
    statusEnglish: "TEMPORARY ACCESS",
    statusChinese: "临时通行",
  },
];

const GAME_OVER_TAPES = [
  { className: "from-left", top: "8%", angle: "-7deg", delay: "0ms", duration: "4800ms" },
  { className: "from-right", top: "22%", angle: "5deg", delay: "140ms", duration: "5100ms" },
  { className: "from-top", top: "35%", angle: "-12deg", delay: "260ms", duration: "4550ms" },
  { className: "from-bottom", top: "48%", angle: "10deg", delay: "80ms", duration: "5200ms" },
  { className: "from-top-left", top: "61%", angle: "-7deg", delay: "360ms", duration: "4700ms" },
  { className: "from-top-right", top: "73%", angle: "5deg", delay: "220ms", duration: "5000ms" },
  { className: "from-bottom-left", top: "84%", angle: "10deg", delay: "440ms", duration: "4450ms" },
  { className: "from-bottom-right", top: "91%", angle: "-12deg", delay: "320ms", duration: "4900ms" },
];

const VISIBLE_ACTION_RESPONSES = {
  "Bet Human": {
    en: "Your bet on human authorship has been recorded.",
    cn: "你对人类创作的下注已被记录。",
  },
  "Bet AI": {
    en: "Your bet on AI generation has been recorded.",
    cn: "你对 AI 生成的下注已被记录。",
  },
  "Bet Mixed": {
    en: "Your mixed judgement has been recorded.",
    cn: "你的混合判断已被记录。",
  },
  Fold: {
    en: "You folded this round. Refusal is also processed as data.",
    cn: "你放弃了这一轮。拒绝判断也会被处理为数据。",
  },
  "I Don't Care": {
    en: "Your indifference has been recorded as market behaviour.",
    cn: "你的不在乎已被记录为市场行为。",
  },
};

const OPAQUE_RESULT_DISPLAY = {
  "minor reward": {
    en: "Reward temporarily approved",
    cn: "奖励已获临时批准",
  },
  "market loss": {
    en: "Market adjustment applied",
    cn: "市场调整已执行",
  },
  "under review": {
    en: "Result under review",
    cn: "结果正在审核中",
  },
  "platform fee": {
    en: "Platform fee deducted",
    cn: "平台费用已扣除",
  },
  "trust adjustment": {
    en: "Trust value recalculated",
    cn: "信任价值已重新计算",
  },
  "appeal delay": {
    en: "Market adjustment applied",
    cn: "市场调整已执行",
  },
};

const MARKET_IMPACT_INDEXES = [
  {
    key: "humanOriginality",
    en: "Human Originality",
    cn: "人类原创性",
  },
  { key: "aiSuspicion", en: "AI Suspicion", cn: "AI 怀疑" },
  { key: "publicTrust", en: "Public Trust", cn: "公众信任" },
  { key: "appealFailure", en: "Appeal Failure", cn: "申诉失败率" },
  {
    key: "platformAuthority",
    en: "Platform Authority",
    cn: "平台权威",
  },
];

function formatSignedValue(value) {
  return value > 0 ? `+${value}` : `${value}`;
}

function calculateAccountMarketImpact(bets) {
  const actionCounts = Object.fromEntries(
    actions.map((action) => [action.name, 0]),
  );
  const indexTotals = Object.fromEntries(
    MARKET_IMPACT_INDEXES.map((index) => [index.key, 0]),
  );
  let totalTrustChipsSpent = 0;

  bets.forEach((bet) => {
    totalTrustChipsSpent += Number.isFinite(bet.chipCost) ? bet.chipCost : 0;
    if (bet.actionType in actionCounts) {
      actionCounts[bet.actionType] += 1;
    }
    MARKET_IMPACT_INDEXES.forEach((index) => {
      indexTotals[index.key] += Number.isFinite(bet.delta?.[index.key])
        ? bet.delta[index.key]
        : 0;
    });
  });

  const supportAppealCount = actionCounts["Support Appeal"];
  const supportAppealUsedMost =
    supportAppealCount > 0 &&
    actions
      .filter((action) => action.name !== "Support Appeal")
      .every((action) => supportAppealCount > actionCounts[action.name]);

  let strongestMessage;
  if (supportAppealUsedMost) {
    strongestMessage = {
      en: "Your resistance was recorded and processed as data.",
      cn: "你的抵抗已被记录，并被处理为数据。",
    };
  } else {
    const impactMessages = [
      {
        strength: Math.max(0, indexTotals.aiSuspicion),
        en: "Your session strengthened the suspicion market.",
        cn: "你的场次强化了怀疑市场。",
      },
      {
        strength: Math.max(0, -indexTotals.publicTrust),
        en: "Your session contributed to public trust loss.",
        cn: "你的场次促成了公众信任的流失。",
      },
      {
        strength: Math.max(0, -indexTotals.humanOriginality),
        en: "Your session placed pressure on human originality.",
        cn: "你的场次对人类原创性施加了压力。",
      },
    ];
    strongestMessage = impactMessages.reduce((strongest, impact) =>
      impact.strength > strongest.strength ? impact : strongest,
    );
  }

  return {
    totalTrustChipsSpent,
    actionCounts,
    indexTotals,
    strongestMessage,
  };
}

function readSelectedCases(account) {
  if (!account) return null;

  try {
    const savedSelection = JSON.parse(
      localStorage.getItem(STORAGE_KEYS.prototypeSelectedCases) ?? "null",
    );
    const belongsToAccount =
      savedSelection?.accountNumber === account.accountNumber &&
      savedSelection?.createdAt === account.createdAt;

    const hasFiveCases =
      belongsToAccount &&
      Array.isArray(savedSelection.cases) &&
      savedSelection.cases.length === REQUIRED_CONFIRMED_BETS;
    if (!hasFiveCases) return null;

    if (!Number.isInteger(savedSelection.sessionStartBetCount)) {
      localStorage.setItem(
        STORAGE_KEYS.prototypeSelectedCases,
        JSON.stringify({
          ...savedSelection,
          sessionStartBetCount: account.bets.length,
        }),
      );
    }

    if (
      savedSelection.sessionRulesVersion !== PROTOTYPE_SESSION_RULES_VERSION ||
      !Array.isArray(savedSelection.confirmedBetIds)
    ) {
      localStorage.setItem(
        STORAGE_KEYS.prototypeSelectedCases,
        JSON.stringify({
          ...savedSelection,
          sessionRulesVersion: PROTOTYPE_SESSION_RULES_VERSION,
          sessionStartBetCount: account.bets.length,
          confirmedBetIds: [],
        }),
      );
    }

    return savedSelection.cases;
  } catch {
    return null;
  }
}

function createAndSaveSelectedCases(account) {
  const selectedCases = createPrototypeCases();
  const sessionId = crypto.randomUUID();

  try {
    localStorage.setItem(
      STORAGE_KEYS.prototypeSelectedCases,
      JSON.stringify({
        accountNumber: account.accountNumber,
        createdAt: account.createdAt,
        sessionId,
        sessionRulesVersion: PROTOTYPE_SESSION_RULES_VERSION,
        sessionStartBetCount: account.bets.length,
        confirmedBetIds: [],
        cases: selectedCases,
      }),
    );
  } catch {
    // React state keeps the selected cases stable for this browser session.
  }

  return selectedCases;
}

function getOrCreateSessionId(account) {
  if (!account) return null;

  try {
    const savedSelection = JSON.parse(
      localStorage.getItem(STORAGE_KEYS.prototypeSelectedCases) ?? "null",
    );
    const belongsToAccount =
      savedSelection?.accountNumber === account.accountNumber &&
      savedSelection?.createdAt === account.createdAt;

    if (!belongsToAccount) return null;
    if (typeof savedSelection.sessionId === "string" && savedSelection.sessionId) {
      return savedSelection.sessionId;
    }

    const sessionId = crypto.randomUUID();
    localStorage.setItem(
      STORAGE_KEYS.prototypeSelectedCases,
      JSON.stringify({ ...savedSelection, sessionId }),
    );
    return sessionId;
  } catch (error) {
    console.error("Could not create or restore the prototype session ID:", error);
    return null;
  }
}

function getOrCreateSelectedCases(account) {
  const selectedCases =
    readSelectedCases(account) ?? createAndSaveSelectedCases(account);
  getOrCreateSessionId(account);
  return selectedCases;
}

async function uploadConfirmedBetToSupabase({
  account,
  bet,
  sessionId,
  roundNumber,
  caseData,
}) {
  if (!supabase) {
    console.error("Supabase bet upload failed: client is not configured.");
    return;
  }

  try {
    const {
      data: { user },
      error: getUserError,
    } = await supabase.auth.getUser();

    if (getUserError) throw getUserError;
    if (!user) throw new Error("Supabase anonymous user is unavailable.");

    const formattedAccountNumber = String(account.accountNumber ?? "").match(
      /\d+$/,
    )?.[0];
    const accountNumber = Number(
      account.supabaseAccountNumber ?? formattedAccountNumber,
    );
    if (!Number.isInteger(accountNumber)) {
      throw new Error("The participant database account number is unavailable.");
    }
    if (!sessionId) {
      throw new Error("The current five-round session ID is unavailable.");
    }

    const { error } = await supabase.from("bets").insert({
      user_id: user.id,
      account_number: accountNumber,
      session_id: sessionId,
      round_number: roundNumber,
      case_id: caseData.caseId,
      category: caseData.categoryId,
      selected_action: bet.actionLabel.toUpperCase(),
      visible_cost: bet.visibleCost,
      actual_balance_change: bet.actualBalanceChange,
      chips_before: bet.chipsBefore,
      chips_after: bet.chipsAfter,
    });

    if (error) throw error;
    console.log(`Supabase bet uploaded: round ${roundNumber}`);
  } catch (error) {
    console.error("Supabase bet upload failed:", error);
  }
}

function getSessionConfirmedBets(account) {
  if (!account || !Array.isArray(account.bets)) return [];

  try {
    const savedSelection = JSON.parse(
      localStorage.getItem(STORAGE_KEYS.prototypeSelectedCases) ?? "null",
    );
    const belongsToAccount =
      savedSelection?.accountNumber === account.accountNumber &&
      savedSelection?.createdAt === account.createdAt;

    if (belongsToAccount && Array.isArray(savedSelection.confirmedBetIds)) {
      const confirmedBetIds = new Set(savedSelection.confirmedBetIds);
      return account.bets.filter((bet) => confirmedBetIds.has(bet.betId));
    }
  } catch {
    // Fall through to the legacy session baseline migration.
  }

  // Never infer the current five-round session from the account's full history.
  return [];
}

function saveSessionConfirmedBets(account, bets) {
  try {
    const savedSelection = JSON.parse(
      localStorage.getItem(STORAGE_KEYS.prototypeSelectedCases) ?? "null",
    );
    const belongsToAccount =
      savedSelection?.accountNumber === account.accountNumber &&
      savedSelection?.createdAt === account.createdAt;

    if (!belongsToAccount) return;
    localStorage.setItem(
      STORAGE_KEYS.prototypeSelectedCases,
      JSON.stringify({
        ...savedSelection,
        confirmedBetIds: bets.map((bet) => bet.betId),
      }),
    );
  } catch {
    // React state remains the source of truth for the open page.
  }
}

function getSessionCompletionStatus(account) {
  if (!account) return false;

  try {
    const savedSelection = JSON.parse(
      localStorage.getItem(STORAGE_KEYS.prototypeSelectedCases) ?? "null",
    );
    return (
      savedSelection?.accountNumber === account.accountNumber &&
      savedSelection?.createdAt === account.createdAt &&
      savedSelection?.sessionComplete === true &&
      savedSelection?.completedRound === REQUIRED_CONFIRMED_BETS &&
      Array.isArray(savedSelection?.confirmedBetIds) &&
      savedSelection.confirmedBetIds.length >= REQUIRED_CONFIRMED_BETS
    );
  } catch {
    return false;
  }
}

function saveSessionCompletionStatus(
  account,
  sessionComplete,
  completedRound = 0,
) {
  try {
    const savedSelection = JSON.parse(
      localStorage.getItem(STORAGE_KEYS.prototypeSelectedCases) ?? "null",
    );
    const belongsToAccount =
      savedSelection?.accountNumber === account.accountNumber &&
      savedSelection?.createdAt === account.createdAt;

    if (!belongsToAccount) return;
    localStorage.setItem(
      STORAGE_KEYS.prototypeSelectedCases,
      JSON.stringify({
        ...savedSelection,
        sessionComplete,
        completedRound,
      }),
    );
  } catch {
    // React state remains the source of truth for the open page.
  }
}

function getOrCreateSessionAchievement(account) {
  const fallbackAchievement = FINAL_ACHIEVEMENTS[0];
  if (!account) return fallbackAchievement;

  try {
    const savedSelection = JSON.parse(
      localStorage.getItem(STORAGE_KEYS.prototypeSelectedCases) ?? "null",
    );
    const belongsToAccount =
      savedSelection?.accountNumber === account.accountNumber &&
      savedSelection?.createdAt === account.createdAt;

    if (belongsToAccount) {
      const savedAchievement = FINAL_ACHIEVEMENTS.find(
        (achievement) => achievement.id === savedSelection.finalAchievementId,
      );
      if (savedAchievement) return savedAchievement;

      const selectedAchievement =
        FINAL_ACHIEVEMENTS[
          Math.floor(Math.random() * FINAL_ACHIEVEMENTS.length)
        ];
      localStorage.setItem(
        STORAGE_KEYS.prototypeSelectedCases,
        JSON.stringify({
          ...savedSelection,
          finalAchievementId: selectedAchievement.id,
        }),
      );
      return selectedAchievement;
    }
  } catch {
    // Fall back to one stable achievement for this mounted summary screen.
  }

  return fallbackAchievement;
}

function getMarketEntryStatus() {
  try {
    const savedStatus = JSON.parse(
      localStorage.getItem(STORAGE_KEYS.marketEntryStatus) ?? "null",
    );
    return savedStatus && typeof savedStatus === "object"
      ? savedStatus
      : null;
  } catch {
    return null;
  }
}

function hasEnteredMarket(account, entryStatus) {
  return Boolean(
    account &&
      entryStatus?.accountNumber === account.accountNumber &&
      entryStatus?.createdAt === account.createdAt,
  );
}

function saveMarketEntryStatus(account) {
  const entryStatus = {
    accountNumber: account.accountNumber,
    createdAt: account.createdAt,
  };

  try {
    localStorage.setItem(
      STORAGE_KEYS.marketEntryStatus,
      JSON.stringify(entryStatus),
    );
  } catch {
    // React state still allows the current visitor to enter the market.
  }

  return entryStatus;
}

function clearMarketEntryStatus() {
  try {
    localStorage.removeItem(STORAGE_KEYS.marketEntryStatus);
  } catch {
    // React state still returns to the correct page for this browser session.
  }
}

function RegistrationPanel({ marketState, onAccountGenerated }) {
  const [nickname, setNickname] = useState("");
  const [error, setError] = useState("");
  const [errorChinese, setErrorChinese] = useState("");
  const [isCreatingAccount, setIsCreatingAccount] = useState(false);

  async function handleSubmit(event) {
    event.preventDefault();

    if (!nickname.trim()) {
      setError("Enter a nickname before generating an account.");
      setErrorChinese("生成账户前请输入昵称。");
      return;
    }

    if (isCreatingAccount) return;
    setIsCreatingAccount(true);
    setError("");
    setErrorChinese("");

    try {
      const user = await createAccount(nickname, marketState);

      if (!user) {
        setError("ACCOUNT CREATION FAILED");
        setErrorChinese("账户创建失败");
        return;
      }

      onAccountGenerated(user);
    } catch (accountCreationError) {
      console.error("Supabase account creation failed:", accountCreationError);
      setError("ACCOUNT CREATION FAILED");
      setErrorChinese("账户创建失败");
    } finally {
      setIsCreatingAccount(false);
    }
  }

  return (
    <main className="registration-shell">
      <div className="registration-shape registration-shape-lime" aria-hidden="true" />
      <div className="registration-shape registration-shape-yellow" aria-hidden="true" />
      <div className="registration-shape registration-shape-red" aria-hidden="true" />

      <div className="registration-stage">
        <nav className="registration-fake-nav" aria-label="Decorative betting labels">
          <span>Who Made It?</span>
          <span>Bet Human</span>
          <span>Bet AI</span>
          <span>Fold</span>
        </nav>

        <div className="registration-composition">
          <section className="registration-poster">
            <p className="registration-poster-kicker">
              Live Judgement Market
              <span className="cn-line">实时判断市场</span>
            </p>
            <h1>
              <span>Who</span>
              <span>Made</span>
              <span>It?</span>
            </h1>
            <p className="registration-project-title">
              A? CASINO
              <span className="cn-line">？赌场</span>
            </p>
            <div className="registration-tagline">
              <strong>Place your judgement.</strong>
              <strong>Feed the market.</strong>
              <span className="cn-line">做出你的判断。喂养这个市场。</span>
            </div>
          </section>

          <section className="panel registration-panel">
            <p className="registration-eyebrow">
              Audience Account Desk
              <span className="cn-line">观众账户柜台</span>
            </p>
            <h2>
              A Game Show for Doubtful Posts
              <span className="cn-line">一个关于可疑帖子的竞猜秀</span>
            </h2>
            <p className="registration-entry-copy">
              One nickname. One account. Five judgements.
              <span className="cn-line">一个昵称。一个账户。五次判断。</span>
            </p>
            <form onSubmit={handleSubmit}>
              <label htmlFor="nickname">
                Nickname
                <span className="cn-line">昵称</span>
              </label>
              <input
                autoComplete="nickname"
                id="nickname"
                onChange={(event) => {
                  setNickname(event.target.value);
                  setError("");
                  setErrorChinese("");
                }}
                type="text"
                value={nickname}
              />
              {error && (
                <p className="registration-error" role="alert">
                  {error}
                  <span className="cn-line">{errorChinese}</span>
                </p>
              )}
              <button
                className="generate-account-button"
                disabled={isCreatingAccount}
                type="submit"
              >
                {isCreatingAccount ? "CREATING ACCOUNT..." : "Generate Account"}
                <span className="cn-line">
                  {isCreatingAccount ? "正在创建账户……" : "生成账户"}
                </span>
              </button>
              <p className="registration-privacy-note">
                No real name is needed. Your betting data is saved locally.
                Exported data keeps only the account number and interaction
                results for the Suspicion Market statistics.
                <span className="cn-line">
                  无需输入真实姓名。你的下注数据会被本地保存，导出时仅保留账户编号与互动结果，用于怀疑市场结果统计。
                </span>
              </p>
            </form>
          </section>
        </div>
      </div>
    </main>
  );
}

function RulesOnboarding({ account, onEnterMarket }) {
  const rules = [
    {
      number: "01",
      en: "you start with 100 Trust Chips",
      cn: "你一开始有 100 个信任筹码",
    },
    {
      number: "02",
      en: "every bet spends your trust",
      cn: "每一次下注都会花掉一点信任",
    },
    {
      number: "03",
      en: "the label may not tell the truth",
      cn: "平台标签不一定代表真相",
    },
    {
      number: "04",
      en: "your judgement feeds the market",
      cn: "你的判断会喂养怀疑市场",
    },
  ];

  return (
    <main className="rules-onboarding-shell">
      <div className="rules-onboarding-stage">
        <PrototypeTopNavigation
          ariaLabel="Decorative betting labels"
          className="rules-onboarding-fake-nav"
        />

        <section className="panel rules-onboarding-panel">
          <header className="rules-onboarding-header">
            <p>
              Before you enter the market
              <span className="cn-line">进入市场之前</span>
            </p>
            <h1>
              Rules
              <span className="cn-line">下注规则</span>
            </h1>
          </header>

          <div className="rules-onboarding-grid">
            {rules.map((rule) => (
              <article className="rules-onboarding-card" key={rule.number}>
                <span className="rules-onboarding-number">{rule.number}</span>
                <p>
                  {rule.en}
                  <span className="cn-line">{rule.cn}</span>
                </p>
              </article>
            ))}
          </div>

          <div className="rules-onboarding-account">
            <p>
              Hello, {account.accountNumber}.
              <span className="cn-line">
                你好，{account.accountNumber}。
              </span>
            </p>
            <p>
              This is not real money. It is a game about trust, doubt, and
              authorship.
              <span className="cn-line">
                这不是真钱。这是一个关于信任、怀疑和作者身份的游戏。
              </span>
            </p>
          </div>

          <button
            className="rules-enter-market-button"
            onClick={onEnterMarket}
            type="button"
          >
            Enter The Market
            <span className="cn-line">进入市场</span>
          </button>
        </section>
      </div>
    </main>
  );
}

function SessionDebug({ confirmedBets, currentCaseIndex, activeCases }) {
  return (
    <p
      hidden
      style={{
        margin: "0 0 0.75rem",
        border: "2px solid #101010",
        background: "#fff",
        padding: "0.35rem 0.55rem",
        fontSize: "0.75rem",
        fontWeight: 800,
        lineHeight: 1.35,
      }}
    >
      DEBUG: confirmedBets: {confirmedBets.length} / {REQUIRED_CONFIRMED_BETS}
      {" | "}currentCaseIndex: {currentCaseIndex}
      {" | "}selectedCases length: {activeCases.length}
    </p>
  );
}

// Kept for later re-enabling; the render block is temporarily disabled below.
// eslint-disable-next-line no-unused-vars
function AccountSummary({
  account,
  confirmedBets: sessionBets,
  currentCaseIndex,
  activeCases,
  onNewAudience,
}) {
  const confirmedBets = sessionBets.slice(0, REQUIRED_CONFIRMED_BETS);
  const marketImpact = calculateAccountMarketImpact(confirmedBets);
  const strongestImpact = MARKET_IMPACT_INDEXES.reduce(
    (strongest, index) =>
      Math.abs(marketImpact.indexTotals[index.key]) >
      Math.abs(marketImpact.indexTotals[strongest.key])
        ? index
        : strongest,
    MARKET_IMPACT_INDEXES[0],
  );
  const supportAppealUsedMost =
    marketImpact.actionCounts["Support Appeal"] > 0 &&
    actions
      .filter((action) => action.name !== "Support Appeal")
      .every(
        (action) =>
          marketImpact.actionCounts["Support Appeal"] >
          marketImpact.actionCounts[action.name],
      );
  const hasPendingResult = confirmedBets.some((bet) =>
    ["under review", "appeal delay"].includes(bet.opaqueResult),
  );
  const systemStatus = hasPendingResult
    ? { en: "Under Review", cn: "审核中" }
    : strongestImpact.key === "aiSuspicion" &&
        marketImpact.indexTotals.aiSuspicion > 0
      ? { en: "Suspicion Contributor", cn: "怀疑贡献者" }
      : supportAppealUsedMost
        ? { en: "Temporarily Verified", cn: "临时验证" }
        : { en: "Processed", cn: "已处理" };

  return (
    <main className="account-summary-shell">
      <section className="panel account-summary-panel">
        <SessionDebug
          activeCases={activeCases}
          confirmedBets={sessionBets}
          currentCaseIndex={currentCaseIndex}
        />
        <p className="account-summary-eyebrow">
          Judgement session complete
          <span className="cn-line">判断场次已完成</span>
        </p>
        <h1>
          ACCOUNT SUMMARY
          <span className="cn-line">账户总结</span>
        </h1>
        <dl className="account-summary-details">
          <div>
            <dt>
              Account number
              <span className="cn-line">账户编号</span>
            </dt>
            <dd>{account.accountNumber}</dd>
          </div>
          <div>
            <dt>
              Nickname
              <span className="cn-line">昵称</span>
            </dt>
            <dd>{account.nickname}</dd>
          </div>
          <div>
            <dt>
              Starting Trust Chips
              <span className="cn-line">初始信任筹码</span>
            </dt>
            <dd>100</dd>
          </div>
          <div>
            <dt>
              Current Trust Chips
              <span className="cn-line">当前信任筹码</span>
            </dt>
            <dd>{account.trustChips}</dd>
          </div>
          <div>
            <dt>
              Total confirmed bets
              <span className="cn-line">确认下注总数</span>
            </dt>
            <dd>{confirmedBets.length}</dd>
          </div>
        </dl>
        <section className="account-summary-bets">
          <h2>
            Confirmed judgement bets
            <span className="cn-line">已确认的判断下注</span>
          </h2>
          <div className="account-summary-bet-list">
            {confirmedBets.map((bet, index) => {
              const action = actions.find(
                (item) => item.name === bet.actionType,
              );
              const result =
                OPAQUE_RESULT_DISPLAY[bet.opaqueResult] ?? {
                  en: bet.opaqueResult,
                  cn: "结果已由平台处理",
                };
              const timestamp = new Date(bet.timestamp);
              const formattedTimestamp = Number.isNaN(timestamp.getTime())
                ? bet.timestamp
                : timestamp.toLocaleString("en-GB");

              return (
                <article className="account-summary-bet" key={bet.betId}>
                  <h3>
                    Bet {String(index + 1).padStart(2, "0")}
                    <span className="cn-line">
                      下注 {String(index + 1).padStart(2, "0")}
                    </span>
                  </h3>
                  <p className="account-summary-case">
                    {bet.caseNumber}
                    <span className="cn-line">
                      {bet.caseNumber?.replace("Case", "案例")}
                    </span>
                  </p>
                  <dl>
                    <div>
                      <dt>
                        Action
                        <span className="cn-line">操作</span>
                      </dt>
                      <dd>
                        {bet.actionType}
                        <span className="cn-line">{action?.cn}</span>
                      </dd>
                    </div>
                    <div>
                      <dt>
                        Cost
                        <span className="cn-line">成本</span>
                      </dt>
                      <dd>
                        {bet.chipCost} Trust Chips
                        <span className="cn-line">
                          {bet.chipCost} 信任筹码
                        </span>
                      </dd>
                    </div>
                    <div>
                      <dt>
                        Result
                        <span className="cn-line">结果</span>
                      </dt>
                      <dd>
                        {result.en}
                        <span className="cn-line">{result.cn}</span>
                      </dd>
                    </div>
                    <div>
                      <dt>
                        Trust Chips
                        <span className="cn-line">信任筹码</span>
                      </dt>
                      <dd>
                        {bet.chipsBefore} → {bet.chipsAfter}
                      </dd>
                    </div>
                    <div>
                      <dt>
                        Timestamp
                        <span className="cn-line">时间</span>
                      </dt>
                      <dd>{formattedTimestamp}</dd>
                    </div>
                  </dl>
                </article>
              );
            })}
          </div>
        </section>
        <section className="account-market-impact">
          <h2>
            YOUR MARKET IMPACT
            <span className="cn-line">你的市场影响</span>
          </h2>
          <p className="account-impact-spend">
            Total Trust Chips spent:{" "}
            <strong>{marketImpact.totalTrustChipsSpent}</strong>
            <span className="cn-line">
              信任筹码总支出：
              <strong>{marketImpact.totalTrustChipsSpent}</strong>
            </span>
          </p>
          <div className="account-impact-columns">
            <section>
              <h3>
                Action counts
                <span className="cn-line">操作次数</span>
              </h3>
              <ul>
                {actions.map((action) => (
                  <li key={action.name}>
                    <span>
                      {action.name}
                      <span className="cn-line">{action.cn}</span>
                    </span>
                    <strong>{marketImpact.actionCounts[action.name]}</strong>
                  </li>
                ))}
              </ul>
            </section>
            <section>
              <h3>
                Index changes
                <span className="cn-line">指数变化</span>
              </h3>
              <ul>
                {MARKET_IMPACT_INDEXES.map((index) => (
                  <li key={index.key}>
                    <span>
                      {index.en}
                      <span className="cn-line">{index.cn}</span>
                    </span>
                    <strong>
                      {formatSignedValue(
                        marketImpact.indexTotals[index.key],
                      )}
                    </strong>
                  </li>
                ))}
              </ul>
            </section>
          </div>
          <p className="account-impact-message">
            {marketImpact.strongestMessage.en}
            <span className="cn-line">
              {marketImpact.strongestMessage.cn}
            </span>
          </p>
        </section>
        <section className="final-receipt">
          <header className="final-receipt-header">
            <p>
              PLATFORM RESULT SLIP
              <span className="cn-line">平台结果单</span>
            </p>
            <h2>
              FINAL RECEIPT
              <span className="cn-line">最终凭证</span>
            </h2>
          </header>
          <dl className="final-receipt-lines">
            <div>
              <dt>
                Account number
                <span className="cn-line">账户编号</span>
              </dt>
              <dd>{account.accountNumber}</dd>
            </div>
            <div>
              <dt>
                Nickname
                <span className="cn-line">昵称</span>
              </dt>
              <dd>{account.nickname}</dd>
            </div>
            <div>
              <dt>
                Session date
                <span className="cn-line">场次日期</span>
              </dt>
              <dd>{account.sessionDate}</dd>
            </div>
            <div>
              <dt>
                Total bets
                <span className="cn-line">下注总数</span>
              </dt>
              <dd>{confirmedBets.length}</dd>
            </div>
            <div>
              <dt>
                Total Trust Chips spent
                <span className="cn-line">信任筹码总支出</span>
              </dt>
              <dd>{marketImpact.totalTrustChipsSpent}</dd>
            </div>
            <div>
              <dt>
                Final Trust Chips balance
                <span className="cn-line">最终信任筹码余额</span>
              </dt>
              <dd>{account.trustChips}</dd>
            </div>
            <div>
              <dt>
                Strongest market impact
                <span className="cn-line">最强市场影响</span>
              </dt>
              <dd>
                {strongestImpact.en}{" "}
                {formatSignedValue(
                  marketImpact.indexTotals[strongestImpact.key],
                )}
                <span className="cn-line">
                  {strongestImpact.cn}{" "}
                  {formatSignedValue(
                    marketImpact.indexTotals[strongestImpact.key],
                  )}
                </span>
              </dd>
            </div>
          </dl>
          <div className="final-receipt-status">
            <span>
              System status
              <span className="cn-line">系统状态</span>
            </span>
            <strong>
              {systemStatus.en}
              <span className="cn-line">{systemStatus.cn}</span>
            </strong>
          </div>
          <p className="final-receipt-footer">
            No appeal token issued. Market processing remains final until
            recalculated.
            <span className="cn-line">
              未签发申诉凭证。市场处理结果在重新计算前保持最终状态。
            </span>
          </p>
        </section>
        <p className="account-summary-message">
          Your judgement session has been closed. Your actions have been
          processed as market data.
          <span className="cn-line">
            你的判断场次已经关闭。你的操作已被处理为市场数据。
          </span>
        </p>
        <button
          className="account-summary-new-audience"
          onClick={onNewAudience}
          type="button"
        >
          New Audience / New Account
          <span className="cn-line">下一位观众 / 新建账户</span>
        </button>
      </section>
    </main>
  );
}

function EscapingAiRulesNavItem() {
  const [aiRulesEscaping, setAiRulesEscaping] = useState(false);
  const [aiRulesPosition, setAiRulesPosition] = useState(null);
  const [aiRulesEscapeCount, setAiRulesEscapeCount] = useState(0);
  const [aiRulesWarnings, setAiRulesWarnings] = useState([]);
  const [aiRulesAnimationMode, setAiRulesAnimationMode] = useState(null);
  const aiRulesRef = useRef(null);
  const escapeTimerRef = useRef(null);

  function chooseSafePosition(rect) {
    const safeMargin = 20;
    const maxLeft = Math.max(
      safeMargin,
      window.innerWidth - rect.width - safeMargin,
    );
    const maxTop = Math.max(
      safeMargin,
      window.innerHeight - rect.height - safeMargin,
    );
    let nextLeft = safeMargin;
    let nextTop = safeMargin;

    for (let attempt = 0; attempt < 10; attempt += 1) {
      nextLeft = safeMargin + Math.random() * (maxLeft - safeMargin);
      nextTop = safeMargin + Math.random() * (maxTop - safeMargin);
      if (Math.hypot(nextLeft - rect.left, nextTop - rect.top) > 120) break;
    }

    return {
      left: Math.round(nextLeft),
      top: Math.round(nextTop),
      rotation: Math.round(Math.random() * 10 - 5),
    };
  }

  function escapeAiRules() {
    const item = aiRulesRef.current;
    if (!item || aiRulesEscaping) return;

    const rect = item.getBoundingClientRect();
    const animationMode = Math.random() < 0.5 ? "flight" : "warning";

    setAiRulesEscapeCount((count) => count + 1);
    setAiRulesAnimationMode(animationMode);
    if (animationMode === "flight") {
      const flightPoints = Array.from({ length: 4 }, () =>
        chooseSafePosition(rect),
      );
      setAiRulesPosition({
        height: rect.height,
        left: rect.left,
        top: rect.top,
        width: rect.width,
        points: flightPoints.map((point) => ({
          x: point.left - rect.left,
          y: point.top - rect.top,
          rotation: point.rotation,
        })),
      });
      setAiRulesWarnings([]);
    } else {
      setAiRulesPosition(null);
      setAiRulesWarnings(
        Array.from({ length: 14 }, (_, index) => ({
          id: `${Date.now()}-${index}`,
          left: Math.round(3 + Math.random() * 84),
          top: Math.round(4 + Math.random() * 84),
          rotation: Math.round(Math.random() * 18 - 9),
          delay: Math.round(Math.random() * 180),
        })),
      );
    }
    setAiRulesEscaping(true);
    escapeTimerRef.current = window.setTimeout(() => {
      setAiRulesEscaping(false);
      setAiRulesAnimationMode(null);
      setAiRulesPosition(null);
      setAiRulesWarnings([]);
      escapeTimerRef.current = null;
    }, 1000);
  }

  useEffect(
    () => () => {
      if (escapeTimerRef.current) {
        window.clearTimeout(escapeTimerRef.current);
      }
    },
    [],
  );

  return (
    <>
      {aiRulesEscaping && aiRulesAnimationMode === "warning" &&
        createPortal(
          <div className="ai-rules-chaos-overlay" aria-hidden="true">
            {aiRulesWarnings.map((warning) => (
              <div
                className="ai-rules-warning"
                key={warning.id}
                style={{
                  "--warning-delay": `${warning.delay}ms`,
                  "--warning-left": `${warning.left}%`,
                  "--warning-rotation": `${warning.rotation}deg`,
                  "--warning-top": `${warning.top}%`,
                }}
              >
                WARNING: AI RULES?
                <small>警告：AI 规则？</small>
              </div>
            ))}
          </div>,
          document.body,
        )}
      {aiRulesEscaping && aiRulesAnimationMode === "flight" && (
        <span
          aria-hidden="true"
          className="ai-rules-nav-placeholder"
          style={{
            height: aiRulesPosition?.height,
            width: aiRulesPosition?.width,
          }}
        />
      )}
      {(!aiRulesEscaping || aiRulesAnimationMode === "warning") && (
        <span
          className="ai-rules-nav-item"
          data-escape-count={aiRulesEscapeCount}
          onClick={escapeAiRules}
          ref={aiRulesRef}
        >
          AI RULES?
          <small>AI 规则?</small>
        </span>
      )}
      {aiRulesEscaping &&
        aiRulesAnimationMode === "flight" &&
        aiRulesPosition &&
        createPortal(
          <span
            aria-hidden="true"
            className="ai-rules-nav-item is-escaping"
            style={{
              height: `${aiRulesPosition.height}px`,
              left: `${aiRulesPosition.left}px`,
              top: `${aiRulesPosition.top}px`,
              width: `${aiRulesPosition.width}px`,
              "--flight-x-1": `${aiRulesPosition.points[0].x}px`,
              "--flight-y-1": `${aiRulesPosition.points[0].y}px`,
              "--flight-r-1": `${aiRulesPosition.points[0].rotation}deg`,
              "--flight-x-2": `${aiRulesPosition.points[1].x}px`,
              "--flight-y-2": `${aiRulesPosition.points[1].y}px`,
              "--flight-r-2": `${aiRulesPosition.points[1].rotation}deg`,
              "--flight-x-3": `${aiRulesPosition.points[2].x}px`,
              "--flight-y-3": `${aiRulesPosition.points[2].y}px`,
              "--flight-r-3": `${aiRulesPosition.points[2].rotation}deg`,
              "--flight-x-4": `${aiRulesPosition.points[3].x}px`,
              "--flight-y-4": `${aiRulesPosition.points[3].y}px`,
              "--flight-r-4": `${aiRulesPosition.points[3].rotation}deg`,
            }}
          >
            AI RULES?
            <small>AI 规则?</small>
          </span>,
          document.body,
        )}
    </>
  );
}

function PrototypeTopNavigation({
  ariaLabel = "Decorative navigation",
  className = "exchange-fake-nav",
}) {
  return (
    <nav className={className} aria-label={ariaLabel}>
      <span>WHO MADE IT?</span>
      <EscapingAiRulesNavItem />
    </nav>
  );
}

function FinalSummaryScreen({
  account,
  confirmedBets,
  onPlayAgain,
}) {
  const [achievement] = useState(() =>
    getOrCreateSessionAchievement(account),
  );
  const [isSavingReceipt, setIsSavingReceipt] = useState(false);
  const [showGameOverTape, setShowGameOverTape] = useState(false);
  const [societyExitBlocked, setSocietyExitBlocked] = useState(false);
  const voucherRef = useRef(null);
  const gameOverTimerRef = useRef(null);
  const receiptBets = confirmedBets.slice(0, REQUIRED_CONFIRMED_BETS);
  const voucherAccountNumber =
    account.accountNumber?.match(/\d+$/)?.[0] ?? account.accountNumber;
  const formatBalanceChange = (change) => {
    const numericChange = Number(change) || 0;
    return numericChange > 0 ? `+${numericChange}` : String(numericChange);
  };

  async function saveReceiptAsJpeg(event) {
    if (isSavingReceipt || !voucherRef.current) return;

    event.currentTarget.blur();
    setIsSavingReceipt(true);

    try {
      await new Promise((resolve) => requestAnimationFrame(resolve));
      const imageData = await toJpeg(voucherRef.current, {
        backgroundColor: "#ffffff",
        cacheBust: true,
        pixelRatio: 2,
        quality: 0.95,
      });
      const downloadLink = document.createElement("a");
      downloadLink.download = `suspicion-exchange-receipt-${voucherAccountNumber}.jpg`;
      downloadLink.href = imageData;
      downloadLink.click();
    } catch (error) {
      console.error("Failed to save receipt as JPG:", error);
    } finally {
      setIsSavingReceipt(false);
    }
  }

  function playGameOverTape() {
    if (showGameOverTape || societyExitBlocked) return;

    const prefersReducedMotion = window.matchMedia(
      "(prefers-reduced-motion: reduce)",
    ).matches;
    setShowGameOverTape(true);
    gameOverTimerRef.current = window.setTimeout(
      () => {
        setShowGameOverTape(false);
        setSocietyExitBlocked(true);
        gameOverTimerRef.current = null;
      },
      prefersReducedMotion ? 1400 : 5900,
    );
  }

  useEffect(
    () => () => {
      if (gameOverTimerRef.current) {
        window.clearTimeout(gameOverTimerRef.current);
      }
    },
    [],
  );

  return (
    <main className="exchange-shell final-summary-shell">
      <header className="exchange-header">
        <PrototypeTopNavigation />
      </header>

      <div className="final-summary-stage">
        <header className="final-summary-title">
          <h1>
            TRUST REDEMPTION CENTER
            <span className="cn-line">信任兑奖中心</span>
          </h1>
        </header>

        <div className="final-summary-grid">
          <section className="panel final-summary-main-panel" ref={voucherRef}>
            <div className="final-summary-inner-card">
              <div className="final-voucher-heading">
                <h2 className="final-voucher-title">
                  Official Reward Voucher
                  <span className="cn-line">官方奖励兑换券</span>
                </h2>
                <div className="final-voucher-account-number">
                  <strong>ACCOUNT NO. {voucherAccountNumber}</strong>
                  <span className="cn-line">
                    账户编号 {voucherAccountNumber}
                  </span>
                </div>
                <span
                  className="final-voucher-right-notch-shadow"
                  aria-hidden="true"
                />
              </div>
              <p className="final-reward-unlocked-label">
                Reward Unlocked:
                <span className="cn-line">奖励已解锁：</span>
              </p>
              <h3 className="final-reward-name">
                {achievement.titleEnglish}
                <span className="cn-line">{achievement.titleChinese}</span>
              </h3>
              <p className="final-reward-description">
                {achievement.descriptionEnglish}
                <span className="cn-line">{achievement.descriptionChinese}</span>
              </p>
              <section className="final-betting-receipt">
                <h4>
                  Betting Receipt
                  <span className="cn-line">下注结算小票</span>
                </h4>
                <div className="final-receipt-rows">
                  {receiptBets.map((bet, index) => (
                    <div className="final-receipt-row" key={bet.betId ?? index}>
                      <span>R{index + 1}</span>
                      <span>{bet.actionLabel ?? bet.selectedAction ?? bet.actionType}</span>
                      <strong>{formatBalanceChange(bet.actualBalanceChange)}</strong>
                    </div>
                  ))}
                </div>
              </section>
              <div className="final-voucher-info-grid">
                <div className="final-voucher-info-box final-balance-info-box">
                  <p>
                    Final Balance
                    <span className="cn-line">最终余额</span>
                  </p>
                  <strong className="final-voucher-info-value">
                    {account.trustChips}
                  </strong>
                </div>
                <div className="final-voucher-info-box final-status-info-box">
                  <p>
                    Reward Status
                    <span className="cn-line">奖励状态</span>
                  </p>
                  <strong className="final-voucher-info-value">
                    {achievement.statusEnglish}
                    <span className="cn-line">{achievement.statusChinese}</span>
                  </strong>
                </div>
              </div>
            </div>
          </section>

          <aside className="panel final-summary-side-panel">
            <div className="final-summary-statement">
              <p>
                YOUR BALANCE IS BEING PROCESSED INTO REAL LIFE.
                <span className="cn-line">
                  您的余额正在被处理到现实生活中。
                </span>
              </p>
              <p>
                PLEASE WAIT FOR REVIEW.
                <span className="cn-line">请等待审核。</span>
              </p>
            </div>

            <div className="final-summary-status-box">
              <p>
                YOUR JUDGEMENTS HAVE BEEN ACCEPTED.
                <span className="cn-line">你的判断已被接收。</span>
              </p>
            </div>

            <div className="final-summary-status-box">
              <p className="final-summary-status-uppercase">
                Physical presence was not required.
                <span className="cn-line">本次流程不需要身体在场。</span>
              </p>
            </div>

            <div className="final-summary-actions">
              <button onClick={onPlayAgain} type="button">
                Play Again
                <span className="cn-line">再玩一次</span>
              </button>
              <button
                className={`society-exit-button${societyExitBlocked ? " is-blocked" : ""}`}
                disabled={societyExitBlocked}
                onClick={playGameOverTape}
                type="button"
              >
                Return to Society
                <span className="cn-line">返回社会</span>
              </button>
            </div>
          </aside>

          <button
            className="final-summary-save-button"
            disabled={isSavingReceipt}
            onClick={saveReceiptAsJpeg}
            type="button"
          >
            {isSavingReceipt ? "Saving..." : "Save Receipt"}
            <span className="cn-line">
              {isSavingReceipt ? "正在保存……" : "保存小票"}
            </span>
          </button>
        </div>
      </div>
      {showGameOverTape && (
        <div
          className="game-over-tape-overlay"
          aria-label="Game over. Your actions have been absorbed by the system."
          role="status"
        >
          {GAME_OVER_TAPES.map((tape, index) => (
            <div
              className={`game-over-tape ${tape.className}`}
              key={`${tape.className}-${index}`}
              style={{
                "--tape-angle": tape.angle,
                "--tape-delay": tape.delay,
                "--tape-duration": tape.duration,
                "--tape-top": tape.top,
              }}
            >
              <div className="game-over-tape-copy">
                <strong>
                  GAME OVER · YOUR ACTIONS HAVE BEEN ABSORBED BY THE SYSTEM. · GAME OVER · YOUR ACTIONS HAVE BEEN ABSORBED BY THE SYSTEM. · GAME OVER · YOUR ACTIONS HAVE BEEN ABSORBED BY THE SYSTEM. · GAME OVER · YOUR ACTIONS HAVE BEEN ABSORBED BY THE SYSTEM.
                </strong>
                <span>
                  游戏结束 · 你的行动已被系统吸收。 · 游戏结束 · 你的行动已被系统吸收。 · 游戏结束 · 你的行动已被系统吸收。 · 游戏结束 · 你的行动已被系统吸收。
                </span>
              </div>
            </div>
          ))}
        </div>
      )}
    </main>
  );
}

export function MainScreen() {
  const state = useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
  const [currentUser, setCurrentUser] = useState(getCurrentUser);
  const [selectedCases, setSelectedCases] = useState(() =>
    currentUser ? getOrCreateSelectedCases(currentUser) : [],
  );
  const [marketEntryStatus, setMarketEntryStatus] = useState(
    getMarketEntryStatus,
  );
  const [currentCaseIndex, setCurrentCaseIndex] = useState(() =>
    currentUser
      ? Math.max(
          0,
          Math.min(
            getSessionConfirmedBets(currentUser).length,
            selectedCases.length - 1,
          ),
        )
      : 0,
  );
  const [selectedAction, setSelectedAction] = useState(null);
  const [settlementResult, setSettlementResult] = useState(null);
  const [betError, setBetError] = useState("");
  const [opaqueMessage, setOpaqueMessage] = useState("");
  const [isConfirming, setIsConfirming] = useState(false);
  const confirmingRef = useRef(false);
  const supabaseAuthTestStartedRef = useRef(false);
  const preloadedCaseImagesRef = useRef(new Map());
  const [confirmedBets, setConfirmedBets] = useState(() =>
    getSessionConfirmedBets(currentUser),
  );
  const sessionComplete = isSessionComplete(confirmedBets);
  const currentCase = selectedCases[currentCaseIndex] ?? selectedCases[0];
  const currentPostType = currentCase
    ? POST_TYPE_LABELS[currentCase.categoryId]
    : { en: "Post", cn: "帖子" };

  useEffect(() => {
    selectedCases.forEach((caseData, index) => {
      const imagePath = caseData?.image;
      if (!imagePath || preloadedCaseImagesRef.current.has(imagePath)) return;

      const image = new Image();
      if (index === 0) image.fetchPriority = "high";
      image.decoding = "async";
      image.addEventListener("error", () => {
        console.warn(`Case image preload failed: ${imagePath}`);
      });
      preloadedCaseImagesRef.current.set(imagePath, image);
      image.src = imagePath;
    });
  }, [selectedCases]);

  useEffect(() => {
    if (supabaseAuthTestStartedRef.current) return;
    supabaseAuthTestStartedRef.current = true;

    if (!supabase) {
      console.error(
        "Supabase anonymous sign-in test could not start because the client is not configured.",
      );
      return;
    }

    async function testSupabaseAnonymousAuth() {
      try {
        const {
          data: { user },
          error: getUserError,
        } = await supabase.auth.getUser();

        if (getUserError) {
          console.error(
            "Supabase getUser failed during the anonymous sign-in test:",
            getUserError,
          );
        }

        if (user) {
          console.log("Supabase anonymous user already exists:", user.id);
          return;
        }

        const { data, error } = await supabase.auth.signInAnonymously();

        if (error) {
          console.error("Supabase anonymous sign-in failed:", error);
          return;
        }

        if (data.user) {
          console.log(
            "Supabase anonymous sign-in successful:",
            data.user.id,
          );
        }
      } catch (error) {
        console.error(
          "Unexpected Supabase anonymous sign-in test error:",
          error,
        );
      }
    }

    void testSupabaseAnonymousAuth();
  }, []);

  useEffect(() => {
    function syncCurrentAccount(event) {
      if (event.key === STORAGE_KEYS.currentUser || event.key === null) {
        const nextUser = getCurrentUser();
        const nextCases = nextUser ? getOrCreateSelectedCases(nextUser) : [];
        const nextConfirmedBets = getSessionConfirmedBets(nextUser);
        setCurrentUser(nextUser);
        setSelectedCases(nextCases);
        setConfirmedBets(nextConfirmedBets);
        setCurrentCaseIndex(
          nextUser
            ? Math.min(
                nextConfirmedBets.length,
                REQUIRED_CONFIRMED_BETS - 1,
              )
            : 0,
        );
      }
      if (event.key === STORAGE_KEYS.marketEntryStatus || event.key === null) {
        setMarketEntryStatus(getMarketEntryStatus());
      }
      if (event.key === STORAGE_KEYS.prototypeSelectedCases) {
        const activeUser = getCurrentUser();
        const activeCases = activeUser
          ? getOrCreateSelectedCases(activeUser)
          : [];
        const activeConfirmedBets = getSessionConfirmedBets(activeUser);
        setSelectedCases(activeCases);
        setConfirmedBets(activeConfirmedBets);
        setCurrentCaseIndex(
          activeUser
            ? Math.min(
                activeConfirmedBets.length,
                REQUIRED_CONFIRMED_BETS - 1,
              )
            : 0,
        );
      }
    }

    window.addEventListener("storage", syncCurrentAccount);
    return () => window.removeEventListener("storage", syncCurrentAccount);
  }, []);

  function showNextCase() {
    setSettlementResult(null);
    setSelectedAction(null);
    setBetError("");
    setCurrentCaseIndex((index) => (index + 1) % selectedCases.length);
  }

  function selectBet(action) {
    if (settlementResult) return;
    const selectedBet = {
      ...action,
      ...BET_DETAILS[action.internalEffect],
      cost: getRandomVisibleCost(),
    };
    setSelectedAction(selectedBet);
    setBetError("");
  }

  function cancelBet() {
    setSettlementResult(null);
    setSelectedAction(null);
    setBetError("");
  }

  function startNewAudience() {
    cancelBet();
    setOpaqueMessage("");
    setSelectedCases([]);
    setConfirmedBets([]);
    setCurrentCaseIndex(0);
    clearMarketEntryStatus();
    setMarketEntryStatus(null);
    try {
      localStorage.removeItem(STORAGE_KEYS.prototypeSelectedCases);
    } catch {
      // React state still returns the next audience to registration.
    }
    clearCurrentUser();
    setCurrentUser(null);
  }

  function confirmBet() {
    if (
      sessionComplete ||
      confirmingRef.current ||
      isConfirming ||
      !selectedAction
    ) {
      return;
    }
    confirmingRef.current = true;
    setIsConfirming(true);

    try {
      const actualBalanceChange = getRandomActualBalanceChange();
      const result = spendTrustChips(
        currentUser.accountNumber,
        actualBalanceChange,
      );
      if (!result.ok) {
        if (result.user) setCurrentUser(result.user);
        setBetError(INSUFFICIENT_CHIPS_MESSAGE);
        return;
      }

      setOpaqueMessage(VISIBLE_ACTION_RESPONSES[selectedAction.name]);
      const timestamp = new Date().toISOString();
      const newBet = {
        betId: `BET-${Date.now()}-${selectedAction.name
          .toUpperCase()
          .replaceAll(" ", "-")}`,
        accountNumber: result.user.accountNumber,
        caseNumber: `Case ${currentCase.caseId}`,
        actionType: selectedAction.name,
        cnActionType: selectedAction.cn,
        selectedAction: selectedAction.name,
        actionLabel: selectedAction.name,
        actionChineseLabel: selectedAction.cn,
        internalEffect: selectedAction.internalEffect,
        chipsBefore: result.chipsBefore,
        chipCost: selectedAction.cost,
        visibleCost: selectedAction.cost,
        actualBalanceChange: result.actualBalanceChange,
        chipsAfter: result.chipsAfter,
        trustChipsAfterBet: result.chipsAfter,
        timestamp,
      };
      const updatedUser = {
        ...result.user,
        bets: [...(result.user.bets ?? []), newBet],
      };

      try {
        const savedAccounts = JSON.parse(
          localStorage.getItem(STORAGE_KEYS.users) ?? "[]",
        );
        const updatedAccounts = Array.isArray(savedAccounts)
          ? savedAccounts.map((account) =>
              account.accountNumber === updatedUser.accountNumber
                ? updatedUser
                : account,
            )
          : [updatedUser];
        localStorage.setItem(
          STORAGE_KEYS.users,
          JSON.stringify(updatedAccounts),
        );
        localStorage.setItem(
          STORAGE_KEYS.currentUser,
          JSON.stringify(updatedUser),
        );
      } catch {
        // React state still keeps the five-case prototype flow working.
      }

      const updatedBets =
        newBet && !confirmedBets.some((bet) => bet.betId === newBet.betId)
          ? [...confirmedBets, newBet]
          : [...confirmedBets];

      console.log("CONFIRM BET DEBUG");
      console.log("updatedBets length:", updatedBets.length);
      console.log("REQUIRED_CONFIRMED_BETS:", REQUIRED_CONFIRMED_BETS);
      console.log("currentCaseIndex before:", currentCaseIndex);
      console.log(
        "should show summary:",
        updatedBets.length >= REQUIRED_CONFIRMED_BETS,
      );

      saveSessionConfirmedBets(updatedUser, updatedBets);
      const sessionId = getOrCreateSessionId(updatedUser);
      void uploadConfirmedBetToSupabase({
        account: updatedUser,
        bet: newBet,
        sessionId,
        roundNumber: updatedBets.length,
        caseData: currentCase,
      });
      if (
        updatedBets.length >= REQUIRED_CONFIRMED_BETS &&
        currentCaseIndex === REQUIRED_CONFIRMED_BETS - 1
      ) {
        saveSessionCompletionStatus(
          updatedUser,
          true,
          REQUIRED_CONFIRMED_BETS,
        );
      }
      setCurrentUser(updatedUser);
      setConfirmedBets(updatedBets);
      setBetError("");

      const nextCaseIndex = Math.min(
        updatedBets.length,
        REQUIRED_CONFIRMED_BETS - 1,
      );
      setSettlementResult({
        actualBalanceChange: result.actualBalanceChange,
        chipsAfter: result.chipsAfter,
        nextCaseIndex,
      });
    } finally {
      confirmingRef.current = false;
      setIsConfirming(false);
    }
  }

  function continueAfterSettlement() {
    if (!settlementResult) return;
    setCurrentCaseIndex(settlementResult.nextCaseIndex);
    setSettlementResult(null);
    setSelectedAction(null);
    setBetError("");
  }

  if (!currentUser) {
    return (
      <RegistrationPanel
        marketState={state}
        onAccountGenerated={(user) => {
          cancelBet();
          setOpaqueMessage("");
          setSelectedCases(createAndSaveSelectedCases(user));
          setConfirmedBets([]);
          setCurrentCaseIndex(0);
          clearMarketEntryStatus();
          setMarketEntryStatus(null);
          setCurrentUser(user);
        }}
      />
    );
  }

  if (!hasEnteredMarket(currentUser, marketEntryStatus)) {
    return (
      <RulesOnboarding
        account={currentUser}
        onEnterMarket={() =>
          setMarketEntryStatus(saveMarketEntryStatus(currentUser))
        }
      />
    );
  }

  if (sessionComplete && !settlementResult) {
    return (
      <FinalSummaryScreen
        account={currentUser}
        confirmedBets={confirmedBets}
        onPlayAgain={startNewAudience}
      />
    );
  }

  return (
    <main className="exchange-shell">
      <SessionDebug
        activeCases={selectedCases}
        confirmedBets={confirmedBets}
        currentCaseIndex={currentCaseIndex}
      />
      <header className="exchange-header">
        <PrototypeTopNavigation />
      </header>

      <div className="main-grid judgement-table">
        <div className="case-status-row">
        <div className="exchange-chip round-chip">
          Round {currentCaseIndex + 1} / {REQUIRED_CONFIRMED_BETS}
          <span className="cn-line">
            第 {currentCaseIndex + 1} 轮 / 共 {REQUIRED_CONFIRMED_BETS} 轮
          </span>
        </div>
        </div>
        <div className="control-status-row">
        <div className="exchange-chip account-chip">
          {currentUser.accountNumber}
          <span className="cn-line">账户编号</span>
          <button
            className="new-account-button"
            onClick={startNewAudience}
            type="button"
          >
            New Audience
            <span className="cn-line">下一位观众</span>
          </button>
        </div>
        <div className="exchange-chip trust-chip">
          Trust Chips: {currentUser.trustChips}
          <span className="cn-line">
            信任筹码：{currentUser.trustChips}
          </span>
        </div>
        </div>
        <div className="table-open-label" hidden>
          INPUT OPEN · AUDIENCE JUDGEMENTS ACCEPTED AS DATA
          <span className="cn-line">输入开放 · 观众判断作为数据被接收</span>
        </div>

        <section className="case-column" aria-label="Social platform case">
          <article className="panel post case-board">
            <div className="case-top-tags">
              <div className="post-meta">
                <span>
                  Post type: {currentPostType.en}
                  <span className="cn-line">
                    {currentPostType.cn}
                  </span>
                </span>
              </div>
              <div className="label-warning">
                Platform label: {currentCase.platformLabel}
                <span className="cn-line">
                  平台标签：{currentCase.cnPlatformLabel}
                </span>
              </div>
            </div>

            <div className="case-post-card">
              <div className="post-user-row">
                <span className="post-avatar" aria-hidden="true" />
                <div className="post-user-copy">
                  <strong>@platform_user_{currentCaseIndex + 1}</strong>
                  <span>
                    Posted 15 minutes ago
                    <span className="cn-line">发布于 15 分钟前</span>
                  </span>
                </div>
              </div>

              <div className="case-original-post">
                <img
                  src={currentCase.image}
                  alt={currentCase.title}
                  loading="eager"
                  fetchPriority="high"
                  decoding="async"
                />
              </div>

              <h1>
                {currentCase.title}
                <span className="cn-line">{currentCase.cnTitle}</span>
              </h1>
              <p className="post-body">
                {currentCase.description}
                <span className="cn-line">{currentCase.cnDescription}</span>
              </p>
            </div>

            <div className="evidence-grid">
              <section className="panel evidence-card case-reality-card">
                <div className="reality-line">
                  <strong>
                    Reality claim <span>真实来源说明</span>
                  </strong>
                  <span className="reality-divider" aria-hidden="true">
                    |
                  </span>
                  <span>
                    {currentCase.reality.replace(/^Reality(?: claim)?:\s*/i, "")}
                  </span>
                  <span className="reality-divider" aria-hidden="true">
                    |
                  </span>
                  <span>
                    {currentCase.cnReality.replace(
                      /^真实(?:来源)?(?:说明|声明)[：:]?\s*/,
                      "",
                    )}
                  </span>
                </div>
              </section>
            </div>

            <section className="panel feedback" aria-live="polite">
              <p className="feedback-status">
                System Response
                <span className="cn-line">系统回应</span>
              </p>
              <p className="feedback-message">
                {opaqueMessage?.en ?? state.feedback}
                <span className="cn-line">
                  {opaqueMessage?.cn ?? state.cnFeedback}
                </span>
              </p>
              {!opaqueMessage && (
                <p className="feedback-detail">
                  {state.detail}
                  <span className="cn-line">{state.cnDetail}</span>
                </p>
              )}
            </section>
          </article>
        </section>

        <aside className="control-column">
          <section className="panel action-panel">
            <h2>
              PLACE YOUR BET
              <span className="cn-line">下注判断它是谁做的</span>
            </h2>
            <div className="judgement-input-rule">
              <p>
                Your judgement will be recorded as market data.
                <span className="cn-line">
                  你的判断会被记录为市场数据。
                </span>
              </p>
            </div>
            <div className="action-buttons">
              {actions.map((action) => (
                <Fragment key={action.name}>
                  <button
                    className="action-button"
                    onClick={() => selectBet(action)}
                    type="button"
                  >
                    <span className="bet-token">
                      <b>BET</b>
                      <small>下注</small>
                    </span>
                    <span>
                      {action.name}
                      <span className="cn-line">{action.cn}</span>
                    </span>
                  </button>
                  {selectedAction?.name === action.name && (
                    <section
                      aria-label="Confirm selected bet"
                      className="bet-confirmation"
                    >
                      {settlementResult ? (
                        <div className="settlement-result-view">
                          <p className="bet-confirmation-label">
                            Settlement Result
                            <span className="cn-line">结算结果</span>
                          </p>
                          <p className="settlement-processed-copy">
                            {settlementResult.actualBalanceChange < 0 ? (
                              <>
                                TRUST CHIPS DEDUCTED:{" "}
                                {Math.abs(settlementResult.actualBalanceChange)}
                                <span className="cn-line">
                                  已扣除 Trust Chips：
                                  {Math.abs(settlementResult.actualBalanceChange)}
                                </span>
                              </>
                            ) : settlementResult.actualBalanceChange === 0 ? (
                              <>
                                NO TRUST CHIPS DEDUCTED
                                <span className="cn-line">
                                  本轮没有扣除 Trust Chips
                                </span>
                              </>
                            ) : (
                              <>
                                YOU WON TRUST CHIPS: +
                                {settlementResult.actualBalanceChange}
                                <span className="cn-line">
                                  你赢得了 Trust Chips：+
                                  {settlementResult.actualBalanceChange}
                                </span>
                              </>
                            )}
                          </p>
                          <p className="settlement-balance">
                            BALANCE: {settlementResult.chipsAfter}
                            <span className="cn-line">
                              余额：{settlementResult.chipsAfter}
                            </span>
                          </p>
                          <button
                            className="settlement-next-button"
                            onClick={continueAfterSettlement}
                            type="button"
                          >
                            Next Post
                            <span className="cn-line">下一条帖子</span>
                          </button>
                        </div>
                      ) : (
                        <>
                          <p className="bet-confirmation-label">
                            Confirm Bet
                            <span className="cn-line">确认下注</span>
                          </p>
                          <h3>
                            YOUR BET: {selectedAction.name}
                            <span className="cn-line">
                              你的下注：{selectedAction.cn}
                            </span>
                          </h3>
                          <p>
                            ESTIMATED COST:{" "}
                            <strong>{selectedAction.cost}</strong> TRUST CHIPS
                            <span className="cn-line">
                              预计扣费：<strong>{selectedAction.cost}</strong> 个
                              Trust Chips
                            </span>
                          </p>
                          {betError && (
                            <p className="bet-error" role="alert">
                              {betError}
                              <span className="cn-line">
                                {INSUFFICIENT_CHIPS_MESSAGE_CN}
                              </span>
                            </p>
                          )}
                          <div className="bet-confirmation-actions">
                            <button
                              className="confirm-bet-button"
                              disabled={
                                sessionComplete ||
                                isConfirming
                              }
                              onClick={confirmBet}
                              type="button"
                            >
                              Confirm Bet
                              <span className="cn-line">确认下注</span>
                            </button>
                            <button
                              className="cancel-bet-button"
                              onClick={cancelBet}
                              type="button"
                            >
                              Cancel
                              <span className="cn-line">取消</span>
                            </button>
                          </div>
                        </>
                      )}
                    </section>
                  )}
                </Fragment>
              ))}
            </div>
            <button
              className="reset-market-button"
              hidden
              onClick={resetMarketState}
              type="button"
            >
              Reset Market
              <span className="cn-line">重置市场</span>
            </button>

            <button
              className="next-case-button"
              onClick={showNextCase}
              type="button"
            >
              <span className="next-post-main">
                NEXT POST
                <span className="cn-line">下一条帖子</span>
              </span>
              <span className="next-post-preview">
                Next:{" "}
                {
                  selectedCases[(currentCaseIndex + 1) % selectedCases.length]
                    .categoryName
                }
                <span className="cn-line">
                  下一个：
                  {
                    selectedCases[
                      (currentCaseIndex + 1) % selectedCases.length
                    ].cnCategoryName
                  }
                </span>
              </span>
            </button>
          </section>
        </aside>
      </div>
    </main>
  );
}

createRoot(document.getElementById("root")).render(
  <StrictMode>
    <MainScreen />
  </StrictMode>,
);
