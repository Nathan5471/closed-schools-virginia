import { integer, pgTable, varchar, pgEnum } from "drizzle-orm/pg-core";
import { defineRelations } from "drizzle-orm";

export const usersTable = pgTable("users", {
  id: integer().primaryKey().generatedAlwaysAsIdentity(),
  username: varchar({ length: 255 }).notNull().unique(),
  password: varchar({ length: 255 }).notNull(),
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
  description: varchar({ length: 255 }),
  uploadedBy: integer()
    .notNull()
    .references(() => usersTable.id, { onDelete: "cascade" }),
  uploadedAt: integer().notNull(),
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
