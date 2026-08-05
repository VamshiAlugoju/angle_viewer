import { useCallback, useEffect, useMemo, useState } from "react";
import { api, type GreekRow, type Instrument, type PositionContract, type QuoteRow } from "../api/client";
import { OptionChainTable, type ChainRow } from "../components/OptionChainTable";
import { BasketBuilder, type BasketLeg } from "../components/BasketBuilder";
import { HistoricalData } from "../components/HistoricalData";
import type { PositionsApi } from "../usePositions";

type ExpiryType = "WEEKLY" | "MONTHLY";

const REFRESH_MS = 20_000; // stay well under SmartAPI's rate limits

const INDEX_DEFS = [
  { key: "NIFTY", label: "NIFTY 50", optionExchange: "NFO", spotSymbol: "Nifty 50" },
  { key: "BANKNIFTY", label: "BANK NIFTY", optionExchange: "NFO", spotSymbol: "Nifty Bank" },
  { key: "FINNIFTY", label: "FIN NIFTY", optionExchange: "NFO", spotSymbol: "Nifty Fin Service" },
  { key: "MIDCPNIFTY", label: "MIDCAP NIFTY", optionExchange: "NFO", spotSymbol: "NIFTY MID SELECT" },
  { key: "SENSEX", label: "SENSEX", optionExchange: "BFO", spotSymbol: "SENSEX" },
] as const;

function formatExpiry(expiry: string) {
  return `${expiry.slice(0, 2)} ${expiry.slice(2, 5)} ${expiry.slice(5)}`;
}

