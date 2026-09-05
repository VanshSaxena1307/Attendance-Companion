CREATE TABLE "attendance_issues" (
	"id" text PRIMARY KEY NOT NULL,
	"student_id" text NOT NULL,
	"subject_id" text NOT NULL,
	"subject_name" text NOT NULL,
	"date" date NOT NULL,
	"issue_type" text NOT NULL,
	"description" text NOT NULL,
	"evidence_name" text,
	"status" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"reviewed_at" timestamp with time zone,
	"reviewer" text,
	"reviewer_remarks" text
);
--> statement-breakpoint
CREATE TABLE "attendance" (
	"id" text PRIMARY KEY NOT NULL,
	"student_id" text NOT NULL,
	"subject_id" text NOT NULL,
	"section_id" text NOT NULL,
	"date" date NOT NULL,
	"status" text NOT NULL,
	"detail" text DEFAULT 'Imported from attendance workbook' NOT NULL,
	"marked_by" text,
	"marked_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "attendance_student_subject_date_unique" UNIQUE("student_id","subject_id","date")
);
--> statement-breakpoint
CREATE TABLE "audit_logs" (
	"id" text PRIMARY KEY NOT NULL,
	"actor_id" text,
	"action" text NOT NULL,
	"entity_type" text NOT NULL,
	"entity_id" text NOT NULL,
	"detail" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "exemption_requests" (
	"id" text PRIMARY KEY NOT NULL,
	"student_id" text NOT NULL,
	"category" text NOT NULL,
	"reason" text NOT NULL,
	"start_date" date NOT NULL,
	"end_date" date NOT NULL,
	"proof_name" text,
	"status" text NOT NULL,
	"submitted_at" timestamp with time zone DEFAULT now() NOT NULL,
	"reviewed_at" timestamp with time zone,
	"reviewer" text,
	"reviewer_remarks" text
);
--> statement-breakpoint
CREATE TABLE "notifications" (
	"id" text PRIMARY KEY NOT NULL,
	"recipient_id" text NOT NULL,
	"title" text NOT NULL,
	"message" text NOT NULL,
	"type" text NOT NULL,
	"related_id" text,
	"read" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "sections" (
	"id" text PRIMARY KEY NOT NULL,
	"code" text NOT NULL,
	"department" text NOT NULL,
	"semester" text,
	CONSTRAINT "sections_code_unique" UNIQUE("code")
);
--> statement-breakpoint
CREATE TABLE "settings" (
	"user_id" text PRIMARY KEY NOT NULL,
	"theme" text DEFAULT 'SYSTEM' NOT NULL,
	"target_attendance" numeric DEFAULT '75' NOT NULL,
	"notifications_enabled" boolean DEFAULT true NOT NULL
);
--> statement-breakpoint
CREATE TABLE "students" (
	"id" text PRIMARY KEY NOT NULL,
	"roll_no" text NOT NULL,
	"admission_no" text NOT NULL,
	"section_id" text NOT NULL,
	"mobile" text,
	"mentor_id" text
);
--> statement-breakpoint
CREATE TABLE "subjects" (
	"id" text PRIMARY KEY NOT NULL,
	"code" text NOT NULL,
	"name" text NOT NULL,
	"semester" text,
	"subject_type" text NOT NULL,
	"teacher" text,
	"color" text DEFAULT '#5B6EE1' NOT NULL,
	CONSTRAINT "subjects_code_unique" UNIQUE("code")
);
--> statement-breakpoint
CREATE TABLE "teacher_subject_sections" (
	"id" text PRIMARY KEY NOT NULL,
	"teacher_id" text NOT NULL,
	"subject_id" text NOT NULL,
	"section_id" text NOT NULL,
	"subject_type" text NOT NULL,
	CONSTRAINT "teacher_subject_section_unique" UNIQUE("teacher_id","subject_id","section_id","subject_type")
);
--> statement-breakpoint
CREATE TABLE "teachers" (
	"id" text PRIMARY KEY NOT NULL,
	"teacher_code" text NOT NULL,
	"mobile" text,
	CONSTRAINT "teachers_teacher_code_unique" UNIQUE("teacher_code")
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"email" text,
	"role" text NOT NULL,
	"initials" text NOT NULL,
	"department" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "users_email_unique" UNIQUE("email")
);
--> statement-breakpoint
ALTER TABLE "attendance_issues" ADD CONSTRAINT "attendance_issues_student_id_students_id_fk" FOREIGN KEY ("student_id") REFERENCES "public"."students"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "attendance_issues" ADD CONSTRAINT "attendance_issues_subject_id_subjects_id_fk" FOREIGN KEY ("subject_id") REFERENCES "public"."subjects"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "attendance" ADD CONSTRAINT "attendance_student_id_students_id_fk" FOREIGN KEY ("student_id") REFERENCES "public"."students"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "attendance" ADD CONSTRAINT "attendance_subject_id_subjects_id_fk" FOREIGN KEY ("subject_id") REFERENCES "public"."subjects"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "attendance" ADD CONSTRAINT "attendance_section_id_sections_id_fk" FOREIGN KEY ("section_id") REFERENCES "public"."sections"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "attendance" ADD CONSTRAINT "attendance_marked_by_users_id_fk" FOREIGN KEY ("marked_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_actor_id_users_id_fk" FOREIGN KEY ("actor_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "exemption_requests" ADD CONSTRAINT "exemption_requests_student_id_students_id_fk" FOREIGN KEY ("student_id") REFERENCES "public"."students"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_recipient_id_users_id_fk" FOREIGN KEY ("recipient_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "settings" ADD CONSTRAINT "settings_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "students" ADD CONSTRAINT "students_id_users_id_fk" FOREIGN KEY ("id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "students" ADD CONSTRAINT "students_section_id_sections_id_fk" FOREIGN KEY ("section_id") REFERENCES "public"."sections"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "students" ADD CONSTRAINT "students_mentor_id_users_id_fk" FOREIGN KEY ("mentor_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "teacher_subject_sections" ADD CONSTRAINT "teacher_subject_sections_teacher_id_teachers_id_fk" FOREIGN KEY ("teacher_id") REFERENCES "public"."teachers"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "teacher_subject_sections" ADD CONSTRAINT "teacher_subject_sections_subject_id_subjects_id_fk" FOREIGN KEY ("subject_id") REFERENCES "public"."subjects"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "teacher_subject_sections" ADD CONSTRAINT "teacher_subject_sections_section_id_sections_id_fk" FOREIGN KEY ("section_id") REFERENCES "public"."sections"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "teachers" ADD CONSTRAINT "teachers_id_users_id_fk" FOREIGN KEY ("id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "attendance_student_subject_idx" ON "attendance" USING btree ("student_id","subject_id");--> statement-breakpoint
CREATE INDEX "attendance_section_subject_idx" ON "attendance" USING btree ("section_id","subject_id");--> statement-breakpoint
CREATE INDEX "audit_logs_entity_idx" ON "audit_logs" USING btree ("entity_type","entity_id");--> statement-breakpoint
CREATE UNIQUE INDEX "students_roll_no_unique" ON "students" USING btree ("roll_no");--> statement-breakpoint
CREATE UNIQUE INDEX "students_admission_no_unique" ON "students" USING btree ("admission_no");--> statement-breakpoint
CREATE INDEX "students_section_idx" ON "students" USING btree ("section_id");--> statement-breakpoint
CREATE INDEX "teacher_subject_section_lookup_idx" ON "teacher_subject_sections" USING btree ("teacher_id","section_id");