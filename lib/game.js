// Motore di gioco "Cin" — funzioni pure, indipendenti dal ruolo (p1 / p2).
// Usato sia dalla UI (per renderizzare e calcolare le mosse) sia per generare
// lo stato che viene salvato su Supabase.

let ID = 0;

export const SUITS = [
  { sym: "\u2660", red: false }, // ♠
  { sym: "\u2665", red: true },  // ♥
  { sym: "\u2666", red: true },  // ♦
  { sym: "\u2663", red: false }, // ♣
];

export const rankLabel = (r) =>
  r === 1 ? "A" : r === 11 ? "J" : r === 12 ? "Q" : r === 13 ? "K" : String(r);

export function shuffle(a) {
  a = [...a];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function makeDeck() {
  const d = [];
  for (let s = 0; s < 4; s++) for (let r = 1; r <= 13; r++) d.push({ r, s, id: ID++ });
  return shuffle(d);
}

// scala con "giro": K(13)-A(1) e A(1)-2 sono adiacenti
export const adjacent = (a, b) => {
  const d = Math.abs(a - b);
  return d === 1 || d === 12;
};

export const topR = (pile) => (pile && pile.length ? pile[pile.length - 1].r : null);

function refill(board, deck) {
  board = board.map((s) => [...s]);
  deck = [...deck];
  while (board.length < 4 && deck.length) {
    const c = deck.shift();
    const st = board.find((s) => s[0].r === c.r);
    if (st) st.push(c);
    else board.push([c]);
  }
  return { board, deck };
}

function dealBoard(deck) {
  deck = [...deck];
  const board = [];
  for (let i = 0; i < 4 && deck.length; i++) {
    const c = deck.shift();
    const st = board.find((s) => s[0].r === c.r);
    if (st) st.push(c);
    else board.push([c]);
  }
  return { board, deck };
}

export function legalTargets(r, c1, c2) {
  const t = [];
  if (topR(c1) != null && adjacent(r, topR(c1))) t.push("c1");
  if (topR(c2) != null && adjacent(r, topR(c2))) t.push("c2");
  return t;
}

export function canMove(board, c1, c2) {
  return board.some((s) => legalTargets(s[s.length - 1].r, c1, c2).length > 0);
}

const emptySide = (deck, board) => deck.length === 0 && board.length === 0;

export function newGame() {
  const full = makeDeck();
  const a = dealBoard(full.slice(0, 26));
  const b = dealBoard(full.slice(26));
  const p1Deck = [...a.deck];
  const p2Deck = [...b.deck];
  const c1 = [p1Deck.shift()];
  const c2 = [p2Deck.shift()];
  const r1 = refill(a.board, p1Deck);
  const r2 = refill(b.board, p2Deck);
  return {
    p1Board: r1.board, p1Deck: r1.deck,
    p2Board: r2.board, p2Deck: r2.deck,
    c1, c2, winner: null, message: "Via!",
  };
}

export function checkWin(st) {
  if (st.winner) return st;
  if (emptySide(st.p1Deck, st.p1Board)) return { ...st, winner: "p1", message: "p1 ha finito le carte." };
  if (emptySide(st.p2Deck, st.p2Board)) return { ...st, winner: "p2", message: "p2 ha finito le carte." };
  return st;
}

export function cinAvailable(st) {
  return topR(st.c1) != null && topR(st.c1) === topR(st.c2) && !st.winner;
}

export function isStuck(st) {
  return (
    !st.winner &&
    !cinAvailable(st) &&
    !canMove(st.p1Board, st.c1, st.c2) &&
    !canMove(st.p2Board, st.c1, st.c2)
  );
}

// Cala una carta scoperta sulla pila centrale target ('c1' | 'c2').
// Ritorna il nuovo stato oppure null se la mossa non è valida.
export function applyMove(st, role, stackIdx, target) {
  if (st.winner) return null;
  const boardKey = role === "p1" ? "p1Board" : "p2Board";
  const deckKey = role === "p1" ? "p1Deck" : "p2Deck";
  const board = st[boardKey].map((s) => [...s]);
  const stack = board[stackIdx];
  if (!stack) return null;
  const card = stack[stack.length - 1];
  const pile = [...st[target]];
  if (topR(pile) == null || !adjacent(card.r, topR(pile))) return null;
  stack.pop();
  pile.push(card);
  const r = refill(board.filter((s) => s.length), st[deckKey]);
  return checkWin({ ...st, [boardKey]: r.board, [deckKey]: r.deck, [target]: pile, message: "" });
}

// Chi dice Cin scarica le due pile centrali sull'avversario.
export function callCin(st, role) {
  if (!cinAvailable(st)) return null;
  const heap = [...st.c1, ...st.c2];
  let p1Deck = [...st.p1Deck];
  let p2Deck = [...st.p2Deck];
  if (role === "p1") p2Deck = [...p2Deck, ...heap];
  else p1Deck = [...p1Deck, ...heap];
  const c1 = p1Deck.length ? [p1Deck.shift()] : [];
  const c2 = p2Deck.length ? [p2Deck.shift()] : [];
  const r1 = refill(st.p1Board.map((s) => [...s]), p1Deck);
  const r2 = refill(st.p2Board.map((s) => [...s]), p2Deck);
  return checkWin({
    ...st,
    p1Deck: r1.deck, p1Board: r1.board,
    p2Deck: r2.deck, p2Board: r2.board,
    c1, c2, message: (role === "p1" ? "p1" : "p2") + " ha detto CIN!",
  });
}

// Sblocco stallo: gira una carta a testa dai mazzi; se i mazzi sono vuoti,
// rimescola le due pile centrali e riparte. Se non c'è più nulla, patta.
export function unstick(st) {
  if (st.winner) return null;
  if (cinAvailable(st)) return null;
  if (canMove(st.p1Board, st.c1, st.c2) || canMove(st.p2Board, st.c1, st.c2)) return null;

  if (st.p1Deck.length || st.p2Deck.length) {
    const p1Deck = [...st.p1Deck];
    const p2Deck = [...st.p2Deck];
    const c1 = [...st.c1];
    const c2 = [...st.c2];
    if (p1Deck.length) c1.push(p1Deck.shift());
    if (p2Deck.length) c2.push(p2Deck.shift());
    return checkWin({ ...st, p1Deck, p2Deck, c1, c2, message: "Girata una carta a testa." });
  }

  if (st.c1.length + st.c2.length <= 2) {
    return { ...st, winner: "draw", message: "Stallo totale: patta." };
  }
  const n1 = shuffle(st.c1);
  const n2 = shuffle(st.c2);
  const c1 = n1.length ? [n1.pop()] : [];
  const c2 = n2.length ? [n2.pop()] : [];
  const r1 = refill(st.p1Board.map((s) => [...s]), n1);
  const r2 = refill(st.p2Board.map((s) => [...s]), n2);
  return checkWin({
    ...st,
    p1Deck: r1.deck, p1Board: r1.board,
    p2Deck: r2.deck, p2Board: r2.board,
    c1, c2, message: "Pile centrali rimescolate: si riparte.",
  });
}
