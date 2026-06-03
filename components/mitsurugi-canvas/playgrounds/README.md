# Playground JSON scenarios

Use this shape for importable playground files:

```json
{
  "schemaVersion": 1,
  "id": "starter-habakiri-prayers",
  "name": "Habakiri + Prayers",
  "description": "Short note shown in the scenario library.",
  "tags": ["starter", "ritual"],
  "initialHand": ["habakiri", "prayers"],
  "gameState": {
    "hand": ["habakiri", "prayers"],
    "field": [],
    "graveyard": [],
    "banished": [],
    "deck": ["saji", "aramasa", "kusanagi"],
    "extraDeck": ["dyna-mondo", "ip", "sp"],
    "opponentAction": "none",
    "ritualSummoned": []
  },
  "steps": [
    {
      "sourceCardId": "habakiri",
      "actionId": "habakiri-summon-small",
      "targetCardId": "saji"
    }
  ]
}
```

Required fields: `schemaVersion`, `id`, `name`, and `initialHand`.

Optional fields: `description`, `tags`, `gameState`, and `steps`.

Valid zones in `gameState`: `hand`, `field`, `graveyard`, `banished`, `deck`, `extraDeck`.

Valid `opponentAction`: `none`, `specialSummon`, `activatedEffect`.

Card IDs and action IDs must match the IDs in `cards.ts`. Unknown IDs are ignored during import.
