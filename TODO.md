# TODO

## Null handling review (all data structures)

Null and `undefined` item values are handled inconsistently. Establish the rules first, then check every data structure against them.

**Rules to decide:**
- Whether `null` / `undefined` are valid items or are rejected on insert.
- If they are valid items, how they differ from the "empty / no match" `null` that collection methods return (see Known Deviations in `CLAUDE.md`).
- Whether `values()`, iterators, `filter`, `query`, and `stringify` include or skip them. They must all agree.

**Known inconsistencies in `LinkedList` (`src/linked/list.ts`):**
- `values()` skips `null` using `!== null`, while `filterValues` skips with `!= null`.
- The iterator (`src/linked/list/iterator.ts`) yields `null` values, so `[...list]` and `list.values()` can differ.
- `query` never matches an element whose value is `null`.
- `insert(undefined)` stores `null`, because `LinkedListElement.value(undefined)` is treated as a getter call.

**Then:** check every other data structure (Trees, Graphs, `CircularQueue`, `HashTable`, `ObjectPool`, `PriorityQueue`, `Queue`, `Stack`, `Trie`) against the rules, and record them in `CLAUDE.md`.
