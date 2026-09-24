import { DAY, HOUR } from './config.js';

const MIN = 60 * 1000;
const ago = (d, h = 0, m = 0) => d * DAY + h * HOUR + m * MIN;

// Demo numbers use the +91 55… range, which isn't a valid Indian mobile prefix,
// and calling is disabled for demo contacts anyway.
const number = (i) => `9155${String(40000000 + i * 7919).slice(-8)}`;

/*
 * Each chat: [how long ago, 'me' | 'them', text, extra] — oldest first.
 * My messages default to read (blue ticks); `ack` on the last one sets the scenario.
 */
const CHATS = [
  // ---------- Call first: read your message and went quiet ----------
  {
    name: 'Ananya Iyer',
    msgs: [
      [ago(6, 3), 'them', 'Hi! Saw Brulé on Instagram 😍 Do you do corporate gift boxes? Need around 30 for Diwali'],
      [ago(6, 2, 40), 'me', 'Hi Ananya! Yes we do ☕ Our Dolce Vita box has 250g of house blend, a ceramic mug and postcards. ₹1,450 each, ₹1,250 each for 25+'],
      [ago(6, 2, 38), 'them', 'Ooh nice. Can you add our logo somewhere?'],
      [ago(6, 2, 30), 'me', 'Absolutely — we can print a custom note card with your logo in every box.'],
      [ago(4, 1), 'me', '', { type: 'document', body: '[document: Brule-Gifting-Catalogue.pdf]' }],
      [ago(4, 0, 58), 'me', 'Here’s the full catalogue. Shall I hold 30 boxes for you? Diwali orders close on the 10th.', { ack: 3 }],
    ],
    analysis: {
      category: 'lead', interest: 86, sentiment: 'positive', endedOnGoodNote: true, expectsReply: true,
      intent: '30 Diwali gift boxes',
      summary: 'Wants about 30 corporate Diwali gift boxes with her company logo. You sent pricing and the catalogue; she read it four days ago but hasn’t confirmed.',
      whyCall: 'A 30-box order is close — confirm quantity before the Diwali cut-off.',
      opener: 'Hi Ananya! Calling from Brulé about the Diwali gift boxes — did the catalogue have what you were looking for?',
      talkingPoints: ['Confirm 30 boxes at ₹1,250 each', 'Offer the custom logo note card', 'Orders close on the 10th'],
    },
  },
  {
    name: 'Rohan Mehta',
    note: 'Ember Café',
    msgs: [
      [ago(8, 5), 'them', 'Hey, I run Ember Café in Indiranagar. Looking for a new roaster for our espresso. Do you supply cafés?'],
      [ago(8, 4), 'me', 'Hi Rohan! We do. Our house espresso blend is medium-dark, chocolatey, great with milk. Happy to send a 1kg trial bag.'],
      [ago(7, 22), 'them', 'Trial would be great. We go through ~5kg a month'],
      [ago(5, 2), 'them', 'Got the trial bag, the team liked it 👍 what’s the price for 5kg monthly?'],
      [ago(3, 6), 'me', 'So glad! For 5kg/month it’s ₹1,180/kg with free delivery, roasted fresh every week. Want me to set up the first order for Monday?', { ack: 3 }],
    ],
    analysis: {
      category: 'lead', interest: 81, sentiment: 'positive', endedOnGoodNote: true, expectsReply: true,
      intent: 'Wholesale espresso for café',
      summary: 'Café owner buying ~5kg a month. His team liked the trial bag; you quoted ₹1,180/kg and he read it three days ago without replying.',
      whyCall: 'Recurring 5kg/month account — a quick call can close the first order.',
      opener: 'Hi Rohan, it’s Brulé — glad the team liked the trial! Shall we lock in Monday’s delivery?',
      talkingPoints: ['5kg/month at ₹1,180/kg, free delivery', 'Weekly fresh roast schedule', 'Offer a barista tasting visit'],
    },
  },
  {
    name: 'Aditya Banerjee',
    msgs: [
      [ago(9, 4), 'them', 'Hi, we’re a 40-person startup. Looking at better office coffee than the vending machine 😅'],
      [ago(9, 3), 'me', 'Ha, we can definitely beat the vending machine! Do you have a machine or would you want pour-over / cold brew?'],
      [ago(9, 2), 'them', 'We have a bean-to-cup machine. Maybe 8-10kg a month?'],
      [ago(8, 6), 'me', 'Perfect. I’ll put together an office plan with two blends and delivery every two weeks.'],
      [ago(8, 5), 'them', 'Send me the proposal on email, will review with the team'],
      [ago(3, 4), 'me', 'Sent it over — let me know what the team thinks!', { ack: 3 }],
    ],
    analysis: {
      category: 'lead', interest: 74, sentiment: 'positive', endedOnGoodNote: true, expectsReply: true,
      intent: 'Office coffee plan (8–10kg)',
      summary: 'Startup of 40 wants an office coffee plan for their bean-to-cup machine. Proposal sent by email; he read your follow-up three days ago.',
      whyCall: 'Proposal is with his team — a call can answer questions before it stalls.',
      opener: 'Hi Aditya, Brulé here — wanted to check whether the team had a chance to look at the office plan.',
      talkingPoints: ['Walk through the two-blend plan', 'Offer a free tasting at the office', 'Ask who else signs off'],
    },
  },
  {
    name: 'Arjun Kapoor',
    msgs: [
      [ago(7, 6), 'them', 'Bro the sample pack was 🔥🔥 the Chikmagalur one especially'],
      [ago(7, 5), 'me', 'Haha thank you Arjun! That one’s my favourite too ☕'],
      [ago(3, 4), 'me', 'We’re starting a monthly subscription — 2 bags a month, 15% off. Want me to put you down for the first batch?', { ack: 3 }],
    ],
    analysis: {
      category: 'lead', interest: 72, sentiment: 'positive', endedOnGoodNote: true, expectsReply: true,
      intent: 'Monthly subscription',
      summary: 'Loved the sample pack, especially the Chikmagalur single origin. You offered the monthly subscription; he read it three days ago.',
      whyCall: 'A fan of the product — a friendly call is likely to convert him to a subscription.',
      opener: 'Arjun! It’s Brulé — so glad you loved the Chikmagalur. Want me to add you to the first subscription batch?',
      talkingPoints: ['2 bags a month at 15% off', 'Lead with the Chikmagalur he loved', 'First batch ships next week'],
    },
  },
  {
    name: 'Kavya Nair',
    msgs: [
      [ago(6, 1), 'them', 'Hii I joined the waitlist! Will you have beans ground for a moka pot?'],
      [ago(5, 23), 'me', 'Hi Kavya, welcome! Yes — we grind fine for moka pots, or you can get whole beans.'],
      [ago(5, 22), 'them', 'Grind please, I don’t have a grinder 🙈'],
      [ago(3, 3), 'me', 'Noted! Want me to reserve a moka-grind bag of the house blend for launch day? You get the 10% waitlist discount too.', { ack: 3 }],
    ],
    analysis: {
      category: 'lead', interest: 64, sentiment: 'positive', endedOnGoodNote: true, expectsReply: true,
      intent: 'Moka pot grind on launch',
      summary: 'Waitlist member who wants pre-ground coffee for her moka pot. You offered to reserve a bag for launch day; she read it three days ago.',
      whyCall: 'Easy first order — she only needs a nudge to reserve.',
      opener: 'Hi Kavya! Brulé here — shall I reserve that moka-grind bag for you for launch day?',
      talkingPoints: ['Reserve a moka-grind house blend', 'Remind her of the 10% waitlist discount'],
    },
  },
  {
    name: 'Farhan Sheikh',
    note: 'Food creator',
    msgs: [
      [ago(12, 2), 'them', 'Hey! I make food & café videos (120k on Insta). Would love to feature Brulé before launch'],
      [ago(12, 1), 'me', 'Hi Farhan! That would be amazing. What would the collab look like?'],
      [ago(11, 20), 'them', 'A reel at home brewing your coffee + story mentions. Usually barter + small fee'],
      [ago(5, 3), 'me', 'Here’s what we can offer: a launch hamper + ₹8,000 for one reel and 3 stories. Does that work?', { ack: 3 }],
    ],
    analysis: {
      category: 'partner', interest: 60, sentiment: 'neutral', endedOnGoodNote: true, expectsReply: true,
      intent: 'Instagram collaboration',
      summary: 'Food creator with 120k followers offered a launch reel. You proposed a hamper plus ₹8,000; he read it five days ago and went quiet.',
      whyCall: 'He may be negotiating the fee — a call can settle terms quickly.',
      opener: 'Hey Farhan, it’s Brulé — wanted to hear what you thought of the collab offer.',
      talkingPoints: ['Ask if the fee works for him', 'Timing: reel before launch week', 'Offer an extra hamper for a giveaway'],
    },
  },
  {
    name: 'Ishaan Gupta',
    msgs: [
      [ago(2, 5), 'them', 'What grind should I get for a French press?'],
      [ago(2, 4), 'me', 'Coarse! Like sea salt. Our house blend in French press grind is ₹650 for 250g.'],
      [ago(2, 3), 'them', 'Cool, can I pay by UPI?'],
      [ago(2, 2), 'me', 'Yes, UPI works 👍', { ack: 3 }],
    ],
    callLogs: [{ ago: ago(0, 5), fromMe: false }],
    analysis: {
      category: 'lead', interest: 78, sentiment: 'positive', endedOnGoodNote: true, expectsReply: false,
      intent: 'French press order',
      summary: 'Asked about French press grind and paying by UPI — ready to buy. He tried calling you on WhatsApp this morning.',
      whyCall: 'He called you — call back while he’s ready to pay.',
      opener: 'Hi Ishaan, sorry I missed your call! Want me to send the UPI details for the French press bag?',
      talkingPoints: ['250g house blend, French press grind — ₹650', 'Share UPI details', 'Ask for his delivery address'],
    },
  },
  {
    name: 'Riya Chatterjee',
    msgs: [
      [ago(7, 3), 'them', 'Do you ship to Kolkata?'],
      [ago(7, 2), 'me', 'We do! 3–4 days by courier, free above ₹999.'],
      [ago(7, 1), 'them', 'Great, I want to gift my dad something nice for his birthday'],
      [ago(4, 2), 'me', 'The Brulé Year box would be perfect for him — calendar, tee and our ceramic mug. Want me to pack one with a birthday note?', { ack: 3 }],
    ],
    crm: { calls: [{ ago: ago(1, 2), outcome: 'no_answer' }] },
    analysis: {
      category: 'lead', interest: 58, sentiment: 'positive', endedOnGoodNote: true, expectsReply: true,
      intent: 'Birthday gift for her dad',
      summary: 'Looking for a birthday gift for her dad in Kolkata. You suggested The Brulé Year box; she read it four days ago but hasn’t replied.',
      whyCall: 'Birthday gifts have a deadline — find out when she needs it.',
      opener: 'Hi Riya, Brulé here — when is your dad’s birthday? I want to make sure the box reaches Kolkata in time.',
      talkingPoints: ['Ask the birthday date', 'The Brulé Year box with a birthday note', 'Free shipping above ₹999'],
    },
  },
  {
    name: 'Deepak Rao',
    msgs: [
      [ago(6, 4), 'them', 'Hello, I own two homestays in Coorg. Interested in coffee for guest rooms'],
      [ago(6, 3), 'me', 'Hi Deepak! Lovely. We could do drip bags for the rooms — easy for guests, no equipment needed.'],
      [ago(6, 2), 'them', 'Sounds good. Call me later this week, I’m travelling'],
    ],
    crm: { calls: [{ ago: ago(3, 1), outcome: 'callback', note: 'Travelling, asked for a call after the weekend' }], snoozeAgo: ago(0, 2) },
    analysis: {
      category: 'lead', interest: 76, sentiment: 'positive', endedOnGoodNote: true, expectsReply: false,
      intent: 'Drip bags for homestays',
      summary: 'Owns two homestays in Coorg and wants coffee for guest rooms. He asked you to call back after his trip — that’s now.',
      whyCall: 'He asked for this call — follow through on drip bags for both properties.',
      opener: 'Hi Deepak, it’s Brulé — you asked me to call after your trip. Is now a good time to talk about the guest rooms?',
      talkingPoints: ['Drip bags for both homestays', 'Monthly quantity per room', 'Branded welcome card option'],
    },
  },

  // ---------- Call next: good chat, not called yet ----------
  {
    name: 'Priya Sharma',
    msgs: [
      [ago(3, 6), 'them', 'Hi! My friend told me about Brulé. I’m getting into pour-over, any tips? ☕'],
      [ago(3, 5), 'me', 'Hi Priya! Start with 15g coffee to 250ml water, water just off the boil, and a medium-fine grind.'],
      [ago(3, 4, 50), 'them', 'That’s so helpful, thank you!! Which of your coffees is best for pour-over?'],
      [ago(3, 4), 'me', 'The Chikmagalur single origin — fruity and bright. It’s in the launch lineup.'],
      [ago(1, 3), 'them', 'Will definitely order when you launch! 😍'],
      [ago(1, 2), 'me', 'Anytime! ☕ I’ll ping you on launch day.', { ack: 3 }],
    ],
    analysis: {
      category: 'lead', interest: 70, sentiment: 'positive', endedOnGoodNote: true, expectsReply: false,
      intent: 'Pour-over beans at launch',
      summary: 'New to pour-over; you gave brewing tips and suggested the Chikmagalur single origin. She said she’ll definitely order at launch.',
      whyCall: 'Warm and keen — a short call can turn “at launch” into a pre-order.',
      opener: 'Hi Priya! It’s Brulé — how’s the pour-over going? I can set aside a bag of the Chikmagalur for you.',
      talkingPoints: ['Pre-order the Chikmagalur for launch', 'Offer a quick brew guide card', '10% off her first order'],
    },
  },
  {
    name: 'Siddharth Menon',
    msgs: [
      [ago(5, 3), 'them', 'Hi, I saw your ceramic mugs. Do you sell them separately? Want some for our studio'],
      [ago(5, 2), 'me', 'Hi Siddharth! Yes — ₹690 each, and we can glaze them in your studio colours for 20+.'],
      [ago(5, 1), 'them', 'Oh that’s cool. We’d need ~25'],
      [ago(4, 22), 'me', 'Perfect, 25 works for custom glaze. I can share samples of the colours.'],
      [ago(2, 4), 'them', 'Sounds great, let’s talk next week about the mugs'],
    ],
    analysis: {
      category: 'lead', interest: 82, sentiment: 'positive', endedOnGoodNote: true, expectsReply: false,
      intent: '25 custom mugs for studio',
      summary: 'Wants about 25 custom-glazed ceramic mugs for his studio and suggested talking this week. He wrote last, so the next step is yours.',
      whyCall: 'He literally asked to talk — call to finalise colours and quantity.',
      opener: 'Hi Siddharth, it’s Brulé — you mentioned talking this week about the studio mugs. Is now good?',
      talkingPoints: ['25 mugs, custom glaze in studio colours', '₹690 each — confirm timeline', 'Share colour samples'],
    },
  },
  {
    name: 'Neha Agarwal',
    msgs: [
      [ago(4, 5), 'them', 'What subscription plans will you have?'],
      [ago(4, 4), 'me', 'Two options: 1 bag a month for ₹620, or 2 bags for ₹1,150. Pause or cancel anytime.'],
      [ago(4, 3), 'them', 'And can I switch coffees each month?'],
      [ago(4, 2), 'me', 'Yes, you can pick a different one every month.'],
      [ago(3, 6), 'them', 'Okay will think and get back 🙂'],
    ],
    analysis: {
      category: 'lead', interest: 55, sentiment: 'positive', endedOnGoodNote: true, expectsReply: false,
      intent: 'Subscription plans',
      summary: 'Asked about subscription plans and switching coffees each month. Said she’ll think about it and get back.',
      whyCall: 'Interested but undecided — answer her questions live and suggest the 1-bag plan.',
      opener: 'Hi Neha, Brulé here — I wanted to check if you had any more questions about the subscription.',
      talkingPoints: ['Start with the 1-bag plan', 'She can switch coffees monthly', 'Pause or cancel anytime'],
    },
  },
  {
    name: 'Tanvi Desai',
    msgs: [
      [ago(1, 4), 'me', 'Hi Tanvi! We’re doing a pop-up tasting this Saturday at Third Place, 11am–4pm. Would love to see you there ☕'],
      [ago(0, 6), 'them', 'Would love to come!! Can I bring a friend?'],
    ],
    analysis: {
      category: 'lead', interest: 66, sentiment: 'positive', endedOnGoodNote: true, expectsReply: false,
      intent: 'Pop-up tasting RSVP',
      summary: 'Keen to come to Saturday’s pop-up tasting and asked if she can bring a friend. You haven’t answered yet.',
      whyCall: 'She’s waiting on a quick yes — confirm her and her friend.',
      opener: 'Hi Tanvi! Of course bring your friend — can I put you both down for Saturday?',
      talkingPoints: ['Confirm her +1', 'Saturday 11am–4pm at Third Place', 'Mention pre-orders at the pop-up'],
    },
  },
  {
    name: 'Rahul Verma',
    msgs: [
      [ago(6, 2), 'them', 'Do you have decaf? My wife can’t have caffeine'],
      [ago(6, 1), 'me', 'Not at launch, but a Swiss-water decaf is coming in November!'],
      [ago(4, 4), 'them', 'cool, keep me posted 👍'],
    ],
    analysis: {
      category: 'lead', interest: 48, sentiment: 'positive', endedOnGoodNote: true, expectsReply: false,
      intent: 'Decaf for his wife',
      summary: 'Wants decaf for his wife; you told him Swiss-water decaf arrives in November. Friendly, asked to be kept posted.',
      whyCall: 'Low urgency — a short call could win a pre-order for the November decaf.',
      opener: 'Hi Rahul, Brulé here — quick one: shall I reserve a bag of the November decaf for your wife?',
      talkingPoints: ['Reserve Swiss-water decaf for November', 'Suggest a regular bag for him meanwhile'],
    },
  },
  {
    name: 'Zoya Khan',
    msgs: [
      [ago(8, 2), 'them', 'The house blend is SO good. Finished the bag in a week 😂'],
      [ago(8, 1), 'me', 'Haha that’s the best compliment! ❤️'],
      [ago(2, 5), 'them', 'Will reorder soon, maybe the bigger 1kg this time'],
      [ago(2, 4), 'me', 'Yay! Let me know whenever ☕', { ack: 3 }],
    ],
    analysis: {
      category: 'customer', interest: 75, sentiment: 'positive', endedOnGoodNote: true, expectsReply: false,
      intent: 'Reorder, 1kg house blend',
      summary: 'Happy repeat customer who loved the house blend and plans to reorder a 1kg bag.',
      whyCall: 'Ready to reorder — a call can take the 1kg order now.',
      opener: 'Hi Zoya! It’s Brulé — shall I send that 1kg of house blend this week?',
      talkingPoints: ['1kg house blend reorder', 'Suggest the subscription for regular orders'],
    },
  },

  // ---------- Maybe later ----------
  {
    name: 'Sneha Pillai',
    msgs: [
      [ago(3, 1), 'me', 'Hi Sneha! Thanks for joining the Brulé waitlist ☕ Any coffee you’re excited to try?', { ack: 2 }],
    ],
    analysis: {
      category: 'lead', interest: 35, sentiment: 'neutral', endedOnGoodNote: false, expectsReply: true,
      intent: 'Waitlist sign-up', summary: 'Joined the waitlist. Your welcome message was delivered three days ago but not read yet.',
      whyCall: 'No conversation yet — wait for her to open your message.', opener: '', talkingPoints: [],
    },
  },
  {
    name: 'Karan Malhotra',
    msgs: [
      [ago(64, 3), 'them', 'What’s the price of 250g?'],
      [ago(64, 2), 'me', '₹650 for the house blend, ₹780 for single origins. Want me to send the menu?', { ack: 3 }],
    ],
    analysis: {
      category: 'lead', interest: 38, sentiment: 'neutral', endedOnGoodNote: false, expectsReply: true,
      intent: 'Price check', summary: 'Asked the price of a 250g bag two months ago and didn’t reply to your answer.',
      whyCall: 'Gone cold — maybe a launch-day message rather than a call.', opener: 'Hi Karan, Brulé here — we launched! Still looking for coffee?',
      talkingPoints: ['Mention the launch offer'],
    },
  },
  {
    name: 'Pooja Reddy',
    msgs: [
      [ago(9, 4), 'me', 'Hi Pooja! Want to try our launch sampler? 3 coffees, ₹499.'],
      [ago(9, 1), 'them', 'Maybe later, I have beans at home right now'],
      [ago(9, 0, 50), 'me', 'No worries at all! 😊', { ack: 3 }],
    ],
    analysis: {
      category: 'lead', interest: 28, sentiment: 'neutral', endedOnGoodNote: true, expectsReply: false,
      intent: 'Not buying right now', summary: 'Said maybe later — she still has beans at home.',
      whyCall: 'Not now — check back in a few weeks when her beans run out.', opener: '', talkingPoints: [],
    },
  },
  {
    name: 'Nikhil Jain',
    msgs: [
      [ago(5, 2), 'me', 'Hi Nikhil, following up on the office order enquiry from the website — is this still the best number?', { ack: 1 }],
    ],
    analysis: {
      category: 'lead', interest: 40, sentiment: 'neutral', endedOnGoodNote: false, expectsReply: true,
      intent: 'Website office enquiry', summary: 'Enquired through the website. Your follow-up hasn’t been delivered in five days.',
      whyCall: 'Number may be inactive — try email instead.', opener: '', talkingPoints: [],
    },
  },
  {
    name: 'Divya Krishnan',
    msgs: [
      [ago(0, 1, 5), 'them', 'Hi'],
      [ago(0, 0, 25), 'me', 'Hi Divya! How can I help? ☕', { ack: 3 }],
    ],
    analysis: {
      category: 'lead', interest: 40, sentiment: 'neutral', endedOnGoodNote: false, expectsReply: true,
      intent: 'Just said hi', summary: 'Said hi a little while ago; she has read your reply.',
      whyCall: 'Too early — give her time to reply.', opener: '', talkingPoints: [],
    },
  },
  {
    name: 'Aman Singh',
    msgs: [
      [ago(10, 5), 'them', 'price for cold brew?'],
      [ago(10, 4), 'me', '₹420 for a 500ml bottle, 3 for ₹1,150.'],
      [ago(10, 2), 'them', 'ok'],
    ],
    analysis: {
      category: 'lead', interest: 34, sentiment: 'neutral', endedOnGoodNote: false, expectsReply: false,
      intent: 'Cold brew price', summary: 'Asked the cold brew price and replied “ok”. No sign of wanting to buy yet.',
      whyCall: 'Lukewarm — a message about the pop-up may work better than a call.', opener: '', talkingPoints: [],
    },
  },

  // ---------- Don't call ----------
  {
    name: 'Amit Chauhan',
    msgs: [
      [ago(12, 3), 'me', 'Hi Amit! Brulé launches next month — want early access and 10% off?'],
      [ago(12, 1), 'them', 'Not interested. Please don’t message again.'],
    ],
    analysis: {
      category: 'lead', interest: 3, sentiment: 'negative', endedOnGoodNote: false, expectsReply: false,
      doNotCall: true, doNotCallReason: 'Asked you not to message again',
      intent: 'Not interested', summary: 'Said he’s not interested and asked not to be messaged again.',
      whyCall: 'Respect his request — don’t call.', opener: '', talkingPoints: [],
    },
  },
  {
    name: 'Maa',
    saved: true,
    msgs: [
      [ago(0, 9), 'them', 'Beta khana kha liya?'],
      [ago(0, 8), 'me', 'Haan maa, abhi khaya 😊'],
      [ago(0, 7), 'them', 'Sunday ko ghar aa jana ❤️'],
    ],
    analysis: {
      category: 'personal', interest: 0, sentiment: 'positive', endedOnGoodNote: true, expectsReply: false,
      intent: 'Family', summary: 'Family chat.', whyCall: 'Personal — not part of your business call list.', opener: '', talkingPoints: [],
    },
  },
  {
    name: 'HDFC Bank',
    business: true,
    msgs: [
      [ago(1, 8), 'them', 'Dear Customer, ₹2,450.00 has been debited from your a/c XX1234 on 23-09. Not you? Call 1800-XXX-XXXX.'],
    ],
    analysis: {
      category: 'service', interest: 0, sentiment: 'neutral', endedOnGoodNote: false, expectsReply: false,
      intent: 'Bank alert', summary: 'Automated bank transaction alert.', whyCall: 'Automated messages.', opener: '', talkingPoints: [],
    },
  },
  {
    name: '+91 55 0000 1234',
    saved: false,
    msgs: [
      [ago(2, 3), 'them', 'Congratulations!! You have won ₹25,00,000 in the KBC lucky draw 🎉 Click the link to claim your prize: bit.ly/xxxx'],
    ],
    analysis: {
      category: 'spam', interest: 0, sentiment: 'neutral', endedOnGoodNote: false, expectsReply: false,
      doNotCall: true, doNotCallReason: 'Lottery scam', intent: 'Scam', summary: 'Lottery scam message with a suspicious link.',
      whyCall: 'Spam — don’t call.', opener: '', talkingPoints: [],
    },
  },
  {
    name: 'Sunil Yadav',
    msgs: [
      [ago(6, 2), 'them', 'Is this Sharma Electricals?'],
      [ago(6, 1), 'me', 'Hi! No, this is Brulé Coffee ☕ But if you like coffee…'],
    ],
    crm: { calls: [{ ago: ago(5, 3), outcome: 'wrong_number' }] },
    analysis: {
      category: 'other', interest: 5, sentiment: 'neutral', endedOnGoodNote: false, expectsReply: false,
      intent: 'Wrong number', summary: 'Was looking for an electrical shop — wrong number.', whyCall: 'Wrong number.', opener: '', talkingPoints: [],
    },
  },

  // ---------- Called ----------
  {
    name: 'Sanjana Bose',
    msgs: [
      [ago(4, 2), 'them', 'Hi, can I order 3 glass bottles as return gifts?'],
      [ago(4, 1), 'me', 'Of course! ₹890 each. Want them gift-wrapped?', { ack: 3 }],
    ],
    crm: { calls: [{ ago: ago(1, 3), outcome: 'interested', note: 'Ordering 3 bottles gift-wrapped, sending UPI tonight' }] },
    analysis: {
      category: 'lead', interest: 80, sentiment: 'positive', endedOnGoodNote: true, expectsReply: true,
      intent: '3 glass bottles as gifts', summary: 'Wants three glass bottles as return gifts.',
      whyCall: 'Already called — she’s ordering.', opener: '', talkingPoints: [],
    },
  },
  {
    name: 'Harsh Vardhan',
    msgs: [
      [ago(3, 6), 'them', 'Can we do a tasting for my café staff?'],
      [ago(3, 5), 'me', 'Yes! Let’s find a time — I’ll give you a quick call.', { ack: 3 }],
    ],
    callLogs: [{ ago: ago(2, 2), fromMe: true }],
    analysis: {
      category: 'partner', interest: 72, sentiment: 'positive', endedOnGoodNote: true, expectsReply: false,
      intent: 'Staff tasting at his café', summary: 'Asked for a coffee tasting for his café staff; you called him on WhatsApp.',
      whyCall: 'Already called — follow up on the tasting date.', opener: '', talkingPoints: [],
    },
  },

  // ---------- Snoozed ----------
  {
    name: 'Gauri Kulkarni',
    msgs: [
      [ago(3, 5), 'them', 'Interested in cold brew for my yoga studio’s café corner'],
      [ago(3, 4), 'me', 'Love that! Cold brew bottles or a concentrate you can dilute?', { ack: 3 }],
    ],
    crm: { calls: [{ ago: ago(1, 1), outcome: 'callback', note: 'Busy with a class — call Friday afternoon' }], snoozeIn: ago(2) },
    analysis: {
      category: 'lead', interest: 70, sentiment: 'positive', endedOnGoodNote: true, expectsReply: true,
      intent: 'Cold brew for yoga studio', summary: 'Wants cold brew for her yoga studio’s café corner. Asked you to call back Friday.',
      whyCall: 'Call back on Friday as promised.', opener: 'Hi Gauri, Brulé here — calling back about cold brew for the studio as promised.',
      talkingPoints: ['Bottles vs concentrate', 'Weekly quantity'],
    },
  },
  {
    name: 'Mohit Saxena',
    msgs: [
      [ago(2, 7), 'them', 'Will be travelling for 10 days, let’s discuss the bulk order when I’m back'],
      [ago(2, 6), 'me', 'Sure, safe travels! ✈️', { ack: 3 }],
    ],
    crm: { snoozeIn: ago(8) },
    analysis: {
      category: 'lead', interest: 68, sentiment: 'positive', endedOnGoodNote: true, expectsReply: false,
      intent: 'Bulk order after travel', summary: 'Wants to discuss a bulk order when he’s back from a 10-day trip.',
      whyCall: 'Call when he’s back.', opener: 'Hi Mohit, welcome back! Shall we pick up the bulk order conversation?',
      talkingPoints: ['Quantity and frequency', 'Delivery location'],
    },
  },
];

