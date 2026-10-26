CREATE TYPE "schoolType" AS ENUM('white', 'colored', 'mixed');--> statement-breakpoint
CREATE TYPE "status" AS ENUM('standing', 'repurposed', 'not standing');--> statement-breakpoint
CREATE TYPE "submissionStatus" AS ENUM('pending', 'approved', 'rejected');--> statement-breakpoint
CREATE TABLE "counties" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "counties_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"name" varchar(255) NOT NULL UNIQUE
);
--> statement-breakpoint
CREATE TABLE "images" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "images_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"schoolId" integer NOT NULL,
	"url" varchar(255) NOT NULL,
	"name" varchar(255) NOT NULL,
	"description" text,
	"uploadedBy" integer NOT NULL,
	"uploadedAt" bigint NOT NULL
);
--> statement-breakpoint
CREATE TABLE "invitations" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "invitations_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"token" varchar(128) NOT NULL UNIQUE,
	"createdBy" integer NOT NULL,
	"createdAt" bigint DEFAULT (extract(epoch from now()) * 1000) NOT NULL,
	"expiresAt" bigint NOT NULL,
	"usedAt" bigint,
	"usedBy" integer
);
--> statement-breakpoint
CREATE TABLE "schools" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "schools_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"schoolName" varchar(255) NOT NULL,
	"countyId" integer NOT NULL,
	"schoolType" "schoolType",
	"status" "status",
	"closedYear" integer,
	"address" varchar(255),
	"sourceLinks" varchar(2048)[],
	"description" text,
	"createdAt" bigint DEFAULT (extract(epoch from now()) * 1000) NOT NULL,
	"updatedAt" bigint DEFAULT (extract(epoch from now()) * 1000) NOT NULL
);
--> statement-breakpoint
CREATE TABLE "submissions" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "submissions_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"schoolName" varchar(255) NOT NULL,
	"countyName" varchar(255) NOT NULL,
	"schoolType" "schoolType",
	"schoolStatus" "status",
	"closedYear" integer,
	"address" varchar(255),
	"additionalInfo" varchar(255),
	"attachmentedURLs" varchar(255)[],
	"submittedBy" varchar(255) NOT NULL,
	"submitterEmail" varchar(255) NOT NULL,
	"submittedAt" bigint NOT NULL,
	"submissionStatus" "submissionStatus" DEFAULT 'pending'::"submissionStatus" NOT NULL
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "users_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"username" varchar(255) NOT NULL UNIQUE,
	"password" varchar(255) NOT NULL
);
--> statement-breakpoint
ALTER TABLE "images" ADD CONSTRAINT "images_schoolId_schools_id_fkey" FOREIGN KEY ("schoolId") REFERENCES "schools"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "images" ADD CONSTRAINT "images_uploadedBy_users_id_fkey" FOREIGN KEY ("uploadedBy") REFERENCES "users"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "invitations" ADD CONSTRAINT "invitations_createdBy_users_id_fkey" FOREIGN KEY ("createdBy") REFERENCES "users"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "invitations" ADD CONSTRAINT "invitations_usedBy_users_id_fkey" FOREIGN KEY ("usedBy") REFERENCES "users"("id") ON DELETE SET NULL;--> statement-breakpoint
ALTER TABLE "schools" ADD CONSTRAINT "schools_countyId_counties_id_fkey" FOREIGN KEY ("countyId") REFERENCES "counties"("id") ON DELETE CASCADE;