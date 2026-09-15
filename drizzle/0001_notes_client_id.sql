ALTER TABLE "notes" ADD COLUMN "client_id" text;--> statement-breakpoint
CREATE UNIQUE INDEX "notes_user_client_key" ON "notes" USING btree ("user_id","client_id");