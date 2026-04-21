/**
 * Parse OCR text from « 350 quiz de culture générale » (PDF scanné).
 *
 * Pipeline pour régénérer `all_raw.txt` :
 *   mkdir -p .tmp_quiz_ocr
 *   for i in $(seq 1 126); do
 *     pdftoppm -png -r 150 -f $i -l $i "$PDF" .tmp_quiz_ocr/p
 *     f=$(ls .tmp_quiz_ocr/p-*.png | head -1); xattr -c "$f" 2>/dev/null
 *     printf "\n\n===== PAGE $i =====\n" >> .tmp_quiz_ocr/all_raw.txt
 *     tesseract "$f" stdout -l fra+eng --psm 4 >> .tmp_quiz_ocr/all_raw.txt
 *     rm -f "$f"
 *   done
 *
 * Usage : node packages/content/scripts/parse-pdf-quiz-ocr.mjs [.tmp_quiz_ocr/all_raw.txt]
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
/** Racine du dépôt (…/MVPCulture) */
const ROOT = path.resolve(__dirname, '../../..');

// ─────────────────────────── helpers texte ────────────────────────────

function normalizeSpaces(s) {
  return s.replace(/\s+/g, ' ').trim();
}

function stripFooters(lines) {
  return lines.filter((ln) => {
    const t = ln.trim();
    if (/^Retrouvez toutes les réponses/i.test(t)) return false;
    if (/^===== PAGE \d+ =====$/.test(t)) return false;
    if (/^\d{1,3}$/.test(t) && t.length <= 3) return false;
    return true;
  });
}

function isNoiseLine(t) {
  if (!t || t.length === 0) return true;
  if (/^===== PAGE \d+ =====$/.test(t)) return true;
  if (/^\d{1,3}$/.test(t)) return true;
  // titres de section en majuscules entre tirets
  if (/^—\s+[A-ZÀ-Ÿ]/.test(t) && t.length < 80) return true;
  return false;
}

// Blocs éditoriaux insérés entre deux options (infographies, proverbes…)
const PROSE_JUNK_RE = [
  /^La France est découpée/i,
  /^Les Régions de France/i,
  /^Métropole\s*:/i,
  /^[¢C]\s+Outre-mer/i,
  /^Les dates clés de la télé/i,
  /^«\s/,              // citations
  /^[A-Z][a-zà-ÿ]+ [A-Z][a-zà-ÿ]+,\s+[a-z]/,  // attrib. "Blaise Pascal, philosophe"
  /À qui le pouvoir/i,
  /« archies »/i,
  /désignent des formes/i,
  /Anarchie\s*:/i,
  /Les Sept Merveilles/i,
  /Sachez les reconnaitre/i,
  /Les principales appartenances/i,
];

function isProseJunk(t) {
  return PROSE_JUNK_RE.some((re) => re.test(t));
}

function skipNoise(qlines, i0) {
  let i = i0;
  while (i < qlines.length && (isNoiseLine(qlines[i].trim()) || isProseJunk(qlines[i].trim()))) i++;
  return i;
}

// ─────────────────────────── parseur réponses ─────────────────────────

/** @returns {{ id: number, letter: string, rest: string, section: string }[]} */
function parseAnswers(answerText) {
  const lines = answerText.split(/\r?\n/).map((l) => l.trim());
  let section = 'Arts';
  const out = [];
  const sectionHeader =
    /^(ARTS ET MYTHOLOGIE|HISTOIRE ET GRANDES FIGURES|PAYS ET CAPITALES|SOCI[EÉ]T[EÉ] ET M[EÉ]DIAS|SCIENCES ET ENVIRONNEMENT)\s*$/i;

  for (let i = 0; i < lines.length; i++) {
    const ln = lines[i];
    if (!ln) continue;
    if (sectionHeader.test(ln)) {
      section = ln.trim();
      continue;
    }
    // Cas spécial 51 : "51. a. 5, b.1, …"
    const m51 = ln.match(/^51\.\s*([a-e])\.\s*/i);
    if (m51) {
      out.push({ id: 51, letter: 'special', rest: ln, section });
      continue;
    }
    // Cas spécial 92 : "92. b et c -"
    if (/^92\.\s*b\s+et\s+c\s*[-\.—]/i.test(ln)) {
      out.push({
        id: 92,
        letter: 'special',
        rest: ln.replace(/^92\.\s*b\s+et\s+c\s*[-\.—\s]*/i, ''),
        section,
      });
      continue;
    }
    // Cas général : "1.a-", "2. d-", "221.d-58 %"
    const m = ln.match(/^(\d{1,3})\.\s*([a-eA-E])(?:\s*[-\.—]+\s*|\s*\.\s*)(.*)$/);
    if (m) {
      let id = Number(m[1]);
      const letter = m[2].toLowerCase();
      const rest = m[3] ?? '';
      // Correction OCR : réponse FAO mal numérotée "208.d" au lieu de "203.d"
      if (id === 208 && letter === 'd' && /FAO|faim/i.test(rest)) id = 203;
      if (id >= 1 && id <= 350) {
        out.push({ id, letter, rest, section });
      }
    }
  }
  return out;
}

