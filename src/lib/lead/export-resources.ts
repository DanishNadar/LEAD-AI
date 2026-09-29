/**
 * Resources published by the CampusGroups Data Export API specification.
 * Keep this list in one browser-safe module: the admin console uses it to
 * configure a run, while the server adapter uses the same exact values to
 * construct API URLs.
 */
export const exportResources = [
  "events",
  "rsvp",
  "checkins",
  "event_registration_options",
  "payments",
  "members",
  "users",
  "groups",
  "tags",
  "academic_experiences",
  "work_experiences",
  "budgets",
  "budget_transactions",
  "surveys",
  "survey_submissions",
  "rooms",
  "room_reservations",
  "badges",
  "badge_completions",
  "feed_posts",
  "tracks",
  "checklists",
  "checklist_items",
  "stores",
  "store_products",
  "announcements",
  "announcement_recipients",
] as const;

export type ExportResource = (typeof exportResources)[number];

export const exportResourceLabels: Record<ExportResource, string> = {
  events: "Events",
  rsvp: "RSVPs",
  checkins: "Check-ins",
  event_registration_options: "Event registration options",
  payments: "Payments",
  members: "Members",
  users: "Users",
  groups: "Groups",
  tags: "Tags",
  academic_experiences: "Academic experiences",
  work_experiences: "Work experiences",
  budgets: "Budgets",
  budget_transactions: "Budget transactions",
  surveys: "Surveys",
  survey_submissions: "Survey submissions",
  rooms: "Rooms",
  room_reservations: "Room reservations",
  badges: "Badges",
  badge_completions: "Badge completions",
  feed_posts: "Feed posts",
  tracks: "Tracks",
  checklists: "Checklists",
  checklist_items: "Checklist items",
  stores: "Stores",
  store_products: "Store products",
  announcements: "Announcements",
  announcement_recipients: "Announcement recipients",
};
