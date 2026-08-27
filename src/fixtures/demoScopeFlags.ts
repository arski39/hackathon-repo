/** The canned scope check for SCOPE_CREEP_MESSAGE, served by Demo Mode.
 *
 *  Every "quote" is a verbatim substring of the parsed follow-up body —
 *  validateScopeFlags drops any flag whose quote isn't really there, so if you
 *  edit SCOPE_CREEP_MESSAGE you must edit these or the flags silently vanish.
 *  `npm run check` guards it.
 *
 *  Note what it does NOT do: every suggestedPriceCents is null. The hero record
 *  prices the reels as one lump of 2k for the bundle and leaves the stills
 *  unpriced, so there is no per-unit rate anywhere in it to derive a cutdown or
 *  a story frame from. Inventing one is precisely what §8 forbids, so all three
 *  flags hand the user an empty box instead. That is the honest answer and it
 *  is also the demo: the tool would rather show nothing than make a number up.
 */
export const DEMO_SCOPE_FLAGS = JSON.stringify(
  {
    flags: [
      {
        whatWasAsked: '30s cutdown for YouTube pre-roll',
        differenceFromRecord:
          'The record lists 3 vertical reels at 15s for the launch. A 30s cutdown for pre-roll is not one of them.',
        source: {
          quote: 'could we also get a 30s cutdown for the youtube pre-roll',
          messageId: 'msg_3',
        },
        suggestedPriceCents: null,
        priceBasis: null,
      },
      {
        whatWasAsked: 'Story frames built from the feed stills',
        differenceFromRecord:
          'The record covers 6 stills for the feed. It does not cover story frames.',
        source: {
          quote: 'can you throw the stills into a couple of story frames as well',
          messageId: 'msg_3',
        },
        suggestedPriceCents: null,
        priceBasis: null,
      },
      {
        whatWasAsked: 'Paid media usage for one reel, Sweden',
        differenceFromRecord:
          'The record grants no usage rights at all. Running a reel as a paid ad in Sweden is a use it does not cover.',
        source: {
          quote: 'the client wants to run one of the reels as a paid ad in sweden',
          messageId: 'msg_3',
        },
        suggestedPriceCents: null,
        priceBasis: null,
      },
    ],
  },
  null,
  2,
)