// ─────────────────────────── parseur questions ────────────────────────

const OPT_START = /^([a-e])\s*(?:\u2014|\u2013|-|\.)\s*(.*)$/i;
const Q_START   = /^(\d{1,3})[.,]\s+(.*)$/;
const Q_NUM     = /^(\d{1,3})[.,]\s+/;

function parseQuestions(questionText) {
  const lines = stripFooters(questionText.split(/\r?\n/));
  const text = lines.join('\n');
  const anchor = text.indexOf('1. Le premier ministre de la Culture');
  const slice = anchor >= 0 ? text.slice(anchor) : text;
  const qlines = stripFooters(slice.split(/\r?\n/));

  const map = new Map();

  let i = 0;
  while (i < qlines.length) {
    i = skipNoise(qlines, i);
    if (i >= qlines.length) break;
    const ln = qlines[i].trim();
    const start = ln.match(Q_START);
    if (!start) { i++; continue; }
    const id = Number(start[1]);
    if (id < 1 || id > 350) { i++; continue; }

    // Accumule le prompt jusqu'à la première option
    const buf = [start[2]];
    i++;
    while (i < qlines.length) {
      const L = qlines[i].trim();
      const nq = L.match(Q_NUM);
      if (nq && !OPT_START.test(L) && Number(nq[1]) !== id) break;
      if (OPT_START.test(L)) break;
      buf.push(L);
      i++;
    }
    const prompt = normalizeSpaces(buf.join(' '));

    // Accumule les options a/b/c/d/e
    const opts = {};
    for (const key of ['a', 'b', 'c', 'd', 'e']) {
      i = skipNoise(qlines, i);
      if (i >= qlines.length) break;
      const L = qlines[i].trim();
      const om = L.match(new RegExp(`^${key}\\s*(?:\\u2014|\\u2013|-|\\.)\\s*(.*)$`, 'i'));
      if (!om) break;
      const parts = [om[1] ?? ''];
      i++;
      while (i < qlines.length) {
        const L2 = qlines[i].trim();
        // stop si une autre option commence
        const om2 = L2.match(OPT_START);
        if (om2 && om2[1].toLowerCase() !== key) break;
        // stop si une nouvelle question commence
        const nq2 = L2.match(Q_NUM);
        if (nq2 && !OPT_START.test(L2) && Number(nq2[1]) !== id) break;
        // Les citations éditoriales («…») ne font jamais partie d'une option
        if (L2.startsWith('«')) break;
        // ignore lignes de bruit / prose éditoriale
        if (isNoiseLine(L2) || isProseJunk(L2)) { i++; continue; }
        // descriptions numérotées Q51
        if (/^\d+\s*[—\-–]\s*/.test(L2) && id === 51) { parts.push(L2); i++; continue; }
        parts.push(L2);
        i++;
      }
      let optText = normalizeSpaces(parts.join(' '));
      // Si l'option est trop longue c'est qu'un bloc éditorial (tableau, liste)
      // a été absorbé. On tronque à la première phrase complète.
      if (optText.length > 120) {
        const dot = optText.indexOf('. ');
        optText = dot > 4 ? optText.slice(0, dot + 1) : optText.slice(0, 120).trimEnd();
      }
      opts[key] = optText;
    }

    const optCount = ['a','b','c','d','e'].filter((k) => opts[k]?.length > 1).length;

    if (prompt.length >= 8 && optCount >= 2 && !map.has(id)) {
      // "first-occurrence wins" : les listes éditoriales (ex. « Les Sept Merveilles »)
      // apparaissent plus tard dans le doc et ne doivent pas écraser la vraie question.
      map.set(id, { prompt, ...opts });
    }
  }
  return map;
}

