import { Fragment } from "react";
import type { Position, QuoteRow } from "../api/client";

function pnl(position: Position, exitOrLtp: number | undefined) {
  if (exitOrLtp === undefined) return undefined;
  const dir = position.side === "BUY" ? 1 : -1;
  return (exitOrLtp - position.entryPrice) * position.qty * Number(position.lotsize) * dir;
}

function formatPnl(value: number | undefined) {
  if (value === undefined) return "—";
  const sign = value > 0 ? "+" : "";
  return `${sign}${value.toLocaleString("en-IN", { maximumFractionDigits: 2 })}`;
}

interface Group {
  basketId: string | null;
  basketLabel: string | null;
  positions: Position[];
}

// Groups legs placed together (basketId set) so a short strangle etc. shows as one
// unit; standalone single-leg trades (basketId null) each get their own group of 1.
function groupByBasket(list: Position[]): Group[] {
  const groups: Group[] = [];
  const byBasket = new Map<string, Group>();
  for (const p of list) {
    if (!p.basketId) {
      groups.push({ basketId: null, basketLabel: null, positions: [p] });
      continue;
    }
    let group = byBasket.get(p.basketId);
    if (!group) {
      group = { basketId: p.basketId, basketLabel: p.basketLabel ?? null, positions: [] };
      byBasket.set(p.basketId, group);
      groups.push(group);
    }
    group.positions.push(p);
  }
  return groups;
}

export function PositionsPanel({
  open,
  closed,
  quotes,
  onExit,
}: {
  open: Position[];
  closed: Position[];
  quotes: Map<string, QuoteRow>;
  onExit: (positions: Position[]) => void;
}) {
  const openGroups = groupByBasket(open);
  const closedGroups = groupByBasket([...closed].reverse());
  const totalRealized = closed.reduce((sum, p) => sum + (pnl(p, p.exitPrice) ?? 0), 0);

  return (
    <div className="card positions-panel">
      <h2>Paper Positions</h2>

      <h3>Open ({open.length})</h3>
      {openGroups.length === 0 ? (
        <p className="muted">No open positions.</p>
      ) : (
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Symbol</th>
                <th>Side</th>
                <th>Lots</th>
                <th>Entry</th>
                <th>LTP</th>
                <th>P&amp;L</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {openGroups.map((group) => {
                const isBasket = group.basketId !== null && group.positions.length > 1;
                const legLtps = group.positions.map((p) => quotes.get(p.token)?.ltp);
                const allLtpKnown = legLtps.every((v) => v !== undefined);
                const combinedPnl = allLtpKnown
                  ? group.positions.reduce((sum, p, i) => sum + (pnl(p, legLtps[i]) ?? 0), 0)
                  : undefined;

                return (
                  <Fragment key={group.basketId ?? group.positions[0].id}>
                    {isBasket && (
                      <tr className="basket-header-row">
                        <td colSpan={5}>🧺 {group.basketLabel || "Basket"}</td>
                        <td className={combinedPnl !== undefined ? (combinedPnl >= 0 ? "pnl-pos" : "pnl-neg") : ""}>
                          {formatPnl(combinedPnl)}
                        </td>
                        <td>
                          <button type="button" disabled={!allLtpKnown} onClick={() => onExit(group.positions)}>
                            Exit All
                          </button>
                        </td>
                      </tr>
                    )}
                    {group.positions.map((p) => {
                      const ltp = quotes.get(p.token)?.ltp;
                      const value = pnl(p, ltp);
                      return (
                        <tr key={p.id} className={isBasket ? "basket-leg-row" : ""}>
                          <td>{p.symbol}</td>
                          <td>{p.side}</td>
                          <td>{p.qty}</td>
                          <td>{p.entryPrice.toLocaleString("en-IN")}</td>
                          <td>{ltp?.toLocaleString("en-IN") ?? "—"}</td>
                          <td className={value !== undefined ? (value >= 0 ? "pnl-pos" : "pnl-neg") : ""}>
                            {formatPnl(value)}
                          </td>
                          <td>
                            <button type="button" disabled={ltp === undefined} onClick={() => onExit([p])}>
                              Exit
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </Fragment>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      <h3>Closed ({closed.length})</h3>
      {closedGroups.length === 0 ? (
        <p className="muted">No closed positions yet.</p>
      ) : (
        <>
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Symbol</th>
                  <th>Side</th>
                  <th>Lots</th>
                  <th>Entry</th>
                  <th>Exit</th>
                  <th>P&amp;L</th>
                </tr>
              </thead>
              <tbody>
                {closedGroups.map((group) => {
                  const isBasket = group.basketId !== null && group.positions.length > 1;
                  const combinedPnl = group.positions.reduce((sum, p) => sum + (pnl(p, p.exitPrice) ?? 0), 0);

                  return (
                    <Fragment key={group.basketId ?? group.positions[0].id}>
                      {isBasket && (
                        <tr className="basket-header-row">
                          <td colSpan={5}>🧺 {group.basketLabel || "Basket"}</td>
                          <td className={combinedPnl >= 0 ? "pnl-pos" : "pnl-neg"}>{formatPnl(combinedPnl)}</td>
                        </tr>
                      )}
                      {group.positions.map((p) => {
                        const value = pnl(p, p.exitPrice);
                        return (
                          <tr key={p.id} className={isBasket ? "basket-leg-row" : ""}>
                            <td>{p.symbol}</td>
                            <td>{p.side}</td>
                            <td>{p.qty}</td>
                            <td>{p.entryPrice.toLocaleString("en-IN")}</td>
                            <td>{p.exitPrice?.toLocaleString("en-IN") ?? "—"}</td>
                            <td className={value !== undefined ? (value >= 0 ? "pnl-pos" : "pnl-neg") : ""}>
                              {formatPnl(value)}
                            </td>
                          </tr>
                        );
                      })}
                    </Fragment>
                  );
                })}
              </tbody>
            </table>
          </div>
          <p className="selected-instrument">
            Total realized P&amp;L:{" "}
            <strong className={totalRealized >= 0 ? "pnl-pos" : "pnl-neg"}>{formatPnl(totalRealized)}</strong>
          </p>
        </>
      )}
    </div>
  );
}
