# Clawcade design lab

Updated: 2026-11-05

## Product truth

The public build is an **alpha arcade**. Its automated checks prove that the
controls and state machines work; they do not prove that the games are fun.
This iteration is successful only when a player shows mastery, makes a choice
that changes the run, understands a loss, and voluntarily plays again.

## Research principles

- **Fair failure:** Super Hexagon's creator describes difficulty as fair when a
  player recognizes their own mistake and can learn the pattern.
- **One strong verb:** Downwell grew from a tiny mobile input vocabulary and one
  mechanic with multiple consequences. New features must deepen the core verb.
- **Constraints create identity:** WarioWare's five-second format works because
  each prompt is instantly legible, not because it is loud or random.
- **Shared problems create conversation:** Wordle's common daily puzzle made
  results comparable. A daily seed may add a social layer, but cannot rescue a
  weak core loop.
- **Iteration is the work:** Threes documented 423 days between a recognizable
  prototype and the finished game. A working loop is the starting point.
- **Competence, autonomy, relatedness:** solo games need visible learning and
  meaningful choices; multiplayer gets relatedness from another human.

Primary and creator sources:

- Threes development archive: https://asherv.com/threes/threemails/
- WarioWare developer interview: https://iwataasks.nintendo.com/interviews/wii/warioware_smooth_moves/0/0/
- Downwell GDC talk: https://gdcvault.com/play/1023533/Polishing-the-Boots-Designing-Downwell
- Simon Tatham's Mines rules: https://www.chiark.greenend.org.uk/~sgtatham/puzzles/doc/mines.html
- Telegram Mini Apps API: https://core.telegram.org/bots/webapps
- Apple accessibility guidance: https://developer.apple.com/design/human-interface-guidelines/accessibility

## Portfolio decision

### 1. Claw Four — keep and finish the social contract

The opponent already supplies prediction, counterplay, stories, and replay
variance. The product work is cadence and trust, not a novelty rule.

Prototype:

- best-of-three set score;
- alternate first player;
- preserve the winning board;
- both players must request the next round;
- identify returning players with a private token rather than a display name;
- reset/leave actions require a player identity;
- show the winning four and the set state.

Kill/reverse if the ready ceremony creates more waiting than anticipation.

### 2. Abyss Expedition — rebuild around deduction plus commitment

The current 5×5 board often opens most of its safe cells on the first tap. It is
a tutorial, not a durable logic game.

Prototype:

- a run has three solver-verified boards of increasing size/density;
- time is a tiebreaker, not the primary objective;
- after a clear, Surface banks the expedition or Descend risks the run;
- one Sonar can reveal a 3×3 mine count, but marks the result assisted;
- never fall back to an unverified board;
- record seed, first-open size, actions, chords, sonar, and failure reason.

The meaningful decision is whether the player trusts their deduction enough to
risk the expedition. Reverse if everyone always makes the same choice.

### 3. Kraken Wager — one bounded attempt to earn survival

The current Simon loop rewards good play with longer forced playback. Tempo is
not agency.

Prototype:

- bounded sequence windows rather than replaying an ever-growing prefix;
- after each clear, choose Safe (one new cue) or Deep (two cues and more depth);
- one Ink Replay per run replays the current window but marks the run assisted;
- later rounds replace old cues so playback stays short;
- losses distinguish recall errors from misunderstood rules.

Reverse if Safe/Deep is mathematically or behaviorally fake, or if players still
spend more time watching than acting.

### 4. Tide Tell — replace Shell Shuffle and Reef Reflex

Static matching is luck-heavy and raw reaction time is device-heavy. Tide Tell
combines their useful pieces into a rule-switching read game.

Prototype:

- a clear rule says Tap, Hold, or Do Nothing for a creature category;
- rules visibly change every short wave;
- accuracy is scored before response time;
- a clean wave offers Bank or Dive into faster/less obvious cues;
- icon, word, shape, and position carry the cue; color/audio are redundant;
- misses break a combo but do not immediately end a run.

Reverse if players cannot explain the rule they violated, or if experienced
players plateau without developing a tactic.

## Human evidence plan

Automated tests remain responsible for state, accessibility markup, overflow,
deterministic generation, and server contracts. Human sessions answer the fun
questions.

Use blind first play on a real phone. Ask players to complete one run, then give
them free choice. Observe before interviewing:

- immediate replay without prompting;
- choosing the same cabinet during free choice;
- naming a tactic and changing it next round;
- explaining a loss as their own decision rather than luck, lag, or UI;
- hesitation at a real risk decision;
- spontaneous challenge/share behavior;
- return on another day.

After observation, ask only: **What were you trying to do?** and **Why did you
lose?** “Was it fun?” is too easy to answer politely.

Anonymous instrumentation may record session-scoped game events, seeds, choices,
results, replays, exits, and visibility changes. It must not store Telegram
identity, player names, or init data.

## Current lab evidence

This evidence establishes implementation quality, **not fun**:

- A 3,000-board generator audit (1,000 per depth) produced no instant clears.
  Median opening sizes were 13/21, 16/29, and 19/39 safe cells; all accepted
  boards were solver-verified and stayed below the configured 70% opening cap.
- Unit and API tests cover deterministic seeds, board solvability, bounded
  sequence transforms, Tide input classification, winning-line detection,
  private player tokens, best-of-three scoring, mutual rematch consent, and new
  set reset.
- A real Chrome mobile lab completed three Kraken trials, two Abyss depths plus
  a Surface decision, a perfect Calm Tide wave, and an intentional Deep failure.
  The same run checked 360, 390, and 430 pixel viewports with no horizontal
  overflow, unnamed enabled buttons, or page exceptions.
- The design lab remains local. The public arcade has not been replaced, and no
  human enjoyment claim has been made.

## Release rule

Do not call a prototype finished because tests pass. Promote a cabinet only
after its rules are understood without coaching, failure is attributable, a
repeat attempt shows learning, and at least some players voluntarily replay it.
