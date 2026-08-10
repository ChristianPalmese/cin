"use client";
import { useEffect, useRef, useState, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";
import { getClientId } from "@/lib/clientId";
import Card from "@/components/Card";
import {
  newGame,
  applyMove,
  callCin,
  unstick,
  cinAvailable,
  isStuck,
  legalTargets,
} from "@/lib/game";

function Screen({ children }) {
  return (
    <main className="min-h-screen bg-gradient-to-b from-emerald-900 to-emerald-950 text-white flex flex-col items-center justify-center p-6 text-center">
      {children}
    </main>
  );
}

export default function Room() {
  const { id } = useParams();
  const router = useRouter();
  const [room, setRoom] = useState(null);
  const [clientId, setClientId] = useState(null);
  const [sel, setSel] = useState(null);
  const versionRef = useRef(0);

  useEffect(() => {
    setClientId(getClientId());
  }, []);

  // fetch iniziale + realtime
  useEffect(() => {
    if (!id) return;
    let active = true;
    (async () => {
      const { data } = await supabase.from("rooms").select("*").eq("id", id).single();
      if (active && data) {
        setRoom(data);
        versionRef.current = data.version;
      }
    })();
    const channel = supabase
      .channel(`room-${id}`)
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "rooms", filter: `id=eq.${id}` },
        (payload) => {
          setRoom(payload.new);
          versionRef.current = payload.new.version;
          setSel(null);
        }
      )
      .subscribe();
    return () => {
      active = false;
      supabase.removeChannel(channel);
    };
  }, [id]);

  const role =
    room && clientId
      ? room.player1_id === clientId
        ? "p1"
        : room.player2_id === clientId
        ? "p2"
        : null
      : null;

  const commit = useCallback(
    async (next) => {
      if (!next) return;
      await supabase.rpc("commit_state", {
        p_id: id,
        p_expected: versionRef.current,
        p_state: next,
      });
    },
    [id]
  );

  // p1 distribuisce le carte quando entrambi sono presenti.
  // Riprova finché lo stato non risulta effettivamente scritto (rete di sicurezza
  // nel caso l'evento Realtime non arrivi al momento giusto).
  useEffect(() => {
    if (!room || role !== "p1") return;
    if (room.status !== "playing" || room.state) return;

    let cancelled = false;
    const deal = async () => {
      // ricontrolla lo stato più recente dal DB prima di distribuire
      const { data: fresh } = await supabase
        .from("rooms")
        .select("version,state,status")
        .eq("id", id)
        .single();
      if (cancelled || !fresh || fresh.state || fresh.status !== "playing") return;
      const ok = await supabase.rpc("commit_state", {
        p_id: id,
        p_expected: fresh.version,
        p_state: newGame(),
      });
      // se non ha scritto (versione cambiata nel frattempo), riprova a breve
      if (!cancelled && ok && ok.data === false) {
        setTimeout(deal, 400);
      }
    };
    deal();
    return () => {
      cancelled = true;
    };
  }, [room, role, id]);

  // sblocco stallo automatico (lo attiva p1 per evitare doppioni)
  useEffect(() => {
    if (!room || !room.state || role !== "p1") return;
    if (isStuck(room.state)) {
      const t = setTimeout(() => commit(unstick(room.state)), 600);
      return () => clearTimeout(t);
    }
  }, [room, role, commit]);

  if (!room) return <Screen>Caricamento…</Screen>;
  if (clientId && role === null) return <Screen>Questa stanza è già piena.</Screen>;

  if (room.status === "waiting") {
    return (
      <Screen>
        <div className="text-xl mb-3">In attesa dell'avversario…</div>
        <div className="opacity-80 text-sm">Condividi questa password:</div>
        <div className="text-3xl font-black mt-1 tracking-wider">{room.password}</div>
        <button
          onClick={() => router.push("/")}
          className="mt-8 text-sm bg-white/10 hover:bg-white/20 px-4 py-2 rounded-lg"
        >
          Annulla
        </button>
      </Screen>
    );
  }

  const st = room.state;
  if (!st) return <Screen>Preparazione partita…</Screen>;

  const me = role;
  const opp = role === "p1" ? "p2" : "p1";
  const myBoard = st[me + "Board"];
  const myDeck = st[me + "Deck"];
  const oppBoard = st[opp + "Board"];
  const oppDeck = st[opp + "Deck"];
  const cin = cinAvailable(st);
  const stuck = isStuck(st);

  const selStack = sel != null ? myBoard[sel] : null;
  const selTargets = selStack ? legalTargets(selStack[selStack.length - 1].r, st.c1, st.c2) : [];

  const clickStack = (idx) => {
    if (st.winner) return;
    const stack = myBoard[idx];
    const t = legalTargets(stack[stack.length - 1].r, st.c1, st.c2);
    if (t.length === 0) {
      setSel(null);
      return;
    }
    if (t.length === 1) {
      commit(applyMove(st, me, idx, t[0]));
      setSel(null);
    } else {
      setSel(idx);
    }
  };
  const clickPile = (target) => {
    if (sel == null) return;
    commit(applyMove(st, me, sel, target));
    setSel(null);
  };

  const winnerText = st.winner
    ? st.winner === "draw"
      ? "Patta 🤝"
      : st.winner === me
      ? "Hai vinto! 🎉"
      : "Ha vinto l'avversario"
    : null;

  return (
    <main className="min-h-screen bg-gradient-to-b from-emerald-900 to-emerald-950 text-white p-4 flex flex-col items-center">
      <div className="w-full max-w-2xl">
        <div className="flex items-center justify-between mb-2">
          <h1 className="text-2xl font-black tracking-widest">CIN</h1>
          <button
            onClick={() => router.push("/")}
            className="text-sm bg-white/10 hover:bg-white/20 px-3 py-1 rounded-lg"
          >
            Esci
          </button>
        </div>

        {/* Avversario */}
        <div className="bg-black/20 rounded-xl p-3 mb-3">
          <div className="text-xs opacity-70 mb-1">Avversario · mazzo: {oppDeck.length}</div>
          <div className="flex gap-2">
            {oppBoard.map((s, i) => (
              <Card key={i} card={s[s.length - 1]} small count={s.length} />
            ))}
          </div>
        </div>

        {/* Centro */}
        <div className="bg-emerald-800/40 rounded-xl p-4 mb-3 flex flex-col items-center gap-3">
          <div className="flex gap-8 items-center">
            <div
              onClick={() => selTargets.includes("c1") && clickPile("c1")}
              className={selTargets.includes("c1") ? "cursor-pointer" : ""}
            >
              <Card card={st.c1[st.c1.length - 1]} glow={selTargets.includes("c1")} />
            </div>
            <div
              onClick={() => selTargets.includes("c2") && clickPile("c2")}
              className={selTargets.includes("c2") ? "cursor-pointer" : ""}
            >
              <Card card={st.c2[st.c2.length - 1]} glow={selTargets.includes("c2")} />
            </div>
          </div>
          <div className="flex gap-2">
            <button
              onClick={() => commit(callCin(st, me))}
              disabled={!cin}
              className={`px-6 py-2 rounded-lg font-black tracking-wider transition ${
                cin ? "bg-amber-400 text-emerald-950 animate-pulse" : "bg-white/10 text-white/40"
              }`}
            >
              CIN!
            </button>
            <button
              onClick={() => commit(unstick(st))}
              disabled={!stuck}
              className={`px-4 py-2 rounded-lg text-sm ${
                stuck ? "bg-white/20 hover:bg-white/30" : "bg-white/5 text-white/30"
              }`}
            >
              Gira
            </button>
          </div>
        </div>

        {/* Giocatore */}
        <div className="bg-black/20 rounded-xl p-3">
          <div className="text-xs opacity-70 mb-1">Tu · mazzo: {myDeck.length}</div>
          <div className="flex gap-2">
            {myBoard.map((s, i) => {
              const t = legalTargets(s[s.length - 1].r, st.c1, st.c2);
              return (
                <Card
                  key={i}
                  card={s[s.length - 1]}
                  count={s.length}
                  glow={sel === i}
                  faded={t.length === 0}
                  onClick={() => clickStack(i)}
                />
              );
            })}
          </div>
        </div>

        <div className="mt-3 text-center text-sm bg-black/30 rounded-lg py-2 px-3 min-h-[2.5rem] flex items-center justify-center">
          {st.message}
        </div>
      </div>

      {st.winner && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center">
          <div className="bg-emerald-800 rounded-2xl p-8 text-center">
            <div className="text-3xl font-black mb-4">{winnerText}</div>
            <button
              onClick={() => router.push("/")}
              className="bg-amber-400 text-emerald-950 font-bold px-6 py-2 rounded-lg"
            >
              Torna alla lobby
            </button>
          </div>
        </div>
      )}
    </main>
  );
}
