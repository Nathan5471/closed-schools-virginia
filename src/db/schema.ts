import { sql } from "drizzle-orm";
import {
  bigint,
  integer,
  pgTable,
  varchar,
  pgEnum,
  text,
} from "drizzle-orm/pg-core";
import { defineRelations } from "drizzle-orm";

export const usersTable = pgTable("users", {
  id: integer().primaryKey().generatedAlwaysAsIdentity(),
  username: varchar({ length: 255 }).notNull().unique(),
  password: varchar({ length: 255 }).notNull(),
});

export const invitationsTable = pgTable("invitations", {
  id: integer().primaryKey().generatedAlwaysAsIdentity(),
  token: varchar({ length: 128 }).notNull().unique(),
  createdBy: integer()
    .notNull()
    .references(() => usersTable.id, { onDelete: "cascade" }),
  createdAt: bigint({ mode: "number" })
    .notNull()
    .default(sql`(extract(epoch from now()) * 1000)::bigint`),
  expiresAt: bigint({ mode: "number" }).notNull(),
  usedAt: bigint({ mode: "number" }),
  usedBy: integer().references(() => usersTable.id, { onDelete: "set null" }),
});

export const countiesTable = pgTable("counties", {
  id: integer().primaryKey().generatedAlwaysAsIdentity(),
  name: varchar({ length: 255 }).notNull().unique(),
});

export const imagesTable = pgTable("images", {
  id: integer().primaryKey().generatedAlwaysAsIdentity(),
  schoolId: integer()
    .notNull()
    .references(() => schoolsTable.id, { onDelete: "cascade" }),
  url: varchar({ length: 255 }).notNull(), // Cloudflare R2 URL
  name: varchar({ length: 255 }).notNull(),
  description: text(),
  uploadedBy: integer()
    .notNull()
    .references(() => usersTable.id, { onDelete: "cascade" }),
  uploadedAt: bigint({ mode: "number" }).notNull(),
});

export const schoolTypesEnum = pgEnum("schoolType", [
  "white",
  "colored",
  "mixed",
]);
export const statusEnum = pgEnum("status", [
  "standing",
  "repurposed",
  "not standing",
]);

export const schoolsTable = pgTable("schools", {
  id: integer().primaryKey().generatedAlwaysAsIdentity(),
  schoolName: varchar({ length: 255 }).notNull(),
  countyId: integer()
    .notNull()
    .references(() => countiesTable.id, { onDelete: "cascade" }),
  schoolType: schoolTypesEnum(),
  status: statusEnum(),
  closedYear: integer(),
  address: varchar({ length: 255 }),
  sourceLinks: varchar({ length: 2048 }).array(),
  description: text(),
  createdAt: bigint({ mode: "number" })
    .notNull()
    .default(sql`(extract(epoch from now()) * 1000)::bigint`),
  updatedAt: bigint({ mode: "number" })
    .notNull()
    .default(sql`(extract(epoch from now()) * 1000)::bigint`),
});

export const submissionStatusEnum = pgEnum("submissionStatus", [
  "pending",
  "approved",
  "rejected",
]);

export const submissionsTable = pgTable("submissions", {
  id: integer().primaryKey().generatedAlwaysAsIdentity(),
  schoolName: varchar({ length: 255 }).notNull(),
  countyName: varchar({ length: 255 }).notNull(),
  schoolType: schoolTypesEnum(),
  schoolStatus: statusEnum(),
  closedYear: integer(),
  address: varchar({ length: 255 }),
  additionalInfo: varchar({ length: 255 }),
  attachmentedURLs: varchar({ length: 255 }).array(),
  submittedBy: varchar({ length: 255 }).notNull(),
  submitterEmail: varchar({ length: 255 }).notNull(),
  submittedAt: bigint({ mode: "number" }).notNull(),
  submissionStatus: submissionStatusEnum().notNull().default("pending"),
});

export const relations = defineRelations(
  { schoolsTable, countiesTable, imagesTable, usersTable },
  (relation) => ({
    schoolsTable: {
      county: relation.one.countiesTable({
        from: relation.schoolsTable.countyId,
        to: relation.countiesTable.id,
      }),
      images: relation.many.imagesTable({
        from: relation.schoolsTable.id,
        to: relation.imagesTable.schoolId,
      }),
    },
    countiesTable: {
      schools: relation.many.schoolsTable({
        from: relation.countiesTable.id,
        to: relation.schoolsTable.countyId,
      }),
    },
    imagesTable: {
      school: relation.one.schoolsTable({
        from: relation.imagesTable.schoolId,
        to: relation.schoolsTable.id,
      }),
      uploader: relation.one.usersTable({
        from: relation.imagesTable.uploadedBy,
        to: relation.usersTable.id,
      }),
    },
    usersTable: {
      uploadedImages: relation.many.imagesTable({
        from: relation.usersTable.id,
        to: relation.imagesTable.uploadedBy,
      }),
    },
  }),
);
