// ---------------------------------------------------------------------------
// DEMO MODE API CLIENT
// ---------------------------------------------------------------------------
// This app was originally powered by a Cloudflare Worker + Postgres backend.
// For this static/demo build, every function below keeps the exact same
// name, signature, and return shape as the original — so no page or
// component anywhere in the app needed to change — but internally it reads
// and writes to an in-browser "database" (see ./mockDb.ts) instead of
// calling a real API. That means this whole app can be built and hosted as
// static files (GitHub Pages, Cloudflare Pages, Netlify, etc.) with zero
// server, zero database, and zero secrets.
// ---------------------------------------------------------------------------

import { getDb, saveDb, delay, guid, daysAgo, createDemoBusiness } from './mockDb';

function getToken() {
  return localStorage.getItem('rs2:token');
}

function currentBusinessId(): number {
  const token = getToken();
  if (!token) throw new Error('Not logged in');
  if (token === 'demo-token:admin') return -1;
  const id = Number(token.replace('demo-token:', ''));
  if (!id) throw new Error('Session expired');
  return id;
}

function isAdminToken() {
  return getToken() === 'demo-token:admin';
}

// ---------------- types ----------------
export interface Review {
  id: number;
  locationId: number;
  reviewhookReviewId: string;
  platform: string;
  rating: number;
  authorName: string | null;
  text: string | null;
  hasResponse: boolean;
  responseText: string | null;
  reviewCreatedAt: string;
}

export interface KioskSession {
  id: number;
  locationId: number;
  rating: number;
  answers: { q: string; a: string }[];
  targetLength: number;
  aiDraft: string | null;
  editedDraft: string | null;
  confirmedAuthentic: boolean;
  posted: boolean;
  createdAt: string;
}

export interface ScreeningLog {
  id: number;
  reviewText: string;
  verdict: string;
  category: string;
  reasoning: string;
  flagText: string;
  createdAt: string;
}

// ---------------- businesses ----------------
export const businessesApi = {
  get: async (id: number) => {
    const db = getDb();
    const business = db.businesses[id];
    const locations = Object.values(db.locations).filter((l: any) => l.businessId === id);
    return delay({ business, locations });
  },

  getLocation: async (locationId: number) => {
    const db = getDb();
    return delay({ location: db.locations[locationId] || null });
  },

  setGoogleReviewLink: async (locationId: number, googleReviewLink: string) => {
    const db = getDb();
    const loc = db.locations[locationId];
    if (loc) {
      loc.googleReviewLink = googleReviewLink.trim();
      saveDb(db);
    }
    return delay({ location: loc });
  },

  addLocation: async (body: { address?: string; googleReviewLink?: string; googlePlaceId?: string }) => {
    const db = getDb();
    const businessId = currentBusinessId();
    const id = db.nextLocalId++;
    const location = {
      id,
      businessId,
      address: body.address || '',
      googleReviewLink: body.googleReviewLink || '',
      googlePlaceId: body.googlePlaceId || '',
      dmAutoReplyEnabled: true,
      managerPhone: '',
    };
    db.locations[id] = location;
    saveDb(db);
    return delay({ location });
  },
};

// ---------------- reviews ----------------
export const reviewsApi = {
  sync: async (_locationId: number) => delay({ synced: 0 }),

  list: async (locationId: number) => {
    const db = getDb();
    const reviews = db.reviews
      .filter((r) => r.locationId === locationId)
      .sort((a, b) => +new Date(b.reviewCreatedAt) - +new Date(a.reviewCreatedAt));
    return delay({ reviews });
  },

  draftReply: async (reviewId: number, tone?: string) => {
    const db = getDb();
    const review = db.reviews.find((r) => r.id === reviewId);
    const t = tone || 'friendly';
    const openers: Record<string, string> = {
      friendly: 'Thanks so much for taking the time to share this',
      professional: 'Thank you for your feedback',
      warm: "We're so grateful you shared this with us",
      concise: 'Thanks for the review',
    };
    const opener = openers[t] || openers.friendly;
    let draft: string;
    if (!review || review.rating >= 4) {
      draft = `${opener}! We're thrilled to hear you had a great experience — comments like yours make our whole team's day. We hope to see you again soon!`;
    } else {
      draft = `${opener}, and we're sorry to hear it didn't fully meet expectations. We'd love the chance to make this right — please reach out to us directly so we can follow up.`;
    }
    return delay({ draft });
  },

  reply: async (reviewId: number, text: string) => {
    const db = getDb();
    const review = db.reviews.find((r) => r.id === reviewId);
    if (review) {
      review.hasResponse = true;
      review.responseText = text;
      saveDb(db);
    }
    return delay({ ok: true });
  },
};

// ---------------- kiosk ----------------
const KIOSK_QUESTIONS: Record<number, string[]> = {
  5: ['What made your meal great today?', 'Any dish you’d recommend to others?'],
  4: ['What did you enjoy most?', 'Was there anything that could have been better?'],
  3: ['What worked well for you today?', 'What would you like to see improved on the menu or service?'],
  2: ['What went wrong with your visit?', 'How can we make it right next time?'],
  1: ['What went wrong with your visit?', 'How can we make it right next time?'],
};

