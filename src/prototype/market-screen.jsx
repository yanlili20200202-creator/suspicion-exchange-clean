import {
  StrictMode,
  useEffect,
  useRef,
  useState,
  useSyncExternalStore,
} from "react";
import { createRoot } from "react-dom/client";
import {
  clearMarketState,
  getSnapshot,
  resetMarketState,
  restoreMarketState,
  subscribe,
} from "./suspicion-store";
import {
  getLatestMarketResult,
  getSidePredictions,
} from "./system-prediction";
import {
  calculateTodayTrustChipsFlow,
  clearExhibitionData,
  downloadExhibitionBackup,
  importExhibitionBackup,
} from "./exhibition-data-store.js";
import "./prototype.css";

const indexDefinitions = [
  {
    key: "humanOriginality",
    en: "Human Originality Index",
    cn: "人类原创性指数",
  },
  { key: "aiSuspicion", en: "AI Suspicion Index", cn: "AI 怀疑指数" },
  { key: "publicTrust", en: "Public Trust Index", cn: "公众信任指数" },
  { key: "appealFailure", en: "Appeal Failure Rate", cn: "申诉失败率" },
  { key: "platformAuthority", en: "Platform Authority", cn: "平台权威" },
];

const actionSentences = {
  "BUY DOUBT": { en: "Bet Human", cn: "赌人类" },
  "SELL TRUST": { en: "Bet AI", cn: "赌 AI" },
  "SHORT HUMAN ORIGINALITY": {
    en: "Bet Mixed",
    cn: "赌混合",
  },
  "SUPPORT APPEAL": { en: "Fold", cn: "放弃这一轮" },
  "I DON'T CARE": { en: "I Don't Care", cn: "不在乎" },
};

const trustChipsFlowTranslations = {
  "Buy Doubt": {
    poolName: "买入怀疑池",
    message:
      "大多数信任筹码正在流向怀疑。猜疑正成为最强的市场力量。",
  },
  "Sell Trust": {
    poolName: "卖出信任池",
    message: "大多数信任筹码正在离开信任。公众信任正被清算。",
  },
  "Short Human Originality": {
    poolName: "做空人类原创性池",
    message:
      "大多数信任筹码正在押注人类原创性的下跌。创作者证言正承受市场压力。",
  },
  "Support Appeal": {
    poolName: "支持申诉池",
    message:
      "大多数信任筹码正在进入申诉支持。抵抗清晰可见，但仍被处理为数据。",
  },
};

