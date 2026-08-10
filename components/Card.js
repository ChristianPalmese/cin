import { SUITS, rankLabel } from "@/lib/game";

export default function Card({ card, small, onClick, count }) {
  if (!card) {
    return (
      <div className={`rounded-lg border-2 border-dashed border-white/20 ${small ? "w-12 h-16" : "w-16 h-24"}`} />
    );
  }
  const s = SUITS[card.s];
  return (
    <button
      onClick={onClick}
      className={`relative rounded-lg bg-white shadow-md flex flex-col items-center justify-center font-bold select-none transition
        ${small ? "w-12 h-16 text-base" : "w-16 h-24 text-2xl"}
        ${onClick ? "cursor-pointer hover:-translate-y-1" : "cursor-default"}`}
      style={{ color: s.red ? "#dc2626" : "#1f2937" }}
    >
      <span>{rankLabel(card.r)}</span>
      <span className={small ? "text-lg" : "text-3xl"}>{s.sym}</span>
      {count > 1 && (
        <span className="absolute -top-1 -right-1 bg-slate-800 text-white text-[10px] rounded-full w-5 h-5 flex items-center justify-center">
          {count}
        </span>
      )}
    </button>
  );
}