export const kioskApi = {
  getQuestions: async (rating: number, locationId?: number) => {
    if (locationId) {
      const db = getDb();
      const custom = (db.locations[locationId]?.kioskQuestions || [])
        .map((q: string) => String(q || '').trim())
        .filter(Boolean);
      if (custom.length > 0) return delay({ questions: custom });
    }
    return delay({ questions: KIOSK_QUESTIONS[rating] || KIOSK_QUESTIONS[5] });
  },

  getCustomQuestions: async (locationId: number) => {
    const db = getDb();
    const saved = db.locations[locationId]?.kioskQuestions;
    const questions = Array.isArray(saved) ? [...saved] : ['', '', '', '', ''];
    while (questions.length < 5) questions.push('');
    return delay({ questions: questions.slice(0, 5) });
  },

  saveCustomQuestions: async (locationId: number, questions: string[]) => {
    const db = getDb();
    const loc = db.locations[locationId];
    if (loc) {
      const next = [...questions.map((q) => q.trim())];
      while (next.length < 5) next.push('');
      loc.kioskQuestions = next.slice(0, 5);
      saveDb(db);
    }
    return delay({ questions: loc?.kioskQuestions || questions });
  },

  generate: async (body: { locationId: number; rating: number; answers: { q: string; a: string }[]; targetLength: number }) => {
    const db = getDb();
    const answerText = body.answers.map((a) => a.a).join(' ');
    const draft =
      body.rating >= 4
        ? `Really great experience! ${answerText} Would definitely recommend to friends and family.`
        : `Mixed experience today. ${answerText} Hoping this gets addressed soon.`;
    const session: KioskSession = {
      id: db.nextLocalId++,
      locationId: body.locationId,
      rating: body.rating,
      answers: body.answers,
      targetLength: body.targetLength,
      aiDraft: draft,
      editedDraft: null,
      confirmedAuthentic: false,
      posted: false,
      createdAt: new Date().toISOString(),
    };
    db.kioskSessions.push(session);
    saveDb(db);
    const location = db.locations[body.locationId];
    return delay({ session, draft, googleReviewLink: location?.googleReviewLink || null });
  },

  confirm: async (id: number, body: { editedDraft?: string; confirmedAuthentic: boolean }) => {
    const db = getDb();
    const session = db.kioskSessions.find((s) => s.id === id);
    if (session) {
      if (body.editedDraft !== undefined) session.editedDraft = body.editedDraft;
      session.confirmedAuthentic = body.confirmedAuthentic;
      session.posted = body.confirmedAuthentic;
      saveDb(db);
    }
    return delay({ session });
  },

  listForLocation: async (locationId: number) => {
    const db = getDb();
    const sessions = db.kioskSessions
      .filter((s) => s.locationId === locationId)
      .sort((a, b) => +new Date(b.createdAt) - +new Date(a.createdAt));
    return delay({ sessions });
  },
};

// ---------------- screening ----------------
export const screeningApi = {
  check: async (body: { locationId: number; reviewText: string; ownerContext?: string }) => {
    const db = getDb();
    const text = body.reviewText.toLowerCase();
    const suspiciousSignals = ['scam', 'never go', 'fake', 'worst ever', 'sue', 'lawyer'];
    const isSuspicious = suspiciousSignals.some((s) => text.includes(s)) || body.reviewText.length < 12;
    const log: ScreeningLog = {
      id: db.nextLocalId++,
      reviewText: body.reviewText,
      verdict: isSuspicious ? 'flagged' : 'genuine',
      category: isSuspicious ? 'suspicious' : 'general',
      reasoning: isSuspicious
        ? 'Contains inflammatory or vague language without specific, checkable details about a visit or order.'
        : 'References specific, plausible details consistent with a genuine customer visit.',
      flagText: isSuspicious ? 'Consider reporting to the platform for policy review.' : '',
      createdAt: new Date().toISOString(),
    };
    db.screeningLogs.push(log);
    saveDb(db);
    return delay({ log, ...log });
  },

  history: async (_locationId: number) => {
    const db = getDb();
    return delay({ logs: [...db.screeningLogs].reverse() });
  },
};

// ---------------- analytics ----------------
export interface AnalyticsSnapshot {
  id: number;
  periodLabel: string;
  summary: string;
  recommendations: string[];
  reviewCountAnalyzed: number;
  createdAt: string;
}

export const analyticsApi = {
  generate: async (locationId: number, days = 30) => {
    const db = getDb();
    const reviews = db.reviews.filter((r) => r.locationId === locationId);
    const avg = reviews.length ? (reviews.reduce((s, r) => s + r.rating, 0) / reviews.length).toFixed(1) : '0.0';
    const snapshot: AnalyticsSnapshot = {
      id: db.nextLocalId++,
      periodLabel: `Last ${days} days`,
      summary: `Average rating over this period was ${avg}\u2605 across ${reviews.length} reviews. Guests most frequently mentioned staff friendliness and speed of service as highlights.`,
      recommendations: [
        'Reply to every review within 48 hours \u2014 responsiveness is one of the strongest signals to new customers.',
        'Highlight your top-mentioned strength in social posts and Google posts.',
        'Reach out personally to guests who left 3\u2605 or below to turn the experience around.',
      ],
      reviewCountAnalyzed: reviews.length,
      createdAt: new Date().toISOString(),
    };
    db.analyticsSnapshots.push(snapshot);
    saveDb(db);
    return delay({ snapshot }, 800);
  },

  list: async (_locationId: number) => {
    const db = getDb();
    return delay({ snapshots: [...db.analyticsSnapshots].reverse() });
  },
};

// ---------------- competitors ----------------
export interface Competitor {
  id: number;
  name: string;
  rating: number | null;
  reviewCount: number | null;
  lastCheckedAt: string | null;
  notes: string | null;
}