export function MarketScreen() {
  const state = useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
  const [time, setTime] = useState(() => new Date());
  const importInputRef = useRef(null);
  const marketResult = getLatestMarketResult(state);
  const predictions = getSidePredictions(state);
  const trustChipsFlow = calculateTodayTrustChipsFlow();
  const highestTrustChipsTotal = Math.max(
    0,
    ...trustChipsFlow.pools.map((pool) => pool.totalChips),
  );

  useEffect(() => {
    const timer = window.setInterval(() => setTime(new Date()), 1000);
    return () => window.clearInterval(timer);
  }, []);

  async function importBackup(event) {
    const file = event.target.files?.[0];
    if (!file) return;

    try {
      const backup = JSON.parse(await file.text());
      const importedData = importExhibitionBackup(backup);
      restoreMarketState(importedData.marketPrototype);
      window.alert("Import complete. / 导入完成。");
    } catch {
      window.alert("Import failed. Check the backup file. / 导入失败，请检查备份文件。");
    } finally {
      event.target.value = "";
    }
  }

  function clearAllData() {
    const confirmed = window.confirm(
      "Clear all accounts, bets, sessions and market data? This cannot be undone.\n清除所有账户、下注、每日记录和市场数据？此操作无法撤销。",
    );
    if (!confirmed) return;

    clearExhibitionData();
    clearMarketState();
  }

  return (
    <main className="market-page">
      <header className="exchange-header">
        <div className="exchange-logo">
          SUSPICION MARKET
          <span className="cn-line">怀疑市场</span>
          <p className="market-subtitle">
            Each bet is processed. The indexes show changes in suspicion,
            trust, and platform authority.
            <span className="cn-line">
              每次下注都会被系统处理。指数显示怀疑、信任和平台权威的变化。
            </span>
          </p>
        </div>
        <div className="market-clock">
          Audience judgements processing
          <span className="cn-line">观众判断处理中</span>
          {time.toLocaleTimeString("en-GB")}
        </div>
      </header>

      <div className="market-content">
        <section className="warning-box" aria-live="polite">
          <strong>
            MARKET REACTION
            <span className="cn-line">市场反应</span>
          </strong>
          <p>
            {marketResult.en}
            <span className="cn-line">{marketResult.cn}</span>
          </p>
        </section>

        <section className="index-list" aria-label="Market indices">
          {indexDefinitions.map((definition) => (
            <div className="index-row" key={definition.key}>
              <span className="index-name">
                {definition.en}
                <span className="cn-line">{definition.cn}</span>
              </span>
              <span className="index-value">
                {state.indices[definition.key]}
              </span>
              <div className="index-track" aria-hidden="true">
                <div
                  className="index-fill"
                  style={{ width: `${state.indices[definition.key]}%` }}
                />
              </div>
            </div>
          ))}
        </section>

        <section className="panel market-section" hidden>
          <h2 className="panel-title">
            Market movement
            <span className="cn-line">市场波动</span>
          </h2>
          <div className="movement-board" aria-label="Recent market movement">
            {state.movement.map((value, index) => (
              <div
                className="movement-bar"
                key={`${index}-${value}`}
                style={{ height: `${value}%` }}
                title={`${value}`}
              />
            ))}
          </div>
        </section>

        <section className="panel market-section" hidden>
          <h2 className="panel-title">
            TRUST CHIPS FLOW
            <span className="cn-line">信任筹码流向</span>
          </h2>
          <ul className="log-list trust-chips-flow-list">
            {trustChipsFlow.pools.map((pool) => {
              const isLeadingPool =
                trustChipsFlow.leadingPool?.actionType === pool.actionType;
              const relativeWidth =
                highestTrustChipsTotal > 0
                  ? (pool.totalChips / highestTrustChipsTotal) * 100
                  : 0;

              return (
                <li
                  className={`log-item trust-chips-pool${isLeadingPool ? " trust-chips-pool-leading" : ""}`}
                  key={pool.actionType}
                >
                  <span className="trust-chips-pool-label">
                    {pool.poolName}: {pool.totalChips} Trust Chips /{" "}
                    {pool.betCount} {pool.betCount === 1 ? "bet" : "bets"}
                    <span className="cn-line">
                      {trustChipsFlowTranslations[pool.actionType].poolName}：
                      {pool.totalChips} 信任筹码 / {pool.betCount} 次下注
                    </span>
                  </span>
                  <div
                    aria-label={`${pool.poolName}: ${pool.totalChips} Trust Chips`}
                    aria-valuemax={highestTrustChipsTotal}
                    aria-valuemin="0"
                    aria-valuenow={pool.totalChips}
                    className="trust-chips-track"
                    role="progressbar"
                  >
                    <div
                      className="trust-chips-fill"
                      style={{ width: `${relativeWidth}%` }}
                    />
                  </div>
                </li>
              );
            })}
          </ul>
          {trustChipsFlow.leadingPoolMessage && (
            <p className="trust-chips-leading-message">
              {trustChipsFlow.leadingPoolMessage}
              <span className="cn-line">
                {
                  trustChipsFlowTranslations[
                    trustChipsFlow.leadingPool.actionType
                  ].message
                }
              </span>
            </p>
          )}
        </section>

        <section className="panel market-section">
          <h2 className="panel-title">
            Latest Judgement Processed
            <span className="cn-line">最新处理的判断</span>
          </h2>
          <ul className="log-list">
            {state.logs.slice(0, 1).map((log) => {
              const actionSentence = actionSentences[log.action];

              return (
                <li className="log-item" key={log.id}>
                  <span className="log-action">
                    [{log.time}]{" "}
                    {log.accountNumber && actionSentence
                      ? `${log.accountNumber}: ${actionSentence.en}`
                      : log.action}
                    <span className="cn-line">
                      {log.accountNumber && actionSentence
                        ? `${log.accountNumber}：${actionSentence.cn}`
                        : log.cnAction}
                    </span>
                  </span>
                  {log.accountNumber && (
                    <span className="log-audience">
                      {log.nickname} · {log.caseNumber}
                      <span className="cn-line">
                        昵称：{log.nickname} ·{" "}
                        {log.caseNumber?.replace("Case", "案例")}
                      </span>
                    </span>
                  )}
                  <span className="log-change">
                    {log.change}
                    <span className="cn-line">{log.cnChange}</span>
                  </span>
                </li>
              );
            })}
          </ul>
        </section>

        <section className="panel prediction" hidden>
          <div className="prediction-heading">
            <h2>
              System Prediction
              <span className="cn-line">系统预测</span>
            </h2>
            <p>
              Forecast generated from the current market indices and latest
              audience action. This is a system output, not an authorship verdict.
              <span className="cn-line">
                预测根据当前市场指数和最新观众操作生成。这是系统输出，并非作者身份裁决。
              </span>
            </p>
          </div>
          <div className="prediction-primary">
            <span>
              Current direction
              <span className="cn-line">当前走向</span>
            </span>
            <strong>{state.prediction}</strong>
          </div>
          <div className="prediction-sides">
            <article className="prediction-side">
              <h2>
                Human Creators / Trust Side
                <span className="cn-line">人类创作者 / 信任侧</span>
              </h2>
              <p className="prediction-scope">
                Human creators · Human originality · Public trust
                <span className="cn-line">
                  人类创作者 · 人类原创性 · 公众信任
                </span>
              </p>
              <p>
                {predictions.humanSide.en}
                <span className="cn-line">{predictions.humanSide.cn}</span>
              </p>
            </article>

            <article className="prediction-side">
              <h2>
                Platform Suspicion / Authority Side
                <span className="cn-line">平台怀疑 / 权威侧</span>
              </h2>
              <p className="prediction-scope">
                AI suspicion · Platform authority · Appeal failure
                <span className="cn-line">
                  AI 怀疑 · 平台权威 · 申诉失败
                </span>
              </p>
              <p>
                {predictions.platformSide.en}
                <span className="cn-line">{predictions.platformSide.cn}</span>
              </p>
            </article>
          </div>
        </section>

        <div className="market-utility-actions">
          <div className="export-action-group">
            <button
              className="action-button export-backup-button"
              onClick={() => downloadExhibitionBackup(state)}
              type="button"
            >
              Export exhibition backup
              <span className="cn-line">导出展览备份</span>
            </button>
            <p className="export-privacy-note">
              Exported data only keeps account numbers. Nicknames are removed
              for privacy.
              <span className="cn-line">
                导出的数据只保留账户编号。昵称会为了隐私被移除。
              </span>
            </p>
          </div>
          <button
            className="action-button export-backup-button"
            onClick={() => importInputRef.current?.click()}
            type="button"
          >
            Import data
            <span className="cn-line">导入数据</span>
          </button>
          <input
            accept="application/json,.json"
            className="data-import-input"
            onChange={importBackup}
            ref={importInputRef}
            type="file"
          />
          <button
            className="action-button"
            onClick={() => resetMarketState()}
            type="button"
          >
            Reset market state
            <span className="cn-line">重置市场状态</span>
          </button>
          <button
            className="action-button clear-data-button"
            onClick={clearAllData}
            type="button"
          >
            Clear data
            <span className="cn-line">清除全部数据</span>
          </button>
        </div>
      </div>
    </main>
  );
}

createRoot(document.getElementById("root")).render(
  <StrictMode>
    <MarketScreen />
  </StrictMode>,
);
