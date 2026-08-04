import React, { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { gamePosts } from "./data/gamePosts";
import { realBodyPosts } from "./data/realBodyPosts";
import { artPosts } from "./data/artPosts";
import { petPosts } from "./data/petPosts";
import { textPosts } from "./data/textPosts";

const postGroups = [
  {
    id: "game",
    name: "Game Images as Suspicious Images",
    cnName: "游戏图像作为可疑图像",
    posts: gamePosts,
  },
  {
    id: "real-body",
    name: "Real Bodies as AI Suspects",
    cnName: "真人身体作为 AI 可疑对象",
    posts: realBodyPosts,
  },
  {
    id: "art",
    name: "Original Art as Suspicious Art",
    cnName: "原创绘画作为可疑艺术",
    posts: artPosts,
  },
  {
    id: "pet",
    name: "Pet Videos as Suspicious Daily Life",
    cnName: "宠物视频作为可疑日常",
    posts: petPosts,
  },
  {
    id: "text",
    name: "Text Posts Trapped by AI Labels",
    cnName: "被 AI 标签困住的文字内容",
    posts: textPosts,
  },
];

function pickRandomPost(posts) {
  return posts[Math.floor(Math.random() * posts.length)];
}

export default function WhoMadeItStartPages() {
  const [page, setPage] = useState("start");
  const [playerName, setPlayerName] = useState("");
  const [currentIndex, setCurrentIndex] = useState(0);
  const [roundPosts, setRoundPosts] = useState([]);
  const [chips, setChips] = useState(100);
  const [selectedBet, setSelectedBet] = useState(null);
  const [roundResult, setRoundResult] = useState(null);

  function getDebtWarning(chipsValue) {
    if (chipsValue <= -200) {
      return {
        en: "You are no longer judging content. You are generating behavioural data.",
        cn: "你已经不再判断内容。你正在生成行为数据。",
      };
    }

    if (chipsValue <= -100) {
      return {
        en: "Negative trust is still useful to the platform.",
        cn: "负数信任对平台依然有用。",
      };
    }

    if (chipsValue < 0) {
      return {
        en: "Your trust is now in debt.",
        cn: "你的信任已经负债。",
      };
    }

    return null;
  }

  function startGame() {
    const selectedPosts = postGroups.map((group) => {
      return {
        ...pickRandomPost(group.posts),
        groupName: group.name,
        cnGroupName: group.cnName,
      };
    });

    setRoundPosts(selectedPosts);
    setCurrentIndex(0);
    setSelectedBet(null);
    setChips(100);
    setPage("game");
  }

  function handleBet(betType) {
    setSelectedBet(betType);

    let result = {
      betType,
      stake: 0,
      change: 0,
      message: "",
      cnMessage: "",
    };

    if (betType === "Fold") {
      result = {
        betType,
        stake: 0,
        change: -5,
        message: "you folded. the platform still charges a hesitation fee.",
        cnMessage: "你放弃了下注。平台仍然收取了犹豫费用。",
      };
    } else if (betType === "I Don't Care") {
      const loss = Math.random() < 0.65 ? 15 : 0;

      result = {
        betType,
        stake: 0,
        change: -loss,
        message:
          loss > 0
            ? "you did not care. the label stayed, and trust was lost."
            : "you did not care. the system accepted your silence.",
        cnMessage:
          loss > 0
            ? "你不在乎。标签仍然存在，信任被扣除。"
            : "你不在乎。系统接受了你的沉默。",
      };
    } else {
      const stake = [15, 20, 25, 30, 40][Math.floor(Math.random() * 5)];

      let winChance = 0.42;
      let multiplier = 2;

      if (betType === "Bet Mixed") {
        winChance = 0.28;
        multiplier = 3;
      }

      const platformPenalty = roundPosts[currentIndex]?.hasLabel
        ? [0, 5, 10][Math.floor(Math.random() * 3)]
        : 0;

      const won = Math.random() < winChance;

      if (won) {
        const gain = stake * multiplier - platformPenalty;

        result = {
          betType,
          stake,
          change: gain,
          message: `you won ${gain} trust chips. the system rewards your suspicion.`,
          cnMessage: `你赢了 ${gain} 个信任筹码。系统奖励了你的怀疑。`,
        };
      } else {
        const loss = stake + platformPenalty;

        result = {
          betType,
          stake,
          change: -loss,
          message: `you lost ${loss} trust chips. the truth was not where you placed it.`,
          cnMessage: `你失去了 ${loss} 个信任筹码。真相不在你的下注位置。`,
        };
      }
    }

    setRoundResult(result);
    setChips((oldChips) => oldChips + result.change);
  }

  function goNextRound() {
    setSelectedBet(null);
    setRoundResult(null);

    if (currentIndex < roundPosts.length - 1) {
      setCurrentIndex((oldIndex) => oldIndex + 1);
    } else {
      setPage("end");
    }
  }

  const debtWarning = getDebtWarning(chips);

  return (
    <main className="min-h-screen w-screen overflow-hidden bg-[#f3dfbd] text-[#101010]">
      <TopNav page={page} />

      <AnimatePresence mode="wait">
        {page === "start" && (
          <StartPage key="start" onStart={() => setPage("preload")} />
        )}

        {page === "preload" && (
          <PreloadPage
            key="preload"
            playerName={playerName}
            setPlayerName={setPlayerName}
            onBack={() => setPage("start")}
            onEnter={startGame}
          />
        )}

        {page === "game" && roundPosts.length > 0 && (
          <GameBetPage
            post={roundPosts[currentIndex]}
            chips={chips}
            currentIndex={currentIndex}
            total={roundPosts.length}
            selectedBet={selectedBet}
            onBet={handleBet}
            onNext={goNextRound}
            roundResult={roundResult}
            debtWarning={debtWarning}
          />
        )}

        {page === "end" && (
          <EndPage
            key="end"
            chips={chips}
            onRestart={() => setPage("preload")}
          />
        )}
      </AnimatePresence>
    </main>
  );
}

function TopNav({ page }) {
  const [showTaunt, setShowTaunt] = useState(false);
  const [isRunning, setIsRunning] = useState(false);
  const [rulePosition, setRulePosition] = useState({
    x: 72,
    y: 72,
    rotate: 22,
  });

  const showRuleButton = page !== "start";

  function handleRuleClick() {
    const effect = Math.random() < 0.5 ? "taunt" : "run";

    if (effect === "taunt") {
      setShowTaunt(true);

      setTimeout(() => {
        setShowTaunt(false);
      }, 900);
    }

    if (effect === "run") {
      setRulePosition({
        x: Math.floor(Math.random() * 75) + 8,
        y: Math.floor(Math.random() * 70) + 12,
        rotate: Math.floor(Math.random() * 60) - 30,
      });

      setIsRunning(true);

      setTimeout(() => {
        setIsRunning(false);
      }, 1200);
    }
  }

  return (
    <>
      <header className="fixed left-0 right-0 top-0 z-30 border-b-[5px] border-[#101010] bg-[#f3dfbd] px-4 py-3 sm:px-8">
        <div className="flex flex-wrap items-center gap-3 sm:gap-5">
          <Logo text="WHO MADE IT?" main />
          <Logo text="BET HUMAN" />
          <Logo text="BET AI" />
          <Logo text="FOLD" />

          {showRuleButton && (
            <button
              onClick={handleRuleClick}
              style={
                isRunning
                  ? {
                      left: `${rulePosition.x}vw`,
                      top: `${rulePosition.y}vh`,
                      transform: `rotate(${rulePosition.rotate}deg) scale(1.25)`,
                    }
                  : undefined
              }
              className={`border-[4px] border-[#101010] bg-white px-2 py-1 text-base font-black leading-none tracking-tight shadow-[4px_4px_0_#ff4b1f] transition-all duration-700 sm:text-xl ${
                isRunning ? "fixed z-[60] bg-[#e8ff42]" : "relative"
              }`}
            >
              AI RULES?
              <p className="mt-1 text-[10px] font-bold leading-none">
                AI 规则？
              </p>
            </button>
          )}
        </div>
      </header>

      {showTaunt && (
        <div className="fixed inset-0 z-50 flex flex-wrap items-center justify-center gap-3 bg-[#ff4b1f]/95 p-6">
          {Array.from({ length: 42 }).map((_, index) => (
            <div
              key={index}
              className="rotate-[-4deg] border-[4px] border-[#101010] bg-[#e8ff42] px-3 py-2 shadow-[4px_4px_0_#101010]"
            >
              <p className="text-xl font-black leading-none">
                POSSIBLY AI-GENERATED
              </p>
              <p className="mt-1 text-xs font-bold leading-none">
                可能是 AI 生成的作品
              </p>
            </div>
          ))}
        </div>
      )}
    </>
  );
}

function Logo({ text, main }) {
  return (
    <div
      className={`border-[4px] border-[#101010] px-2 py-1 shadow-[4px_4px_0_#ff4b1f] ${
        main ? "bg-[#e8ff42]" : "bg-white"
      }`}
    >
      <span className="text-base font-black leading-none tracking-tight sm:text-xl">
        {text}
      </span>
    </div>
  );
}

function StartPage({ onStart }) {
  return (
    <motion.section
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.35 }}
      className="relative flex min-h-screen items-center justify-center overflow-hidden px-5 pb-10 pt-32 sm:px-8 sm:pt-36"
    >
      <div className="absolute inset-0 bg-[#86c8ff]" />
      <div className="absolute left-[-6%] top-[15%] h-40 w-96 rounded-[55%] bg-white sm:h-56 sm:w-[38rem]" />
      <div className="absolute right-[-8%] top-[27%] h-32 w-72 rounded-[50%] bg-white sm:h-44 sm:w-[32rem]" />
      <div className="absolute bottom-[-10%] left-[7%] h-56 w-56 rounded-full bg-[#ffed4a] border-[6px] border-[#101010] sm:h-80 sm:w-80" />
      <div className="absolute bottom-[8%] right-[8%] h-40 w-40 rounded-[45%] bg-[#ff4b1f] border-[6px] border-[#101010] sm:h-56 sm:w-56" />
      <div className="absolute left-[55%] top-[22%] h-24 w-28 rotate-12 bg-[#c7ff5a] border-[6px] border-[#101010] sm:h-32 sm:w-40" />
      <div className="absolute left-[42%] bottom-[11%] h-16 w-64 rotate-[-8deg] bg-white border-[5px] border-[#101010]" />

      <div className="relative z-10 grid w-full max-w-6xl grid-cols-1 items-center gap-8 lg:grid-cols-[1.05fr_0.95fr]">
        <div>
          <motion.div
            initial={{ y: 20, rotate: -2, opacity: 0 }}
            animate={{ y: 0, rotate: 0, opacity: 1 }}
            transition={{ duration: 0.45 }}
            className="inline-block bg-white border-[7px] border-[#101010] p-3 shadow-[12px_12px_0_#ff4b1f]"
          >
            <h1 className="max-w-4xl text-[clamp(4.2rem,11vw,9.6rem)] font-black leading-[0.82] tracking-[-0.08em]">
              WHO
              <br />
              MADE
              <br />
              IT?
            </h1>
          </motion.div>

          <div className="mt-8 inline-block rotate-[-1deg] border-[6px] border-[#101010] bg-[#e8ff42] p-4 shadow-[8px_8px_0_#101010] sm:p-6">
            <p className="text-[clamp(1.65rem,2.8vw,2.8rem)] font-black leading-none">
              Place your bet. Human or AI?
            </p>
            <p className="mt-2 text-sm font-bold leading-snug sm:text-base">
              下注吧。是人做的，还是 AI 做的？
            </p>
          </div>
        </div>

        <motion.div
          initial={{ y: 25, rotate: 3, opacity: 0 }}
          animate={{ y: 0, rotate: -1, opacity: 1 }}
          transition={{ delay: 0.12, duration: 0.45 }}
          className="justify-self-center lg:justify-self-end"
        >
          <div className="relative h-[25rem] w-[20rem] border-[7px] border-[#101010] bg-[#f3dfbd] p-5 shadow-[12px_12px_0_#101010] sm:h-[30rem] sm:w-[24rem]">
            <div className="absolute -left-10 top-10 h-24 w-24 rounded-full bg-[#ffed4a] border-[6px] border-[#101010]" />
            <div className="absolute -right-8 bottom-20 h-20 w-20 rounded-full bg-[#86c8ff] border-[6px] border-[#101010]" />
            <div className="absolute right-7 top-7 h-10 w-20 rotate-12 bg-[#ff4b1f] border-[4px] border-[#101010]" />
            <div className="flex h-full flex-col justify-between border-[4px] border-[#101010] bg-white p-5 text-center">
              <div>
                <p className="text-5xl font-black leading-none">START</p>
                <p className="mt-2 text-sm font-bold">开始</p>
              </div>
              <p className="text-2xl font-black leading-tight">
                a game show for doubtful posts
              </p>
              <p className="text-xs font-bold leading-relaxed">
                一个关于可疑帖子的竞猜秀
              </p>
              <button
                onClick={onStart}
                className="border-[5px] border-[#101010] bg-[#ff4b1f] px-6 py-4 text-3xl font-black text-white shadow-[6px_6px_0_#101010] transition hover:-translate-y-1 hover:shadow-[8px_8px_0_#101010] active:translate-y-1 active:shadow-[3px_3px_0_#101010]"
              >
                START
              </button>
            </div>
          </div>
        </motion.div>
      </div>
    </motion.section>
  );
}

