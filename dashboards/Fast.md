# Fast 
```dataview
TABLE artist, key, tempo
FROM "songs"
WHERE tempo = "fast"
SORT title ASC
LIMIT 50
```