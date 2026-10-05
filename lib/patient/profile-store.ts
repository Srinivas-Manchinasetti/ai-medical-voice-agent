import { pgTable, varchar, text, jsonb, timestamp, integer, boolean } from "drizzle-orm/pg-core";
import { PatientMedication, DrugAllergy } from "../clinical-knowledge/types";

/**
 * Patient Health Records & Context Profile Table
 * Persists longitudinal clinical history (conditions, medications, allergies, demographics)
 * supporting multi-patient management per caregiver with DPDP Act privacy compliance.
 */
export const patientProfilesTable = pgTable("patient_profiles", {
  id: varchar("id", { length: 128 }).primaryKey(),
  userId: varchar("user_id", { length: 128 }).notNull(),
  relationshipToUser: varchar("relationship_to_user", { length: 32 }).default("self"), // self | child | parent | spouse | other
  
  // Demographics (minimizing sensitive data: yearOfBirth preferred over exact DOB)
  yearOfBirth: integer("year_of_birth"),
  dateOfBirth: varchar("date_of_birth", { length: 32 }),
  age: integer("age"),
  ageGroup: varchar("age_group", { length: 32 }).notNull().default("adult"),
  sexAssignedAtBirth: varchar("sex_assigned_at_birth", { length: 16 }),
  pregnancyStatus: varchar("pregnancy_status", { length: 32 }).default("not_applicable"),
  
  // Clinical History
  knownConditions: jsonb("known_conditions").$type<string[]>().default([]),
  currentMedications: jsonb("current_medications").$type<PatientMedication[]>().default([]),
  allergyStatus: varchar("allergy_status", { length: 32 }).default("unassessed"), // unassessed | none_known | confirmed
  drugAllergies: jsonb("drug_allergies").$type<DrugAllergy[]>().default([]),
  surgicalHistory: jsonb("surgical_history").$type<string[]>().default([]),
  smokingStatus: varchar("smoking_status", { length: 16 }).default("unknown"),

  // DPDP Act (India) Compliance
  consentGiven: boolean("consent_given").default(false).notNull(),
  consentTimestamp: timestamp("consent_timestamp"),
  isDeleted: boolean("is_deleted").default(false).notNull(),
  deletedAt: timestamp("deleted_at"),

  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});
