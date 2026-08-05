import { PositionsPanel } from "../components/PositionsPanel";
import type { PositionsApi } from "../usePositions";

export function Positions({ positions }: { positions: PositionsApi }) {
  return (
    <>
      {positions.error && <p className="error">{positions.error}</p>}
      <PositionsPanel
        open={positions.open}
        closed={positions.closed}
        quotes={positions.quotes}
        onExit={(list) => positions.closePositions(list.map((p) => p.id)).catch(() => {})}
      />
    </>
  );
}
