"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";
import { getClientId } from "@/lib/clientId";

export default function Lobby() {
  const router = useRouter();
  const [pw, setPw] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");

  const create = async () => {
    if (!pw.trim()) return setErr("Scegli una password.");
    setBusy(true);
    setErr("");
    const { data, error } = await supabase.rpc("create_room", {
      p_password: pw.trim(),
      p_client_id: getClientId(),
    });
    setBusy(false);
    if (error || !data) return setErr("Errore nella creazione della stanza.");
    router.push(`/room/${data}`);
  };

  const join = async () => {
    if (!pw.trim()) return setErr("Inserisci la password.");
    setBusy(true);
    setErr("");
    const { data, error } = await supabase.rpc("join_room", {
      p_password: pw.trim(),
      p_client_id: getClientId(),
    });
    setBusy(false);
    if (error) return setErr("Errore durante l'accesso.");
    if (!data) return setErr("Nessuna partita in attesa con questa password.");
    router.push(`/room/${data}`);
  };

  return (
    <main className="min-h-screen bg-gradient-to-b from-emerald-900 to-emerald-950 text-white flex flex-col items-center justify-center p-6">
      <h1 className="text-5xl font-black tracking-widest mb-2">CIN</h1>
      <p className="opacity-70 mb-8 text-sm text-center">Sfida un amico con una password condivisa</p>

      <div className="w-full max-w-sm bg-black/20 rounded-2xl p-6 flex flex-col gap-4">
        <input
          value={pw}
          onChange={(e) => setPw(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && join()}
          placeholder="Password della partita"
          className="rounded-lg px-4 py-3 text-slate-900 outline-none"
        />
        <button
          onClick={create}
          disabled={busy}
          className="bg-amber-400 text-emerald-950 font-bold rounded-lg py-3 disabled:opacity-50"
        >
          Crea stanza
        </button>
        <button
          onClick={join}
          disabled={busy}
          className="bg-white/15 hover:bg-white/25 rounded-lg py-3 disabled:opacity-50"
        >
          Entra in una stanza
        </button>
        {err && <div className="text-amber-300 text-sm text-center">{err}</div>}
      </div>

      <p className="opacity-50 text-xs mt-6 max-w-sm text-center">
        Uno crea la stanza con una password e la comunica all'altro, che entra usando la stessa
        password.
      </p>
    </main>
  );
}