function PreloadPage({ playerName, setPlayerName, onBack, onEnter }) {
  return (
    <motion.section
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.35 }}
      className="relative flex min-h-screen items-center justify-center overflow-hidden bg-[#f3dfbd] px-5 pb-10 pt-32 sm:px-8 sm:pt-36"
    >
      <div className="absolute left-8 top-32 h-32 w-32 rounded-full bg-[#86c8ff] border-[6px] border-[#101010]" />
      <div className="absolute right-14 top-44 h-28 w-32 rotate-12 bg-[#ff4b1f] border-[6px] border-[#101010]" />
      <div className="absolute bottom-10 left-[16%] h-40 w-40 rounded-full bg-[#ffed4a] border-[6px] border-[#101010]" />
      <div className="absolute bottom-24 right-[18%] h-16 w-64 rotate-6 bg-white border-[5px] border-[#101010]" />

      <div className="relative z-10 w-full max-w-4xl">
        <div className="mb-5 flex items-center justify-between gap-4">
          <button
            onClick={onBack}
            className="border-[4px] border-[#101010] bg-white px-4 py-2 text-lg font-black shadow-[4px_4px_0_#101010] transition hover:-translate-y-1"
          >
            BACK
          </button>
          <div className="border-[5px] border-[#101010] bg-[#e8ff42] px-4 py-2 shadow-[5px_5px_0_#101010]">
            <p className="text-xl font-black sm:text-2xl">100 TRUST CHIPS</p>
            <p className="text-xs font-bold">100 个信任筹码</p>
          </div>
        </div>

        <motion.div
          initial={{ y: 20, rotate: -1.5, opacity: 0 }}
          animate={{ y: 0, rotate: 0, opacity: 1 }}
          transition={{ delay: 0.08, duration: 0.4 }}
          className="border-[7px] border-[#101010] bg-white p-5 shadow-[12px_12px_0_#ff4b1f] sm:p-8"
        >
          <div className="mb-6 border-[5px] border-[#101010] bg-[#86c8ff] p-4 text-center shadow-[5px_5px_0_#101010]">
            <h2 className="text-4xl font-black leading-none sm:text-6xl">
              RULES
            </h2>
            <p className="mt-1 text-xs font-bold sm:text-sm">下注规则</p>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <RuleLine
              title="you start with 100 trust chips"
              cn="你一开始有 100 个信任筹码"
            />
            <RuleLine
              title="every bet spends your trust"
              cn="每一次下注都会花掉一点信任"
            />
            <RuleLine
              title="the label may not tell the truth"
              cn="平台标签不一定代表真相"
            />
            <RuleLine
              title="your judgement feeds the machine"
              cn="你的判断会喂养怀疑机器"
            />
          </div>

          <div className="mt-7 border-[5px] border-[#101010] bg-[#f3dfbd] p-4 shadow-[5px_5px_0_#101010]">
            <label className="block text-2xl font-black sm:text-3xl">
              PRESS YOUR NAME
            </label>
            <p className="mt-1 text-xs font-bold">输入你的名字</p>
            <div className="mt-4 flex flex-col gap-3 sm:flex-row">
              <input
                value={playerName}
                onChange={(e) => setPlayerName(e.target.value)}
                placeholder="your name"
                className="min-w-0 flex-1 border-[4px] border-[#101010] bg-white px-4 py-3 text-xl font-bold outline-none placeholder:text-[#111]/35"
              />
              <button
                onClick={onEnter}
                className="border-[4px] border-[#101010] bg-[#ff4b1f] px-6 py-3 text-xl font-black text-white shadow-[4px_4px_0_#101010] transition hover:-translate-y-1"
              >
                ENTER
              </button>
            </div>
          </div>

          <p className="mt-6 max-w-3xl text-xl font-black leading-tight sm:text-2xl">
            this is not real money. it is a game about trust, doubt, and
            authorship.
          </p>
          <p className="mt-2 text-xs font-bold leading-relaxed sm:text-sm">
            这不是真钱。这是一个关于信任、怀疑和作者身份的游戏。
          </p>
        </motion.div>
      </div>
    </motion.section>
  );
}

