# Worship Flow Planner

Use this to build a set by energy arc. Typical flow: medium-fast opener, high energy praise, medium transition, slow worship, slow-reverential altar call.

## Fast (Openers / Praise)
```dataview
TABLE artist, key, tempo, bpm
FROM "songs"
WHERE tempo = "fast"
SORT title ASC
LIMIT 15
```

## Medium-Fast
```dataview
TABLE artist, key, tempo
FROM "songs"
WHERE tempo = "medium-fast"
SORT title ASC
LIMIT 15
```

## Medium
```dataview
TABLE artist, key, tempo
FROM "songs"
WHERE tempo = "medium"
SORT title ASC
LIMIT 15
```

## Medium-Slow (Transitions)
```dataview
TABLE artist, key, tempo
FROM "songs"
WHERE tempo = "medium-slow"
SORT title ASC
LIMIT 15
```

## Slow 
```dataview
TABLE artist, key, tempo
FROM "songs"
WHERE tempo = "slow"
SORT title ASC
LIMIT 15
```

## Songs with Matching Keys (for smooth transitions)
Change the key below to plan transitions:
```dataview
TABLE artist, key, tempo
FROM "songs"
WHERE key = "F" AND (tempo = "slow" OR tempo = "medium-slow")
SORT energy ASC
LIMIT 15
```
