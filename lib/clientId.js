// Identificatore anonimo e persistente per distinguere i due giocatori,
// senza bisogno di login. Salvato in localStorage del browser.
export function getClientId() {
  if (typeof window === "undefined") return null;
  let id = localStorage.getItem("cin_client_id");
  if (!id) {
    id =
      typeof crypto !== "undefined" && crypto.randomUUID
        ? crypto.randomUUID()
        : "c_" + Math.random().toString(36).slice(2) + Date.now().toString(36);
    localStorage.setItem("cin_client_id", id);
  }
  return id;
}
