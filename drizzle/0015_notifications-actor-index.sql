-- Every foreign key carries a leading index (03 § standard columns, checked by audit:schema).
-- `actor_id` is the one the feed never queries by -- it is there so a notification can say who
-- caused it -- but a user being deleted still cascades through it, and that scan is what the index
-- is for.
CREATE INDEX "notifications_actor_idx" ON "notifications" USING btree ("actor_id");