export const competitorsApi = {
  create: async (body: { locationId: number; name: string; rating?: number; reviewCount?: number; notes?: string }) => {
    const db = getDb();
    const competitor = {
      id: db.nextLocalId++,
      locationId: body.locationId,
      name: body.name,
      rating: body.rating ?? null,
      reviewCount: body.reviewCount ?? null,
      lastCheckedAt: new Date().toISOString(),
      notes: body.notes ?? null,
    };
    db.competitors.push(competitor);
    saveDb(db);
    return delay({ competitor });
  },

  createFromLink: async (body: { locationId: number; mapsUrl: string; notes?: string }) => {
    const db = getDb();
    let name = 'Competitor';
    try {
      const match = body.mapsUrl.match(/place\/([^/]+)/);
      if (match) name = decodeURIComponent(match[1]).replace(/\+/g, ' ');
    } catch {
      // keep default name
    }
    const competitor = {
      id: db.nextLocalId++,
      locationId: body.locationId,
      name,
      rating: +(3.8 + Math.random() * 1.1).toFixed(1),
      reviewCount: Math.floor(80 + Math.random() * 500),
      lastCheckedAt: new Date().toISOString(),
      notes: body.notes ?? null,
    };
    db.competitors.push(competitor);
    saveDb(db);
    return delay<{ competitor: Competitor; error?: string }>({ competitor });
  },

  insight: async (id: number) => {
    const db = getDb();
    const c = db.competitors.find((x) => x.id === id);
    const insight = c
      ? `${c.name} is averaging ${c.rating ?? 'N/A'}\u2605 across ${c.reviewCount ?? '?'} reviews. Their reviewers most often mention pricing and ambiance \u2014 worth highlighting your own strengths in those areas.`
      : 'No data available for this competitor yet.';
    return delay({ insight }, 700);
  },

  list: async (locationId: number) => {
    const db = getDb();
    return delay({ competitors: db.competitors.filter((c) => c.locationId === locationId) });
  },

  comparison: async (locationId: number) => {
    const db = getDb();
    const reviews = db.reviews.filter((r) => r.locationId === locationId);
    const averageRating = reviews.length ? +(reviews.reduce((s, r) => s + r.rating, 0) / reviews.length).toFixed(2) : 0;
    const competitors = db.competitors
      .filter((c) => c.locationId === locationId)
      .map((c) => ({ name: c.name, averageRating: c.rating, reviewCount: c.reviewCount }));
    return delay({ you: { averageRating, reviewCount: reviews.length }, competitors });
  },

  remove: async (id: number) => {
    const db = getDb();
    db.competitors = db.competitors.filter((c) => c.id !== id);
    saveDb(db);
    return delay({ ok: true });
  },
};

// ---------------- review requests ----------------
export interface ReviewRequest {
  id: number;
  channel: 'email';
  customerContact: string;
  customerName: string | null;
  status: 'sent';
  createdAt: string;
}

export const requestsApi = {
  status: async () => delay({ emailConfigured: true }),

  create: async (body: { locationId: number; channel?: 'email'; customerContact: string; customerName?: string }) => {
    const db = getDb();
    const request = {
      id: db.nextLocalId++,
      locationId: body.locationId,
      channel: 'email' as const,
      customerContact: body.customerContact,
      customerName: body.customerName || null,
      status: 'sent' as const,
      createdAt: new Date().toISOString(),
    };
    db.requests.push(request);
    saveDb(db);
    return delay<{ request: ReviewRequest; delivered: boolean; reason?: string }>({ request, delivered: true });
  },

  list: async (locationId: number) => {
    const db = getDb();
    return delay({
      requests: db.requests
        .filter((r) => r.locationId === locationId && r.channel !== 'sms')
        .map((r) => ({ ...r, channel: 'email' as const, status: 'sent' as const }))
        .sort((a, b) => +new Date(b.createdAt) - +new Date(a.createdAt)),
    });
  },
};

// ---------------- reports (CSV export, generated client-side) ----------------
function toCsv(rows: Record<string, any>[]): string {
  if (!rows.length) return '';
  const headers = Object.keys(rows[0]);
  const escape = (v: any) => `"${String(v ?? '').replace(/"/g, '""')}"`;
  return [headers.join(','), ...rows.map((r) => headers.map((h) => escape(r[h])).join(','))].join('\n');
}

