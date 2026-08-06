import { StrictMode, useEffect, useRef, useState } from "react";
import { createRoot } from "react-dom/client";
import { supabase } from "./supabase-client.js";
import "./market.css";

const EMPTY_BET_COUNTS = {
  "BET HUMAN": 0,
  "BET AI": 0,
  "BET MIXED": 0,
  FOLD: 0,
  "I DON'T CARE": 0,
};

const OVERVIEW_MIN_DATA_SCALE = 0.5;
const OVERVIEW_MAX_DATA_SCALE = 1.5;
const OVERVIEW_EQUAL_DATA_SCALE = 1;
const TERMINAL_MIN_SCALE = 0.5;
const TERMINAL_MAX_SCALE = 1.4;
const TERMINAL_EQUAL_SCALE = 1;
const OVERVIEW_ACTIONS = [
  "BET HUMAN",
  "BET AI",
  "BET MIXED",
  "FOLD",
  "I DON'T CARE",
];

const CURVE_MIN_AMPLITUDE = 5;
const CURVE_MAX_AMPLITUDE = 24;
const CURVE_SLOW_DURATION = 8;
const CURVE_FAST_DURATION = 2.8;
const CURVE_MIN_WAVE_COUNT = 2.2;
const CURVE_MAX_WAVE_COUNT = 6.4;
const TRANSPORT_MIN_SHAPE_COUNT = 2;
const TRANSPORT_MAX_SHAPE_COUNT = 8;
const MARKET_CURVE_MODES = {
  "BET HUMAN": "smooth",
  "BET AI": "angular",
  "BET MIXED": "hybrid",
  FOLD: "smooth",
  "I DON'T CARE": "angular",
};
const MARKET_CURVE_PHASES = {
  "BET HUMAN": 0,
  "BET AI": 0.9,
  "BET MIXED": 1.8,
  FOLD: 2.7,
  "I DON'T CARE": 3.6,
};

function lerp(minimum, maximum, normalized) {
  const safeNormalized = Number.isFinite(normalized)
    ? Math.min(1, Math.max(0, normalized))
    : 0.5;

  return minimum + (maximum - minimum) * safeNormalized;
}

function getMarketCurveProfile(normalized) {
  return {
    amplitude: lerp(
      CURVE_MIN_AMPLITUDE,
      CURVE_MAX_AMPLITUDE,
      normalized,
    ),
    duration: lerp(
      CURVE_SLOW_DURATION,
      CURVE_FAST_DURATION,
      normalized,
    ),
    waveCount: lerp(
      CURVE_MIN_WAVE_COUNT,
      CURVE_MAX_WAVE_COUNT,
      normalized,
    ),
  };
}

function getTransportShapeCount(normalized) {
  return Math.round(
    lerp(
      TRANSPORT_MIN_SHAPE_COUNT,
      TRANSPORT_MAX_SHAPE_COUNT,
      normalized,
    ),
  );
}

function getActionClassName(action) {
  return action.toLowerCase().replaceAll(" ", "-").replaceAll("'", "");
}

function MarketTransportShape({ action }) {
  if (action === "BET HUMAN") {
    return <circle cx="0" cy="0" r="9" />;
  }

  if (action === "BET AI") {
    return <rect x="-9" y="-9" width="18" height="18" />;
  }

  if (action === "BET MIXED") {
    return <polygon points="-10,-10 11,0 -10,10" />;
  }

  if (action === "FOLD") {
    return <polygon points="10,-10 -11,0 10,10" />;
  }

  return <rect x="-14" y="-7" width="28" height="14" />;
}

function getCurvePointCount(width, waveCount, mode) {
  if (mode === "angular") {
    const angularAnchorCount = Math.round(4 + waveCount * 1.8);
    return Math.min(16, Math.max(7, angularAnchorCount));
  }

  if (mode === "hybrid") {
    const hybridAnchorCount = Math.round(16 + waveCount * 4);
    return Math.min(48, Math.max(24, hybridAnchorCount));
  }

  return Math.max(72, Math.round(width / 10));
}

