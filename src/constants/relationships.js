export const RELATIONSHIP_TYPES = [
  "mother", "father", "parent", "child", "son", "daughter",
  "brother", "sister", "sibling", "spouse", "partner", "ex",
  "aunt", "uncle", "cousin", "nephew", "niece", "grandparent", "grandchild",
  "friend", "best friend", "coworker", "colleague", "boss", "subordinate",
  "neighbor", "associate", "contact", "rival", "other",
];

export const FAMILY_TYPES = new Set([
  "mother","father","parent","child","son","daughter",
  "brother","sister","sibling",
  "aunt","uncle","nephew","niece",
  "grandparent","grandchild",
  "spouse","partner","ex","cousin",
]);

export const PC_TYPES = new Set(["mother","father","parent","child","son","daughter"]);

export const REL_REVERSE = {
  "mother": "child",       "father": "child",       "parent": "child",
  "child": "parent",       "son": "parent",          "daughter": "parent",
  "brother": "sibling",    "sister": "sibling",      "sibling": "sibling",
  "spouse": "spouse",      "partner": "spouse",       "ex": "ex",
  "aunt": "relative",      "uncle": "relative",
  "nephew": "relative",    "niece": "relative",      "cousin": "cousin",
  "grandparent": "grandchild",                        "grandchild": "grandparent",
  "friend": "friend",      "best friend": "best friend",
  "coworker": "coworker",  "colleague": "colleague",
  "boss": "subordinate",   "subordinate": "boss",
  "neighbor": "neighbor",  "associate": "associate",
  "contact": "contact",    "rival": "rival",          "other": "other",
  "mentor": "mentee",      "mentee": "mentor",
};
