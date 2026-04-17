# Pipeline IA de génération — Phase 2

> Stub documenté. Non intégré au MVP. Les questions du MVP sont seedées depuis
> `packages/content/seed/*.json`.

## Objectif

Générer automatiquement des questions de qualité pour tous les modes, à partir
de **Wikipedia / Wikimedia** et d'un LLM, avec un workflow de review humaine
avant publication.

## Architecture cible

```
1. Sélection de sources     → Liste de pages Wikipedia / catégories ciblées (par thème)
2. Extraction de faits      → API Wikipedia REST (summary, infobox, wikidata)
3. Génération LLM           → Prompt par mode (classic / estimation / list-turns)
4. Validation structurée    → Zod schemas (types partagés packages/shared)
5. Persistance              → Prisma, status=draft
6. Review humaine           → Back-office Next.js, status=published
7. Export                   → Re-seed des fichiers JSON publics si besoin
```

## Prompts par mode (briefs)

### classic
- Une question factuelle non ambiguë.
- Une réponse canonique + 2-4 aliases (orthographes, variantes).
- Difficulté : estimée par le LLM (easy/medium/hard).

### estimation
- Une question numérique avec une réponse **vérifiable** dans Wikidata.
- `unit` obligatoire quand pertinent.
- Refuser les valeurs qui changent trop souvent (populations annuelles OK mais
  marquer avec `source` daté).

### list-turns
- Une question ouverte avec **au moins 8** réponses valides.
- `validItems[]` doit inclure toutes les variantes typographiques attendues
  (minuscules, accents retirés, abréviations).

## Pseudocode

```ts
// packages/content/ai/generate.ts (à implémenter en phase 2)
async function generate(sourceTitle: string, mode: GameModeId) {
  const summary = await fetchWikiSummary(sourceTitle);
  const facts = await fetchWikidataFacts(sourceTitle);
  const raw = await llm.completion({ system: PROMPTS[mode], user: JSON.stringify({ summary, facts }) });
  const parsed = QuestionSchema.parse(JSON.parse(raw));
  await prisma.question.create({ data: { ...parsed, status: 'draft' } });
}
```

## Anti-patterns à éviter

- Ne **jamais** publier sans review humaine (hallucinations possibles).
- Ne pas stocker de contenus sous copyright (textes Wikipedia : OK en CC BY-SA,
  mais **reformuler** les prompts).
- Ne pas générer en lot sans quota : prévoir rate-limit Wikipedia (1 req/s).
