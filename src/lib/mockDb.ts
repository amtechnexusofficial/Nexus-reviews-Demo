// ---------------------------------------------------------------------------
// DEMO DATA LAYER
// ---------------------------------------------------------------------------
// This file replaces the real backend (Cloudflare Worker + Neon Postgres).
// Everything is stored in the visitor's browser via localStorage, seeded
// with realistic-looking sample data on first load. No network calls, no
// database, no API keys required — safe to deploy as a fully static site.
// ---------------------------------------------------------------------------

export const DB_KEY = 'rs2:demo-db';

export function uid(): number {
  return Math.floor(Date.now() * 1000 + Math.random() * 1000);
}

export function guid(): string {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

export function daysAgo(n: number): string {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return d.toISOString();
}

export function delay<T>(value: T, ms = 350 + Math.random() * 400): Promise<T> {
  return new Promise((resolve) => setTimeout(() => resolve(value), ms));
}

export function pick<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

// ---------------------------------------------------------------------------
// Shape of the whole demo "database"
// ---------------------------------------------------------------------------
export interface DemoUser {
  email: string;
  password: string;
  businessId: number;
  isPlatformAdmin: boolean;
}

export interface DemoDb {
  nextLocalId: number;
  users: DemoUser[];
  businesses: Record<number, any>;
  locations: Record<number, any>;
  reviews: any[];
  kioskSessions: any[];
  screeningLogs: any[];
  analyticsSnapshots: any[];
  competitors: any[];
  requests: any[];
  employees: any[];
  chatMessages: any[];
  knowledgeEntries: any[];
  feedback: any[];
  dmChatsByPlatform: Record<string, any[]>;
  dmMessagesByChat: Record<string, any[]>;
  dmConversations: any[];
  posts: any[];
  connectionsByLocation: Record<number, any>;
  auditLog: any[];
  imageQuotaUsed: number;
}

function seedLocation(businessId: number, locationId: number, name: string, address: string) {
  return {
    id: locationId,
    businessId,
    address,
    googleReviewLink: 'https://maps.app.goo.gl/vK8vS8uc48e8TFY28',
    googlePlaceId: 'ChIJdemo000000000000000000000',
    dmAutoReplyEnabled: false,
    managerPhone: '+1 (555) 019-2828',
    kioskQuestions: [
      'What did you enjoy most about your meal?',
      'How was the service from our staff?',
      'Was the atmosphere comfortable for you?',
      'Anything we could improve for next time?',
      '',
    ],
    lastScreeningScan: { scanned: 5, flagged: 2, at: daysAgo(0.1) },
  };
}

const REVIEW_AUTHORS = [
  'Priya S.', 'Marcus T.', 'Aiko N.', 'Daniel R.', 'Sofia G.', 'Ben H.',
  'Lena W.', 'Omar K.', 'Grace L.', 'Ethan P.', 'Nadia F.', 'Chris D.',
];
const REVIEW_TEXT_POS = [
  "Absolutely loved the experience — the staff went out of their way to make us feel welcome. Will be back!",
  "Best in the area, hands down. Quick service and the quality is consistently great.",
  "Great vibe, friendly team, and everything was ready right on time. Highly recommend.",
  "Five stars. Clean space, attentive staff, and fair prices. Exactly what I was looking for.",
  "This is now our go-to spot. The attention to detail really shows.",
];
const REVIEW_TEXT_MIXED = [
  "Good overall, though we waited a bit longer than expected. Staff was apologetic and helpful.",
  "Solid experience. A couple of small things could be improved but nothing major.",
  "Pretty good, would come back. Parking was a little tricky to find.",
];
const REVIEW_TEXT_NEG = [
  "Service was slower than I expected for a weekday afternoon. Hoping this was a one-off.",
  "Was okay, but I've had better. Might give it another shot.",
];

function seedReviews(locationId: number) {
  const reviews: any[] = [];
  let idc = 1;
  for (let i = 0; i < 14; i++) {
    const rating = i < 9 ? 5 : i < 12 ? 4 : i < 13 ? 3 : 2;
    const text = rating >= 5 ? pick(REVIEW_TEXT_POS) : rating >= 4 ? pick(REVIEW_TEXT_MIXED) : pick(REVIEW_TEXT_NEG);
    const hasResponse = i % 3 !== 0;
    reviews.push({
      id: idc++,
      locationId,
      reviewhookReviewId: `demo-review-${i}`,
      platform: 'google',
      rating,
      authorName: REVIEW_AUTHORS[i % REVIEW_AUTHORS.length],
      text,
      hasResponse,
      responseText: hasResponse ? "Thank you so much for the kind words — we really appreciate you taking the time to share this!" : null,
      reviewCreatedAt: daysAgo(i * 3 + 1),
    });
  }

  // Unanswered low-star reviews from the last few days — powers the Overview "Needs attention" panel.
  reviews.push(
    {
      id: idc++,
      locationId,
      reviewhookReviewId: 'demo-attention-1',
      platform: 'google',
      rating: 2,
      authorName: 'Jordan M.',
      text: 'Waited almost 40 minutes for our order and nobody checked in on us. Really disappointing for a weekday lunch.',
      hasResponse: false,
      responseText: null,
      reviewCreatedAt: daysAgo(1),
    },
    {
      id: idc++,
      locationId,
      reviewhookReviewId: 'demo-attention-2',
      platform: 'google',
      rating: 1,
      authorName: 'Samira K.',
      text: 'Table was sticky and the food came out cold. Manager never came over even after we asked.',
      hasResponse: false,
      responseText: null,
      reviewCreatedAt: daysAgo(3),
    }
  );

  return reviews;
}

/** Rename seeded demo login emails on older browser demos. */
export function ensureDemoEmails(db: DemoDb) {
  let changed = false;
  for (const user of db.users) {
    if (user.email === 'demo@example.com') {
      user.email = 'demo@amtechnexus.com';
      changed = true;
    }
    if (user.email === 'admin@example.com') {
      user.email = 'admin@amtechnexus.com';
      changed = true;
    }
  }
  return changed;
}

/** Seed the Insights report list for older browser demos. */
export function ensureInsightReports(db: DemoDb) {
  if (db.analyticsSnapshots.length >= 3) return false;
  db.analyticsSnapshots = [
    {
      id: db.nextLocalId++,
      periodLabel: 'Last 30 days',
      summary: 'Not enough reviews in this period to generate meaningful insights yet.',
      recommendations: [],
      reviewCountAnalyzed: 0,
      createdAt: daysAgo(4),
    },
    {
      id: db.nextLocalId++,
      periodLabel: 'Last 30 days',
      summary: 'Not enough reviews in this period to generate meaningful insights yet.',
      recommendations: [],
      reviewCountAnalyzed: 0,
      createdAt: daysAgo(11),
    },
    {
      id: db.nextLocalId++,
      periodLabel: 'All reviews',
      summary:
        'The Rustic Table holds a strong local reputation with consistent praise for warm service, fair pricing, and a welcoming dining room. Guests frequently mention weekend brunch as a highlight. Friction shows up around peak-hour wait times and occasional payment delays at the counter — worth tightening staffing and checkout flow on busy evenings.',
      recommendations: [
        'Add a host during Saturday peak (6–8pm) to cut wait times.',
        'Feature brunch specials in Google and social posts this week.',
        'Follow up with guests who mentioned slow checkout.',
      ],
      reviewCountAnalyzed: 46,
      createdAt: daysAgo(14),
    },
    {
      id: db.nextLocalId++,
      periodLabel: 'Last 30 days',
      summary: 'Not enough reviews in this period to generate meaningful insights yet.',
      recommendations: [],
      reviewCountAnalyzed: 0,
      createdAt: daysAgo(14),
    },
  ];
  return true;
}

/** Seed last screening scan stats and flagged demos on older browser demos. */
export function ensureScreeningScan(db: DemoDb) {
  let changed = false;
  for (const loc of Object.values(db.locations)) {
    if (!loc) continue;
    const scan = loc.lastScreeningScan;
    if (!scan || (scan.scanned === 0 && scan.flagged === 0)) {
      loc.lastScreeningScan = { scanned: 5, flagged: 2, at: daysAgo(0.1) };
      changed = true;
    }
  }

  for (const locationId of Object.keys(db.locations).map(Number)) {
    const hasFlagged = db.screeningLogs.some(
      (l) => l.locationId === locationId && /flagged|likely violation/i.test(l.verdict)
    );
    if (hasFlagged) continue;
    const seeds = seedScreeningLogs(locationId);
    for (const seed of seeds) {
      db.screeningLogs.push({ ...seed, id: db.nextLocalId++ });
    }
    changed = true;
  }
  return changed;
}

/** Prefer the demo website URL shown in Settings for existing browser demos. */
export function ensureDemoWebsiteUrl(db: DemoDb) {
  let changed = false;
  for (const business of Object.values(db.businesses)) {
    if (!business) continue;
    if (
      !business.websiteUrl ||
      business.websiteUrl === 'https://example.com' ||
      business.websiteUrl === 'https://amtechnexus.com/' ||
      business.websiteUrl === 'https://amtechnexus.com'
    ) {
      business.websiteUrl = 'https://www.harborandpine.demo/';
      changed = true;
    }
  }
  return changed;
}

/** Prefer the demo Google review link for existing browser demos. */
export function ensureDemoReviewLink(db: DemoDb) {
  const target = 'https://maps.app.goo.gl/vK8vS8uc48e8TFY28';
  let changed = false;
  for (const loc of Object.values(db.locations)) {
    if (!loc) continue;
    const isPlaceholder =
      !loc.googleReviewLink ||
      loc.googleReviewLink === 'https://g.page/r/demo-business/review' ||
      loc.googleReviewLink.includes('5763oeY3JVkaCppy7') ||
      loc.googleReviewLink.includes('xK9mR2pQ7nLw4vTb8');
    if (isPlaceholder && loc.googleReviewLink !== target) {
      loc.googleReviewLink = target;
      changed = true;
    }
  }
  return changed;
}

const DEFAULT_KIOSK_QUESTIONS = [
  'What did you enjoy most about your meal?',
  'How was the service from our staff?',
  'Was the atmosphere comfortable for you?',
  'Anything we could improve for next time?',
  '',
];

/** Seed kiosk questions on older browser demos. */
export function ensureKioskQuestions(db: DemoDb) {
  const restaurantDefaults = DEFAULT_KIOSK_QUESTIONS;
  const oldDefaults = [
    'Did you find all products?',
    'How was the price?',
    'How did the labours behave?',
    'Anything else you would like to mention?',
  ];
  let changed = false;
  for (const loc of Object.values(db.locations)) {
    if (!loc) continue;
    const current = Array.isArray(loc.kioskQuestions) ? loc.kioskQuestions : null;
    const looksLikeOldDefaults =
      current &&
      oldDefaults.every((q, i) => (current[i] || '') === q);
    if (!current || looksLikeOldDefaults) {
      loc.kioskQuestions = [...restaurantDefaults];
      changed = true;
    }
  }
  return changed;
}

/** Keep seeded competitor ratings at 4.5 / 4.1 / 4.3 for existing browser demos. */
export function ensureCompetitorRatings(db: DemoDb) {
  const targets: Record<string, number> = {
    'Northside Bistro': 4.5,
    'The Corner Kitchen': 4.1,
    'Maple & Vine': 4.3,
  };
  let changed = false;
  for (const c of db.competitors) {
    const rating = targets[c.name];
    if (rating != null && c.rating !== rating) {
      c.rating = rating;
      changed = true;
    }
  }
  return changed;
}

/** Drop SMS requests and normalize remaining history to email / sent. */
export function ensureEmailOnlyRequests(db: DemoDb) {
  let changed = false;
  const kept = db.requests.filter((r) => {
    if (r.channel === 'sms') {
      changed = true;
      return false;
    }
    return true;
  });
  db.requests = kept.map((r) => {
    if (r.channel !== 'email' || r.status !== 'sent') {
      changed = true;
      return { ...r, channel: 'email', status: 'sent' };
    }
    return r;
  });
  return changed;
}

/** Ensure older browser demos pick up the attention reviews without a full reset. */
export function ensureAttentionReviews(db: DemoDb) {
  const attentionSeeds = [
    {
      reviewhookReviewId: 'demo-attention-1',
      rating: 2,
      authorName: 'Jordan M.',
      text: 'Waited almost 40 minutes for our order and nobody checked in on us. Really disappointing for a weekday lunch.',
      daysAgo: 1,
    },
    {
      reviewhookReviewId: 'demo-attention-2',
      rating: 1,
      authorName: 'Samira K.',
      text: 'Table was sticky and the food came out cold. Manager never came over even after we asked.',
      daysAgo: 3,
    },
  ];

  let changed = false;
  for (const locationId of Object.keys(db.locations).map(Number)) {
    for (const seed of attentionSeeds) {
      const exists = db.reviews.some(
        (r) => r.locationId === locationId && r.reviewhookReviewId === seed.reviewhookReviewId
      );
      if (exists) continue;
      db.reviews.push({
        id: db.nextLocalId++,
        locationId,
        reviewhookReviewId: seed.reviewhookReviewId,
        platform: 'google',
        rating: seed.rating,
        authorName: seed.authorName,
        text: seed.text,
        hasResponse: false,
        responseText: null,
        reviewCreatedAt: daysAgo(seed.daysAgo),
      });
      changed = true;
    }
  }
  return changed;
}

function seedKioskSessions(locationId: number) {
  const sessions: any[] = [];
  for (let i = 0; i < 6; i++) {
    const rating = pick([5, 5, 4, 5, 3]);
    sessions.push({
      id: i + 1,
      locationId,
      rating,
      answers: [
        { q: 'What stood out to you most?', a: 'The staff were super friendly and quick.' },
        { q: 'Anything we could improve?', a: 'Nothing really, it was great!' },
      ],
      targetLength: 60,
      aiDraft: "Had a wonderful visit — the team was friendly, fast, and clearly cares about doing things right. Highly recommend!",
      editedDraft: null,
      confirmedAuthentic: true,
      posted: i % 2 === 0,
      createdAt: daysAgo(i * 4),
    });
  }
  return sessions;
}

function seedScreeningLogs(locationId: number) {
  return [
    {
      id: 1,
      locationId,
      reviewText:
        "This place is a total scam!!! Fake reviews everywhere. Don't ever go here or give them your money. Absolute frauds.",
      verdict: 'flagged',
      category: 'spam / fake content',
      reasoning:
        'Uses inflammatory accusations (“scam”, “fraud”) with no visit details, order reference, or specific experience. Language matches common spam and competitor-attack patterns Google’s policy targets — not a good-faith customer complaint.',
      flagText:
        'This review makes unverifiable fraud accusations without describing a real visit, which appears to violate Google’s spam and fake content guidelines.',
      createdAt: daysAgo(2),
    },
    {
      id: 2,
      locationId,
      reviewText:
        "I work at Northside Bistro down the street and trust me, nobody should eat here. Our place is way better and their kitchen is filthy.",
      verdict: 'flagged',
      category: 'conflict of interest',
      reasoning:
        'The reviewer openly identifies as staff at a competing restaurant and uses the review to promote their own business while attacking this one. That is a clear conflict of interest under Google’s review policies, independent of whether the criticism is negative.',
      flagText:
        'Reviewer self-identifies as an employee of a nearby competitor and appears to be posting to promote their own business, which conflicts with Google’s conflict-of-interest rules.',
      createdAt: daysAgo(1),
    },
  ];
}

function seedCompetitors(locationId: number) {
  return [
    { id: 1, locationId, name: 'Northside Bistro', rating: 4.5, reviewCount: 312, lastCheckedAt: daysAgo(1), notes: 'Similar price point, slightly larger seating area.' },
    { id: 2, locationId, name: 'The Corner Kitchen', rating: 4.1, reviewCount: 198, lastCheckedAt: daysAgo(2), notes: 'Newer, running frequent promotions.' },
    { id: 3, locationId, name: 'Maple & Vine', rating: 4.3, reviewCount: 501, lastCheckedAt: daysAgo(1), notes: 'Market leader in the area, strong weekend brunch reviews.' },
  ];
}

function seedRequests(locationId: number) {
  const names = ['Alex', 'Riley', 'Sam'];
  return names.map((customerName, i) => ({
    id: i + 1,
    locationId,
    channel: 'email',
    customerContact: `customer${i + 1}@example.com`,
    customerName,
    status: 'sent',
    createdAt: daysAgo(i + 1),
  }));
}

function seedEmployees(locationId: number) {
  return [
    { id: 1, locationId, name: 'Maria Chen', role: 'Front of House Manager' },
    { id: 2, locationId, name: 'Jordan Blake', role: 'Server' },
    { id: 3, locationId, name: 'Sam Osei', role: 'Barista' },
  ];
}

function seedKnowledge(locationId: number) {
  return [
    { id: 1, locationId, title: 'Hours & Location', content: 'Open Mon–Sat 8am–8pm, Sun 9am–4pm. Free parking in the rear lot.', createdAt: daysAgo(20) },
    { id: 2, locationId, title: 'Return / Refund Policy', content: 'Full refund within 7 days with receipt; store credit after that.', createdAt: daysAgo(15) },
  ];
}

function seedFeedback(locationId: number) {
  return [
    { id: 1, locationId, rating: 2, message: 'Table wasn\u2019t cleared for a while after we sat down.', customerContact: '+1 (555) 400-1122', resolved: false, createdAt: daysAgo(2) },
    { id: 2, locationId, rating: 3, message: 'Music was a bit loud for conversation.', customerContact: null, resolved: true, createdAt: daysAgo(9) },
    { id: 3, locationId, rating: 1, message: 'Order was missing an item and no one followed up.', customerContact: 'customer@example.com', resolved: false, createdAt: daysAgo(1) },
  ];
}

function seedDmData() {
  const dmChatsByPlatform: Record<string, any[]> = {
    instagram: [
      { id: 'ig-chat-1', participant_name: 'ava.eats', participant_username: 'ava.eats', last_message_at: daysAgo(0.2), last_inbound_at: daysAgo(0.2) },
      { id: 'ig-chat-2', participant_name: 'the.foodie.diary', participant_username: 'the.foodie.diary', last_message_at: daysAgo(1) },
    ],
    facebook: [
      { id: 'fb-chat-1', participant_name: 'Karen Boyle', last_message_at: daysAgo(0.5), last_inbound_at: daysAgo(0.5) },
    ],
  };
  const dmMessagesByChat: Record<string, any[]> = {
    'ig-chat-1': [
      { id: 'm1', direction: 'inbound', body: 'Hi! Do you take walk-ins on Saturday evenings?', created_at: daysAgo(0.25) },
      { id: 'm2', direction: 'outbound', body: 'Hey! Yes, we always hold a few walk-in tables, though it does get busy after 7pm 🙂', created_at: daysAgo(0.24) },
      { id: 'm3', direction: 'inbound', body: 'Perfect, thank you!', created_at: daysAgo(0.2) },
    ],
    'ig-chat-2': [
      { id: 'm4', direction: 'inbound', body: 'Loved featuring you in our roundup this week!', created_at: daysAgo(1) },
    ],
    'fb-chat-1': [
      { id: 'm5', direction: 'inbound', body: 'Do you cater for events of 30+ people?', created_at: daysAgo(0.5) },
    ],
  };
  const dmConversations = [
    { id: 1, platform: 'instagram', postproxyChatId: 'ig-chat-1', status: 'ai_handling', escalationReason: null, lastMessageAt: daysAgo(0.2) },
    { id: 2, platform: 'instagram', postproxyChatId: 'ig-chat-2', status: 'ai_handling', escalationReason: null, lastMessageAt: daysAgo(1) },
    { id: 3, platform: 'facebook', postproxyChatId: 'fb-chat-1', status: 'escalated', escalationReason: 'Customer asked about large catering order pricing.', lastMessageAt: daysAgo(0.5) },
  ];
  return { dmChatsByPlatform, dmMessagesByChat, dmConversations };
}

function seedPosts(locationId: number) {
  const posts: any[] = [];
  for (let i = 0; i < 4; i++) {
    posts.push({
      id: guid(),
      body: [
        'New seasonal menu just dropped 🍂 Come try it this week!',
        'Shoutout to our amazing team for another 5-star week ⭐️⭐️⭐️⭐️⭐️',
        'Weekend hours: we\u2019re open till 9pm Fri & Sat!',
        'Behind the scenes from this morning\u2019s prep 👨\u200d🍳',
      ][i],
      status: 'published',
      source: 'dashboard',
      scheduled_at: null,
      created_at: daysAgo(i * 5),
      media: [],
      platforms: [
        { platform: 'google', status: 'published', permalink: 'https://business.google.com/posts/demo', attempted_at: daysAgo(i * 5), insights: { impressions: 200 + i * 47 } },
        { platform: 'facebook', status: 'published', permalink: 'https://facebook.com/demo/posts/1', attempted_at: daysAgo(i * 5), insights: { impressions: 400 + i * 88 } },
      ],
    });
  }
  return posts;
}

function seedConnections() {
  return {
    profiles: [
      { id: 'gp-1', name: 'Demo Business (Google)', platform: 'google', status: 'connected' },
      { id: 'fb-1', name: 'Demo Business', platform: 'facebook', status: 'connected' },
      { id: 'ig-1', name: '@demo.business', platform: 'instagram', status: 'connected' },
    ],
    facebookPageId: 'fb-page-demo',
    facebookPlacements: [{ id: 'fb-page-demo', name: 'Demo Business', type: 'page' }],
    googleLocationId: 'gl-demo-1',
  };
}

function seedBusiness(id: number, name: string) {
  return {
    id,
    name,
    plan: 'growth',
    subscriptionStatus: 'active',
    email: `owner+${id}@demo.local`,
    websiteUrl: 'https://www.harborandpine.demo/',
    customContext: '',
    websiteContextFetchedAt: daysAgo(10),
    createdAt: daysAgo(200),
  };
}

function buildFreshBusinessData(businessId: number, locationId: number, businessName: string, address: string) {
  const dm = seedDmData();
  return {
    business: seedBusiness(businessId, businessName),
    location: seedLocation(businessId, locationId, businessName, address),
    reviews: seedReviews(locationId),
    kioskSessions: seedKioskSessions(locationId),
    screeningLogs: seedScreeningLogs(locationId),
    competitors: seedCompetitors(locationId),
    requests: seedRequests(locationId),
    employees: seedEmployees(locationId),
    knowledge: seedKnowledge(locationId),
    feedback: seedFeedback(locationId),
    posts: seedPosts(locationId),
    connections: seedConnections(),
    ...dm,
  };
}

function seedFullDb(): DemoDb {
  const businessId = 1;
  const locationId = 1;
  const fresh = buildFreshBusinessData(businessId, locationId, 'The Rustic Table', '221 Maple Street, Springfield');

  const db: DemoDb = {
    nextLocalId: 1000,
    users: [
      { email: 'demo@amtechnexus.com', password: 'demo1234', businessId, isPlatformAdmin: false },
      { email: 'admin@amtechnexus.com', password: 'admin1234', businessId: -1, isPlatformAdmin: true },
    ],
    businesses: { [businessId]: fresh.business },
    locations: { [locationId]: fresh.location },
    reviews: fresh.reviews,
    kioskSessions: fresh.kioskSessions,
    screeningLogs: fresh.screeningLogs,
    analyticsSnapshots: [
      {
        id: 4,
        periodLabel: 'Last 30 days',
        summary: 'Not enough reviews in this period to generate meaningful insights yet.',
        recommendations: [],
        reviewCountAnalyzed: 0,
        createdAt: daysAgo(4),
      },
      {
        id: 3,
        periodLabel: 'Last 30 days',
        summary: 'Not enough reviews in this period to generate meaningful insights yet.',
        recommendations: [],
        reviewCountAnalyzed: 0,
        createdAt: daysAgo(11),
      },
      {
        id: 2,
        periodLabel: 'All reviews',
        summary:
          'The Rustic Table holds a strong local reputation with consistent praise for warm service, fair pricing, and a welcoming dining room. Guests frequently mention weekend brunch as a highlight. Friction shows up around peak-hour wait times and occasional payment delays at the counter — worth tightening staffing and checkout flow on busy evenings.',
        recommendations: [
          'Add a host during Saturday peak (6–8pm) to cut wait times.',
          'Feature brunch specials in Google and social posts this week.',
          'Follow up with guests who mentioned slow checkout.',
        ],
        reviewCountAnalyzed: 46,
        createdAt: daysAgo(14),
      },
      {
        id: 1,
        periodLabel: 'Last 30 days',
        summary: 'Not enough reviews in this period to generate meaningful insights yet.',
        recommendations: [],
        reviewCountAnalyzed: 0,
        createdAt: daysAgo(14),
      },
    ],
    competitors: fresh.competitors,
    requests: fresh.requests,
    employees: fresh.employees,
    chatMessages: [
      { id: 1, role: 'assistant', content: "Hi! I'm your AI advisor. Ask me anything about your reviews, ratings trends, or how you compare to competitors.", createdAt: daysAgo(5) },
    ],
    knowledgeEntries: fresh.knowledge,
    feedback: fresh.feedback,
    dmChatsByPlatform: fresh.dmChatsByPlatform,
    dmMessagesByChat: fresh.dmMessagesByChat,
    dmConversations: fresh.dmConversations,
    posts: fresh.posts,
    connectionsByLocation: { [locationId]: fresh.connections },
    auditLog: [
      { id: 1, action: 'business.created', target: 'The Rustic Table', actor: 'system', createdAt: daysAgo(200) },
    ],
    imageQuotaUsed: 2,
  };
  return db;
}

let cached: DemoDb | null = null;

export function getDb(): DemoDb {
  if (cached) return cached;
  try {
    const raw = localStorage.getItem(DB_KEY);
    if (raw) {
      cached = JSON.parse(raw);
      const attentionFixed = ensureAttentionReviews(cached as DemoDb);
      const requestsFixed = ensureEmailOnlyRequests(cached as DemoDb);
      const competitorsFixed = ensureCompetitorRatings(cached as DemoDb);
      const websiteFixed = ensureDemoWebsiteUrl(cached as DemoDb);
      const reviewLinkFixed = ensureDemoReviewLink(cached as DemoDb);
      const kioskFixed = ensureKioskQuestions(cached as DemoDb);
      const screeningFixed = ensureScreeningScan(cached as DemoDb);
      const insightsFixed = ensureInsightReports(cached as DemoDb);
      const emailsFixed = ensureDemoEmails(cached as DemoDb);
      if (
        attentionFixed ||
        requestsFixed ||
        competitorsFixed ||
        websiteFixed ||
        reviewLinkFixed ||
        kioskFixed ||
        screeningFixed ||
        insightsFixed ||
        emailsFixed
      ) {
        saveDb(cached as DemoDb);
      }
      return cached as DemoDb;
    }
  } catch {
    // fall through to reseed
  }
  cached = seedFullDb();
  saveDb(cached);
  return cached;
}

export function saveDb(db: DemoDb) {
  cached = db;
  try {
    localStorage.setItem(DB_KEY, JSON.stringify(db));
  } catch {
    // storage full or unavailable — demo still works in-memory for this session
  }
}

export function resetDb() {
  localStorage.removeItem(DB_KEY);
  cached = null;
  getDb();
}

// Creates a brand-new demo business (used by the signup flow) pre-loaded
// with its own sample data so every feature has something to show.
export function createDemoBusiness(businessName: string, email: string, password: string) {
  const db = getDb();
  const businessId = db.nextLocalId++;
  const locationId = db.nextLocalId++;
  const fresh = buildFreshBusinessData(businessId, locationId, businessName || 'My Business', '1 Main Street');
  fresh.business.email = email;
  db.businesses[businessId] = fresh.business;
  db.locations[locationId] = fresh.location;
  db.reviews.push(...fresh.reviews);
  db.kioskSessions.push(...fresh.kioskSessions);
  db.competitors.push(...fresh.competitors);
  db.requests.push(...fresh.requests);
  db.employees.push(...fresh.employees);
  db.knowledgeEntries.push(...fresh.knowledge);
  db.feedback.push(...fresh.feedback);
  db.posts.push(...fresh.posts);
  db.connectionsByLocation[locationId] = fresh.connections;
  Object.assign(db.dmChatsByPlatform, fresh.dmChatsByPlatform);
  Object.assign(db.dmMessagesByChat, fresh.dmMessagesByChat);
  db.dmConversations.push(...fresh.dmConversations);
  db.users.push({ email, password, businessId, isPlatformAdmin: false });
  db.auditLog.push({ id: db.auditLog.length + 1, action: 'business.created', target: businessName, actor: email, createdAt: new Date().toISOString() });
  saveDb(db);
  return { business: fresh.business, location: fresh.location };
}