function GameBetPage({
  post,
  chips,
  currentIndex,
  total,
  selectedBet,
  roundResult,
  onBet,
  onNext,
  debtWarning,
}) {
  return (
    <motion.section
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.35 }}
      className="relative min-h-screen overflow-y-auto bg-[#86c8ff] px-5 pb-12 pt-32 sm:px-8 sm:pt-36"
    >
      <div className="absolute left-[-4rem] top-[8rem] h-60 w-60 rounded-full border-[6px] border-[#101010] bg-[#ffed4a]" />
      <div className="absolute right-[-3rem] bottom-[5rem] h-52 w-52 rounded-full border-[6px] border-[#101010] bg-[#c7ff5a]" />

      <div className="relative z-10 mx-auto max-w-6xl">
        <div className="mb-5 flex flex-wrap items-start justify-between gap-4">
          <InfoBadge
            title={`ROUND ${currentIndex + 1} / ${total}`}
            cn={`第 ${currentIndex + 1} 轮`}
            color="bg-[#e8ff42]"
          />

          <div>
            <InfoBadge
              title={`${chips} TRUST CHIPS`}
              cn={
                chips < 0
                  ? `${Math.abs(chips)} 个信任债务`
                  : `${chips} 个信任筹码`
              }
              color={chips < 0 ? "bg-[#ff4b1f] text-white" : "bg-white"}
            />

            {debtWarning && (
              <div className="mt-3 max-w-sm border-[4px] border-[#101010] bg-[#ff4b1f] px-4 py-3 text-white shadow-[6px_6px_0_#101010]">
                <p className="text-base font-black uppercase leading-tight">
                  SYSTEM NOTICE
                </p>
                <p className="mt-2 text-lg font-black leading-tight">
                  {debtWarning.en}
                </p>
                <p className="mt-1 text-[11px] font-bold leading-tight">
                  {debtWarning.cn}
                </p>
              </div>
            )}
          </div>
        </div>

        <div className="grid gap-6 lg:grid-cols-[1fr_0.85fr]">
          <article className="border-[7px] border-[#101010] bg-white p-5 shadow-[12px_12px_0_#ff4b1f]">
            <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
              <div className="border-[4px] border-[#101010] bg-[#f3dfbd] px-3 py-2 shadow-[4px_4px_0_#101010]">
                <p className="text-xl font-black">{post.category}</p>
                <p className="text-xs font-bold">{post.cnCategory}</p>
              </div>

              <PlatformLabel post={post} />
            </div>

            <div className="min-h-[430px] border-[5px] border-[#101010] bg-[#f3dfbd] p-5 sm:p-7">
              <div className="mb-5 flex items-center gap-3">
                <div className="h-14 w-14 rounded-full border-[4px] border-[#101010] bg-[#ff4b1f]" />
                <div>
                  <p className="text-xl font-black">
                    @platform_user_{currentIndex + 1}
                  </p>
                  <p className="text-xs font-bold">
                    3 minutes ago · public post
                  </p>
                </div>
              </div>

              <div className="mb-6 overflow-hidden border-[5px] border-[#101010] bg-white text-center shadow-[6px_6px_0_#101010]">
                {post.image ? (
                  <img
                    src={post.image}
                    alt={post.title}
                    className="h-72 w-full object-cover"
                  />
                ) : (
                  <div className="flex min-h-48 items-center justify-center p-4">
                    <p className="text-4xl font-black leading-none sm:text-6xl">
                      {post.category.toUpperCase()}
                      <br />
                      POST
                    </p>
                  </div>
                )}
              </div>

              <h2 className="text-4xl font-black leading-none sm:text-5xl">
                {post.title}
              </h2>
              <p className="mt-2 text-sm font-bold leading-snug">
                {post.cnTitle}
              </p>

              <p className="mt-6 text-xl font-black leading-tight sm:text-2xl">
                {post.body}
              </p>
              <p className="mt-2 text-xs font-bold leading-relaxed sm:text-sm">
                {post.cnBody}
              </p>
            </div>
          </article>

          <aside className="border-[7px] border-[#101010] bg-[#e8ff42] p-5 shadow-[12px_12px_0_#101010]">
            <h2 className="text-5xl font-black leading-none">
              PLACE YOUR BET
            </h2>
            <p className="mt-2 text-sm font-bold">下注判断它是谁做的</p>

            <div className="mt-6 grid gap-3">
              <BetButton
                text="BET HUMAN"
                cn="赌人类"
                onClick={() => onBet("Bet Human")}
              />
              <BetButton
                text="BET AI"
                cn="赌 AI"
                onClick={() => onBet("Bet AI")}
              />
              <BetButton
                text="BET MIXED"
                cn="赌混合"
                onClick={() => onBet("Bet Mixed")}
              />
              <BetButton
                text="FOLD"
                cn="放弃这一轮"
                onClick={() => onBet("Fold")}
              />
              <BetButton
                text="I DON'T CARE"
                cn="不在乎"
                onClick={() => onBet("I Don't Care")}
              />
            </div>

            {selectedBet && (
              <ResultBox
                post={post}
                selectedBet={selectedBet}
                roundResult={roundResult}
                onNext={onNext}
              />
            )}
          </aside>
        </div>
      </div>
    </motion.section>
  );
}

