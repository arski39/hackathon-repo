/** The canned extraction for HERO_THREAD, served by Demo Mode.
 *
 *  Every "quote" below is a verbatim substring of the parsed message body —
 *  validateRecord drops any that isn't, so if you edit HERO_THREAD you must
 *  edit these too or the provenance lines silently disappear.
 *
 *  Note what it deliberately does NOT do: usageRights stays null because the
 *  thread never mentions rights, and the whole 2k lands on the reels rather
 *  than being split across both lines. Splitting a budget is the user's call. */
export const DEMO_EXTRACTION = JSON.stringify(
  {
    clientName: 'Nina',
    projectName: 'Launch content',
    deliverables: [
      {
        description: '3 vertical reels, 15s, for launch',
        quantity: 1,
        unitPriceCents: 200000,
        source: {
          quote: '3 reels for the launch, vertical, 15s ish',
          messageId: 'msg_1',
        },
        priceSource: { quote: 'budget-ish 2k', messageId: 'msg_1' },
      },
      {
        description: 'Still image for feed',
        quantity: 6,
        unitPriceCents: null,
        source: {
          quote: 'some stills we can use on the feed. maybe 5 or 6 of those',
          messageId: 'msg_1',
        },
        priceSource: null,
      },
    ],
    revisionsIncluded: null,
    deadline: '2026-09-12',
    usageRights: null,
    paymentTerms: { depositPercent: null, netDays: null },
    notes:
      'The 2k is stated as one lump for the whole job and is sitting on the reels line as a package price, so the stills are currently unpriced. Quantity of stills is "5 or 6" — confirm before quoting.',
    fieldSources: {
      clientName: null,
      projectName: { quote: 'do the content for it', messageId: 'msg_1' },
      deadline: { quote: "we'd need it by the 12th", messageId: 'msg_1' },
      usageRights: null,
      revisionsIncluded: null,
      depositPercent: null,
      netDays: null,
    },
  },
  null,
  2,
)
