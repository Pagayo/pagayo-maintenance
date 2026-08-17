#!/usr/bin/env node
/**
 * Generates pagayo-marketing/src/content/success-stories.json (100 stories).
 */
import { writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const OUT_PATH = join(__dirname, '../../../pagayo-marketing/src/content/success-stories.json');

const CONTINENT_QUOTAS = [
  { id: 'europe', label: 'Europe', count: 32 },
  { id: 'north-america', label: 'North America', count: 22 },
  { id: 'asia', label: 'Asia', count: 18 },
  { id: 'latin-america', label: 'Latin America', count: 10 },
  { id: 'africa', label: 'Africa', count: 8 },
  { id: 'middle-east', label: 'Middle East', count: 5 },
  { id: 'oceania', label: 'Oceania', count: 5 },
];

const CITIES = {
  europe: [
    { city: 'Amsterdam', code: 'NL' },
    { city: 'Berlin', code: 'DE' },
    { city: 'Paris', code: 'FR' },
    { city: 'Madrid', code: 'ES' },
    { city: 'Dublin', code: 'IE' },
    { city: 'Stockholm', code: 'SE' },
    { city: 'Warsaw', code: 'PL' },
    { city: 'Lisbon', code: 'PT' },
    { city: 'Vienna', code: 'AT' },
    { city: 'Brussels', code: 'BE' },
    { city: 'Copenhagen', code: 'DK' },
    { city: 'Milan', code: 'IT' },
  ],
  'north-america': [
    { city: 'Toronto', code: 'CA' },
    { city: 'Austin', code: 'US' },
    { city: 'Portland', code: 'US' },
    { city: 'Denver', code: 'US' },
    { city: 'Montreal', code: 'CA' },
    { city: 'Chicago', code: 'US' },
    { city: 'Vancouver', code: 'CA' },
    { city: 'Boston', code: 'US' },
  ],
  asia: [
    { city: 'Singapore', code: 'SG' },
    { city: 'Tokyo', code: 'JP' },
    { city: 'Bangkok', code: 'TH' },
    { city: 'Hong Kong', code: 'HK' },
    { city: 'Seoul', code: 'KR' },
    { city: 'Kuala Lumpur', code: 'MY' },
  ],
  'latin-america': [
    { city: 'São Paulo', code: 'BR' },
    { city: 'Mexico City', code: 'MX' },
    { city: 'Buenos Aires', code: 'AR' },
    { city: 'Bogotá', code: 'CO' },
    { city: 'Santiago', code: 'CL' },
  ],
  africa: [
    { city: 'Lagos', code: 'NG' },
    { city: 'Nairobi', code: 'KE' },
    { city: 'Cape Town', code: 'ZA' },
    { city: 'Accra', code: 'GH' },
  ],
  'middle-east': [
    { city: 'Dubai', code: 'AE' },
    { city: 'Tel Aviv', code: 'IL' },
    { city: 'Riyadh', code: 'SA' },
  ],
  oceania: [
    { city: 'Sydney', code: 'AU' },
    { city: 'Melbourne', code: 'AU' },
    { city: 'Auckland', code: 'NZ' },
  ],
};

/** vertical, role label, quote templates (use {city} optional) */
const VERTICALS = [
  {
    vertical: 'gym',
    role: 'Gym Owner',
    quotes: [
      'We left an enterprise gym platform and cut software costs without losing memberships or POS.',
      'Check-in, subscriptions, and class packs finally live in one dashboard — no per-member tax.',
      'Our front desk runs POS and memberships on the same order model as the webshop.',
    ],
  },
  {
    vertical: 'crossfit',
    role: 'CrossFit Operator',
    quotes: [
      'Drop-in cards, monthly memberships, and merch share one checkout flow.',
      'We sell training blocks online and scan members at the door with the same subscription record.',
    ],
  },
  {
    vertical: 'yoga',
    role: 'Yoga Studio Manager',
    quotes: [
      'Class passes and recurring memberships renew automatically — we stopped chasing spreadsheets.',
      'Students book online; staff sell retail at the desk without a second system.',
    ],
  },
  {
    vertical: 'martial-arts',
    role: 'Martial Arts Club Coach',
    quotes: [
      'Belt fees, monthly dues, and event tickets all land as orders we can actually report on.',
      'Parents pay online; we validate membership at the mat with QR check-in.',
    ],
  },
  {
    vertical: 'football-club',
    role: 'Football Club Treasurer',
    quotes: [
      'Membership renewals and kit orders used to be three spreadsheets — now one platform.',
      'Volunteers sell snacks on match day through POS; parents pay subs online on the same ledger.',
    ],
  },
  {
    vertical: 'tennis-club',
    role: 'Tennis Club Administrator',
    quotes: [
      'Court bookings, member fees, and pro-shop sales share one order history.',
      'We launched seasonal memberships and guest passes without a custom build.',
    ],
  },
  {
    vertical: 'swimming-club',
    role: 'Swimming Club Secretary',
    quotes: [
      'Lane memberships and gala entries are finally separate line items, not manual notes.',
      'Families renew online; coaches see who is paid before the first whistle.',
    ],
  },
  {
    vertical: 'community-pool',
    role: 'Community Pool Operator',
    quotes: [
      'Season passes, day tickets, and a small shop run on one stack — on our own domain.',
      'We had no budget for enterprise software; subscriptions and QR entry were live in an afternoon.',
    ],
  },
  {
    vertical: 'community-foundation',
    role: 'Community Foundation Coordinator',
    quotes: [
      'Donations, event tickets, and a modest webshop feed one transparent order log.',
      'Volunteers manage sales without touching code; finance exports what auditors expect.',
    ],
  },
  {
    vertical: 'cultural-association',
    role: 'Cultural Association Board Member',
    quotes: [
      'Member dues, workshop fees, and merchandise no longer sit in disconnected tools.',
      'We publish bilingual pages and sell tickets without a plugin marketplace.',
    ],
  },
  {
    vertical: 'fashion-webshop',
    role: 'Fashion Retailer',
    quotes: [
      'Webshop, Instagram orders, and market-day POS reconcile in one order feed.',
      'Returns and discount codes work the same online and at pop-up stalls.',
    ],
  },
  {
    vertical: 'electronics-webshop',
    role: 'Electronics Webshop Owner',
    quotes: [
      'High-SKU catalogue, bundles, and in-store pickup share one inventory view.',
      'We added WhatsApp order links without another middleware bill.',
    ],
  },
  {
    vertical: 'bookshop',
    role: 'Bookshop Owner',
    quotes: [
      'In-store POS and online pre-orders finally agree on stock levels.',
      'Author events sell tickets beside books — one checkout, one receipt flow.',
    ],
  },
  {
    vertical: 'home-goods',
    role: 'Home Goods Retailer',
    quotes: [
      'Bulky items online, small goods at the counter — same tax and shipping rules.',
      'We run seasonal collections on the webshop and clear remainder stock via POS.',
    ],
  },
  {
    vertical: 'pet-supplies',
    role: 'Pet Supplies Retailer',
    quotes: [
      'Subscribe-and-save for food bags works next to one-off toy sales in store.',
      'Repeat customers get the same account online and at the pickup desk.',
    ],
  },
  {
    vertical: 'artisan-marketplace',
    role: 'Artisan Marketplace Curator',
    quotes: [
      'Multiple makers, one storefront — each order still traces to the right seller line.',
      'Market weekends and the online catalogue no longer diverge after Monday.',
    ],
  },
  {
    vertical: 'b2b-catalog',
    role: 'Wholesale Catalog Manager',
    quotes: [
      'Tiered pricing and re-order lists without a separate B2B portal project.',
      'Trade buyers and walk-in accounts share products; permissions stay separate.',
    ],
  },
  {
    vertical: 'subscription-box',
    role: 'Subscription Box Founder',
    quotes: [
      'Monthly boxes, gift subscriptions, and one-time add-ons use one billing engine.',
      'Skipped months and address changes self-serve — support tickets dropped sharply.',
    ],
  },
  {
    vertical: 'cafe',
    role: 'Café Owner',
    quotes: [
      'Table QR orders and the counter POS write to the same kitchen queue.',
      'Gift cards sold online redeem at the register without manual lookups.',
    ],
  },
  {
    vertical: 'restaurant',
    role: 'Restaurant Operator',
    quotes: [
      'Delivery links, dine-in tabs, and catering deposits are all orders we can audit.',
      'Split payments at the table sync with end-of-day reporting automatically.',
    ],
  },
  {
    vertical: 'food-truck',
    role: 'Food Truck Operator',
    quotes: [
      'Festival POS and pre-order links for regular spots share one menu.',
      'Cash and card sales from the truck appear beside online pre-orders instantly.',
    ],
  },
  {
    vertical: 'charity-shop',
    role: 'Charity Shop Manager',
    quotes: [
      'Donation sales and volunteer shifts do not need separate tills anymore.',
      'Low-volume SKUs and campaign weeks export cleanly for trustees.',
    ],
  },
  {
    vertical: 'event-tickets',
    role: 'Event Ticket Organiser',
    quotes: [
      'Early-bird tiers, door sales, and merch bundles use one order model.',
      'QR tickets validate at entry without a dedicated events stack.',
    ],
  },
  {
    vertical: 'hotel-gift-shop',
    role: 'Hotel Gift Shop Manager',
    quotes: [
      'Room-charge retail and walk-in POS share stock with the online gift catalogue.',
      'Guests order souvenirs online for pickup at checkout — same SKU list.',
    ],
  },
  {
    vertical: 'local-retailer',
    role: 'Independent Retailer',
    quotes: [
      'We outgrew spreadsheets the week we added a second sales channel.',
      'One platform for web, counter, and payment links — no revenue share on our sales.',
    ],
  },
];

function pickCity(continentId, index) {
  const pool = CITIES[continentId];
  return pool[index % pool.length];
}

function buildStories(continentId, count) {
  const stories = [];
  for (let i = 0; i < count; i++) {
    const v = VERTICALS[i % VERTICALS.length];
    const quoteSet = v.quotes;
    const quote = quoteSet[i % quoteSet.length];
    const { city, code } = pickCity(continentId, i);
    stories.push({
      quote,
      role: `${v.role}, ${city}`,
      vertical: v.vertical,
      countryCode: code,
    });
  }
  return stories;
}

const continents = CONTINENT_QUOTAS.map(({ id, label, count }) => ({
  id,
  label,
  stories: buildStories(id, count),
}));

const previewSlugs = [
  'europe:0',
  'north-america:2',
  'asia:4',
];

const output = {
  meta: {
    version: 1,
    storyCount: 100,
    locale: 'en',
  },
  continents,
  previewSlugs,
};

const total = continents.reduce((n, c) => n + c.stories.length, 0);
if (total !== 100) {
  console.error(`Story count mismatch: ${total}`);
  process.exit(1);
}

writeFileSync(OUT_PATH, `${JSON.stringify(output, null, 2)}\n`);
console.log(`Wrote ${total} stories to ${OUT_PATH}`);
