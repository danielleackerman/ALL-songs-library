# Quick Search

## Search by Title

```dataview
TABLE artist, key, energy
FROM "songs"
WHERE contains(lower(title), "amazing")
SORT title ASC
LIMIT 10
```

## Multi-Filter

```dataview
TABLE artist, tempo
FROM "songs"
WHERE key = "F" AND energy = "slow" AND contains(tags, "worship")
SORT title ASC
LIMIT 10
```

## Multiple Tags

```dataview
TABLE artist, key, energy
FROM "songs"
WHERE contains(tags, "black-gospel") AND contains(tags, "choir")
SORT title ASC
LIMIT 10
```

## Search Artist

```dataview
TABLE key, energy, tempo
FROM "songs"
WHERE contains(lower(artist), "lanny")
SORT title ASC
LIMIT 10
```