// ─────────────────────────── classification ───────────────────────────

function difficultyFor(id) {
  if (id % 7 === 0) return 'hard';
  if (id % 3 === 0) return 'easy';
  return 'medium';
}

function sectionToCategory(section) {
  const s = (section ?? '').toLowerCase();
  if (s.includes('arts')) return 'Arts';
  if (s.includes('histoire')) return 'Histoire';
  if (s.includes('pays') || s.includes('capitale')) return 'Géographie';
  if (s.includes('soci') || s.includes('medias') || s.includes('médias')) return 'Société';
  if (s.includes('sciences')) return 'Sciences';
  return 'Culture générale';
}

/**
 * Retourne `true` si le texte ressemble à un nombre / une mesure.
 * Exemples valides :
 *   "1 235 kilomètres-heure", "3 millions", "40 %", "140 litres",
 *   "1896", "-600 av. J.-C.", "Moins de 1 °C", "1 à 2 °C"
 */
function isNumericOption(o) {
  if (!o || o.length > 70) return false;
  const t = o.trim();

  // Chiffre pur (avec espaces comme séparateurs de milliers) : 1 235 / 3000 / 20000
  if (/^-?\d[\d\s]*$/.test(t)) return true;

  // Années avec av. J.-C.
  if (/^-?\d[\d\s]*\s*av\.?\s*J\.?-?C\.?/i.test(t)) return true;

  // "X millions / milliards / mille"
  if (/^\d[\d\s,.]*\s*(millions?|milliards?|milliers?|mille)\b/i.test(t)) return true;

  // Mesures : km/h, dB, °C, %, tonnes, km, m, litres, kg, euros, kc…
  if (/^\d[\d\s,.]*\s*(km[\s/]h|kilomètres?[- ]?heure|km\b|m\b|metres?|mètres?|kilo|kg\b|tonne|litre|décibel|dB\b|°C|%|euro|\$)/i.test(t)) return true;

  // "Moins de X", "Plus de X", "X à Y", "X ou Y" tous numériques
  if (/^(?:moins|plus)\s+de\s+\d/i.test(t)) return true;
  if (/^\d[\d\s,.]*\s*[àa]\s*\d[\d\s,.]*\s*°?[CcKk]?$/i.test(t)) return true;

  // Un entier de 4 chiffres (années) sans autre texte
  if (/^\d{4}$/.test(t.replace(/\s/g, ''))) return true;

  // "X décibels", "X km-heure", "X km·h⁻¹" (OCR variantes)
  if (/^\d[\d\s,.]*(décibels?|kilo\s*mètres?|mètr|km)/i.test(t)) return true;

  return false;
}

/**
 * Règles de classification :
 *  → 'estimation'  si les options ressemblent à des mesures / nombres
 *  → 'classic'     si la question est Vrai/Faux, longue association,
 *                  ou si les options sont toutes de longues phrases
 *  → 'qcm'         sinon
 */
function classify(q, correctText) {
  const { prompt, a, b, c, d } = q;
  const pl = (prompt ?? '').toLowerCase();
  const opts = [a, b, c, d].filter(Boolean);

  // ── Association / appariement → classique
  if (/associez|associe\s|reliez|appariez/i.test(pl)) return 'classic';

  // ── Vrai ou faux → classique (même si 2 options)
  if (/\bvrai ou faux\b/i.test(pl)) return 'classic';

  // ── Seulement 2 options (a, b) → classique
  if (opts.length <= 2) return 'classic';

  // ── Options toutes très longues (paragraphes explicatifs) → classique
  const avgLen = opts.reduce((s, o) => s + o.length, 0) / opts.length;
  const maxLen = Math.max(...opts.map((o) => o.length));
  if (maxLen > 140 || avgLen > 80) return 'classic';

  // ── Estimation : TOUTES les options ressemblent à des nombres/mesures
  //    (on tolère jusqu'à 1 option non-numérique sur 4 pour l'OCR bruité)
  const numericCount = opts.filter(isNumericOption).length;
  if (numericCount >= opts.length - 1 && numericCount >= 2) return 'estimation';

  // ── Prompt contient « combien » et ≥ 2 options numériques → estimation
  if (/\bcombien\b/i.test(pl) && numericCount >= 2) return 'estimation';

  // ── Options assez courtes et diversifiées → QCM
  return 'qcm';
}

