import { integer, pgTable, varchar, text, doublePrecision, boolean, timestamp, jsonb } from "drizzle-orm/pg-core";

export const usersTable = pgTable("users", {
  id: integer().primaryKey().generatedAlwaysAsIdentity(),
  name: varchar({ length: 255 }).notNull(),
  email: varchar({ length: 255 }).notNull().unique(),
  credits: integer()
});

/**
 * Production Healthcare Facility Schema
 * Separates Government Source Facts (ABDM HFR / OGD), External Enrichment (Ratings / Maps), and MedVoice Derived Metadata.
 */
export const hospitalsTable = pgTable("hospitals", {
  // 1. PRIMARY IDENTITY & GOVERNMENT SOURCE FACTS (ABDM HFR / OGD National Hospital Directory)
  id: varchar("id", { length: 128 }).primaryKey(),
  hfrId: varchar("hfr_id", { length: 128 }), // Ayushman Bharat Digital Mission (ABDM) HFR Registry ID
  ogdId: varchar("ogd_id", { length: 128 }), // Government of India OGD Directory ID
  name: text("name").notNull(),
  facilityType: varchar("facility_type", { length: 128 }), // e.g. "Tertiary Care Hospital", "Medical College"
  ownership: varchar("ownership", { length: 128 }), // e.g. "Public / Govt", "Private Trust"
  address: text("address").notNull(),
  city: varchar("city", { length: 128 }).notNull(),
  state: varchar("state", { length: 128 }).notNull(),
  pincode: varchar("pincode", { length: 32 }),
  latitude: doublePrecision("latitude").notNull(),
  longitude: doublePrecision("longitude").notNull(),
  phone: varchar("phone", { length: 64 }),
  emergencyPhone: varchar("emergency_phone", { length: 64 }),
  isEmergency24x7: boolean("is_emergency_24x7").default(true),
  officialSpecialties: jsonb("official_specialties").$type<string[]>(),

  // 2. EXTERNAL ENRICHMENT (Google Places API / OpenStreetMap / Accreditation Bodies)
  rating: doublePrecision("rating"),
  ratingSource: varchar("rating_source", { length: 128 }), // e.g. "Google Places Commercial API"
  accreditations: jsonb("accreditations").$type<string[]>(), // e.g. ["NABH", "JCI", "NABL"]
  mapGeometrySource: varchar("map_geometry_source", { length: 128 }).default("OpenStreetMap / Overpass"),

  // 3. MEDVOICE DERIVED CLINICAL METADATA
  capabilities: jsonb("capabilities").$type<string[]>(), // e.g. ["emergency", "cardiology", "pci", "trauma"]
  verificationStatus: varchar("verification_status", { length: 64 }).default("verified"), // 🟢 "verified" | 🔵 "enriched" | 🟡 "unverified"
  source: varchar("source", { length: 128 }).default("ABDM HFR / OGD India Directory"),
  lastVerifiedAt: timestamp("last_verified_at").defaultNow()
});