function downloadText(text: string, filename: string, mime = 'text/csv') {
  const blob = new Blob([text], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

export const reportsApi = {
  downloadReviews: async (locationId: number) => {
    const db = getDb();
    const rows = db.reviews
      .filter((r) => r.locationId === locationId)
      .map((r) => ({ id: r.id, platform: r.platform, rating: r.rating, author: r.authorName, text: r.text, hasResponse: r.hasResponse, createdAt: r.reviewCreatedAt }));
    downloadText(toCsv(rows), `reviews-location-${locationId}.csv`);
  },
  downloadKioskDrafts: async (locationId: number) => {
    const db = getDb();
    const rows = db.kioskSessions
      .filter((s) => s.locationId === locationId)
      .map((s) => ({ id: s.id, rating: s.rating, draft: s.editedDraft || s.aiDraft, confirmed: s.confirmedAuthentic, posted: s.posted, createdAt: s.createdAt }));
    downloadText(toCsv(rows), `kiosk-drafts-location-${locationId}.csv`);
  },
};

// ---------------- auth ----------------
export const authApi = {
  signup: async (body: { email: string; password: string; businessName: string }) => {
    const db = getDb();
    if (db.users.some((u) => u.email.toLowerCase() === body.email.toLowerCase())) {
      throw new Error('An account with this email already exists.');
    }
    const { business, location } = createDemoBusiness(body.businessName, body.email, body.password);
    const token = `demo-token:${business.id}`;
    return delay({ token, business, location, user: { email: body.email } }, 600);
  },

  login: async (body: { email: string; password: string }) => {
    const db = getDb();
    const user = db.users.find((u) => u.email.toLowerCase() === body.email.toLowerCase() && u.password === body.password);
    if (!user) throw new Error('Invalid credentials');
    if (user.isPlatformAdmin) {
      return delay({ token: 'demo-token:admin', user: { email: user.email }, businessId: -1, locations: [] }, 500);
    }
    const locations = Object.values(db.locations).filter((l: any) => l.businessId === user.businessId);
    return delay({ token: `demo-token:${user.businessId}`, user: { email: user.email }, businessId: user.businessId, locations }, 500);
  },

  me: async () => {
    const db = getDb();
    if (isAdminToken()) {
      return delay({ business: null, locations: [], isPlatformAdmin: true });
    }
    const businessId = currentBusinessId();
    const business = db.businesses[businessId];
    if (!business) throw new Error('Session expired');
    const locations = Object.values(db.locations).filter((l: any) => l.businessId === businessId);
    return delay({ business, locations, isPlatformAdmin: false });
  },

  // Impersonation session management — the admin's real token is preserved
  // separately so "Return to Admin" can restore it exactly.
  startImpersonation: (token: string, businessName: string) => {
    const currentToken = localStorage.getItem('rs2:token');
    if (currentToken) localStorage.setItem('rs2:admin-token', currentToken);
    localStorage.setItem('rs2:token', token);
    localStorage.setItem('rs2:impersonating', businessName);
    localStorage.removeItem('rs2:active-location-id');
  },

  endImpersonation: () => {
    const adminToken = localStorage.getItem('rs2:admin-token');
    if (adminToken) localStorage.setItem('rs2:token', adminToken);
    localStorage.removeItem('rs2:admin-token');
    localStorage.removeItem('rs2:impersonating');
    localStorage.removeItem('rs2:active-location-id');
  },

  isImpersonating: () => Boolean(localStorage.getItem('rs2:impersonating')),
  impersonatingName: () => localStorage.getItem('rs2:impersonating'),

  requestPasswordReset: async (_email: string) =>
    delay({
      message: 'If an account exists for that email, a reset link has been sent.',
      delivered: false,
      devNote: 'Demo mode: no email is actually sent. Use the reset page directly.',
    }),

  resetPassword: async (body: { email: string; token: string; newPassword: string }) => {
    const db = getDb();
    const user = db.users.find((u) => u.email.toLowerCase() === body.email.toLowerCase());
    if (user) {
      user.password = body.newPassword;
      saveDb(db);
    }
    return delay({ message: 'Password updated.' });
  },

  logout: () => localStorage.removeItem('rs2:token'),

  isLoggedIn: () => Boolean(getToken()),

  setToken: (token: string) => localStorage.setItem('rs2:token', token),
};

// ---------------- employees ----------------
export interface Employee {
  id: number;
  name: string;
  role: string | null;
}

export interface EmployeeMention {
  name: string;
  positiveMentions: number;
  negativeMentions: number;
  examples: string[];
}

export const employeesApi = {
  create: async (body: { locationId: number; name: string; role?: string }) => {
    const db = getDb();
    const employee = { id: db.nextLocalId++, locationId: body.locationId, name: body.name, role: body.role || null };
    db.employees.push(employee);
    saveDb(db);
    return delay({ employee });
  },

  list: async (locationId: number) => {
    const db = getDb();
    return delay({ employees: db.employees.filter((e) => e.locationId === locationId) });
  },

  remove: async (id: number) => {
    const db = getDb();
    db.employees = db.employees.filter((e) => e.id !== id);
    saveDb(db);
    return delay({ ok: true });
  },

  mentions: async (locationId: number) => {
    const db = getDb();
    const employees = db.employees.filter((e) => e.locationId === locationId);
    const mentions: EmployeeMention[] = employees.map((e, i) => ({
      name: e.name,
      positiveMentions: 4 + ((i * 3) % 7),
      negativeMentions: i % 3,
      examples: ['Great service from the team today!', 'Super helpful and attentive.'],
    }));
    return delay({ mentions });
  },
};

// ---------------- AI advisor chat ----------------
export interface ChatMessage {
  id: number;
  role: 'user' | 'assistant';
  content: string;
  createdAt: string;
}

export const chatApi = {
  history: async (_locationId: number) => {
    const db = getDb();
    return delay({ messages: db.chatMessages });
  },

  ask: async (locationId: number, question: string) => {
    const db = getDb();
    const reviews = db.reviews.filter((r) => r.locationId === locationId);
    const avg = reviews.length ? (reviews.reduce((s, r) => s + r.rating, 0) / reviews.length).toFixed(1) : 'N/A';
    const userMsg: ChatMessage = { id: db.nextLocalId++, role: 'user', content: question, createdAt: new Date().toISOString() };
    const content = `Based on your ${reviews.length} reviews (avg ${avg}\u2605), the strongest recurring theme is staff friendliness and fast service. The main opportunity is reducing weekend wait times \u2014 a couple of recent reviews mentioned this. Want me to draft a response plan?`;
    const answer: ChatMessage = { id: db.nextLocalId++, role: 'assistant', content, createdAt: new Date().toISOString() };
    db.chatMessages.push(userMsg, answer);
    saveDb(db);
    return delay({ answer }, 900);
  },
};

// ---------------- content generation ----------------
export const contentApi = {
  googlePost: async (body: { locationId: number; theme: string; details?: string }) => {
    const draft = `\u2728 ${body.theme}\n\n${body.details || 'Come see what\u2019s new \u2014 we can\u2019t wait to share it with you!'}\n\nStop by this week and let us know what you think!`;
    return delay({ draft }, 700);
  },
  socialCaption: async (body: { locationId: number; platform: string; minRating?: number }) => {
    const db = getDb();
    const reviews = db.reviews.filter((r) => r.locationId === body.locationId && r.rating >= (body.minRating || 4));
    const sample = reviews[0]?.text || 'Another great day serving our amazing customers!';
    const draft =
      body.platform === 'instagram'
        ? `"${sample.slice(0, 90)}${sample.length > 90 ? '\u2026' : ''}" \u2014 just one of the reviews that made our week \ud83d\ude4c #localbusiness #customerlove`
        : `We love hearing from our customers: "${sample.slice(0, 120)}${sample.length > 120 ? '\u2026' : ''}"`;
    return delay({ draft, sourceReviewCount: reviews.length }, 700);
  },
};

// ---------------- billing ----------------
export const billingApi = {
  status: async () => {
    const db = getDb();
    const businessId = currentBusinessId();
    const business = db.businesses[businessId];
    return delay({ stripeConfigured: false, subscription: { plan: business?.plan || 'growth', status: business?.subscriptionStatus || 'active' } });
  },
  checkout: async (_priceId: string) =>
    delay<{ url?: string; error?: string }>({ error: 'Billing is disabled in this demo build \u2014 no payment provider is connected.' }),
};

// ---------------- publishing (all platforms) ----------------
export const publishApi = {
  status: async () => delay({ postproxyConfigured: true, supportedPlatforms: ['google', 'facebook', 'instagram', 'x', 'linkedin', 'bluesky', 'telegram'] }),

  connect: async (
    locationId: number,
    platform: string,
    params: { redirectUrl?: string; identifier?: string; appPassword?: string; botToken?: string }
  ) => {
    const db = getDb();
    const conn = db.connectionsByLocation[locationId] || (db.connectionsByLocation[locationId] = { profiles: [] });
    conn.profiles.push({ id: guid(), name: params.identifier || `Demo ${platform}`, platform, status: 'connected' });
    saveDb(db);
    return delay<{ url?: string; connected?: boolean; nextStep?: string }>({ connected: true });
  },

  connections: async (locationId: number) => {
    const db = getDb();
    const conn = db.connectionsByLocation[locationId] || { profiles: [] };
    return delay<{
      profiles: { id: string; name: string; platform: string; status: string }[];
      facebookPageId?: string | null;
      facebookPlacements?: { id: string; name?: string; type?: string }[];
      googleLocationId?: string | null;
      error?: string;
    }>(conn);
  },

  disconnect: async (locationId: number, profileId: string) => {
    const db = getDb();
    const conn = db.connectionsByLocation[locationId];
    if (conn) conn.profiles = conn.profiles.filter((p: any) => p.id !== profileId);
    saveDb(db);
    return delay({ ok: true });
  },

  saveGoogleLocation: async (locationId: number, postproxyGoogleLocationId: string) => {
    const db = getDb();
    const conn = db.connectionsByLocation[locationId] || (db.connectionsByLocation[locationId] = { profiles: [] });
    conn.googleLocationId = postproxyGoogleLocationId;
    saveDb(db);
    return delay({ ok: true });
  },

  saveFacebookPage: async (locationId: number, postproxyFacebookPageId: string) => {
    const db = getDb();
    const conn = db.connectionsByLocation[locationId] || (db.connectionsByLocation[locationId] = { profiles: [] });
    conn.facebookPageId = postproxyFacebookPageId;
    saveDb(db);
    return delay({ ok: true });
  },

  publish: async (body: { locationId: number; body: string; platforms: string[]; mediaUrls?: string[]; scheduledFor?: string; timezone?: string }) => {
    const db = getDb();
    const scheduled = Boolean(body.scheduledFor);
    const post = {
      id: guid(),
      body: body.body,
      status: scheduled ? 'scheduled' : 'published',
      source: 'dashboard',
      scheduled_at: body.scheduledFor || null,
      created_at: new Date().toISOString(),
      media: (body.mediaUrls || []).map((u) => ({ id: guid(), status: 'ready', content_type: 'image', source_url: u, url: u })),
      platforms: body.platforms.map((p) => ({
        platform: p,
        status: scheduled ? 'scheduled' : 'published',
        permalink: scheduled ? null : `https://example.com/${p}/demo-post`,
        attempted_at: scheduled ? null : new Date().toISOString(),
        insights: { impressions: Math.floor(50 + Math.random() * 300) },
      })),
    };
    db.posts.unshift(post);
    saveDb(db);
    return delay<{ published: boolean; scheduled: boolean; error?: string }>({ published: !scheduled, scheduled }, 900);
  },

  publishGooglePost: async (body: any) => {
    const db = getDb();
    const scheduled = Boolean(body.scheduledFor);
    const post = {
      id: guid(),
      body: body.body,
      status: scheduled ? 'scheduled' : 'published',
      source: 'dashboard',
      scheduled_at: body.scheduledFor || null,
      created_at: new Date().toISOString(),
      media: body.mediaUrl ? [{ id: guid(), status: 'ready', content_type: 'image', source_url: body.mediaUrl, url: body.mediaUrl }] : [],
      platforms: [
        {
          platform: 'google',
          status: scheduled ? 'scheduled' : 'published',
          permalink: scheduled ? null : 'https://business.google.com/posts/demo',
          attempted_at: scheduled ? null : new Date().toISOString(),
          insights: { impressions: Math.floor(100 + Math.random() * 400) },
        },
      ],
    };
    db.posts.unshift(post);
    saveDb(db);
    return delay<{ published: boolean; scheduled: boolean; error?: string }>({ published: !scheduled, scheduled }, 900);
  },

  scheduled: async (_locationId: number) => {
    const db = getDb();
    return delay({ scheduled: db.posts.filter((p) => p.status === 'scheduled') });
  },
};

// ---------------- published posts ----------------
export interface SocialPostMedia {
  id: string;
  status?: string;
  content_type?: string;
  source_url?: string | null;
  url?: string | null;
}

export interface SocialPostPlatform {
  platform: string;
  status: string;
  permalink?: string | null;
  error?: string | null;
  attempted_at?: string | null;
  insights?: { impressions?: number; on?: string };
}

export interface SocialPost {
  id: string;
  body?: string | null;
  status: string;
  source?: string;
  scheduled_at?: string | null;
  created_at: string;
  media?: SocialPostMedia[];
  platforms?: SocialPostPlatform[];
}

export interface PostComment {
  id: string;
  body?: string | null;
  created_at?: string;
  author_name?: string | null;
  replies?: PostComment[];
}

export const postsApi = {
  list: async (_locationId: number, page = 0) => {
    const db = getDb();
    const perPage = 10;
    const all = db.posts as SocialPost[];
    const posts = all.slice(page * perPage, page * perPage + perPage);
    return delay<{ total: number; page: number; perPage: number; posts: SocialPost[] }>({ total: all.length, page, perPage, posts });
  },

  detail: async (_locationId: number, postId: string) => {
    const db = getDb();
    const post = db.posts.find((p) => p.id === postId) as SocialPost;
    const totalImpressions = (post?.platforms || []).reduce((s, p) => s + (p.insights?.impressions || 0), 0);
    return delay({
      post,
      stats: {
        totalImpressions,
        metricKeys: ['impressions', 'likes', 'comments'],
        series: [0, 1, 2].map((i) => ({
          recordedAt: daysAgo(2 - i),
          stats: { impressions: Math.floor(totalImpressions * ((i + 1) / 3)), likes: 4 + i * 3, comments: i },
        })),
        platforms: (post?.platforms || []).map((p) => ({
          profileId: p.platform,
          platform: p.platform,
          stats: { impressions: p.insights?.impressions || 0 },
          recordedAt: p.attempted_at || null,
          records: [{ stats: { impressions: p.insights?.impressions || 0 }, recordedAt: p.attempted_at || new Date().toISOString() }],
        })),
      },
      commentsByPlatform: (post?.platforms || []).map((p) => ({
        platform: p.platform,
        profileId: p.platform,
        comments:
          p.status === 'published'
            ? [{ id: guid(), body: 'Looks great!', created_at: new Date().toISOString(), author_name: 'A Customer', replies: [] }]
            : [],
      })),
    });
  },
};

export const pushApi = {
  vapidPublicKey: async () => delay({ publicKey: 'BDemoVapidPublicKeyNotUsedInStaticDemoBuildXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX' }),
  subscribe: async (_body: { endpoint: string; keys: { p256dh: string; auth: string } }) => delay({ subscribed: true }),
  unsubscribe: async (_endpoint: string) => delay({ unsubscribed: true }),
};

// ---------------- Google Places (competitor auto-refresh) ----------------
export const placesApi = {
  status: async () => delay({ configured: true }),
  refreshCompetitor: async (id: number) => {
    const db = getDb();
    const c = db.competitors.find((x) => x.id === id);
    if (c) {
      c.rating = c.rating ? +Math.min(5, Math.max(1, c.rating + (Math.random() - 0.5) * 0.2)).toFixed(1) : 4;
      c.reviewCount = (c.reviewCount || 0) + Math.floor(Math.random() * 5);
      c.lastCheckedAt = new Date().toISOString();
      saveDb(db);
    }
    return delay({ competitor: c, refreshed: true });
  },
};

// ---------------- DM inbox ----------------
export interface DmChat {
  id: string;
  participant_name?: string;
  participant_username?: string;
  participant_external_id?: string;
  participant_avatar_url?: string;
  last_message_at: string;
  last_inbound_at?: string;
}

export interface DmMessage {
  id: string;
  direction: 'inbound' | 'outbound';
  body: string;
  created_at: string;
  external_posted_at?: string | null;
}

export const dmsApi = {
  platforms: async (_locationId: number) => {
    const db = getDb();
    const platforms = Object.keys(db.dmChatsByPlatform).map((p) => ({ id: p, platform: p, name: p.charAt(0).toUpperCase() + p.slice(1) }));
    return delay({ platforms });
  },

  chats: async (_locationId: number, platform: string) => {
    const db = getDb();
    return delay({ chats: db.dmChatsByPlatform[platform] || [] });
  },

  messages: async (_locationId: number, _platform: string, chatId: string) => {
    const db = getDb();
    return delay({ messages: db.dmMessagesByChat[chatId] || [] });
  },

  draftReply: async (_locationId: number, _platform: string, chatId: string) => {
    const db = getDb();
    const msgs = db.dmMessagesByChat[chatId] || [];
    const last = [...msgs].reverse().find((m) => m.direction === 'inbound');
    const draft = last
      ? `Thanks for reaching out! ${last.body.includes('?') ? 'Yes, happy to help \u2014 ' : ''}Let us know if there's anything else we can do.`
      : 'Thanks for reaching out \u2014 how can we help?';
    return delay({ draft }, 700);
  },

  send: async (_locationId: number, platform: string, chatId: string, text: string) => {
    const db = getDb();
    const msgs = db.dmMessagesByChat[chatId] || (db.dmMessagesByChat[chatId] = []);
    msgs.push({ id: guid(), direction: 'outbound', body: text, created_at: new Date().toISOString() });
    const chat = (db.dmChatsByPlatform[platform] || []).find((c) => c.id === chatId);
    if (chat) chat.last_message_at = new Date().toISOString();
    saveDb(db);
    return delay({ sent: true });
  },
};

// ---------------- AI website context, Q&A captions, image generation ----------------
export const aiContentApi = {
  fetchWebsiteContext: async (_locationId: number, websiteUrl: string) =>
    delay(
      { success: true, preview: `Fetched a preview of ${websiteUrl}: homepage, hours, menu/services, and contact pages were found and summarized for use in AI replies.` },
      900
    ),

  uploadImage: async (_locationId: number, file: File): Promise<{ url: string; error?: string }> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve({ url: reader.result as string });
      reader.onerror = () => reject(new Error('Could not read file'));
      reader.readAsDataURL(file);
    });
  },

  captionFromQA: async (body: { locationId: number; platform: string; answers: { q: string; a: string }[] }) => {
    const draft = body.answers.map((a) => a.a).join(' ') + ' \u2014 come see for yourself!';
    return delay({ draft }, 700);
  },

  imageStatus: async () => delay({ configured: true, editConfigured: true, provider: 'workers-ai' as const }),

  imageQuota: async () => {
    const db = getDb();
    return delay({ allowed: db.imageQuotaUsed < 20, used: db.imageQuotaUsed, limit: 20, plan: 'growth', resetsAt: daysAgo(-15), unlimited: false });
  },

  generateImage: async (_locationId: number, prompt: string) => {
    const db = getDb();
    db.imageQuotaUsed += 1;
    saveDb(db);
    const seed = encodeURIComponent(prompt.slice(0, 40) || 'demo') + Math.floor(Math.random() * 1000);
    return delay<{ url: string; error?: string; quotaExceeded?: boolean }>({ url: `https://picsum.photos/seed/${seed}/800/600` }, 1400);
  },

  editImage: async (_locationId: number, _imageUrl: string, instruction: string) => {
    const seed = encodeURIComponent(instruction.slice(0, 40) || 'edit') + Math.floor(Math.random() * 1000);
    return delay<{ url: string; error?: string; quotaExceeded?: boolean }>({ url: `https://picsum.photos/seed/${seed}/800/600` }, 1400);
  },

  chatAboutImage: async (_body: { locationId: number; imageUrl: string; conversation: { role: 'user' | 'assistant'; content: string }[]; message: string }) =>
    delay({ reply: 'Good eye \u2014 I can adjust lighting, crop, or add text overlays. Just tell me what to change.' }, 800),

  chatAboutCaption: async (_body: {
    locationId: number;
    platform?: string;
    imageUrl: string;
    conversation: { role: 'user' | 'assistant'; content: string }[];
    message: string;
  }) => delay({ reply: "Here's a tighter version: shorter hook, clear call-to-action, and a couple of relevant hashtags at the end." }, 800),
};