function getCurvePoints(width, height, profile, timePhase, phaseOffset, mode) {
  const pointCount = getCurvePointCount(width, profile.waveCount, mode);
  const centerY = height / 2;

  return Array.from({ length: pointCount }, (_, index) => {
    const progress = index / (pointCount - 1);
    const x = progress * width;
    const envelope = Math.pow(Math.sin(Math.PI * progress), 0.7);
    const xPhase = progress * Math.PI * 2 * profile.waveCount;
    const primaryWave = Math.sin(xPhase - timePhase + phaseOffset);
    const secondaryWave =
      Math.sin(xPhase * 0.53 - timePhase * 0.72 + phaseOffset * 1.4) * 0.18;
    const rawWave = (primaryWave + secondaryWave) / 1.18;

    return {
      x,
      y: centerY + rawWave * profile.amplitude * envelope,
    };
  });
}

function pointsToSmoothPath(points) {
  if (points.length < 2) return "";

  let path = `M ${points[0].x.toFixed(2)} ${points[0].y.toFixed(2)}`;

  for (let index = 0; index < points.length - 1; index += 1) {
    const previous = points[index - 1] ?? points[index];
    const current = points[index];
    const next = points[index + 1];
    const following = points[index + 2] ?? next;
    const control1X = current.x + (next.x - previous.x) / 6;
    const control1Y = current.y + (next.y - previous.y) / 6;
    const control2X = next.x - (following.x - current.x) / 6;
    const control2Y = next.y - (following.y - current.y) / 6;

    path +=
      ` C ${control1X.toFixed(2)} ${control1Y.toFixed(2)}` +
      `, ${control2X.toFixed(2)} ${control2Y.toFixed(2)}` +
      `, ${next.x.toFixed(2)} ${next.y.toFixed(2)}`;
  }

  return path;
}

function pointsToAngularPath(points) {
  if (points.length < 2) return "";

  return points
    .map((point, index) => {
      const command = index === 0 ? "M" : "L";
      return `${command} ${point.x.toFixed(2)} ${point.y.toFixed(2)}`;
    })
    .join(" ");
}

function pointsToHybridPath(points) {
  if (points.length < 3) return pointsToAngularPath(points);

  const splitIndex = Math.floor(points.length * 0.48);
  let path = pointsToAngularPath(points.slice(0, splitIndex + 1));

  for (let index = splitIndex; index < points.length - 1; index += 1) {
    const previous = points[index - 1] ?? points[index];
    const current = points[index];
    const next = points[index + 1];
    const following = points[index + 2] ?? next;
    const control1X = current.x + (next.x - previous.x) / 6;
    const control1Y = current.y + (next.y - previous.y) / 6;
    const control2X = next.x - (following.x - current.x) / 6;
    const control2Y = next.y - (following.y - current.y) / 6;

    path +=
      ` C ${control1X.toFixed(2)} ${control1Y.toFixed(2)}` +
      `, ${control2X.toFixed(2)} ${control2Y.toFixed(2)}` +
      `, ${next.x.toFixed(2)} ${next.y.toFixed(2)}`;
  }

  return path;
}

function buildMarketCurvePath(
  width,
  height,
  profile,
  timePhase,
  phaseOffset,
  mode,
) {
  const points = getCurvePoints(
    width,
    height,
    profile,
    timePhase,
    phaseOffset,
    mode,
  );

  if (mode === "angular") return pointsToAngularPath(points);
  if (mode === "hybrid") return pointsToHybridPath(points);
  return pointsToSmoothPath(points);
}

