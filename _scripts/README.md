# _scripts

Node.js scripts for managing the song library.

## Setup (one-time)
```
cd _scripts
npm install
```
This installs `gray-matter` (reads YAML frontmatter from .md files).
The `node_modules/`, `package.json`, and `package-lock.json` files are all part of this — don't delete them.

## Scripts

### normalize-file-titles.js
Renames .md files so the filename matches the `title:` in frontmatter.

```
# Dry run (no changes)
node normalize-file-titles.js /path/to/songs

# Actually rename
node normalize-file-titles.js /path/to/songs --apply
```

### normalize_songs.js / normalize_songs1-4.js
Earlier scripts used to clean up frontmatter content after the SQLite export.
