

**Related songs on individual song pages:** Add this block at the bottom of any song file's body (below the lyrics):

````
## Similar Songs
```dataview
TABLE artist, key, energy
FROM "songs"
WHERE any(profile, (p) => contains(this.profile, p)) AND file.name != this.file.name
SORT file.name ASC
```
````

That query finds all songs sharing any profile with the current song. You could also do one by energy:

````
## Same Energy
```dataview
TABLE artist, key
FROM "songs"
WHERE energy = this.energy AND file.name != this.file.name
SORT file.name ASC
```
````

**Or by key:

````
## Same Key
```dataview
TABLE artist, energy
FROM "songs"
WHERE key = this.key AND file.name != this.file.name
SORT file.name ASC
```
````

The magic is `this.` — it references the current file's frontmatter. So `this.profile` pulls from that song's own profile field.

````
### Tighten A: require at least 2 shared profile values

```dataview  
TABLE artist, key, energy  
FROM "songs"  
WHERE length(filter(profile, (p) => contains(this.profile, p))) >= 2  
AND file.name != this.file.name  
SORT file.name ASC  
LIMIT 10  
```
````



````
### Tighten B: require a primary profile match (if you have one)

If you add something like `profile_primary: slow` in YAML, then:

```dataview
TABLE artist, key, energy
FROM "songs"
WHERE profile_primary = this.profile_primary
  AND file.name != this.file.name
SORT file.name ASC
LIMIT 10
````
```