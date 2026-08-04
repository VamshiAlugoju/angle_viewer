import { useEffect, useState } from "react";
import { api, type Instrument } from "../api/client";

type ExpiryType = "WEEKLY" | "MONTHLY";

function formatExpiry(expiry: string) {
  return `${expiry.slice(0, 2)} ${expiry.slice(2, 5)} ${expiry.slice(5)}`;
}

function formatStrike(strike?: string) {
  if (!strike) return "";
  const value = Number(strike) / 100;
  return Number.isInteger(value) ? String(value) : value.toFixed(2);
}

export function OptionsChain({
  selected,
  onSelect,
}: {
  selected: Instrument | null;
  onSelect: (instrument: Instrument) => void;
}) {
  const [query, setQuery] = useState("");
  const [underlyings, setUnderlyings] = useState<string[]>([]);
  const [underlying, setUnderlying] = useState<string | null>(null);
  const [chain, setChain] = useState<Instrument[]>([]);
  const [expiryType, setExpiryType] = useState<ExpiryType>("WEEKLY");
  const [expiry, setExpiry] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [manualSymbol, setManualSymbol] = useState("");
  const [manualToken, setManualToken] = useState("");
  const [manualExchange, setManualExchange] = useState("NFO");

  useEffect(() => {
    if (!query.trim()) {
      setUnderlyings([]);
      return;
    }
    const handle = setTimeout(() => {
      api
        .optionUnderlyings(query)
        .then(setUnderlyings)
        .catch(() => {});
    }, 300);
    return () => clearTimeout(handle);
  }, [query]);

  useEffect(() => {
    if (!underlying) return;
    setLoading(true);
    setError(null);
    api
      .optionsChain(underlying)
      .then((res) => {
        setChain(res);
        const expiries = [
          ...new Set(
            res
              .filter((i) => i.expiryType === expiryType)
              .map((i) => i.expiry!),
          ),
        ];
        setExpiry(expiries[0] ?? null);
      })
      .catch((err) =>
        setError(
          err instanceof Error ? err.message : "Failed to load options chain",
        ),
      )
      .finally(() => setLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [underlying]);

  const expiries = [
    ...new Set(
      chain.filter((i) => i.expiryType === expiryType).map((i) => i.expiry!),
    ),
  ];
  console.log(chain);
  useEffect(() => {
    if (expiries.length && !expiries.includes(expiry ?? ""))
      setExpiry(expiries[0]);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [expiryType, chain]);

  const options = chain
    .filter((i) => i.expiry === expiry)
    .sort((a, b) => Number(a.strike) - Number(b.strike));

  return (
    <div className="card">
      <h2>Options Instruments</h2>

      <div className="search-row">
        <input
          placeholder="Search underlying (e.g. NIFTY, BANKNIFTY, RELIANCE)"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
      </div>

      {underlyings.length > 0 && !underlying && (
        <ul className="instrument-list">
          {underlyings.map((name) => (
            <li key={name}>
              <button
                type="button"
                onClick={() => {
                  setUnderlying(name);
                  setQuery("");
                  setUnderlyings([]);
                }}
              >
                <strong>{name}</strong>
              </button>
            </li>
          ))}
        </ul>
      )}

      {underlying && (
        <>
          <p className="selected-instrument">
            Underlying: <strong>{underlying}</strong>{" "}
            <button
              type="button"
              onClick={() => {
                setUnderlying(null);
                setChain([]);
              }}
            >
              Change
            </button>
          </p>

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
              <select
                value={expiry ?? ""}
                onChange={(e) => setExpiry(e.target.value)}
              >
                {expiries.map((e) => (
                  <option key={e} value={e}>
                    {formatExpiry(e)}
                  </option>
                ))}
              </select>
            )}
          </div>

          {loading && <p className="muted">Loading options chain…</p>}
          {error && <p className="error">{error}</p>}
          {!loading && expiries.length === 0 && (
            <p className="muted">
              No {expiryType.toLowerCase()} expiries found for {underlying}.
            </p>
          )}

          {options.length > 0 && (
            <ul className="instrument-list">
              {options.map((i) => (
                <li key={`${i.exch_seg}-${i.token}`}>
                  <button
                    type="button"
                    className={selected?.token === i.token ? "active" : ""}
                    onClick={() => onSelect(i)}
                  >
                    <strong>{formatStrike(i.strike)}</strong>{" "}
                    <span className="tag">{i.optionType}</span>{" "}
                    <span className="muted">{i.symbol}</span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </>
      )}

      <details className="manual-entry">
        <summary>Know the token for an expired/old contract? Enter manually</summary>
        <p className="muted">
          Chain above only lists currently live contracts. For expired ones (e.g. a 2020
          expiry), grab the symboltoken from an archived scrip master or NSE bhavcopy and
          enter it here — the candle API can still return data for it.
        </p>
        <div className="hist-controls">
          <select value={manualExchange} onChange={(e) => setManualExchange(e.target.value)}>
            <option value="NFO">NFO</option>
            <option value="BFO">BFO</option>
          </select>
          <input
            placeholder="Symbol (e.g. NIFTY20JAN10000CE)"
            value={manualSymbol}
            onChange={(e) => setManualSymbol(e.target.value)}
          />
          <input
            placeholder="Token"
            value={manualToken}
            onChange={(e) => setManualToken(e.target.value)}
          />
          <button
            type="button"
            disabled={!manualSymbol.trim() || !manualToken.trim()}
            onClick={() =>
              onSelect({
                token: manualToken.trim(),
                symbol: manualSymbol.trim(),
                name: manualSymbol.trim(),
                exch_seg: manualExchange,
                instrumenttype: "OPTIDX",
                lotsize: "",
                tick_size: "",
              })
            }
          >
            Use
          </button>
        </div>
      </details>

      {selected && (
        <p className="selected-instrument">
          Selected: <strong>{selected.symbol}</strong> ({selected.exch_seg},
          token {selected.token})
        </p>
      )}
    </div>
  );
}
