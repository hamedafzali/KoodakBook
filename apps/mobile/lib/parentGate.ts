// The parent area unlock is in-memory only — it resets on every app launch,
// mirroring web's per-tab sessionStorage flag. Deliberately NOT persisted:
// a child picking up the phone later must face the PIN again.
let unlocked = false

export const isParentUnlocked = () => unlocked
export const setParentUnlocked = (v: boolean) => { unlocked = v }