// ---------------- knowledge base + auto-reply ----------------
export interface KnowledgeEntry {
  id: number;
  title: string;
  content: string;
  createdAt: string;
}

export const knowledgeApi = {
  create: async (body: { locationId: number; title: string; content: string }) => {
    const db = getDb();
    const entry = { id: db.nextLocalId++, locationId: body.locationId, title: body.title, content: body.content, createdAt: new Date().toISOString() };
    db.knowledgeEntries.push(entry);
    saveDb(db);
    return delay({ entry });
  },

  list: async (locationId: number) => {
    const db = getDb();
    return delay({ entries: db.knowledgeEntries.filter((e) => e.locationId === locationId) });
  },

  getContext: async (_locationId: number) => {
    const db = getDb();
    const businessId = currentBusinessId();
    const business = db.businesses[businessId];
    return delay({ websiteUrl: business?.websiteUrl || '', customContext: business?.customContext || '', websiteContextFetchedAt: business?.websiteContextFetchedAt || null });
  },

  saveContext: async (_locationId: number, body: { websiteUrl: string; customContext: string; websiteContext?: string | null; skipCrawl?: boolean }) => {
    const db = getDb();
    const businessId = currentBusinessId();
    const business = db.businesses[businessId];
    if (business) {
      business.websiteUrl = body.websiteUrl;
      business.customContext = body.customContext;
      if (!body.skipCrawl) business.websiteContextFetchedAt = new Date().toISOString();
      saveDb(db);
    }
    return delay({ saved: true, websiteUrl: body.websiteUrl, customContext: body.customContext, websiteContextFetchedAt: business?.websiteContextFetchedAt, pagesStored: !body.skipCrawl });
  },

  startWebsiteCrawl: async (_locationId: number, websiteUrl: string) => delay({ jobId: guid(), url: websiteUrl }),

  websiteCrawlStatus: async (_locationId: number, _jobId: string) =>
    delay<{ status: 'crawling' | 'completed' | 'failed'; completed?: number; total?: number; context: string | null; error: string | null }>({
      status: 'completed',
      completed: 6,
      total: 6,
      context: 'Crawled 6 pages: home, about, menu/services, hours, contact, FAQ.',
      error: null,
    }),

  remove: async (id: number) => {
    const db = getDb();
    db.knowledgeEntries = db.knowledgeEntries.filter((e) => e.id !== id);
    saveDb(db);
    return delay({ ok: true });
  },

  uploadPdf: async (locationId: number, file: File) => {
    const db = getDb();
    const title = file.name.replace(/\.pdf$/i, '') || 'Uploaded PDF';
    const entry = {
      id: db.nextLocalId++,
      locationId,
      title,
      content: `Extracted text from ${file.name} (demo). Replace this with real document contents as needed.`,
      createdAt: new Date().toISOString(),
    };
    db.knowledgeEntries.push(entry);
    saveDb(db);
    return delay({ entry });
  },

  getAutoReply: async (locationId: number) => {
    const db = getDb();
    const loc = db.locations[locationId];
    return delay({ enabled: Boolean(loc?.dmAutoReplyEnabled) });
  },

  setAutoReply: async (locationId: number, enabled: boolean) => {
    const db = getDb();
    const loc = db.locations[locationId];
    if (loc) {
      loc.dmAutoReplyEnabled = enabled;
      saveDb(db);
    }
    return delay<{ enabled: boolean; webhook?: { ok: boolean; created?: boolean; url?: string; error?: string } }>({
      enabled,
      webhook: { ok: true, created: true, url: 'https://example.com/webhooks/demo' },
    });
  },
};

