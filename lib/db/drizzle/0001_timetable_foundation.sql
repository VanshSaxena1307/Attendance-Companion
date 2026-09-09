-- Add batch columns to students table if they don't exist
ALTER TABLE "students" ADD COLUMN IF NOT EXISTS "lab_batch" text;
ALTER TABLE "students" ADD COLUMN IF NOT EXISTS "python_batch" text;
ALTER TABLE "students" ADD COLUMN IF NOT EXISTS "cloud_batch" text;

-- Create timetables table
CREATE TABLE IF NOT EXISTS "timetables" (
	"id" text PRIMARY KEY NOT NULL,
	"academic_session" text NOT NULL,
	"semester" text NOT NULL,
	"section_id" text REFERENCES "sections"("id"),
	"effective_from" date NOT NULL,
	"effective_to" date,
	"status" text DEFAULT 'ACTIVE' NOT NULL,
	"uploaded_by" text REFERENCES "users"("id"),
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);

-- Create timetable_entries table
CREATE TABLE IF NOT EXISTS "timetable_entries" (
	"id" text PRIMARY KEY NOT NULL,
	"timetable_id" text NOT NULL REFERENCES "timetables"("id") ON DELETE CASCADE,
	"section_id" text NOT NULL REFERENCES "sections"("id"),
	"day_of_week" text NOT NULL,
	"start_time" text NOT NULL,
	"end_time" text NOT NULL,
	"subject_id" text REFERENCES "subjects"("id"),
	"subject_code" text,
	"subject_name" text,
	"teacher_id" text REFERENCES "teachers"("id"),
	"teacher_name" text,
	"teacher_initials" text,
	"batch_type" text NOT NULL,
	"batch" text NOT NULL,
	"room" text NOT NULL,
	"lecture_type" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "timetable_entry_slot_unique" UNIQUE("timetable_id","day_of_week","start_time","batch_type","batch")
);

-- Indexes for timetables and timetable_entries
CREATE INDEX IF NOT EXISTS "timetables_section_status_idx" ON "timetables" ("section_id", "status");
CREATE INDEX IF NOT EXISTS "timetable_entries_timetable_idx" ON "timetable_entries" ("timetable_id");
CREATE INDEX IF NOT EXISTS "timetable_entries_section_day_idx" ON "timetable_entries" ("section_id", "day_of_week");
CREATE INDEX IF NOT EXISTS "timetable_entries_teacher_idx" ON "timetable_entries" ("teacher_id");
CREATE INDEX IF NOT EXISTS "timetable_entries_subject_idx" ON "timetable_entries" ("subject_id");
