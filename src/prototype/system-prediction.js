const MARKET_RESULTS = {
  "BUY DOUBT": {
    en: "AI Suspicion rises. Public Trust falls.",
    cn: "AI 怀疑上升。公众信任下降。",
  },
  "SELL TRUST": {
    en: "Trust value is liquidated. The market becomes less stable.",
    cn: "信任价值被清算。市场变得更加不稳定。",
  },
  "SHORT HUMAN ORIGINALITY": {
    en: "Human originality is under pressure.",
    cn: "人类原创性正承受压力。",
  },
  "SUPPORT APPEAL": {
    en: "Appeal activity is recorded. Resistance is also processed as data.",
    cn: "申诉活动已被记录。抵抗同样会被处理为数据。",
  },
};

export function getLatestMarketResult(state) {
  return (
    MARKET_RESULTS[state.logs[0]?.action] ?? {
      en: "The market is open. Audience judgement data is waiting to be processed.",
      cn: "市场已开放。观众判断数据正在等待处理。",
    }
  );
}

export function getSidePredictions(state) {
  const latestAction = state.logs[0]?.action;
  const humanMessages = [];
  const humanCnMessages = [];
  const platformMessages = [];
  const platformCnMessages = [];

  if (state.indices.publicTrust <= 40) {
    humanMessages.push(
      "Public trust is falling. Human-made claims may require more proof.",
    );
    humanCnMessages.push("公众信任正在下降。人类创作声明可能需要更多证明。");
  }

  if (state.indices.humanOriginality <= 40) {
    humanMessages.push(
      "Human originality is under pressure. Creator testimony becomes less stable.",
    );
    humanCnMessages.push("人类原创性正承受压力。创作者证词变得更不稳定。");
  }

  if (state.indices.aiSuspicion >= 70) {
    platformMessages.push(
      "Suspicion is expanding. More content may be treated as potentially AI-generated.",
    );
    platformCnMessages.push(
      "怀疑正在扩张。更多内容可能会被视为潜在的 AI 生成内容。",
    );
  }

  if (state.indices.platformAuthority >= 70) {
    platformMessages.push(
      "Platform authority is increasing. Repeated audience judgement strengthens the system.",
    );
    platformCnMessages.push(
      "平台权威正在增强。重复的观众判断让系统变得更强。",
    );
  }

  if (latestAction === "SUPPORT APPEAL") {
    platformMessages.push(
      "Appeal activity has been recorded. Resistance is also processed as data.",
    );
    platformCnMessages.push("申诉活动已被记录。抵抗同样会被处理为数据。");
  }

  if (humanMessages.length === 0) {
    humanMessages.push(
      "Human creators remain tradable. Trust waits for the next audience judgement.",
    );
    humanCnMessages.push("人类创作者仍可被交易。信任等待下一次观众判断。");
  }

  if (platformMessages.length === 0) {
    platformMessages.push(
      "Platform suspicion is waiting. Authority requires more audience input.",
    );
    platformCnMessages.push("平台怀疑正在等待。权威需要更多观众输入。");
  }

  const humanSide = {
    en: humanMessages.join(" "),
    cn: humanCnMessages.join(""),
  };
  const platformSide = {
    en: platformMessages.join(" "),
    cn: platformCnMessages.join(""),
  };

  return { humanSide, platformSide };
}