// ---------------- DM conversation status ----------------
export interface DmConversation {
  id: number;
  platform: string;
  postproxyChatId: string;
  status: 'ai_handling' | 'escalated' | 'human_takeover';
  escalationReason: string | null;
  lastMessageAt: string;
}

export const dmStatusApi = {
  list: async (_locationId: number) => {
    const db = getDb();
    return delay({ conversations: db.dmConversations });
  },

  takeOver: async (_locationId: number, chatId: string, _platform: string) => {
    const db = getDb();
    const c = db.dmConversations.find((x) => x.postproxyChatId === chatId);
    if (c) {
      c.status = 'human_takeover';
      saveDb(db);
    }
    return delay({ status: 'human_takeover' });
  },

  handBack: async (_locationId: number, chatId: string) => {
    const db = getDb();
    const c = db.dmConversations.find((x) => x.postproxyChatId === chatId);
    if (c) {
      c.status = 'ai_handling';
      saveDb(db);
    }
    return delay({ status: 'ai_handling' });
  },
};

// ---------------- private feedback ----------------
export const kioskFeedbackApi = {
  submit: async (body: { locationId: number; rating: number; message: string; customerContact?: string }) => {
    const db = getDb();
    const feedback = {
      id: db.nextLocalId++,
      locationId: body.locationId,
      rating: body.rating,
      message: body.message,
      customerContact: body.customerContact || null,
      resolved: false,
      createdAt: new Date().toISOString(),
    };
    db.feedback.push(feedback);
    saveDb(db);
    return delay({ feedback, alertsSent: { sms: Boolean(body.customerContact), call: false } });
  },
};