export function makeDemoData(now = Date.now()) {
  const chats = {};
  const analysis = {};
  const crm = {};

  CHATS.forEach((c, i) => {
    const num = c.name.startsWith('+') ? `915500001234` : number(i + 1);
    const id = `${num}@c.us`;
    const messages = c.msgs.map(([agoMs, who, text, extra = {}], j) => ({
      id: `demo_${i}_${j}`,
      fromMe: who === 'me',
      ts: now - agoMs,
      type: extra.type ?? 'chat',
      body: extra.body ?? text,
      ack: who === 'me' ? (extra.ack ?? 3) : null,
    }));
    const lastTs = messages.at(-1).ts;
    chats[id] = {
      id,
      name: c.name,
      savedName: c.saved === false ? null : c.name,
      pushname: c.name,
      note: c.note ?? null,
      number: num,
      isGroup: false,
      isBusiness: Boolean(c.business),
      isMyContact: c.saved !== false,
      unreadCount: 0,
      archived: false,
      pinned: false,
      muted: false,
      lastActivityAt: Math.max(lastTs, ...(c.callLogs ?? []).map((l) => now - l.ago)),
      messages,
      callLogs: (c.callLogs ?? []).map((l) => ({ ts: now - l.ago, fromMe: l.fromMe, isVideo: false })),
      syncedAt: now,
      demo: true,
    };
    analysis[id] = {
      source: 'ai',
      model: 'demo',
      analyzedAt: now,
      basedOnMessageId: messages.at(-1).id,
      doNotCall: false,
      doNotCallReason: '',
      ...c.analysis,
    };
    if (c.crm) {
      crm[id] = {
        calls: (c.crm.calls ?? []).map((call) => ({ at: now - call.ago, outcome: call.outcome, note: call.note ?? '' })),
        notes: '',
        snoozeUntil: c.crm.snoozeIn ? now + c.crm.snoozeIn : c.crm.snoozeAgo ? now - c.crm.snoozeAgo : null,
        override: null,
        starred: false,
      };
    }
  });

  return { chats, analysis, crm, me: { name: null, number: null } };
}
