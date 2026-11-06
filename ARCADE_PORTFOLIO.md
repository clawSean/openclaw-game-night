# Clawcade cabinet portfolio

Updated: 2026-11-06

## Product direction

Clawcade is a **broad seaside arcade**, not a four-game showcase. Breadth is
valuable when it covers different player fantasies, primary verbs, skill types,
and social textures. A cabinet does not earn its slot merely by working or by
wearing a different sea-creature skin.

The portfolio grows when a new cabinet adds a genuinely different fantasy,
verb, skill, or social relationship. There is no artificial upper cap and no
slot-filling quota. Beta may hold unfinished lab versions, but production
promotion remains cabinet-by-cabinet.

## Evidence that changes the design

- Nintendo describes WarioWare as more than 200 lightning-fast microgames that
  last only a few seconds. The transferable lesson is instant action plus
  authored surprise—not copying its prompts, characters, or cadence.
- Super Mario Party Jamboree pairs more than 110 minigames with solo, co-op,
  competitive, party, and skill-oriented modes. Breadth works because the
  activities cover different skills and social relationships.
- GamePigeon spans sports, words, tactics, and dexterity inside an existing
  conversation. Plato similarly combines many games with chat. Their durable
  advantage is relationship context and low rematch friction, not mechanical
  novelty in every title.
- Player-review evidence across GamePigeon, Plato, SongPop Party, Crossy Road,
  Super Hexagon, Downwell, Threes, and party collections repeatedly rewards
  immediate comprehension, fast retry, strong feedback, visible mastery, and
  effortless social play. It repeatedly punishes setup friction, perceived
  rigging, progress loss, interruption, repetition without evolving decisions,
  and imprecise controls.
- The Threes development archive documents 423 days of iteration. A playable
  prototype is evidence that a loop can be tested, not that it is finished.

Primary/reference sources:

- WarioWare: Move It: https://www.nintendo.com/us/store/products/warioware-move-it-switch/
- Super Mario Party Jamboree: https://www.nintendo.com/us/store/products/super-mario-party-jamboree-switch/
- GamePigeon: https://apps.apple.com/us/app/gamepigeon/id1124197642
- Plato: https://www.platoapp.com/
- Spaceteam: https://apps.apple.com/us/app/spaceteam/id570510529
- Threes archive: https://asherv.com/threes/threemails/
- Telegram Mini Apps: https://core.telegram.org/bots/webapps
- Copyright Office Circular 33: https://www.copyright.gov/circs/circ33.pdf

Perplexity's primary and fallback Agent API credentials both returned `401` in
this research pass. No Perplexity result is represented here. Primary pages,
store pages/review samples, and three context-separated Think Tank seats were
used instead.

## Cabinet admission rule

A cabinet must have all five:

1. **Immediate verb:** the first meaningful action is legible in seconds.
2. **Agency:** choices or execution materially change the outcome.
3. **Attributable failure:** the player can say why they lost.
4. **Learnable tactic:** a replay supports a different or improved approach.
5. **Voluntary replay:** the result flow makes another attempt desirable and
   nearly instant.

Hard failures are not averaged away: inaccessible input, opaque randomness,
unreadable state, clone-level similarity, and device-dependent unfairness block
promotion. Presentation is allowed to amplify fun, but not impersonate it.

## Coverage map

