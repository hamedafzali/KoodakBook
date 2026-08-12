#!/usr/bin/env python3
"""
Turn an exported word list into image_brief records the generator can run.

The central finding from the pilot is that ONE prompt strategy does not cover
this vocabulary. What a picture has to do differs by category, so the brief
differs by category:

  concrete   a plain portrait of the thing. Works well — this is most of the
             vocabulary and needs no special handling.
  colors     a plain filled circle, a colour swatch. Any recognisable object
             teaches that object's name instead of the colour.
  numbers    render_mode=count. SDXL cannot count and cannot draw glyphs; the
             count and the numeral are composited in code (compose.py) from a
             single generated sticker.
  opposites  handled as pairs with STRUCTURALLY different compositions (a
             frame-filling object vs a tiny one), not one scene with a
             different object emphasised — that produces two near-identical
             pictures for opposite words, which teaches nothing.
  people     every human figure reuses one fixed character description
             verbatim, because SDXL does not hold identity across runs.
  skip       words where a picture cannot carry the meaning and a WRONG
             picture actively mis-teaches. These are emitted with
             strategy="skip" and are never generated.

Usage:
  ./export-words.sh > words.json
  python3 build-briefs.py words.json > briefs.json
"""
import json
import sys

# One fixed character, reused verbatim wherever a person appears, so the set
# reads as one recurring child rather than a different child every card.
CHILD = (
    "the same recurring cartoon child character used across this whole set: "
    "round head, short black hair, warm tan skin, big round brown eyes, "
    "small round nose"
)

PALETTE = [
    "plain soft cream background", "plain soft mint background",
    "plain soft lavender background", "plain soft sky-blue background",
    "plain soft peach background", "plain soft warm-yellow background",
]

# Words where an image cannot carry the meaning. A child binds the word to
# whatever they see, so a plausible-but-wrong picture is worse than no picture:
# draw anything for "who" and the child learns that noun, not the question.
SKIP_WORDS = {
    "who", "what", "where", "when", "why", "how",
    "yes", "no", "maybe", "please", "thanks", "thank you", "sorry",
    "hello", "hi", "goodbye", "bye", "welcome",
    "and", "or", "but", "if", "the", "a", "an",
}
SKIP_CATEGORIES = {"questions"}

# Colour words → the hex the swatch should be. Anything not listed falls back
# to naming the colour in the prompt.
COLOR_HEX = {
    "red": "#E4342B", "blue": "#2B6CE4", "green": "#3AA655", "yellow": "#F5C518",
    "orange": "#F08A24", "purple": "#8B4FBF", "pink": "#F07FA8", "brown": "#8B5A2B",
    "black": "#2B2B2B", "white": "#FFFFFF", "grey": "#9AA0A6", "gray": "#9AA0A6",
}

# Number words → the count and the numeral to composite.
NUMBER_VALUE = {
    "zero": 0, "one": 1, "two": 2, "three": 3, "four": 4, "five": 5,
    "six": 6, "seven": 7, "eight": 8, "nine": 9, "ten": 10,
    "eleven": 11, "twelve": 12, "thirteen": 13, "fourteen": 14, "fifteen": 15,
    "sixteen": 16, "seventeen": 17, "eighteen": 18, "nineteen": 19, "twenty": 20,
}

# Opposite pairs rendered as a scale/position contrast on ONE shared object.
# value is (subject, composition) — deliberately different compositions so the
# two cards of a pair cannot be confused for each other.
OPPOSITE_FRAMING = {
    "big":   ("one single round red balloon, so enormous it barely fits in the frame",
              "the balloon fills almost the entire frame, cropped slightly at the edges, nothing else in the scene"),
    "small": ("one single round red balloon, tiny",
              "the balloon is small in the middle of a large empty background with generous empty space all around it"),
    "tall":  ("one single tall narrow tree, very tall and thin",
              "the tree spans the full height of the frame from bottom to top, tall and narrow"),
    "short": ("one single short stubby tree, low to the ground",
              "the tree is low and wide, occupying only the bottom third of the frame with empty space above it"),
    "long":  ("one single long pencil, very long and thin",
              "the pencil lies horizontally and spans the entire width of the frame edge to edge"),
    "up":    ("a single red arrow pointing straight upward, and a balloon floating high near the top",
              "the arrow points up and the balloon sits near the top edge of the frame with empty space below"),
    "down":  ("a single red arrow pointing straight downward, and a ball resting on the ground near the bottom",
              "the arrow points down and the ball sits near the bottom edge of the frame with empty space above"),
    "fast":  ("one cartoon rabbit running at speed with strong motion lines streaking behind it",
              "dynamic side profile, motion lines filling the space behind the rabbit"),
    "slow":  ("one cartoon turtle walking very slowly, no motion lines at all",
              "calm static side profile, plenty of still empty space around the turtle"),
    "hot":   ("a steaming mug with three wavy steam lines rising from it and a bright sun above",
              "centered mug with clear rising steam"),
    "cold":  ("a snowman with a scarf and snowflakes falling around it",
              "centered snowman with a few simple snowflakes"),
    "open":  ("a wooden door standing wide open, showing the gap through the doorway",
              "the door is clearly swung open with a visible opening"),
    "closed":("a wooden door shut tight in its frame, no gap visible",
              "the door is flat and fully shut, no opening visible"),
}