function MarketDataCurve({ action, normalized, mode }) {
  const stageRef = useRef(null);
  const svgRef = useRef(null);
  const pathRef = useRef(null);
  const targetNormalizedRef = useRef(normalized);
  const currentNormalizedRef = useRef(normalized);
  const renderStaticCurveRef = useRef(null);
  const transportShapeRefs = useRef([]);

  useEffect(() => {
    targetNormalizedRef.current = Number.isFinite(normalized) ? normalized : 0.5;
    renderStaticCurveRef.current?.();
  }, [normalized]);

  useEffect(() => {
    const stage = stageRef.current;
    const svg = svgRef.current;
    const path = pathRef.current;

    if (!stage || !svg || !path) return undefined;

    let isActive = true;
    let animationFrameId = null;
    let resizeObserver = null;
    let width = 1;
    let height = 1;
    let previousTimestamp = null;
    let timePhase = 0;
    let transportProgress =
      ((MARKET_CURVE_PHASES[action] ?? 0) / (Math.PI * 2)) % 1;
    const phaseOffset = MARKET_CURVE_PHASES[action] ?? 0;
    const reducedMotionQuery = window.matchMedia(
      "(prefers-reduced-motion: reduce)",
    );

    const updateSize = () => {
      const bounds = stage.getBoundingClientRect();
      width = Math.max(1, bounds.width);
      height = Math.max(1, bounds.height);
      svg.setAttribute("viewBox", `0 0 ${width} ${height}`);
    };

    const drawCurve = (profile, phase = timePhase) => {
      if (!isActive || !pathRef.current) return;

      pathRef.current.setAttribute(
        "d",
        buildMarketCurvePath(
          width,
          height,
          profile,
          phase,
          phaseOffset,
          mode,
        ),
      );
    };

    const positionTransportShapes = (profile, delta = 0) => {
      if (!isActive || !pathRef.current) return;

      const activeShapeCount = getTransportShapeCount(
        currentNormalizedRef.current,
      );
      transportProgress =
        (transportProgress + delta / (profile.duration * 1000)) % 1;

      let pathLength = 0;
      try {
        pathLength = pathRef.current.getTotalLength();
      } catch {
        return;
      }

      if (!Number.isFinite(pathLength) || pathLength <= 0) return;

      transportShapeRefs.current.forEach((shape, index) => {
        if (!shape) return;

        if (index >= activeShapeCount) {
          shape.setAttribute("visibility", "hidden");
          return;
        }

        const progress =
          (transportProgress + index / activeShapeCount) % 1;
        const point = pathRef.current.getPointAtLength(progress * pathLength);
        shape.setAttribute("visibility", "visible");
        shape.setAttribute(
          "transform",
          `translate(${point.x.toFixed(2)} ${point.y.toFixed(2)})`,
        );
      });
    };

    const drawReducedMotionCurve = () => {
      if (!reducedMotionQuery.matches) return;

      currentNormalizedRef.current = targetNormalizedRef.current;
      const profile = getMarketCurveProfile(currentNormalizedRef.current);
      drawCurve(profile, 0);
      positionTransportShapes(profile);
    };

    renderStaticCurveRef.current = drawReducedMotionCurve;
    updateSize();

    if (typeof ResizeObserver === "function") {
      resizeObserver = new ResizeObserver(() => {
        updateSize();
        if (reducedMotionQuery.matches) {
          drawReducedMotionCurve();
        }
      });
      resizeObserver.observe(stage);
    } else {
      window.addEventListener("resize", updateSize);
    }

    if (reducedMotionQuery.matches) {
      drawReducedMotionCurve();
    } else {
      const animate = (timestamp) => {
        if (!isActive) return;

        const delta = previousTimestamp === null
          ? 0
          : Math.min(64, timestamp - previousTimestamp);
        previousTimestamp = timestamp;
        currentNormalizedRef.current +=
          (targetNormalizedRef.current - currentNormalizedRef.current) * 0.04;

        const profile = getMarketCurveProfile(currentNormalizedRef.current);
        timePhase += (delta / (profile.duration * 1000)) * Math.PI * 2;
        drawCurve(profile);
        positionTransportShapes(profile, delta);
        animationFrameId = window.requestAnimationFrame(animate);
      };

      animationFrameId = window.requestAnimationFrame(animate);
    }

    return () => {
      isActive = false;
      renderStaticCurveRef.current = null;
      if (animationFrameId !== null) {
        window.cancelAnimationFrame(animationFrameId);
      }
      resizeObserver?.disconnect();
      if (!resizeObserver) {
        window.removeEventListener("resize", updateSize);
      }
    };
  }, [action, mode]);

  return (
    <div className="market-curve-stage" ref={stageRef}>
      <svg
        className="market-curve-svg"
        ref={svgRef}
        preserveAspectRatio="none"
        role="img"
        aria-label={`${action} dynamic data curve`}
      >
        <path
          className={`market-curve-path market-curve-path-${getActionClassName(
            action,
          )}`}
          ref={pathRef}
        />
        <g
          className={`market-transport-layer market-transport-layer-${getActionClassName(
            action,
          )}`}
          aria-hidden="true"
        >
          {Array.from({ length: TRANSPORT_MAX_SHAPE_COUNT }, (_, index) => (
            <g
              className={`market-transport-shape market-transport-shape-${getActionClassName(
                action,
              )}`}
              key={index}
              ref={(node) => {
                transportShapeRefs.current[index] = node;
              }}
              visibility="hidden"
            >
              <MarketTransportShape action={action} />
            </g>
          ))}
        </g>
      </svg>
    </div>
  );
}

