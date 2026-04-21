/**
 * Décompte des questions par catégorie (même agrégation que src/index.ts).
 */
import classic from '../seed/classic.json' with { type: 'json' };
import qcm from '../seed/qcm.json' with { type: 'json' };
import estimation from '../seed/estimation.json' with { type: 'json' };
import listTurns from '../seed/list-turns.json' with { type: 'json' };
import hotPotato from '../seed/hot-potato.json' with { type: 'json' };
import speedElim from '../seed/speed-elim.json' with { type: 'json' };
import mapMode from '../seed/map.json' with { type: 'json' };
import chronology from '../seed/chronology.json' with { type: 'json' };
import imposter from '../seed/imposter.json' with { type: 'json' };
import wpClassic from '../seed/wikipedia-classic.json' with { type: 'json' };
import wpEstimation from '../seed/wikipedia-estimation.json' with { type: 'json' };
import wpListTurns from '../seed/wikipedia-list-turns.json' with { type: 'json' };
import wpHotPotato from '../seed/wikipedia-hot-potato.json' with { type: 'json' };
import wpSpeedElim from '../seed/wikipedia-speed-elim.json' with { type: 'json' };
import wpMap from '../seed/wikipedia-map.json' with { type: 'json' };
import wpChronology from '../seed/wikipedia-chronology.json' with { type: 'json' };

const pools = [
  ['classic (seed)', classic],
  ['classic (wikipedia)', wpClassic],
  ['qcm', qcm],
  ['estimation (seed)', estimation],
  ['estimation (wikipedia)', wpEstimation],
  ['list-turns (seed)', listTurns],
  ['list-turns (wikipedia)', wpListTurns],
  ['hot-potato (seed)', hotPotato],
  ['hot-potato (wikipedia)', wpHotPotato],
  ['speed-elim (seed)', speedElim],
  ['speed-elim (wikipedia)', wpSpeedElim],
  ['map (seed)', mapMode],
  ['map (wikipedia)', wpMap],
  ['chronology (seed)', chronology],
  ['chronology (wikipedia)', wpChronology],
  ['imposter', imposter],
];

const byCat = new Map();
const byMode = new Map();

for (const [poolName, arr] of pools) {
  const modeGuess = poolName.split(' ')[0].split('(')[0].replace(/-wikipedia$/, '').trim();
  for (const q of arr) {
    const cat = q.category ?? '(sans catégorie)';
    byCat.set(cat, (byCat.get(cat) ?? 0) + 1);
    const m = q.mode ?? modeGuess;
    byMode.set(m, (byMode.get(m) ?? 0) + 1);
  }
}

const sortFr = (a, b) => a[0].localeCompare(b[0], 'fr');

console.log('=== Total par mode ===');
for (const [m, n] of [...byMode.entries()].sort(sortFr)) {
  console.log(`${m}\t${n}`);
}
console.log('');
console.log('=== Total par catégorie (toutes sources confondues) ===');
let sum = 0;
for (const [, n] of byCat) sum += n;
for (const [c, n] of [...byCat.entries()].sort(sortFr)) {
  console.log(`${n}\t${c}`);
}
console.log('');
console.log(`TOTAL questions (hors codenames mots)\t${sum}`);
