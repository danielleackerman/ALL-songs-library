# Song Dashboard

## Browse All Songs
```dataview
TABLE artist, key, energy, tempo
FROM "songs"
SORT title ASC
```

## By Key
```dataview
TABLE title, artist, energy
FROM "songs"
WHERE key = "Eb"
SORT title ASC
```

## By Energy
```dataview
TABLE title, artist, key, tempo
FROM "songs"
WHERE energy = "slow"
SORT title ASC
```

## By Artist
```dataview
TABLE title, key, energy
FROM "songs"
WHERE contains(artist, "Casting Crowns")
SORT title ASC
```

## By Tag
```dataview
TABLE title, artist, key, energy
FROM "songs"
WHERE contains(tags, "worship")
SORT title ASC
```

## By Profile
```dataview
TABLE title, artist, key, energy
FROM "songs"
WHERE contains(profile, "black-gospel-choir-choruses-congregational-contemporary-medium-praise-solo-songs-southern-gospel-traditional-worship")
SORT title ASC
```

## Songs Missing Tempo
```dataview
TABLE title, artist, key, energy
FROM "songs"
WHERE !tempo
SORT title ASC
```