function getMarketComparison(betCounts) {
  const safeCounts = OVERVIEW_ACTIONS.map((action) => {
    const value = betCounts[action];

    return Number.isFinite(value) ? Math.max(0, value) : 0;
  });
  const minimumCount = Math.min(...safeCounts);
  const maximumCount = Math.max(...safeCounts);

  if (maximumCount === minimumCount) {
    return {
      allCountsEqual: true,
      maximumCount,
      minimumCount,
      normalizedMap: Object.fromEntries(
        OVERVIEW_ACTIONS.map((action) => [action, 0.5]),
      ),
    };
  }

  return {
    allCountsEqual: false,
    maximumCount,
    minimumCount,
    normalizedMap: Object.fromEntries(
      OVERVIEW_ACTIONS.map((action, index) => [
        action,
        (safeCounts[index] - minimumCount) / (maximumCount - minimumCount),
      ]),
    ),
  };
}

function mapNormalizedToOverviewScale(normalized) {
  const safeNormalized = Number.isFinite(normalized)
    ? Math.min(1, Math.max(0, normalized))
    : 0.5;

  return (
    OVERVIEW_MIN_DATA_SCALE +
    safeNormalized * (OVERVIEW_MAX_DATA_SCALE - OVERVIEW_MIN_DATA_SCALE)
  );
}

function mapNormalizedToTerminalScale(normalized) {
  const safeNormalized = Number.isFinite(normalized)
    ? Math.min(1, Math.max(0, normalized))
    : 0.5;

  return (
    TERMINAL_MIN_SCALE +
    safeNormalized * (TERMINAL_MAX_SCALE - TERMINAL_MIN_SCALE)
  );
}

function getScaleMap(marketComparison, mapScale, equalScale) {
  if (marketComparison.allCountsEqual) {
    return Object.fromEntries(
      OVERVIEW_ACTIONS.map((action) => [action, equalScale]),
    );
  }

  return Object.fromEntries(
    OVERVIEW_ACTIONS.map((action) => [
      action,
      mapScale(marketComparison.normalizedMap[action]),
    ]),
  );
}

