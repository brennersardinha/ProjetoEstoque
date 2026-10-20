DROP INDEX IF EXISTS "identifiers_normalized_value_active_key";
CREATE UNIQUE INDEX "identifiers_active_value_key" ON "identifiers"("normalized_value") WHERE "active" = true;
