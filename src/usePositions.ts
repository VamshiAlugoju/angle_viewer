import { useCallback, useEffect, useState } from "react";
import { api, type Position, type PositionContract, type QuoteRow } from "./api/client";

const REFRESH_MS = 20_000; // stay well under SmartAPI's rate limits

export interface BasketLegOrder {
  contract: PositionContract;
  side: "BUY" | "SELL";
  qty: number;
  entryPrice: number;
}

// Lives at the App level (not inside the Demo Trade page) so positions and their
// live P&L keep updating regardless of which tab is open, and so the Positions tab
// can show them without Demo Trade needing to be mounted.
export function usePositions(enabled: boolean) {
  const [open, setOpen] = useState<Position[]>([]);
  const [closed, setClosed] = useState<Position[]>([]);
  const [quotes, setQuotes] = useState<Map<string, QuoteRow>>(new Map());
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!enabled) return;
    api
      .positions()
      .then((res) => {
        setOpen(res.open);
        setClosed(res.closed);
      })
      .catch(() => {});
  }, [enabled]);

  const refreshQuotes = useCallback(() => {
    if (!enabled || open.length === 0) return;
    const exchangeTokens: Record<string, string[]> = {};
    for (const p of open) (exchangeTokens[p.exch_seg] ??= []).push(p.token);

    api
      .quote(exchangeTokens, "FULL")
      .then((res) => {
        setQuotes((prev) => {
          const next = new Map(prev);
          for (const q of res.fetched) next.set(q.symbolToken, q);
          return next;
        });
        setError(null);
      })
      .catch((err) => setError(err instanceof Error ? err.message : "Failed to fetch position quotes"));
  }, [enabled, open]);

  useEffect(() => {
    if (!enabled || open.length === 0) return;
    refreshQuotes();
    const handle = setInterval(refreshQuotes, REFRESH_MS);
    return () => clearInterval(handle);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled, open]);

  function openPosition(
    contract: PositionContract,
    side: "BUY" | "SELL",
    qty: number,
    entryPrice: number,
    basketId?: string,
    basketLabel?: string,
  ) {
    return api.openPosition(contract, side, qty, entryPrice, basketId, basketLabel).then((position) => {
      setOpen((prev) => [...prev, position]);
      return position;
    });
  }

  function openBasket(legs: BasketLegOrder[], basketId: string, basketLabel?: string) {
    return Promise.all(
      legs.map((leg) => api.openPosition(leg.contract, leg.side, leg.qty, leg.entryPrice, basketId, basketLabel)),
    ).then((created) => {
      setOpen((prev) => [...prev, ...created]);
      return created;
    });
  }

  function closePositions(ids: string[]) {
    const toClose = open.filter((p) => ids.includes(p.id));
    const withPrices = toClose.map((p) => ({ position: p, exitPrice: quotes.get(p.token)?.ltp }));
    if (withPrices.some(({ exitPrice }) => exitPrice === undefined)) {
      return Promise.reject(new Error("Waiting for quotes on all positions"));
    }
    return Promise.all(
      withPrices.map(({ position, exitPrice }) => api.closePosition(position.id, exitPrice!)),
    ).then((closedList) => {
      const closedIds = new Set(closedList.map((p) => p.id));
      setOpen((prev) => prev.filter((p) => !closedIds.has(p.id)));
      setClosed((prev) => [...prev, ...closedList]);
      return closedList;
    });
  }

  return { open, closed, quotes, error, openPosition, openBasket, closePositions };
}

export type PositionsApi = ReturnType<typeof usePositions>;