function OverviewShape({ action }) {
  if (action === "BET HUMAN") {
    return (
      <div
        className="market-overview-shape market-overview-shape-human"
        aria-hidden="true"
      />
    );
  }

  if (action === "BET AI") {
    return (
      <div
        className="market-overview-shape market-overview-shape-ai"
        aria-hidden="true"
      />
    );
  }

  if (action === "BET MIXED") {
    return (
      <svg
        className="market-overview-shape market-overview-shape-mixed"
        viewBox="0 0 100 116"
        preserveAspectRatio="xMidYMid meet"
        aria-hidden="true"
      >
        <polygon points="3,4 96.53,58 3,112" />
      </svg>
    );
  }

  if (action === "FOLD") {
    return (
      <svg
        className="market-overview-shape market-overview-shape-fold"
        viewBox="0 0 100 116"
        preserveAspectRatio="xMidYMid meet"
        aria-hidden="true"
      >
        <polygon
          points="3,4 96.53,58 3,112"
          transform="translate(100 0) scale(-1 1)"
        />
      </svg>
    );
  }

  return (
    <div
      className="market-overview-shape market-overview-shape-dont-care"
      aria-hidden="true"
    />
  );
}

function OverviewItems({
  betCounts,
  countsAreReady,
  overviewScaleMap,
  duplicate = false,
}) {
  return OVERVIEW_ACTIONS.map((action) => {
    const count = betCounts[action] ?? 0;
    const overviewDataScale = overviewScaleMap[action] ?? 1;

    return (
      <div
        className="market-overview-item"
        key={`${duplicate ? "duplicate" : "primary"}-${action}`}
      >
        <div className="market-overview-shape-stage">
          <div
            className={`market-overview-scale-shell${countsAreReady ? " is-data-ready" : ""}`}
            style={{
              "--overview-data-scale": overviewDataScale,
            }}
          >
            <OverviewShape action={action} />
          </div>
        </div>
        <strong className="market-overview-count">
          {countsAreReady ? `${count} BETS` : "— BETS"}
        </strong>
      </div>
    );
  });
}

function TerminalScaleShell({ action, terminalScaleMap, children }) {
  return (
    <div className="market-terminal-stage">
      <div
        className="market-terminal-scale-shell"
        style={{
          "--terminal-data-scale": terminalScaleMap[action] ?? 1,
        }}
      >
        {children}
      </div>
    </div>
  );
}

let betCountsRequest = null;
let marketSessionRequest = null;

function ensureMarketSession() {
  if (!marketSessionRequest) {
    marketSessionRequest = (async () => {
      if (!supabase) {
        throw new Error(
          "Supabase session initialization could not start because the client is unavailable.",
        );
      }

      const {
        data: { session },
        error: getSessionError,
      } = await supabase.auth.getSession();

      if (getSessionError) {
        console.error("Supabase market getSession failed:", getSessionError);
        throw getSessionError;
      }

      if (session) {
        return session;
      }

      const {
        data: { session: anonymousSession },
        error: signInError,
      } = await supabase.auth.signInAnonymously();

      if (signInError) {
        console.error(
          "Supabase market anonymous sign-in failed:",
          signInError,
        );
        throw signInError;
      }

      if (!anonymousSession) {
        const missingSessionError = new Error(
          "Supabase anonymous sign-in completed without a session.",
        );
        console.error(
          "Supabase market anonymous sign-in failed:",
          missingSessionError,
        );
        throw missingSessionError;
      }

      return anonymousSession;
    })();
  }

  return marketSessionRequest;
}

function loadBetCounts() {
  if (!betCountsRequest) {
    betCountsRequest = (async () => {
      if (!supabase) {
        throw new Error(
          "Supabase bet counts query could not start because the client is unavailable.",
        );
      }

      await ensureMarketSession();

      const { data, error } = await supabase
        .from("bets")
        .select("selected_action");

      if (error) {
        throw error;
      }

      const nextCounts = { ...EMPTY_BET_COUNTS };
      const unknownActions = new Set();

      for (const row of data ?? []) {
        const action = row?.selected_action;

        if (Object.prototype.hasOwnProperty.call(nextCounts, action)) {
          nextCounts[action] += 1;
        } else {
          unknownActions.add(action);
        }
      }

      if (unknownActions.size > 0) {
        console.warn(
          "Supabase bets contained unknown selected_action values; these rows were ignored:",
          [...unknownActions],
        );
      }

      return nextCounts;
    })();
  }

  return betCountsRequest;
}