# Prepositions — NOT GENERATED. The pilot tested this directly: identical
# cat-and-table briefs differing only in "on top of" vs "underneath" produced
# two pictures that both show the cat ON the table. The model rendered the two
# objects faithfully and ignored the spatial word, which is the documented
# weak spot of CLIP-style text encoders — relations between objects are barely
# represented compared to the objects themselves.
#
# This is the one failure mode that must not be shipped: both cards look the
# same, so a child studying them learns that "under" and "on" mean the same
# thing. That is worse than having no picture at all, so these are skipped
# rather than retried with more prompt wording.
#
# The workable route is the numbers route — composite in code. A cat sprite and
# a table sprite placed by hand at chosen coordinates make the relation exact
# by construction instead of hoping the sampler honours a preposition. That is
# a proposal, not built here.
PREPOSITION_WORDS = {
    "on", "under", "inside", "outside", "behind", "in front of", "beside",
    "between", "above", "below", "near", "next to",
}

PEOPLE_CATEGORIES = {"family", "feelings"}
ACTION_CATEGORIES = {"actions"}


def brief_for(word: dict, index: int) -> dict:
    english = word["english"].strip().lower()
    category = word["category"]
    bg = PALETTE[index % len(PALETTE)]

    if english in SKIP_WORDS or category in SKIP_CATEGORIES:
        return {"strategy": "skip",
                "skip_reason": "no picture can carry this meaning; a plausible-but-wrong "
                               "image would teach the child the wrong concept"}

    if category == "colors":
        hexv = COLOR_HEX.get(english)
        shade = f"the exact colour {hexv}" if hexv else f"the colour {english}"
        return {
            "strategy": "color-swatch",
            "subject": f"one single plain filled circle, a flat colour swatch, solid {english} "
                       f"({shade}) all the way through with no gradient and no pattern",
            "composition": "one circle only, centered, large, filling most of the frame, perfectly flat",
            "background": "plain solid white background, completely empty otherwise",
            "cultural_notes": "a plain circle is used rather than a real object because any recognisable "
                              "object teaches that object's name instead of the colour",
            "avoid": ["any recognisable object", "multiple shapes", "gradient or shading",
                      f"any colour other than {english}", "text"],
        }

    if category == "numbers":
        value = NUMBER_VALUE.get(english)
        if value is None or value < 1 or value > 10:
            return {"strategy": "skip",
                    "skip_reason": f"no reliable way to depict the quantity '{english}' "
                                   "(zero has nothing to show; large counts do not read at a glance)"}
        return {
            "strategy": "count-composite",
            "render_mode": "count",
            "count": value,
            "count_object_subject": "a single simple five-pointed cartoon star, solid golden-yellow "
                                    "with a thick outline",
            "numeral_text": str(value),
            "background_hex": "#FBC7AE",
            "numeral_fill_hex": "#FFF6EE",
            "numeral_outline_hex": "#7A3B2E",
            "cultural_notes": "count and numeral are composited deterministically in code; the model "
                              "only ever draws one star",
            "avoid": [],
        }

    if english in OPPOSITE_FRAMING:
        subject, composition = OPPOSITE_FRAMING[english]
        return {
            "strategy": "opposite-contrast",
            "subject": subject,
            "composition": composition,
            "background": bg,
            "cultural_notes": "the two halves of an opposite pair must differ in COMPOSITION, not just "
                              "in which object is emphasised, or the two cards look the same to a child",
            "avoid": ["a second comparison object in frame", "text or labels", "arrows"],
        }

    if english in PREPOSITION_WORDS or category == "prepositions":
        return {
            "strategy": "skip",
            "skip_reason": "pilot-tested and failed: identical briefs differing only in 'on top of' vs "
                           "'underneath' both produced a cat ON the table. The model draws the objects "
                           "and ignores the relation, so opposite prepositions come out looking the "
                           "same - which teaches the child that they mean the same thing. Needs "
                           "code-composited sprites (the numbers approach), not more prompt wording.",
        }

    if category in PEOPLE_CATEGORIES or category in ACTION_CATEGORIES:
        return {
            "strategy": "fixed-character",
            "subject": f"{CHILD} - {english}",
            "composition": "centered, single figure, clear silhouette, three-quarter or side view",
            "background": bg,
            "cultural_notes": "reuses one fixed character description so the set reads as one recurring "
                              "child; SDXL does not hold identity across runs, so this is a mitigation "
                              "and every card still needs a human eye on it",
            "avoid": ["photorealistic face", "identifiable or real-person likeness",
                      "more than one character", "text"],
            "needs_hand_review": True,
        }

    return {
        "strategy": "concrete",
        "subject": f"one single {english}, drawn plainly and clearly",
        "composition": "centered, filling most of the frame, one object only",
        "background": bg,
        "avoid": ["more than one object", "other objects in frame", "text", "branding or logos"],
    }


def main():
    if len(sys.argv) < 2:
        print(__doc__, file=sys.stderr)
        sys.exit(2)
    with open(sys.argv[1], encoding="utf-8") as f:
        words = json.load(f)

    out, counts = [], {}
    for i, w in enumerate(words):
        brief = brief_for(w, i)
        counts[brief["strategy"]] = counts.get(brief["strategy"], 0) + 1
        out.append({**w, "image_brief": brief})

    print(json.dumps(out, ensure_ascii=False, indent=2))
    for k, v in sorted(counts.items(), key=lambda kv: -kv[1]):
        print(f"  {k:<20} {v}", file=sys.stderr)
    print(f"  {'TOTAL':<20} {len(out)}", file=sys.stderr)


if __name__ == "__main__":
    main()