export interface PrivateFeedbackItem {
  id: number;
  rating: number;
  message: string;
  customerContact: string | null;
  resolved: boolean;
  createdAt: string;
}

export const feedbackApi = {
  list: async (locationId: number) => {
    const db = getDb();
    return delay({
      feedback: db.feedback.filter((f) => f.locationId === locationId).sort((a, b) => +new Date(b.createdAt) - +new Date(a.createdAt)),
    });
  },

  unresolvedCount: async (locationId: number) => {
    const db = getDb();
    return delay({ count: db.feedback.filter((f) => f.locationId === locationId && !f.resolved).length });
  },

  resolve: async (id: number) => {
    const db = getDb();
    const f = db.feedback.find((x) => x.id === id);
    if (f) {
      f.resolved = true;
      saveDb(db);
    }
    return delay({ resolved: true });
  },

  setManagerPhone: async (locationId: number, phone: string) => {
    const db = getDb();
    const loc = db.locations[locationId];
    if (loc) {
      loc.managerPhone = phone;
      saveDb(db);
    }
    return delay({ phone });
  },
};

// ---------------- agency admin console ----------------
export interface AdminBusinessSummary {
  id: number;
  name: string;
  locationCount: number;
  reviewCount: number;
  connectedLocations: number;
  plan: string;
  subscriptionStatus: string;
  createdAt: string;
}

