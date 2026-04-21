/**
 * Bus de coordination audio entre la Radio et la TV du lobby.
 *
 * Règle : ouvrir la télé (= l'utilisateur l'a dépliée) coupe la radio.
 * Fermer / replier la télé rend la main à la radio.
 *
 * Très petit pub/sub en mémoire, volontairement pas stocké dans localStorage :
 * l'état "TV ouverte" est purement session-courante et doit se réinitialiser à
 * chaque rechargement pour ne pas garder la radio silencieuse si l'utilisateur
 * a quitté la page avec la télé ouverte.
 */

type Listener = (tvAudioOn: boolean) => void;

let tvAudioOn = false;
const listeners = new Set<Listener>();

export function getTvAudioOn(): boolean {
  return tvAudioOn;
}

export function setTvAudioOn(v: boolean): void {
  if (v === tvAudioOn) return;
  tvAudioOn = v;
  for (const cb of listeners) cb(v);
}

export function subscribeTvAudio(cb: Listener): () => void {
  listeners.add(cb);
  return () => listeners.delete(cb);
}
