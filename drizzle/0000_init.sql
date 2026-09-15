-- pg_trgm powers search across three scripts. Postgres has no Bengali or
-- Arabic text-search configuration, and a single note can mix all three, so
-- trigram similarity is the portable choice. Available on Neon, Supabase and
-- plain Postgres 16 alike.
CREATE EXTENSION IF NOT EXISTS pg_trgm;--> statement-breakpoint
CREATE TYPE "public"."card_direction" AS ENUM('arabic_to_meaning', 'meaning_to_arabic', 'audio_to_meaning');--> statement-breakpoint
CREATE TYPE "public"."card_state" AS ENUM('new', 'learning', 'review', 'relearning');--> statement-breakpoint
CREATE TYPE "public"."difficulty" AS ENUM('beginner', 'intermediate', 'advanced');--> statement-breakpoint
CREATE TYPE "public"."game_type" AS ENUM('match_pairs', 'multiple_choice', 'listening', 'spelling', 'harakat', 'streak_rush');--> statement-breakpoint
CREATE TYPE "public"."gender" AS ENUM('masculine', 'feminine', 'both');--> statement-breakpoint
CREATE TYPE "public"."mastery" AS ENUM('new', 'learning', 'young', 'mature');--> statement-breakpoint
CREATE TYPE "public"."part_of_speech" AS ENUM('noun', 'verb', 'adjective', 'adverb', 'pronoun', 'preposition', 'particle', 'phrase', 'proper_noun');--> statement-breakpoint
CREATE TYPE "public"."plural_type" AS ENUM('sound_masculine', 'sound_feminine', 'broken', 'dual_only', 'invariable');--> statement-breakpoint
CREATE TYPE "public"."review_source" AS ENUM('review', 'game_match_pairs', 'game_multiple_choice', 'game_listening', 'game_spelling', 'game_harakat', 'game_streak_rush');--> statement-breakpoint
CREATE TYPE "public"."ui_language" AS ENUM('bn', 'en');--> statement-breakpoint
CREATE TABLE "accounts" (
	"user_id" uuid NOT NULL,
	"type" text NOT NULL,
	"provider" text NOT NULL,
	"provider_account_id" text NOT NULL,
	"refresh_token" text,
	"access_token" text,
	"expires_at" integer,
	"token_type" text,
	"scope" text,
	"id_token" text,
	"session_state" text,
	CONSTRAINT "accounts_provider_provider_account_id_pk" PRIMARY KEY("provider","provider_account_id")
);
--> statement-breakpoint
CREATE TABLE "daily_activity" (
	"user_id" uuid NOT NULL,
	"local_date" date NOT NULL,
	"review_count" integer DEFAULT 0 NOT NULL,
	"new_count" integer DEFAULT 0 NOT NULL,
	"game_count" integer DEFAULT 0 NOT NULL,
	"note_count" integer DEFAULT 0 NOT NULL,
	"study_seconds" integer DEFAULT 0 NOT NULL,
	"correct_count" integer DEFAULT 0 NOT NULL,
	"goal_met" boolean DEFAULT false NOT NULL,
	CONSTRAINT "daily_activity_user_id_local_date_pk" PRIMARY KEY("user_id","local_date")
);
--> statement-breakpoint
CREATE TABLE "deck_subscriptions" (
	"user_id" uuid NOT NULL,
	"deck_id" text NOT NULL,
	"card_direction" "card_direction",
	"started_at" timestamp with time zone DEFAULT now() NOT NULL,
	"archived_at" timestamp with time zone,
	CONSTRAINT "deck_subscriptions_user_id_deck_id_pk" PRIMARY KEY("user_id","deck_id")
);
--> statement-breakpoint
CREATE TABLE "deck_words" (
	"deck_id" text NOT NULL,
	"word_id" text NOT NULL,
	"order_index" integer DEFAULT 0 NOT NULL,
	CONSTRAINT "deck_words_deck_id_word_id_pk" PRIMARY KEY("deck_id","word_id")
);
--> statement-breakpoint
CREATE TABLE "decks" (
	"id" text PRIMARY KEY NOT NULL,
	"slug" text NOT NULL,
	"title_bengali" text NOT NULL,
	"title_english" text NOT NULL,
	"description_bengali" text NOT NULL,
	"description_english" text NOT NULL,
	"difficulty" "difficulty" NOT NULL,
	"default_card_direction" "card_direction" DEFAULT 'arabic_to_meaning' NOT NULL,
	"order_index" integer DEFAULT 0 NOT NULL,
	"is_published" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "decks_slug_unique" UNIQUE("slug")
);
--> statement-breakpoint
CREATE TABLE "examples" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"word_id" text NOT NULL,
	"arabic" text NOT NULL,
	"arabic_plain" text NOT NULL,
	"bengali" text NOT NULL,
	"english" text NOT NULL,
	"source_ref" text,
	"needs_review" boolean DEFAULT false NOT NULL,
	"order_index" integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE TABLE "game_sessions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"deck_id" text,
	"game_type" "game_type" NOT NULL,
	"score" integer DEFAULT 0 NOT NULL,
	"duration_ms" integer DEFAULT 0 NOT NULL,
	"accuracy" real DEFAULT 0 NOT NULL,
	"correct_count" integer DEFAULT 0 NOT NULL,
	"total_count" integer DEFAULT 0 NOT NULL,
	"word_ids" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"client_event_id" text NOT NULL,
	"started_at" timestamp with time zone DEFAULT now() NOT NULL,
	"ended_at" timestamp with time zone,
	"local_date" date NOT NULL
);
--> statement-breakpoint
CREATE TABLE "notes" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"word_id" text,
	"title" text DEFAULT '' NOT NULL,
	"body" text DEFAULT '' NOT NULL,
	"tags" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"is_pinned" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "review_cards" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"word_id" text NOT NULL,
	"deck_id" text,
	"due" timestamp with time zone DEFAULT now() NOT NULL,
	"stability" double precision DEFAULT 0 NOT NULL,
	"difficulty" double precision DEFAULT 0 NOT NULL,
	"elapsed_days" integer DEFAULT 0 NOT NULL,
	"scheduled_days" integer DEFAULT 0 NOT NULL,
	"learning_steps" smallint DEFAULT 0 NOT NULL,
	"reps" integer DEFAULT 0 NOT NULL,
	"lapses" integer DEFAULT 0 NOT NULL,
	"state" "card_state" DEFAULT 'new' NOT NULL,
	"last_review" timestamp with time zone,
	"mastery" "mastery" DEFAULT 'new' NOT NULL,
	"suspended_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "review_logs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"word_id" text NOT NULL,
	"card_id" uuid,
	"deck_id" text,
	"rating" smallint NOT NULL,
	"source" "review_source" DEFAULT 'review' NOT NULL,
	"state_before" "card_state" NOT NULL,
	"due_before" timestamp with time zone,
	"stability_before" double precision,
	"difficulty_before" double precision,
	"elapsed_days" integer DEFAULT 0 NOT NULL,
	"last_elapsed_days" integer DEFAULT 0 NOT NULL,
	"scheduled_days" integer DEFAULT 0 NOT NULL,
	"elapsed_ms" integer DEFAULT 0 NOT NULL,
	"client_event_id" text NOT NULL,
	"reviewed_at" timestamp with time zone DEFAULT now() NOT NULL,
	"local_date" date NOT NULL
);
--> statement-breakpoint
CREATE TABLE "sessions" (
	"session_token" text PRIMARY KEY NOT NULL,
	"user_id" uuid NOT NULL,
	"expires" timestamp with time zone NOT NULL
);
--> statement-breakpoint
CREATE TABLE "streaks" (
	"user_id" uuid PRIMARY KEY NOT NULL,
	"current_streak" integer DEFAULT 0 NOT NULL,
	"longest_streak" integer DEFAULT 0 NOT NULL,
	"last_active_date" date,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "user_settings" (
	"user_id" uuid PRIMARY KEY NOT NULL,
	"ui_language" "ui_language" DEFAULT 'bn' NOT NULL,
	"daily_new_limit" integer DEFAULT 10 NOT NULL,
	"daily_review_limit" integer DEFAULT 60 NOT NULL,
	"desired_retention" real DEFAULT 0.9 NOT NULL,
	"timezone" text DEFAULT 'Asia/Dhaka' NOT NULL,
	"show_transliteration" boolean DEFAULT true NOT NULL,
	"autoplay_audio" boolean DEFAULT false NOT NULL,
	"reduced_motion" boolean DEFAULT false NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text,
	"email" text,
	"email_verified" timestamp with time zone,
	"image" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"guest_migrated_at" timestamp with time zone,
	"deleted_at" timestamp with time zone,
	CONSTRAINT "users_email_unique" UNIQUE("email")
);
--> statement-breakpoint
CREATE TABLE "verification_tokens" (
	"identifier" text NOT NULL,
	"token" text NOT NULL,
	"expires" timestamp with time zone NOT NULL,
	CONSTRAINT "verification_tokens_identifier_token_pk" PRIMARY KEY("identifier","token")
);
--> statement-breakpoint
CREATE TABLE "words" (
	"id" text PRIMARY KEY NOT NULL,
	"arabic" text NOT NULL,
	"arabic_plain" text NOT NULL,
	"transliteration" text NOT NULL,
	"bengali_meanings" jsonb NOT NULL,
	"english_meanings" jsonb NOT NULL,
	"part_of_speech" "part_of_speech" NOT NULL,
	"root" text,
	"root_key" text,
	"gender" "gender",
	"plural_arabic" text,
	"plural_plain" text,
	"plural_type" "plural_type",
	"verb_form" smallint,
	"present_tense" text,
	"masdar" text,
	"frequency_rank" integer,
	"audio_path" text,
	"editor_note" text,
	"needs_review" boolean DEFAULT false NOT NULL,
	"tags" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"search_blob" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "accounts" ADD CONSTRAINT "accounts_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "daily_activity" ADD CONSTRAINT "daily_activity_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "deck_subscriptions" ADD CONSTRAINT "deck_subscriptions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "deck_subscriptions" ADD CONSTRAINT "deck_subscriptions_deck_id_decks_id_fk" FOREIGN KEY ("deck_id") REFERENCES "public"."decks"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "deck_words" ADD CONSTRAINT "deck_words_deck_id_decks_id_fk" FOREIGN KEY ("deck_id") REFERENCES "public"."decks"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "deck_words" ADD CONSTRAINT "deck_words_word_id_words_id_fk" FOREIGN KEY ("word_id") REFERENCES "public"."words"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "examples" ADD CONSTRAINT "examples_word_id_words_id_fk" FOREIGN KEY ("word_id") REFERENCES "public"."words"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "game_sessions" ADD CONSTRAINT "game_sessions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "game_sessions" ADD CONSTRAINT "game_sessions_deck_id_decks_id_fk" FOREIGN KEY ("deck_id") REFERENCES "public"."decks"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "notes" ADD CONSTRAINT "notes_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "notes" ADD CONSTRAINT "notes_word_id_words_id_fk" FOREIGN KEY ("word_id") REFERENCES "public"."words"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "review_cards" ADD CONSTRAINT "review_cards_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "review_cards" ADD CONSTRAINT "review_cards_word_id_words_id_fk" FOREIGN KEY ("word_id") REFERENCES "public"."words"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "review_cards" ADD CONSTRAINT "review_cards_deck_id_decks_id_fk" FOREIGN KEY ("deck_id") REFERENCES "public"."decks"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "review_logs" ADD CONSTRAINT "review_logs_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "review_logs" ADD CONSTRAINT "review_logs_word_id_words_id_fk" FOREIGN KEY ("word_id") REFERENCES "public"."words"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "review_logs" ADD CONSTRAINT "review_logs_card_id_review_cards_id_fk" FOREIGN KEY ("card_id") REFERENCES "public"."review_cards"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "review_logs" ADD CONSTRAINT "review_logs_deck_id_decks_id_fk" FOREIGN KEY ("deck_id") REFERENCES "public"."decks"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sessions" ADD CONSTRAINT "sessions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "streaks" ADD CONSTRAINT "streaks_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_settings" ADD CONSTRAINT "user_settings_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "daily_activity_date_idx" ON "daily_activity" USING btree ("user_id","local_date");--> statement-breakpoint
CREATE INDEX "deck_words_order_idx" ON "deck_words" USING btree ("deck_id","order_index");--> statement-breakpoint
CREATE INDEX "deck_words_word_idx" ON "deck_words" USING btree ("word_id");--> statement-breakpoint
CREATE INDEX "decks_order_idx" ON "decks" USING btree ("order_index");--> statement-breakpoint
CREATE INDEX "examples_word_id_idx" ON "examples" USING btree ("word_id","order_index");--> statement-breakpoint
CREATE UNIQUE INDEX "game_sessions_client_event_key" ON "game_sessions" USING btree ("user_id","client_event_id");--> statement-breakpoint
CREATE INDEX "game_sessions_user_time_idx" ON "game_sessions" USING btree ("user_id","started_at");--> statement-breakpoint
CREATE INDEX "notes_user_updated_idx" ON "notes" USING btree ("user_id","is_pinned","updated_at");--> statement-breakpoint
CREATE INDEX "notes_user_word_idx" ON "notes" USING btree ("user_id","word_id");--> statement-breakpoint
CREATE INDEX "notes_search_trgm_idx" ON "notes" USING gin ((coalesce("title", '') || ' ' || coalesce("body", '')) gin_trgm_ops);--> statement-breakpoint
CREATE UNIQUE INDEX "review_cards_user_word_key" ON "review_cards" USING btree ("user_id","word_id");--> statement-breakpoint
CREATE INDEX "review_cards_user_due_idx" ON "review_cards" USING btree ("user_id","due");--> statement-breakpoint
CREATE INDEX "review_cards_user_state_idx" ON "review_cards" USING btree ("user_id","state");--> statement-breakpoint
CREATE INDEX "review_cards_user_deck_idx" ON "review_cards" USING btree ("user_id","deck_id");--> statement-breakpoint
CREATE UNIQUE INDEX "review_logs_client_event_key" ON "review_logs" USING btree ("user_id","client_event_id");--> statement-breakpoint
CREATE INDEX "review_logs_user_time_idx" ON "review_logs" USING btree ("user_id","reviewed_at");--> statement-breakpoint
CREATE INDEX "review_logs_user_date_idx" ON "review_logs" USING btree ("user_id","local_date");--> statement-breakpoint
CREATE INDEX "review_logs_word_idx" ON "review_logs" USING btree ("word_id");--> statement-breakpoint
CREATE INDEX "words_arabic_plain_idx" ON "words" USING btree ("arabic_plain");--> statement-breakpoint
CREATE INDEX "words_root_key_idx" ON "words" USING btree ("root_key");--> statement-breakpoint
CREATE INDEX "words_frequency_rank_idx" ON "words" USING btree ("frequency_rank");--> statement-breakpoint
CREATE INDEX "words_search_blob_trgm_idx" ON "words" USING gin ("search_blob" gin_trgm_ops);