function EndPage({ chips, onRestart }) {
  const [societyNotice, setSocietyNotice] = useState(false);
const [isGlitching, setIsGlitching] = useState(false);

  const rewardOptions = [
  {
    title: "ADVANCED HUMAN DETECTION LICENSE",
    cnTitle: "高级真人识别许可证",
    description:
      "You may now enter society with improved suspicion skills.",
    cnDescription:
      "你现在可以带着更强的怀疑能力重新进入社会。",
    status: "approved",
    cnStatus: "已批准",
  },
  {
    title: "PUBLIC DOUBT DEBT",
    cnTitle: "公共怀疑债务",
    description:
      chips < 0
        ? `You owe the platform ${Math.abs(chips)} trust chips. Your negative trust balance will be used for future model improvement.`
        : `The platform found no debt, but your positive balance will still be used for future model improvement.`,
    cnDescription:
      chips < 0
        ? `你欠平台 ${Math.abs(chips)} 个信任筹码。你的负数信任余额将用于未来模型优化。`
        : `平台没有发现债务，但你的正数信任余额仍将用于未来模型优化。`,
    status: "collected",
    cnStatus: "已收集",
  },
  {
    title: "NOTHING HAPPENED BADGE",
    cnTitle: "无事发生徽章",
    description:
      "You completed five rounds. No social ability was improved. No trust was restored. Your data has been received.",
    cnDescription:
      "你完成了五轮。没有社交能力被提升。没有信任被修复。你的数据已被接收。",
    status: "empty reward",
    cnStatus: "空奖励",
  },
  {
    title: "RE-ENTRY PASS TO HUMAN SOCIETY",
    cnTitle: "人类社会再入场券",
    description:
      "This pass does not guarantee trust. This pass does not prove humanity. It only confirms that you participated.",
    cnDescription:
      "此券不保证信任。此券不能证明人类身份。它只证明你参与过。",
    status: "temporary pass",
    cnStatus: "临时通行",
  },
];

  const [reward] = useState(() => {
    return rewardOptions[Math.floor(Math.random() * rewardOptions.length)];
  });

  const balanceText =
    chips < 0 ? `${Math.abs(chips)} TRUST DEBT` : `${chips} TRUST CHIPS`;

  const cnBalanceText =
    chips < 0 ? `${Math.abs(chips)} 个信任债务` : `${chips} 个信任筹码`;

  function handleReturnToSociety() {
  setSocietyNotice(true);
  setIsGlitching(false);

  setTimeout(() => {
    setIsGlitching(true);
  }, 900);

  setTimeout(() => {
    setIsGlitching(false);
    setSocietyNotice(false);
  }, 1900);
}

  return (
    <motion.section
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.35 }}
      className={`relative flex min-h-screen items-center justify-center overflow-hidden bg-[#86c8ff] px-5 pb-12 pt-32 sm:px-8 sm:pt-36 ${
  isGlitching ? "animate-pulse" : ""
}`}
    >
      <div className="absolute left-[-4rem] top-[8rem] h-60 w-60 rounded-full border-[6px] border-[#101010] bg-[#ffed4a]" />
      <div className="absolute right-[-3rem] bottom-[5rem] h-52 w-52 rounded-full border-[6px] border-[#101010] bg-[#c7ff5a]" />
      <div className="absolute bottom-[-5rem] left-[35%] h-40 w-96 rotate-[-8deg] border-[6px] border-[#101010] bg-white" />
      <div className="absolute right-[12%] top-[22%] h-24 w-24 rotate-12 border-[6px] border-[#101010] bg-[#ff4b1f]" />

      {societyNotice && (
  <>
    {isGlitching && (
      <>
        <div className="pointer-events-none fixed inset-0 z-40 bg-[#ff4b1f]/25 mix-blend-multiply" />

        <div className="pointer-events-none fixed left-0 top-[18%] z-50 h-8 w-full rotate-[-2deg] border-y-[4px] border-[#101010] bg-[#e8ff42]" />
        <div className="pointer-events-none fixed left-0 top-[42%] z-50 h-5 w-full rotate-[1deg] border-y-[3px] border-[#101010] bg-white" />
        <div className="pointer-events-none fixed left-0 top-[67%] z-50 h-10 w-full rotate-[-1deg] border-y-[4px] border-[#101010] bg-[#ff4b1f]" />
      </>
    )}

    <div className="pointer-events-none fixed inset-0 z-50 flex items-center justify-center px-5">
      <div
        className={`border-[7px] border-[#101010] bg-white p-5 text-center shadow-[12px_12px_0_#ff4b1f] sm:p-8 ${
          isGlitching ? "rotate-[1deg] scale-105" : "rotate-[-1deg]"
        }`}
      >
        <p className="text-4xl font-black leading-none sm:text-6xl">
          SOCIETY IS CURRENTLY UNDER REVIEW.
        </p>
        <p className="mt-3 text-sm font-bold sm:text-base">
          社会正在审核中。
        </p>
        <p className="mt-5 text-xl font-black leading-tight">
          Please remain outside the screen.
        </p>
        <p className="mt-1 text-xs font-bold">
          请继续停留在屏幕之外。
        </p>
      </div>
    </div>
  </>
)}

      <div
  className={`relative z-10 w-full max-w-6xl transition duration-300 ${
    isGlitching ? "translate-x-1 rotate-[0.4deg] blur-[1px]" : ""
  }`}
