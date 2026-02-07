import ICON_INDEX from "./data/icon-index.json";

export type IconEntry = {
  name: string;
  codepoint?: number;
};

type IconEntryLookup = {
  map: Map<string, IconEntry>;
  list: IconEntry[];
  variableWeights?: boolean;
};

const iconSetLookup = new Map<string, IconEntryLookup>();

for (const set of ICON_INDEX.sets) {
  const lookup: IconEntryLookup = {
    map: new Map(),
    list: set.icons,
    variableWeights: set.variableWeights,
  };

  for (const entry of set.icons) {
    lookup.map.set(entry.name, entry);
  }

  for (const family of set.families) {
    iconSetLookup.set(family, lookup);
  }
}

export function lookupIconSet(name: string): IconEntryLookup | undefined {
  return iconSetLookup.get(name);
}

export function lookupIconEntry(
  iconSet: IconEntryLookup,
  name: string,
): IconEntry | undefined {
  const iconEntry = iconSet.map.get(name);
  if (!iconEntry) {
    return;
  }

  return iconEntry;
}
