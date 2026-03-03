
Good — let's think this through before building it.

The original compound tag like `"Black-Gospel-Choir-Choruses-Congregational-Contemporary-Medium-Praise-Solo-Songs-Southern-Gospel-Traditional-Worship"` was your style fingerprint — songs sharing that exact combination have the same musical DNA. The question is how to preserve that concept in a usable way.

Here are the real options:

**Option A: Auto-generate short descriptive names.** I scan each compound tag and pick the 2-3 most _distinctive_ elements — typically the genre + energy level, since tags like "Choir", "Choruses", "Congregational", "Solo-Songs", "Traditional", "Worship" appear on almost everything and don't differentiate. So `"Black-Gospel-Choir-Choruses-Congregational-Contemporary-Medium-Praise-..."` becomes something like `"black-gospel-medium-praise"`. The full compound still gets logged in the legend file for traceability.

**Option B: Numbered IDs + legend.** `profile-001`, `profile-002`, etc. Clean and short but meaningless until you manually rename them. The legend CSV maps each ID to the full original string.

**Option C: Drop the profile field entirely.** Your individual tags already capture everything. If you want "show me all songs with this exact vibe," that's a Supabase query: `WHERE tags @> ARRAY['black-gospel','medium','praise']`. The profile might be solving a problem that proper tag filtering already handles.

**Option D: Keep the full compound but only in the legend.** The `profile` field in frontmatter stays empty for now. The legend file documents every unique compound tag found across your vault with a count of how many songs share it. Later, when you're building the PWA, you decide which groupings actually matter and assign profile names manually to the ones you care about.

My honest take — Option A gives you the most immediate value without busywork. But Option C is worth considering if you think tag filtering in the PWA will be strong enough. What's your instinct?

That changes everything — I was treating them as redundant when they're actually a structured lookup key. Yes, upload the CSV. That's the master CSV your Python script references (`all-songs-songbook_master.csv`), right?

Once I see the column headers, I'll understand what each segment of the compound tag maps to. Right now I'm guessing, and that's why I was wrong about shortening them.

Here's what I need to figure out from the CSV:

- What the columns are (genre? style? tempo category? voicing?)
- Whether every song has one value per column or multiple
- Whether the compound string is the columns concatenated in a fixed order or freeform
- How many unique compound strings exist across 2,500 songs (if there are 50, profiles are manageable — if there are 1,500, we need a different strategy)

Upload the master CSV and I'll map it out. Don't upload the song.csv (that's huge) — just the master/lookup CSV and the Topic.csv if you have it. Those are the two your Python script used for tag building.

You're right, I did say that, and I should deliver on it. Let me lay out how the shortening would actually work.

**The shortening logic uses your rubric.** Since every compound tag follows the same axes (genre + tempo + direction + type), I can parse it and pull the distinctive values:

`"Black-Gospel-Choir-Choruses-Congregational-Contemporary-Medium-Praise-Solo-Songs-Southern-Gospel-Traditional-Worship"`

Parsing that against your rubric:

- Genre: Black-Gospel, Southern-Gospel, Contemporary, Traditional
- Tempo: Medium
- Direction: Praise, Worship
- Type: Choir, Choruses, Congregational, Solo-Songs

The short profile picks the primary from each axis: `bg-med-praise-mixed`

Where "bg" = Black-Gospel (the dominant genre), "med" = Medium, "praise" = the direction, "mixed" = multiple voicing types.

**But here's the problem.** That same compound tag appears on many songs — it's a category, not unique per song. If I shorten it inconsistently (sometimes picking "Southern-Gospel" as primary, sometimes "Black-Gospel"), the grouping breaks. And some calls are ambiguous — when a song is tagged both Black-Gospel AND Southern-Gospel, which is primary?

**My recommendation:** I auto-generate the short name, but you have final say. Here's the workflow:

1. Script scans all files, finds every unique compound tag
2. Generates a `_profile_legend.csv` with three columns: `short_name`, `full_compound`, `song_count`
3. The short name goes in frontmatter, the full compound is preserved in the legend
4. You review the legend, rename any short names that don't feel right
5. Re-run the script with the edited legend as input — it applies your names

**For "OS-GOSPEL-MED"** — you're right, that's already a short profile from your keywords field. Those go in the same `profile` array, lowercased to `os-gospel-med`. They're the same concept, just from a different source.

So frontmatter would look like:

```yaml
profile:
  - "bg-med-praise-mixed"
  - "os-gospel-med"
```

And `_profile_legend.csv`:

```
short_name, full_compound, song_count
bg-med-praise-mixed, "Black-Gospel-Choir-Choruses-Congregational-Contemporary-Medium-Praise-Solo-Songs-Southern-Gospel-Traditional-Worship", 47
os-gospel-med, "OS-GOSPEL-MED", 112
```

Everything lowercase — yes, I missed that on the profiles. Will fix.

Does this approach work, or would you rather manually name them all from a list up front?

That's important. So the compound tags have inherited errors from the CSV — a song shouldn't be both Black-Gospel and Southern-Gospel, but it ended up that way because you had both genres in the same header cell and the extraction grabbed everything.

That means two things:

**First, we can't auto-shorten profiles yet.** The compound tags contain noise. If I generate `bg-sg-med-praise` from a bad compound, I'm baking the error into the short name. We'd be polishing garbage.

**Second, this is actually fixable** — but it's a manual pass, not a script pass. Here's what I'd do:

1. Script runs as planned, but puts the full compound tag in `profile` as-is (lowercased). No shortening yet.
2. Script generates `_profile_legend.csv` listing every unique compound tag and how many songs use it.
3. You review that legend — probably 30-50 unique profiles across 2,500 songs. For each one, you mark the correct genre (Black-Gospel OR Southern-Gospel, not both).
4. You add a `short_name` column with your preferred abbreviation.
5. Script re-runs using your edited legend as a lookup — applies your corrected short names.

Step 3 is probably a 30-minute task since you know your catalog. And it fixes the problem at the root instead of papering over it.

**For this first pass on the A files**, I'll keep profile as the full compound (lowercased), generate the legend, and skip the shortening. Sound right? That way we're not blocked — everything else in the normalization keeps moving, and the profile cleanup becomes a focused side task once you have the legend in hand.