/**
 * Extrait le nombre « humain » à saisir par un joueur.
 * Pour « 3 millions d'années », renvoie 3 (pas 3 000 000) car
 * l'unité portée par le prompt / les options vaut « millions d'années ».
 * Pour « 1 235 km/h », renvoie 1235.
 * Pour « 1919 », renvoie 1919.
 */
function extractNumeric(label, correctLong) {
  const txt = [label, correctLong].join(' ');

  // X milliards → garde X (p.ex. « 1,5 milliard »)
  const milliards = txt.match(/(\d[\d\s,.]*)[\s]*milliard/i);
  if (milliards) {
    const raw = milliards[1].replace(/\s/g, '').replace(',', '.');
    return parseFloat(raw);
  }

  // X millions → garde X (p.ex. « 3 millions », « 3,7 millions »)
  const millions = txt.match(/(\d[\d\s,.]*)[\s]*millions?/i);
  if (millions) {
    const raw = millions[1].replace(/\s/g, '').replace(',', '.');
    return parseFloat(raw);
  }

  // Nombre pur avec espace séparateur de milliers (p.ex. « 1 235 »)
  // → on essaie de trouver le nombre le plus pertinent (pas un décompte de page)
  const candidates = [...txt.matchAll(/\b(\d[\d\s]*\d|\d{1,4})\b/g)]
    .map((m) => Number(m[1].replace(/\s/g, '')))
    .filter((n) => n > 0 && n < 1e9);
  if (candidates.length > 0) {
    // On préfère la valeur proche de la fourchette des options
    return candidates[0];
  }
  return null;
}

