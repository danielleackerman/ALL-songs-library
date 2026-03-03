# Worship Flow Planner

Use this to build a set by energy arc. Typical flow: medium-fast opener, high energy praise, medium transition, slow worship, slow-reverential altar call.

## High Energy (Openers / Praise)
```dataview
TABLE artist, key, tempo
FROM "songs"
WHERE energy = "high"
SORT title ASC
LIMIT 15
```

## Medium-Fast
```dataview
TABLE artist, key, tempo
FROM "songs"
WHERE energy = "medium-fast"
SORT title ASC
LIMIT 15
```

## Medium
```dataview
TABLE artist, key, tempo
FROM "songs"
WHERE energy = "medium"
SORT title ASC
LIMIT 15
```

## Medium-Slow (Transitions)
```dataview
TABLE artist, key, tempo
FROM "songs"
WHERE energy = "medium-slow"
SORT title ASC
LIMIT 15
```

## Slow 
```dataview
TABLE artist, key, tempo
FROM "songs"
WHERE energy = "slow"
SORT title ASC
LIMIT 15
```

## Songs with Matching Keys (for smooth transitions)
Change the key below to plan transitions:
```dataview
TABLE artist, energy, tempo
FROM "songs"
WHERE key = "F" AND (energy = "slow" OR energy = "medium-slow")
SORT energy ASC
LIMIT 15
```