| Cabinet | Primary verb | Fantasy | Skill / social texture | Status |
|---|---|---|---|---|
| Claw Four | Drop | Outsmart a rival | Live tactical duel | Original / upgraded |
| Kraken Sequence | Echo | Survive an escalating dive | Classic memory | Original preserved |
| Abyss Sweep | Scan | Clear a compact reef | Classic deduction | Original preserved |
| Shell Shuffle | Match | Catalog sea creatures | Recall + efficiency | Original preserved |
| Reef Reflex | Strike | Beat your own reaction time | Dexterity | Original preserved |
| Abyss Expedition | Scan | Survive a dangerous dive | Deduction + commitment | Lab |
| Kraken Current | Echo | Decode a creature's signal | Memory transformation | Lab |
| Tide Tell | Obey | Keep composure under deception | Inhibition + risk | Lab |
| Echo Wake | Move | Outsmart your past self | Delayed spatial planning | Wave 1 |
| Pearl Ricochet | Flick | Make an impossible trick shot | Aim + rebound planning | Wave 1 |
| Shell Shift | Slide | Repair a living reef | Discrete board optimization | Wave 1 |
| Clawcade Panic | Act | Survive ridiculous emergencies | Authored gesture comedy | Original preserved |
| Panic: Director's Cut | Perform | Survive a directed undersea disaster reel | Gesture comedy + boss sequence | Flagship beta |
| Signal Storm | Communicate | Save a failing submarine | Asymmetric live co-op | Flagship beta |
| Ghost Fleet | Program | Outsmart a rival ghost captain | Simultaneous hidden-order duel | Flagship beta |
| Salvage Auction | Bid | Read rival captains | Scarcity + bluff | Wave 2 |
| Wordwreck | Trace | Recover a sunken logbook | Words + spatial planning | Wave 2 |
| Drumline Depths | Pulse | Answer a whale orchestra | Rhythm + pattern | Wave 2 |
| Squid Sketch | Sketch | Communicate with one ink stroke | Creative group play | Wave 3 |
| Beam Keeper | Rotate | Guide ships through haunted fog | Route construction | Wave 3 |

The coverage rule prevents disguised duplicates. Kraken owns memory, Tide owns
rule inhibition, and Panic owns rapid gesture switching and comedy. Abyss owns
solo information risk; Auction owns opponent-driven scarcity. Pearl is
continuous aim; Shell Shift is discrete planning; Beam Keeper is routing.
Signal Storm owns asymmetric spoken coordination; Ghost Fleet owns simultaneous
programming and prediction. Director's Cut owns authored spectacle and a
multi-phase boss, while the original Panic cabinet remains intact.

## Wave 1 experiments

### Echo Wake

Move across a compact reef collecting pearls. Every move leaves a numbered wake
that erupts three turns later. The board is a visible queue: the player plans a
route while avoiding hazards created by their own past decisions.

- Signature: delayed-self interaction; the enemy is your own route.
- Failure must name the exact earlier move that created the collision.
- Kill if players describe eruptions as random after one guided example.

### Pearl Ricochet

Drag from a pearl to aim, release to fire, and bank through coral gates. A
trajectory guide makes the input honest; currents and gate order create planning
beyond raw dexterity.

- Signature: satisfying one-finger trick shots with deterministic rebounds.
- Failure must distinguish bad aim from exhausted shots.
- Kill if physics differs materially across supported devices.

### Shell Shift

Shift whole reef rows or columns to create shell clusters while a forecast tide
adds pressure from a known edge. Each move changes both the current match and the
next board state.

- Signature: the only moves are whole-line currents, not swapping two tiles.
- Failure must expose the forecast piece and the move that stranded the board.
- Kill if lucky cascades dominate planning.

### Clawcade Panic

A short gauntlet of original, authored microgames uses a shared vocabulary of
tap, hold, drag, flick, and wait. Each scene delivers a readable command, an
undersea gag, and a fast success/failure beat.

- Signature: authored surprise and comedy, not a random gesture quiz.
- Start with a small set of polished scenes; content count is not a substitute
  for legibility or delight.
- Kill any scene that needs prose explanation or repeats another cabinet's full
  decision structure.

## Human evidence

Automation proves deterministic rules, accessibility markup, input bounds,
state transitions, reconnection behavior, and layout. It cannot prove delight.

For each cabinet, observe a first attempt without spoken coaching, then free
choice. Record whether the player:

- makes a valid first move quickly;
- explains the loss in their own words;
- names a tactic they would change;
- replays without being prompted;
- chooses the cabinet again after trying others;
- remembers and chooses it on a later session.

Do not turn these observations into fake industry benchmarks. They are evidence
for comparing prototypes and finding failure modes. Same-session replay can mean
confusion or politeness; a later voluntary return is stronger evidence.

## Presentation and platform floor

- One-tap replay/rematch; no menu round trip.
- Clear cause-and-effect feedback and distinct cabinet sound identities.
- No ads, energy, currencies, forced streaks, or interruption economy.
- Color, sound, and motion are never the only cue; reduced motion and mute must
  preserve the game.
- Large thumb-safe targets and no precision gesture against browser edges.
- Telegram viewport, Back Button, safe areas, persistence, visibility changes,
  and reconnect behavior are part of game quality.
- Borrow abstract gameplay lineages, never protected names, assets, text,
  characters, board presentation, audiovisual cadence, or level content.
