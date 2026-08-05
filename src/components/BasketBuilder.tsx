import type { Instrument, QuoteRow } from "../api/client";

export interface BasketLeg {
  instrument: Instrument;
  side: "BUY" | "SELL";
  lots: number;
}

function formatStrike(strike?: string) {
  if (!strike) return "";
  const value = Number(strike) / 100;
  return Number.isInteger(value) ? String(value) : value.toFixed(2);
}

export function BasketBuilder({
  legs,
  label,
  quotes,
  onLabelChange,
  onRemoveLeg,
  onLotsChange,
  onSideChange,
  onPlace,
  onClear,
}: {
  legs: BasketLeg[];
  label: string;
  quotes: Map<string, QuoteRow>;
  onLabelChange: (label: string) => void;
  onRemoveLeg: (index: number) => void;
  onLotsChange: (index: number, lots: number) => void;
  onSideChange: (index: number, side: "BUY" | "SELL") => void;
  onPlace: () => void;
  onClear: () => void;
}) {
  if (legs.length === 0) return null;

  const missingLtp = legs.some((leg) => quotes.get(leg.instrument.token)?.ltp === undefined);

  return (
    <div className="card basket-builder">
      <h2>Basket ({legs.length} legs)</h2>

      <label className="basket-label-input">
        Label
        <input value={label} onChange={(e) => onLabelChange(e.target.value)} placeholder="e.g. Short Strangle" />
      </label>

      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th>Symbol</th>
              <th>Side</th>
              <th>Lots</th>
              <th>LTP</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {legs.map((leg, i) => (
              <tr key={`${leg.instrument.token}-${i}`}>
                <td>
                  {leg.instrument.symbol}
                  {leg.instrument.strike && (
                    <span className="tag">
                      {formatStrike(leg.instrument.strike)} {leg.instrument.optionType}
                    </span>
                  )}
                </td>
                <td>
                  <select value={leg.side} onChange={(e) => onSideChange(i, e.target.value as "BUY" | "SELL")}>
                    <option value="BUY">BUY</option>
                    <option value="SELL">SELL</option>
                  </select>
                </td>
                <td>
                  <input
                    type="number"
                    min={1}
                    value={leg.lots}
                    onChange={(e) => onLotsChange(i, Math.max(1, Number(e.target.value) || 1))}
                    className="lots-cell"
                  />
                </td>
                <td>{quotes.get(leg.instrument.token)?.ltp?.toLocaleString("en-IN") ?? "—"}</td>
                <td>
                  <button type="button" onClick={() => onRemoveLeg(i)}>
                    Remove
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {missingLtp && <p className="muted">Waiting for quotes on all legs…</p>}

      <div className="trade-ticket-controls">
        <button type="button" className="buy-btn" disabled={missingLtp} onClick={onPlace}>
          Place Basket
        </button>
        <button type="button" onClick={onClear}>
          Clear
        </button>
      </div>
    </div>
  );
}