>
        <div className="mb-5 inline-block rotate-[-1deg] border-[6px] border-[#101010] bg-[#e8ff42] px-5 py-3 shadow-[8px_8px_0_#101010]">
          <p className="text-4xl font-black leading-none sm:text-6xl">
            TRUST REDEMPTION CENTER
          </p>
          <p className="mt-2 text-sm font-bold">信任兑奖中心</p>
        </div>

        <div className="grid gap-6 lg:grid-cols-[1fr_0.8fr]">
          <div className="border-[7px] border-[#101010] bg-white p-5 shadow-[12px_12px_0_#ff4b1f] sm:p-7">
            <div className="border-[5px] border-[#101010] bg-[#f3dfbd] p-5 shadow-[6px_6px_0_#101010]">
              <p className="text-sm font-black uppercase tracking-wide">
                official reward voucher
              </p>
              <p className="mt-1 text-xs font-bold">官方奖励兑换券</p>

              <div className="my-5 border-t-[4px] border-dashed border-[#101010]" />

              <p className="text-sm font-black uppercase tracking-wide">
  reward unlocked:
</p>
<p className="mt-1 text-xs font-bold">
  奖励已解锁：
</p>

<p className="mt-4 text-5xl font-black leading-none sm:text-7xl">
  {reward.title}
