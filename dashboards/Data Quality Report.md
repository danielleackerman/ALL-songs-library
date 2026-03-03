# Data Quality Report

## Songs Missing Tempo
```dataview
TABLE artist, key, energy
FROM "songs"
WHERE !tempo
SORT title ASC
```

## Songs Missing Key
```dataview
TABLE artist, tempo, energy
FROM "songs"
WHERE !key
SORT title ASC
```

## Songs Missing Artist
```dataview
TABLE key, energy
FROM "songs"
WHERE !artist OR artist = ""
SORT title ASC
```

## Songs Missing Energy
```dataview
TABLE artist, key, tempo
FROM "songs"
WHERE !energy OR energy = ""
SORT title ASC
```

## Songs with No Tags
```dataview
TABLE artist, key
FROM "songs"
WHERE !tags OR length(tags) = 0
SORT title ASC
```

## Songs with No Profile
```dataview
TABLE artist, key, energy
FROM "songs"
WHERE !profile OR length(profile) = 0
SORT title ASC
```

## Songs with Source Info (verify these)
```dataview
TABLE artist, source
FROM "songs"
WHERE source AND source != ""
SORT title ASC
```

## Songs with Year Extracted
```dataview
TABLE artist, year
FROM "songs"
WHERE year
SORT year ASC
```