function unitFor(label, correctLong) {
  const t = [label, correctLong].join(' ');

  // ── Unités vitesse ──
  if (/km[\s/]?h|kilomètres?[- ]?heure/i.test(t)) return 'km/h';

  // ── Décibels ──
  if (/décibels?/i.test(t)) return 'décibels';

  // ── Température ──
  if (/°\s*c\b/i.test(t) || /degrés?\s+(celsius|c\b)/i.test(t)) return '°C';

  // ── Pourcentage ──
  if (/%/.test(t)) return '%';

  // ── Tonnes ──
  if (/tonnes?/i.test(t)) return 'tonnes';

  // ── Litres ──
  if (/litres?/i.test(t)) return 'litres';

  // ── Millions / milliards (avant km pour éviter collision) ──
  if (/milliards?\s+de\s+kilomètres?|milliards?\s+de\s+km/i.test(t)) return 'milliards de km';
  if (/millions?\s+de\s+kilomètres?|millions?\s+de\s+km/i.test(t)) return 'millions de km';
  if (/milliards?\s+de\s+personnes?|milliards?\s+d'hab/i.test(t)) return "milliards de personnes";
  if (/millions?\s+de\s+personnes?|millions?\s+d'hab/i.test(t)) return "millions de personnes";
  if (/milliards?\b/i.test(t)) return 'milliards';
  if (/millions?\b/i.test(t)) {
    if (/av\.?\s*j\.?-?c/i.test(t)) return "millions d'années av. J.-C.";
    if (/an[née]|year/i.test(t)) return "millions d'années";
    return 'millions';
  }

  // ── Km (distance, hors vitesse) ──
  if (/kilomètres?\b(?!\s*[hH-])|km\b(?![\s/]?h)/i.test(t)) return 'km';

  // ── Mètres ──
  if (/mètres?\b|metres?\b/i.test(t)) return 'mètres';

  // ── Kg ──
  if (/kilos?\b|kg\b/i.test(t)) return 'kg';

  // ── Av. J.-C. ──
  if (/av\.?\s*j\.?-?c/i.test(t)) return 'av. J.-C.';

  // Pas d'unité → année implicite ou valeur brute
  return undefined;
}

// ─────────────────────────── main ─────────────────────────────────────

function main() {
  const inputPath = process.argv[2] || path.join(ROOT, '.tmp_quiz_ocr/all_raw.txt');
  if (!fs.existsSync(inputPath)) {
    console.error('Missing OCR file:', inputPath);
    process.exit(1);
  }

  const full = fs.readFileSync(inputPath, 'utf8');
  // Couper uniquement sur la PAGE 101 (le sommaire contient aussi « Les réponses aux QCM »)
  const page101 = '===== PAGE 101 =====';
  const p101 = full.indexOf(page101);
  const questionPart = p101 >= 0 ? full.slice(0, p101) : full;
  const answerPart   = p101 >= 0 ? full.slice(p101)  : '';

  const answers    = parseAnswers(answerPart);
  const answerById = new Map();
  for (const a of answers) answerById.set(a.id, a);

  const qMap = parseQuestions(questionPart);

  const qcm        = [];
  const classic     = [];
  const estimation  = [];

  for (let id = 1; id <= 350; id++) {
    const q   = qMap.get(id);
    const ans = answerById.get(id);
    if (!q || !ans) {
      if (id !== 92 || !answerById.get(92)) {
        console.warn(`id ${id}: pas de question (${!!q}) ou réponse (${!!ans})`);
      }
      continue;
    }

    const cat  = sectionToCategory(ans.section);
    const diff = difficultyFor(id);
    const pid  = `pdf-cg-${String(id).padStart(3, '0')}`;

    // ── Overrides manuels pour options manquantes / OCR trop bruitées ─

    // Corrections ciblées des questions dont une option n'a pas pu être
    // parsée à cause d'un saut de page OCR entre la question et ses choix.
    const MANUAL_OPTS = {
      // Q63 : option c manquante (saut page 24)
      63: { c: 'Au vii° siècle.' },
      // Q143 : option b manquante (saut page 48)
      143: { b: 'Canberra.' },
      // Q301 : aucune option parsée (saut page)
      301: { a: '100 milliards.', b: '10 000 milliards.', c: '60 000 milliards.', d: '600 000 milliards.' },
      // Q350 : option d manquante (fin de fichier OCR)
      350: { a: "L'US Air Force, qui désirait créer un réseau de communication capable de résister à une attaque nucléaire.",
             b: "Coca-Cola, qui voulait toucher instantanément ses grossistes.", 
             c: "Le conservateur de la bibliothèque du Congrès de Washington." },
    };
    if (MANUAL_OPTS[id]) {
      Object.assign(q, MANUAL_OPTS[id]);
    }

    // ── Cas particuliers manuels ──────────────────────────────────────

    // Q51 : association monstres ↔ descriptions
    if (id === 51) {
      classic.push({
        id: pid, mode: 'classic', difficulty: diff, category: cat,
        prompt: normalizeSpaces(
          `${q.prompt} (a = Sirène, b = Satyre, c = Minotaure, d = Chimère, e = Gorgone)`,
        ),
        answer:
          "a\u21925 (mi-femme, mi-oiseau) ; b\u21921 (corps d'homme, membres de cheval) ; c\u21924 (tête de taureau) ; d\u21922 (lion, chèvre, serpent) ; e\u21923 (femme aux serpents dans la chevelure)",
        aliases: [],
        tags: ['pdf-culture-generale'],
      });
      continue;
    }

    // Q92 : deux bonnes réponses b et c
    if (id === 92 && ans.letter === 'special') {
      classic.push({
        id: pid, mode: 'classic', difficulty: diff, category: cat,
        prompt: q.prompt,
        answer: normalizeSpaces(ans.rest),
        aliases: [q.b, q.c].filter(Boolean).map((x) => normalizeSpaces(x)),
        tags: ['pdf-culture-generale', 'double-reponse'],
      });
      continue;
    }

    // ── Lettre correcte
    const letter = ans.letter;
    if (!['a', 'b', 'c', 'd', 'e'].includes(letter)) {
      console.warn(`id ${id}: lettre invalide "${letter}"`);
      continue;
    }

    const correctLabel = q[letter];
    const correctLong  = normalizeSpaces(ans.rest.replace(/^[-\.—\s]+/, ''));

    // Helper : classique de secours.
    // On préfère l'option courte (correctLabel) comme réponse canonique :
    // elle est lisible et correspond à ce qu'un joueur écrirait.
    // Le texte long du corrigé (correctLong) peut servir d'alias si propre.
    const toClassic = (tag = '') => {
      const shortAnswer = correctLabel
        ? correctLabel.replace(/\.$/, '').trim()
        : null;
      // Garder l'alias uniquement s'il est propre : complet (finit par
      // ponctuation) et différent de la réponse courte.
      const longNorm = normalizeSpaces(correctLong ?? '');
      const isCleanAlias =
        longNorm.length > 3 &&
        longNorm.length < 120 &&
        longNorm !== shortAnswer &&
        /[.!?»]$/.test(longNorm); // phrase complète
      const longAlias = isCleanAlias ? longNorm : null;
      classic.push({
        id: pid, mode: 'classic', difficulty: diff, category: cat,
        prompt: q.prompt,
        answer: shortAnswer || correctLong?.slice(0, 80) || `réponse ${letter}`,
        aliases: longAlias ? [longAlias] : [],
        tags: ['pdf-culture-generale', tag].filter(Boolean),
      });
    };

    if (!correctLabel) {
      toClassic('ocr-option-manquante');
      continue;
    }

    const mode = classify(
      { prompt: q.prompt, a: q.a, b: q.b, c: q.c, d: q.d },
      correctLong,
    );

    if (mode === 'classic') {
      toClassic('');
      continue;
    }

    if (mode === 'estimation') {
      let numeric = extractNumeric(correctLabel, correctLong);
      if (numeric == null || isNaN(numeric)) {
        // Fallback QCM si on ne peut pas extraire le nombre
        const distractors = ['a','b','c','d']
          .filter((L) => L !== letter)
          .map((L) => q[L])
          .filter(Boolean);
        if (distractors.length >= 2) {
          qcm.push({
            id: pid, mode: 'qcm', difficulty: diff, category: cat,
            prompt: q.prompt, answer: correctLabel, distractors,
            tags: ['pdf-culture-generale'],
          });
        } else {
          toClassic('estimation-num-introuvable');
        }
        continue;
      }
      estimation.push({
        id: pid, mode: 'estimation', difficulty: diff, category: cat,
        prompt: q.prompt,
        numericAnswer: numeric,
        unit: unitFor(correctLabel, correctLong),
        tags: ['pdf-culture-generale'],
      });
      continue;
    }

    // QCM
    const distractors = ['a','b','c','d']
      .filter((L) => L !== letter)
      .map((L) => q[L])
      .filter(Boolean);
    if (distractors.length < 2) {
      toClassic('qcm-distracteurs-insuffisants');
      continue;
    }
    qcm.push({
      id: pid, mode: 'qcm', difficulty: diff, category: cat,
      prompt: q.prompt, answer: correctLabel, distractors,
      tags: ['pdf-culture-generale'],
    });
  }

  const outDir = path.join(ROOT, 'packages/content/seed');
  fs.mkdirSync(outDir, { recursive: true });
  fs.writeFileSync(path.join(outDir, 'pdf-quiz-qcm.json'),        JSON.stringify(qcm,       null, 2) + '\n');
  fs.writeFileSync(path.join(outDir, 'pdf-quiz-classic.json'),    JSON.stringify(classic,   null, 2) + '\n');
  fs.writeFileSync(path.join(outDir, 'pdf-quiz-estimation.json'), JSON.stringify(estimation,null, 2) + '\n');

  const total = qcm.length + classic.length + estimation.length;
  console.log(`Résultat (${total}/350) :`);
  console.log(`  QCM         : ${qcm.length}`);
  console.log(`  Classique   : ${classic.length}`);
  console.log(`  Estimation  : ${estimation.length}`);

  // Vérification rapide : exemples mal classés ?
  console.log('\n── Échantillon estimation (5 premiers) :');
  estimation.slice(0, 5).forEach(({ id, prompt, numericAnswer, unit }) =>
    console.log(` ${id} | ${prompt.slice(0, 60)} → ${numericAnswer} ${unit ?? ''}`)
  );
  console.log('\n── Échantillon QCM (5 premiers) :');
  qcm.slice(0, 5).forEach(({ id, prompt, answer }) =>
    console.log(` ${id} | ${prompt.slice(0, 60)} → ${answer}`)
  );
}

main();