</p>
<p className="mt-3 text-lg font-black leading-tight">
  {reward.cnTitle}
</p>

              <div className="my-6 border-t-[4px] border-dashed border-[#101010]" />

              <p className="text-2xl font-black leading-tight">
                {reward.description}
              </p>
              <p className="mt-2 text-sm font-bold leading-relaxed">
                {reward.cnDescription}
              </p>

              <div className="mt-6 grid gap-3 sm:grid-cols-2">
                <div className="border-[4px] border-[#101010] bg-[#e8ff42] p-4 shadow-[4px_4px_0_#101010]">
                  <p className="text-sm font-black uppercase">
                    final balance
                  </p>
                  <p className="mt-2 text-3xl font-black leading-none">
                    {balanceText}
                  </p>
                  <p className="mt-1 text-xs font-bold">{cnBalanceText}</p>
                </div>

                <div className="border-[4px] border-[#101010] bg-[#ff4b1f] p-4 text-white shadow-[4px_4px_0_#101010]">
                  <p className="text-sm font-black uppercase">
                    reward status
                  </p>
                  <p className="mt-2 text-3xl font-black leading-none">
                    {reward.status}
                  </p>
                  <p className="mt-1 text-xs font-bold">{reward.cnStatus}</p>
                </div>
              </div>
            </div>
          </div>

          <aside className="border-[7px] border-[#101010] bg-[#e8ff42] p-5 shadow-[12px_12px_0_#101010] sm:p-7">
            <p className="text-4xl font-black leading-none">
              YOUR BALANCE IS BEING PROCESSED INTO REAL LIFE.
            </p>
            <p className="mt-3 text-4xl font-black leading-none">
              PLEASE WAIT FOR REVIEW.
            </p>

            <p className="mt-5 text-sm font-bold leading-relaxed">
              您的余额正在处理到现实生活中。请等待审核。
            </p>

            <div className="mt-6 border-[5px] border-[#101010] bg-white p-4 shadow-[5px_5px_0_#101010]">
              <p className="text-xl font-black leading-tight">
                Your judgement has been saved.
              </p>
              <p className="mt-1 text-xs font-bold">你的判断已被保存。</p>
            </div>

            <div className="mt-4 border-[5px] border-[#101010] bg-white p-4 shadow-[5px_5px_0_#101010]">
              <p className="text-xl font-black leading-tight">
                Physical presence was not required.
              </p>
              <p className="mt-1 text-xs font-bold">
                本次流程不需要身体在场。
              </p>
            </div>

            {societyNotice && (
              <div className="mt-4 border-[5px] border-[#101010] bg-[#ff4b1f] p-4 text-white shadow-[5px_5px_0_#101010]">
                <p className="text-2xl font-black leading-tight">
                  SOCIETY IS CURRENTLY UNDER REVIEW.
                </p>
                <p className="mt-1 text-xs font-bold">社会正在审核中。</p>
              </div>
            )}

            <button
              onClick={onRestart}
              className="mt-7 w-full border-[5px] border-[#101010] bg-[#ff4b1f] px-6 py-4 text-2xl font-black text-white shadow-[6px_6px_0_#101010] transition hover:-translate-y-1 hover:shadow-[8px_8px_0_#101010] active:translate-y-1 active:shadow-[3px_3px_0_#101010]"
            >
              PLAY AGAIN
              <p className="mt-1 text-xs font-bold">再玩一次</p>
            </button>

            <button
              onClick={handleReturnToSociety}
              className="mt-4 w-full border-[5px] border-[#101010] bg-white px-6 py-4 text-2xl font-black text-[#101010] shadow-[6px_6px_0_#101010] transition hover:-translate-y-1 hover:shadow-[8px_8px_0_#101010] active:translate-y-1 active:shadow-[3px_3px_0_#101010]"
            >
              RETURN TO SOCIETY
              <p className="mt-1 text-xs font-bold">返回社会</p>
            </button>
          </aside>
        </div>
      </div>
    </motion.section>
  );
}