export const adminApi = {
  listBusinesses: async () => {
    const db = getDb();
    const businesses: AdminBusinessSummary[] = Object.values(db.businesses).map((b: any) => {
      const locations = Object.values(db.locations).filter((l: any) => l.businessId === b.id);
      const reviewCount = db.reviews.filter((r) => locations.some((l: any) => l.id === r.locationId)).length;
      return {
        id: b.id,
        name: b.name,
        locationCount: locations.length,
        reviewCount,
        connectedLocations: locations.length,
        plan: b.plan,
        subscriptionStatus: b.subscriptionStatus,
        createdAt: b.createdAt,
      };
    });
    return delay({ businesses });
  },

  getBusiness: async (id: number) => {
    const db = getDb();
    const business = db.businesses[id];
    const locations = Object.values(db.locations).filter((l: any) => l.businessId === id);
    const users = db.users.filter((u) => u.businessId === id).map((u) => ({ email: u.email }));
    return delay({ business, locations, users, subscription: { plan: business?.plan, status: business?.subscriptionStatus } });
  },

  createBusiness: async (body: { businessName: string; email: string; address?: string; googleReviewLink?: string }) => {
    const db = getDb();
    const tempPassword = Math.random().toString(36).slice(2, 10);
    const { business, location } = createDemoBusiness(body.businessName, body.email, tempPassword);
    if (body.address) location.address = body.address;
    if (body.googleReviewLink) location.googleReviewLink = body.googleReviewLink;
    saveDb(db);
    return delay({ business, location, user: { email: body.email }, tempPassword });
  },

  deleteBusiness: async (id: number) => {
    const db = getDb();
    delete db.businesses[id];
    Object.keys(db.locations).forEach((k) => {
      if (db.locations[+k].businessId === id) delete db.locations[+k];
    });
    db.users = db.users.filter((u) => u.businessId !== id);
    saveDb(db);
    return delay({ deleted: true });
  },

  updateLocation: async (
    _businessId: number,
    locationId: number,
    body: { address?: string; googleReviewLink?: string; dmAutoReplyEnabled?: boolean; managerPhone?: string }
  ) => {
    const db = getDb();
    const loc = db.locations[locationId];
    if (loc) {
      Object.assign(loc, body);
      saveDb(db);
    }
    return delay({ location: loc });
  },

  updatePlan: async (businessId: number, plan: string, status?: string) => {
    const db = getDb();
    const business = db.businesses[businessId];
    if (business) {
      business.plan = plan;
      if (status) business.subscriptionStatus = status;
      saveDb(db);
    }
    return delay({ plan });
  },

  impersonate: async (businessId: number) => {
    const db = getDb();
    const business = db.businesses[businessId];
    return delay({ token: `demo-token:${businessId}`, businessName: business?.name || 'Business' });
  },

  auditLog: async () => {
    const db = getDb();
    return delay({ log: [...db.auditLog].reverse() });
  },
};
