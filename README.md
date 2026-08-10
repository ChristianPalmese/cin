# CIN — multiplayer online

Gioco di carte "Cin" per 2 giocatori, in tempo reale, con stanze protette da
password libera. Costruito con **Next.js** (App Router) e **Supabase**
(Postgres + Realtime).

## Come funziona

- Un giocatore apre il sito, sceglie una password e fa **Crea stanza**.
- L'altro apre il sito, inserisce la **stessa password** e fa **Entra in una stanza**.
- La partita parte e le mosse dei due si sincronizzano in tempo reale.

## Setup (una volta)

### 1. Crea il progetto Supabase
Vai su https://supabase.com, crea un progetto e prendi da *Project Settings → API*:
- **Project URL**
- **anon public key**

### 2. Crea lo schema
Apri il **SQL Editor** di Supabase, incolla tutto il contenuto di
[`supabase.sql`](./supabase.sql) ed esegui. Crea la tabella `rooms`, le policy,
il Realtime e le funzioni `create_room`, `join_room`, `commit_state`.

### 3. Configura le variabili d'ambiente
Copia `.env.local.example` in `.env.local` e riempilo:

```
NEXT_PUBLIC_SUPABASE_URL=https://XXXX.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=la-tua-anon-key
```

### 4. Installa e avvia
```bash
npm install
npm run dev
```
Apri http://localhost:3000. Per provarlo da solo, apri due schede (meglio una
in incognito, così hanno due identità diverse), usa la stessa password in
entrambe: una crea, l'altra entra.

## Deploy (Vercel)
1. Metti il progetto su GitHub.
2. Importa il repo su https://vercel.com.
3. In *Settings → Environment Variables* aggiungi le stesse due variabili.
4. Deploy. Il gioco sarà online e condivisibile con un link.

## Struttura
```
app/
  page.js              → lobby (crea / entra con password)
  room/[id]/page.js    → tavolo di gioco + realtime
components/Card.js     → la carta
lib/
  game.js              → motore di gioco puro (regole, mosse, cin, stallo)
  supabaseClient.js    → client Supabase
  clientId.js          → identità anonima del giocatore
supabase.sql           → schema del database
```

## Come sono risolte le "gare" (chi ha fatto per primo)
Lo stato della partita vive in un'unica riga (`rooms.state`) con un contatore
`version`. Ogni mossa è un `commit_state` che aggiorna **solo se la versione
attesa combacia**. Postgres serializza le richieste: chi arriva primo fa +1 alla
versione, l'altro fallisce e riceve lo stato aggiornato via Realtime. È così che
si decide, lato server, chi ha calato la carta o detto "Cin" per primo.

## Nota sulla sicurezza (v1)
`commit_state` accetta lo stato calcolato dal client. Va benissimo per giocare
tra amici (la stanza è già protetta da password), ma un client modificato
potrebbe inviare stati non validi. Per un anti-cheat vero, il passo successivo è
spostare la validazione delle singole mosse dentro funzioni RPC dedicate
(`play_move`, `call_cin`, `flip`) che ricalcolano lo stato in SQL invece di
fidarsi del client.
# cin