function PlatformLabel({ post }) {
  if (post.hasLabel) {
    return (
      <div className="border-[4px] border-[#101010] bg-[#ffed4a] px-3 py-2 shadow-[4px_4px_0_#101010]">
        <p className="text-sm font-black">{post.platformLabel}</p>
        <p className="text-xs font-bold">{post.cnPlatformLabel}</p>
      </div>
    );
  }

  return (
    <div className="border-[4px] border-[#101010] bg-[#c7ff5a] px-3 py-2 shadow-[4px_4px_0_#101010]">
      <p className="text-sm font-black">No platform label</p>
      <p className="text-xs font-bold">没有平台标识</p>
    </div>
  );
}

function InfoBadge({ title, cn, color }) {
  return (
    <div
      className={`border-[5px] border-[#101010] ${color} px-4 py-2 shadow-[5px_5px_0_#101010]`}
    >
      <p className="text-xl font-black sm:text-2xl">{title}</p>
      <p className="text-xs font-bold">{cn}</p>
    </div>
  );
}

function ResultBox({ post, selectedBet, roundResult, onNext }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      className="mt-6 border-[5px] border-[#101010] bg-white p-4 shadow-[6px_6px_0_#ff4b1f]"
    >
      <p className="text-2xl font-black">YOUR BET: {selectedBet}</p>

      {roundResult && (
        <div className="mt-4 border-[4px] border-[#101010] bg-[#e8ff42] p-3 shadow-[4px_4px_0_#101010]">
          <p className="text-2xl font-black">
            {roundResult.change > 0 ? "+" : ""}
            {roundResult.change} TRUST CHIPS
          </p>
          <p className="mt-1 text-sm font-black">
            STAKE: {roundResult.stake}
          </p>
          <p className="mt-3 text-lg font-black leading-tight">
            {roundResult.message}
          </p>
          <p className="mt-1 text-xs font-bold leading-relaxed">
            {roundResult.cnMessage}
          </p>
        </div>
      )}

      <p className="mt-1 text-xs font-bold">你的下注已被记录</p>

      <div className="mt-4 border-[4px] border-[#101010] bg-[#f3dfbd] p-3">
        <p className="text-lg font-black">{post.reality}</p>
        <p className="text-xs font-bold">{post.cnReality}</p>
      </div>

      <p className="mt-4 text-lg font-black leading-tight">
        your judgement has been added to the suspicion machine.
      </p>
      <p className="mt-1 text-xs font-bold leading-relaxed">
        你的判断已经被加入怀疑机器。
      </p>

      <button
        onClick={onNext}
        className="mt-5 w-full border-[4px] border-[#101010] bg-[#ff4b1f] px-5 py-3 text-2xl font-black text-white shadow-[4px_4px_0_#101010] transition hover:-translate-y-1"
      >
        NEXT POST
      </button>
    </motion.div>
  );
}

function BetButton({ text, cn, onClick }) {
  return (
    <button
      onClick={onClick}
      className="border-[4px] border-[#101010] bg-[#ff4b1f] px-4 py-4 text-left text-white shadow-[4px_4px_0_#101010] transition hover:-translate-y-1 hover:bg-[#101010] active:translate-y-1 active:shadow-[2px_2px_0_#101010]"
    >
      <p className="text-2xl font-black leading-none">{text}</p>
      <p className="mt-1 text-xs font-bold">{cn}</p>
    </button>
  );
}

function RuleLine({ title, cn }) {
  return (
    <div className="border-[4px] border-[#101010] bg-[#c7ff5a] p-4 shadow-[4px_4px_0_#101010] odd:bg-[#ffed4a]">
      <p className="text-xl font-black leading-tight sm:text-2xl">{title}</p>
      <p className="mt-2 text-xs font-bold leading-snug">{cn}</p>
    </div>
  );
}