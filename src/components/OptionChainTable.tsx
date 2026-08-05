import { LineChart, Sigma } from "lucide-react";
import type { GreekRow, Instrument, QuoteRow } from "../api/client";

export interface ChainRow {
  strike: string;
  ce?: Instrument;
  pe?: Instrument;
}

function formatStrike(strike: string) {
  const value = Number(strike) / 100;
  return Number.isInteger(value) ? String(value) : value.toFixed(2);
}

function formatNum(n: number | undefined, digits = 2) {
  if (n === undefined || Number.isNaN(n)) return "—";
  return n.toLocaleString("en-IN", { maximumFractionDigits: digits });
}

function findGreek(greeks: GreekRow[], strike: string, optionType: "CE" | "PE") {
  const strikeVal = Number(strike) / 100;
  return greeks.find((g) => g.optionType === optionType && Number(g.strikePrice) === strikeVal);
}

function OptionCell({
  instrument,
  optionType,
  ltp,
  isOpen,
  loading,
  greek,
  onToggleGreeks,
  onQuickTrade,
  onShowChart,
}: {
  instrument: Instrument;
  optionType: "CE" | "PE";
  ltp: number | undefined;
  isOpen: boolean;
  loading: boolean;
  greek: GreekRow | undefined;
  onToggleGreeks: (instrument: Instrument) => void;
  onQuickTrade: (instrument: Instrument, side: "BUY" | "SELL") => void;
  onShowChart: (instrument: Instrument) => void;
}) {
  return (
    <div className="chain-cell">
      <div className="quick-trade-actions">
        <button type="button" className="buy-btn mini" onClick={() => onQuickTrade(instrument, "BUY")}>
          B
        </button>
        <button type="button" className="sell-btn mini" onClick={() => onQuickTrade(instrument, "SELL")}>
          S
        </button>
      </div>

      <span className={`chain-ltp ${optionType === "CE" ? "ce" : "pe"}`}>{formatNum(ltp)}</span>
      <button
        type="button"
        className={`greek-toggle ${isOpen ? "active" : ""}`}
        title="Show greeks"
        onClick={() => onToggleGreeks(instrument)}
      >
        <Sigma size={12} />
      </button>
      <button type="button" className="greek-toggle" title="Premium chart" onClick={() => onShowChart(instrument)}>
        <LineChart size={12} />
      </button>

      {isOpen && (
        <div className="greek-panel">
          {loading && !greek
            ? "Loading…"
            : greek
              ? `IV ${Number(greek.impliedVolatility).toFixed(1)}% · Δ ${Number(greek.delta).toFixed(2)}`
              : "No data"}
        </div>
      )}
    </div>
  );
}

export function OptionChainTable({
  rows,
  quotes,
  greeks,
  loadingGreeks,
  openGreekToken,
  onToggleGreeks,
  onQuickTrade,
  onShowChart,
  spotLtp,
}: {
  rows: ChainRow[];
  quotes: Map<string, QuoteRow>;
  greeks: GreekRow[];
  loadingGreeks: boolean;
  openGreekToken: string | null;
  onToggleGreeks: (instrument: Instrument) => void;
  onQuickTrade: (instrument: Instrument, side: "BUY" | "SELL") => void;
  onShowChart: (instrument: Instrument) => void;
  spotLtp: number | null;
}) {
  if (rows.length === 0) return null;

  const atmStrike = spotLtp
    ? rows.reduce((closest, r) => {
        const strikeVal = Number(r.strike) / 100;
        const closestVal = Number(closest.strike) / 100;
        return Math.abs(strikeVal - spotLtp) < Math.abs(closestVal - spotLtp) ? r : closest;
      }, rows[0]).strike
    : null;

  return (
    <div className="table-wrap chain-wrap">
      <table className="option-chain">
        <thead>
          <tr>
            <th colSpan={3} className="chain-group calls">
              Calls
            </th>
            <th className="chain-group strike-col">Strike</th>
            <th colSpan={3} className="chain-group puts">
              Puts
            </th>
          </tr>
          <tr>
            <th>OI</th>
            <th>Vol</th>
            <th>LTP</th>
            <th className="strike-col"></th>
            <th>LTP</th>
            <th>Vol</th>
            <th>OI</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => {
            const strikeVal = Number(row.strike) / 100;
            const ceQuote = row.ce ? quotes.get(row.ce.token) : undefined;
            const peQuote = row.pe ? quotes.get(row.pe.token) : undefined;
            const ceItm = spotLtp !== null && strikeVal < spotLtp;
            const peItm = spotLtp !== null && strikeVal > spotLtp;
            const isAtm = row.strike === atmStrike;

            const ceOpen = !!row.ce && openGreekToken === row.ce.token;
            const peOpen = !!row.pe && openGreekToken === row.pe.token;

            return (
              <tr key={row.strike} className={isAtm ? "atm-row" : ""}>
                <td className={ceItm ? "itm" : ""}>{formatNum(ceQuote?.opnInterest, 0)}</td>
                <td className={ceItm ? "itm" : ""}>{formatNum(ceQuote?.tradeVolume, 0)}</td>
                <td className={ceItm ? "itm" : ""}>
                  {row.ce ? (
                    <OptionCell
                      instrument={row.ce}
                      optionType="CE"
                      ltp={ceQuote?.ltp}
                      isOpen={ceOpen}
                      loading={loadingGreeks}
                      greek={ceOpen ? findGreek(greeks, row.strike, "CE") : undefined}
                      onToggleGreeks={onToggleGreeks}
                      onQuickTrade={onQuickTrade}
                      onShowChart={onShowChart}
                    />
                  ) : (
                    "—"
                  )}
                </td>

                <td className="strike-col">{formatStrike(row.strike)}</td>

                <td className={peItm ? "itm" : ""}>
                  {row.pe ? (
                    <OptionCell
                      instrument={row.pe}
                      optionType="PE"
                      ltp={peQuote?.ltp}
                      isOpen={peOpen}
                      loading={loadingGreeks}
                      greek={peOpen ? findGreek(greeks, row.strike, "PE") : undefined}
                      onToggleGreeks={onToggleGreeks}
                      onQuickTrade={onQuickTrade}
                      onShowChart={onShowChart}
                    />
                  ) : (
                    "—"
                  )}
                </td>
                <td className={peItm ? "itm" : ""}>{formatNum(peQuote?.tradeVolume, 0)}</td>
                <td className={peItm ? "itm" : ""}>{formatNum(peQuote?.opnInterest, 0)}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