export function DemoTrade({ positions }: { positions: PositionsApi }) {
  const [indexKey, setIndexKey] = useState<(typeof INDEX_DEFS)[number]["key"]>("NIFTY");
  const [expiryType, setExpiryType] = useState<ExpiryType>("WEEKLY");
  const [expiry, setExpiry] = useState<string | null>(null);
  const [chain, setChain] = useState<Instrument[]>([]);
  const [spot, setSpot] = useState<Instrument | null>(null);
  const [quotes, setQuotes] = useState<Map<string, QuoteRow>>(new Map());
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const [loading, setLoading] = useState(false);
  const [quoteError, setQuoteError] = useState<string | null>(null);
  const [chainError, setChainError] = useState<string | null>(null);

  // Angel's greeks endpoint returns a whole expiry at once, so we fetch it lazily
  // (only when the user first opens a greek panel) and cache it per expiry.
  const [greeksByExpiry, setGreeksByExpiry] = useState<Map<string, GreekRow[]>>(new Map());
  const [openGreekToken, setOpenGreekToken] = useState<string | null>(null);
  const [loadingGreeks, setLoadingGreeks] = useState(false);
  const [greeksError, setGreeksError] = useState<string | null>(null);

  const [basketLegs, setBasketLegs] = useState<BasketLeg[]>([]);
  const [basketLabel, setBasketLabel] = useState("");
  const [basketMode, setBasketMode] = useState(false);
  const [chartInstrument, setChartInstrument] = useState<Instrument | null>(null);

  const indexDef = useMemo(() => INDEX_DEFS.find((d) => d.key === indexKey)!, [indexKey]);

  // Load the underlying's option chain + spot instrument whenever the index changes.
  useEffect(() => {
    setLoading(true);
    setChainError(null);
    setChain([]);
    setSpot(null);
    setExpiry(null);
    setQuotes(new Map());
    setGreeksByExpiry(new Map());
    setOpenGreekToken(null);

    Promise.all([
      api.optionsChain(indexDef.key, indexDef.optionExchange),
      api.spot(indexDef.spotSymbol),
    ])
      .then(([chainRes, spotRes]) => {
        setChain(chainRes);
        setSpot(spotRes);
      })
      .catch((err) => setChainError(err instanceof Error ? err.message : "Failed to load chain"))
      .finally(() => setLoading(false));
  }, [indexDef]);

  const expiries = useMemo(
    () => [...new Set(chain.filter((i) => i.expiryType === expiryType).map((i) => i.expiry!))],
    [chain, expiryType],
  );

  useEffect(() => {
    if (expiries.length && !expiries.includes(expiry ?? "")) setExpiry(expiries[0]);
  }, [expiries, expiry]);

  const rows: ChainRow[] = useMemo(() => {
    if (!expiry) return [];
    const byStrike = new Map<string, ChainRow>();
    for (const i of chain) {
      if (i.expiry !== expiry || !i.strike) continue;
      const row = byStrike.get(i.strike) ?? { strike: i.strike };
      if (i.optionType === "CE") row.ce = i;
      if (i.optionType === "PE") row.pe = i;
      byStrike.set(i.strike, row);
    }
    return [...byStrike.values()].sort((a, b) => Number(a.strike) - Number(b.strike));
  }, [chain, expiry]);

  const refreshQuotes = useCallback(() => {
    const exchangeTokens: Record<string, string[]> = {};
    const seen = new Set<string>();
    const addToken = (exchSeg: string, token: string) => {
      const key = `${exchSeg}:${token}`;
      if (seen.has(key)) return;
      seen.add(key);
      (exchangeTokens[exchSeg] ??= []).push(token);
    };

    for (const row of rows) {
      if (row.ce) addToken(row.ce.exch_seg, row.ce.token);
      if (row.pe) addToken(row.pe.exch_seg, row.pe.token);
    }
    if (spot) addToken(spot.exch_seg, spot.token);
    // Keep tracking any staged-but-not-placed basket legs even if the user has
    // browsed away from their index/expiry, so the basket builder keeps updating.
    // (Open positions get their own independent poll, lifted to the App level.)
    for (const leg of basketLegs) addToken(leg.instrument.exch_seg, leg.instrument.token);

    if (Object.keys(exchangeTokens).length === 0) return;

    api
      .quote(exchangeTokens, "FULL")
      .then((res) => {
        setQuotes((prev) => {
          const next = new Map(prev);
          for (const q of res.fetched) next.set(q.symbolToken, q);
          return next;
        });
        setLastUpdated(new Date());
        setQuoteError(null);
      })
      .catch((err) => setQuoteError(err instanceof Error ? err.message : "Failed to fetch quotes"));
  }, [rows, spot, basketLegs]);

  // Poll on a fixed interval instead of per-tick streaming, to keep well within SmartAPI's rate limits.
  useEffect(() => {
    if (rows.length === 0 && basketLegs.length === 0) return;
    refreshQuotes();
    const handle = setInterval(refreshQuotes, REFRESH_MS);
    return () => clearInterval(handle);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rows, spot, basketLegs]);

  const spotLtp = spot ? quotes.get(spot.token)?.ltp ?? null : null;

  // Hover Buy/Sell on a chain cell: instant 1-lot trade normally, or staged into the
  // basket builder when basket mode is on.
  function handleQuickTrade(instrument: Instrument, side: "BUY" | "SELL") {
    if (basketMode) {
      setBasketLegs((prev) => [...prev, { instrument, side, lots: 1 }]);
      return;
    }

    const entryPrice = quotes.get(instrument.token)?.ltp;
    if (entryPrice === undefined) {
      setQuoteError("Waiting for a live quote on this contract — try again in a moment.");
      return;
    }

    positions
      .openPosition(contractFrom(instrument), side, 1, entryPrice)
      .catch((err) => setQuoteError(err instanceof Error ? err.message : "Failed to open position"));
  }

  function contractFrom(instrument: Instrument): PositionContract {
    return {
      token: instrument.token,
      symbol: instrument.symbol,
      exch_seg: instrument.exch_seg,
      name: instrument.name,
      optionType: instrument.optionType ?? "",
      strike: instrument.strike,
      expiry: instrument.expiry,
      lotsize: instrument.lotsize,
    };
  }

  function removeBasketLeg(index: number) {
    setBasketLegs((prev) => prev.filter((_, i) => i !== index));
  }

  function updateBasketLegLots(index: number, lots: number) {
    setBasketLegs((prev) => prev.map((leg, i) => (i === index ? { ...leg, lots } : leg)));
  }

  function updateBasketLegSide(index: number, side: "BUY" | "SELL") {
    setBasketLegs((prev) => prev.map((leg, i) => (i === index ? { ...leg, side } : leg)));
  }

  function placeBasket() {
    if (basketLegs.length === 0) return;
    const legsWithPrices = basketLegs.map((leg) => ({ leg, ltp: quotes.get(leg.instrument.token)?.ltp }));
    if (legsWithPrices.some(({ ltp }) => ltp === undefined)) return;

    const basketId = crypto.randomUUID();
    const label = basketLabel.trim() || undefined;

    positions
      .openBasket(
        legsWithPrices.map(({ leg, ltp }) => ({
          contract: contractFrom(leg.instrument),
          side: leg.side,
          qty: leg.lots,
          entryPrice: ltp!,
        })),
        basketId,
        label,
      )
      .then(() => {
        setBasketLegs([]);
        setBasketLabel("");
      })
      .catch((err) => setQuoteError(err instanceof Error ? err.message : "Failed to place basket"));
  }

  function toggleGreeks(instrument: Instrument) {
    if (openGreekToken === instrument.token) {
      setOpenGreekToken(null);
      return;
    }
    setOpenGreekToken(instrument.token);
    if (!expiry || greeksByExpiry.has(expiry)) return;

    setLoadingGreeks(true);
    setGreeksError(null);
    api
      .optionGreeks(indexDef.key, expiry)
      .then((rows) => setGreeksByExpiry((m) => new Map(m).set(expiry, rows)))
      .catch((err) => setGreeksError(err instanceof Error ? err.message : "Failed to fetch greeks"))
      .finally(() => setLoadingGreeks(false));
  }

  return (
    <div className="demo-trade">
      <div className="card">
        <div className="index-picker">
          {INDEX_DEFS.map((d) => (
            <button
              key={d.key}
              type="button"
              className={indexKey === d.key ? "active" : ""}
              onClick={() => setIndexKey(d.key)}
            >
              {d.label}
            </button>
          ))}
        </div>

        <div className="chain-header">
          <div className="hist-controls">
            <button
              type="button"
              className={expiryType === "WEEKLY" ? "active" : ""}
              onClick={() => setExpiryType("WEEKLY")}
            >
              Weekly
            </button>
            <button
              type="button"
              className={expiryType === "MONTHLY" ? "active" : ""}
              onClick={() => setExpiryType("MONTHLY")}
            >
              Monthly
            </button>
            {expiries.length > 0 && (
              <select value={expiry ?? ""} onChange={(e) => setExpiry(e.target.value)}>
                {expiries.map((e) => (
                  <option key={e} value={e}>
                    {formatExpiry(e)}
                  </option>
                ))}
              </select>
            )}
            <button type="button" onClick={refreshQuotes} disabled={rows.length === 0}>
              Refresh
            </button>
          </div>

          <div className="chain-meta">
            {spotLtp !== null && (
              <span className="spot-price">
                {indexDef.label} <strong>{spotLtp.toLocaleString("en-IN")}</strong>
              </span>
            )}
            {lastUpdated && (
              <span className="muted">
                Updated {lastUpdated.toLocaleTimeString()} · auto-refresh every 20s
              </span>
            )}
          </div>
        </div>

        {loading && <p className="muted">Loading option chain…</p>}
        {chainError && <p className="error">{chainError}</p>}
        {quoteError && <p className="error">{quoteError}</p>}
        {greeksError && <p className="error">{greeksError}</p>}
        {!loading && !chainError && expiries.length === 0 && (
          <p className="muted">No {expiryType.toLowerCase()} expiries found for {indexDef.label}.</p>
        )}

        <div className="chain-toolbar">
          <label className="switch-row">
            🧺 Basket Mode
            <span className="switch">
              <input type="checkbox" checked={basketMode} onChange={(e) => setBasketMode(e.target.checked)} />
              <span className="switch-track" />
            </span>
          </label>
        </div>

        <OptionChainTable
          rows={rows}
          quotes={quotes}
          greeks={expiry ? greeksByExpiry.get(expiry) ?? [] : []}
          loadingGreeks={loadingGreeks}
          openGreekToken={openGreekToken}
          onToggleGreeks={toggleGreeks}
          onQuickTrade={handleQuickTrade}
          onShowChart={setChartInstrument}
          spotLtp={spotLtp}
        />

        {chartInstrument && (
          <div className="chart-panel">
            <div className="chain-toolbar">
              <button type="button" onClick={() => setChartInstrument(null)}>
                Close Chart
              </button>
            </div>
            <HistoricalData instrument={chartInstrument} />
          </div>
        )}

        <BasketBuilder
          legs={basketLegs}
          label={basketLabel}
          quotes={quotes}
          onLabelChange={setBasketLabel}
          onRemoveLeg={removeBasketLeg}
          onLotsChange={updateBasketLegLots}
          onSideChange={updateBasketLegSide}
          onPlace={placeBasket}
          onClear={() => {
            setBasketLegs([]);
            setBasketLabel("");
          }}
        />
      </div>
    </div>
  );
}
