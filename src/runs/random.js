/** Pick a run from the full set. Skip the open one when another exists. */
export function pickRandomRun(runs, currentId, random = Math.random) {
  const list = Array.isArray(runs) ? runs.filter((run) => run && run.id != null) : [];
  if (!list.length) return null;
  const others = list.filter((run) => String(run.id) !== String(currentId ?? ""));
  const pool = others.length ? others : list;
  const roll = Number(random());
  const unit = Number.isFinite(roll) ? Math.min(0.999999, Math.max(0, roll)) : 0;
  return pool[Math.floor(unit * pool.length)];
}