export function MarketScreen() {
  const [betCounts, setBetCounts] = useState(() => ({ ...EMPTY_BET_COUNTS }));
  const [isLoadingCounts, setIsLoadingCounts] = useState(true);
  const [countsError, setCountsError] = useState(null);
  const [overviewGroupWidth, setOverviewGroupWidth] = useState(0);
  const overviewGroupRef = useRef(null);

  useEffect(() => {
    let isActive = true;

    loadBetCounts()
      .then((nextCounts) => {
        if (!isActive) return;
        setBetCounts(nextCounts);
        setCountsError(null);
        setIsLoadingCounts(false);
      })
      .catch((error) => {
        console.error("Supabase bet counts query failed:", error);
        if (!isActive) return;
        setCountsError(error);
        setIsLoadingCounts(false);
      });

    return () => {
      isActive = false;
    };
  }, []);

  useEffect(() => {
    const group = overviewGroupRef.current;
    if (!group) return undefined;

    const measureGroup = () => {
      const nextWidth = group.offsetWidth;
      if (nextWidth > 0) {
        setOverviewGroupWidth((currentWidth) =>
          currentWidth === nextWidth ? currentWidth : nextWidth,
        );
      }
    };

    measureGroup();

    if (typeof ResizeObserver === "undefined") return undefined;

    const observer = new ResizeObserver(measureGroup);
    observer.observe(group);

    return () => observer.disconnect();
  }, []);

  const countsAreReady = !isLoadingCounts && !countsError;
  const marketComparison = getMarketComparison(
    countsAreReady ? betCounts : EMPTY_BET_COUNTS,
  );
  const marketNormalizedMap = marketComparison.normalizedMap;
  const overviewScaleMap = countsAreReady
    ? getScaleMap(
        marketComparison,
        mapNormalizedToOverviewScale,
        OVERVIEW_EQUAL_DATA_SCALE,
      )
    : Object.fromEntries(OVERVIEW_ACTIONS.map((action) => [action, 1]));
  const terminalScaleMap = countsAreReady
    ? getScaleMap(
        marketComparison,
        mapNormalizedToTerminalScale,
        TERMINAL_EQUAL_SCALE,
      )
    : Object.fromEntries(OVERVIEW_ACTIONS.map((action) => [action, 1]));
  const overviewTickerDuration =
    overviewGroupWidth > 0 ? overviewGroupWidth / 42 : 24;

  return (
    <main className="market-page">
      <nav className="market-top-nav" aria-label="Market navigation">
        <div className="market-logo">WHO MADE IT?</div>
      </nav>

      <div className="market-main">
        <aside className="market-sidebar">
          <div className="market-sidebar-heading">
            <span>A? CASINO:</span>
            <strong>
              WHO
              <br />
              MADE
              <br />
              IT?
              <br />
              MARKET
            </strong>
          </div>

          <div className="market-sidebar-cn-title">
            ？赌场
            <br />
            谁整的？市场
          </div>

          <div className="market-live-status">
            <strong>
              <span className="market-live-dot" aria-hidden="true" /> LIVE
            </strong>
            <span>实时数据</span>
          </div>

          <p className="market-sidebar-statement">
            ALL BETS ARE
            <br />
            ANONYMOUS.
            <br />
            ALL JUDGEMENTS
            <br />
            FEED THE MARKET.
            <span>
              所有下注均匿名。
              <br />
              所有判断将汇入市场。
            </span>
          </p>
        </aside>
        <section className="market-visual-area" aria-label="Market lanes">
          <div className="market-lanes">
            <article className="market-lane market-lane-human">
              <div className="market-lane-label">
                <strong>BET HUMAN</strong>
                <span>赌人类</span>
              </div>
              <div className="market-track-wrap">
                <MarketDataCurve
                  action="BET HUMAN"
                  normalized={marketNormalizedMap["BET HUMAN"] ?? 0.5}
                  mode={MARKET_CURVE_MODES["BET HUMAN"]}
                />
              </div>
              <div className="market-pool-space" aria-hidden="true">
                <div className="market-pool-clip">
                  <TerminalScaleShell
                    action="BET HUMAN"
                    terminalScaleMap={terminalScaleMap}
                  >
                    <div className="market-pool-shape market-pool-human" />
                  </TerminalScaleShell>
                </div>
              </div>
            </article>

            <article className="market-lane market-lane-ai">
              <div className="market-lane-label">
                <strong>BET AI</strong>
                <span>赌 AI</span>
              </div>
              <div className="market-track-wrap">
                <MarketDataCurve
                  action="BET AI"
                  normalized={marketNormalizedMap["BET AI"] ?? 0.5}
                  mode={MARKET_CURVE_MODES["BET AI"]}
                />
              </div>
              <div className="market-pool-space" aria-hidden="true">
                <div className="market-pool-clip">
                  <TerminalScaleShell
                    action="BET AI"
                    terminalScaleMap={terminalScaleMap}
                  >
                    <div className="market-pool-shape market-pool-ai" />
                  </TerminalScaleShell>
                </div>
              </div>
            </article>

            <article className="market-lane market-lane-mixed">
              <div className="market-lane-label">
                <strong>BET MIXED</strong>
                <span>赌混合</span>
              </div>
              <div className="market-track-wrap">
                <MarketDataCurve
                  action="BET MIXED"
                  normalized={marketNormalizedMap["BET MIXED"] ?? 0.5}
                  mode={MARKET_CURVE_MODES["BET MIXED"]}
                />
              </div>
              <div className="market-pool-space" aria-hidden="true">
                <div className="market-pool-clip">
                  <TerminalScaleShell
                    action="BET MIXED"
                    terminalScaleMap={terminalScaleMap}
                  >
                    <svg
                      className="market-pool-shape market-pool-mixed"
                      viewBox="0 0 100 116"
                      preserveAspectRatio="xMidYMid meet"
                    >
                      <polygon points="3,4 96.53,58 3,112" />
                    </svg>
                  </TerminalScaleShell>
                </div>
              </div>
            </article>

            <article className="market-lane market-lane-fold">
              <div className="market-lane-label">
                <strong>FOLD</strong>
                <span>放弃这一轮</span>
              </div>
              <div className="market-track-wrap">
                <MarketDataCurve
                  action="FOLD"
                  normalized={marketNormalizedMap.FOLD ?? 0.5}
                  mode={MARKET_CURVE_MODES.FOLD}
                />
              </div>
              <div className="market-pool-space" aria-hidden="true">
                <div className="market-pool-clip">
                  <TerminalScaleShell
                    action="FOLD"
                    terminalScaleMap={terminalScaleMap}
                  >
                    <svg
                      className="market-pool-shape market-pool-fold"
                      viewBox="0 0 100 116"
                      preserveAspectRatio="xMidYMid meet"
                    >
                      <polygon points="97,4 3.47,58 97,112" />
                    </svg>
                  </TerminalScaleShell>
                </div>
              </div>
            </article>

            <article className="market-lane market-lane-dont-care">
              <div className="market-lane-label">
                <strong>I DON'T CARE</strong>
                <span>不在乎</span>
              </div>
              <div className="market-track-wrap">
                <MarketDataCurve
                  action="I DON'T CARE"
                  normalized={marketNormalizedMap["I DON'T CARE"] ?? 0.5}
                  mode={MARKET_CURVE_MODES["I DON'T CARE"]}
                />
              </div>
              <div className="market-pool-space" aria-hidden="true">
                <div className="market-pool-clip">
                  <TerminalScaleShell
                    action="I DON'T CARE"
                    terminalScaleMap={terminalScaleMap}
                  >
                    <div className="market-pool-shape market-pool-dont-care" />
                  </TerminalScaleShell>
                </div>
              </div>
            </article>
          </div>
        </section>
      </div>

      <section className="market-overview">
        <header className="market-overview-heading">
          <h2>
            MARKET OVERVIEW
            <span>市场总览（实时更新）</span>
          </h2>
        </header>

        <div className="market-overview-viewport">
          <div
            className={`market-overview-ticker${overviewGroupWidth > 0 ? " is-ready" : ""}`}
            style={{
              "--overview-cycle-width": `${overviewGroupWidth}px`,
              "--overview-ticker-duration": `${overviewTickerDuration}s`,
            }}
          >
            <div className="market-overview-group" ref={overviewGroupRef}>
              <OverviewItems
                betCounts={betCounts}
                countsAreReady={countsAreReady}
                overviewScaleMap={overviewScaleMap}
              />
            </div>
            <div className="market-overview-group" aria-hidden="true">
              <OverviewItems
                betCounts={betCounts}
                countsAreReady={countsAreReady}
                overviewScaleMap={overviewScaleMap}
                duplicate
              />
            </div>
            <div className="market-overview-group" aria-hidden="true">
              <OverviewItems
                betCounts={betCounts}
                countsAreReady={countsAreReady}
                overviewScaleMap={overviewScaleMap}
                duplicate
              />
            </div>
          </div>
        </div>

        <div className="market-overview-feed">
          <span aria-hidden="true">—</span>
          <strong>LIVE FEED — PUBLIC JUDGEMENTS POWER THE MARKET</strong>
          <span>实时信息流 — 公众判断推动市场</span>
          <span aria-hidden="true">→</span>
        </div>
      </section>
      <footer className="market-legend" aria-label="Market action legend">
        <div className="market-legend-list">
          <div className="market-legend-item"><div className="market-legend-shape market-legend-shape-human" aria-hidden="true" /><div className="market-legend-copy"><strong className="market-legend-en">BET HUMAN</strong><span className="market-legend-cn">赌人类</span></div></div>
          <div className="market-legend-item"><div className="market-legend-shape market-legend-shape-ai" aria-hidden="true" /><div className="market-legend-copy"><strong className="market-legend-en">BET AI</strong><span className="market-legend-cn">赌 AI</span></div></div>
          <div className="market-legend-item"><svg className="market-legend-shape market-legend-shape-mixed" viewBox="0 0 64 64" preserveAspectRatio="xMidYMid meet" aria-hidden="true"><polygon points="8,4 59.96,32 8,60" /></svg><div className="market-legend-copy"><strong className="market-legend-en">BET MIXED</strong><span className="market-legend-cn">赌混合</span></div></div>
          <div className="market-legend-item"><svg className="market-legend-shape market-legend-shape-fold" viewBox="0 0 64 64" preserveAspectRatio="xMidYMid meet" aria-hidden="true"><polygon points="8,4 59.96,32 8,60" transform="translate(64 0) scale(-1 1)" /></svg><div className="market-legend-copy"><strong className="market-legend-en">FOLD</strong><span className="market-legend-cn">放弃这一轮</span></div></div>
          <div className="market-legend-item"><div className="market-legend-shape market-legend-shape-dont-care" aria-hidden="true" /><div className="market-legend-copy"><strong className="market-legend-en">I DON'T CARE</strong><span className="market-legend-cn">不在乎</span></div></div>
        </div>
      </footer>
    </main>
  );
}

createRoot(document.getElementById("root")).render(
  <StrictMode>
    <MarketScreen />
  </StrictMode>,
);
