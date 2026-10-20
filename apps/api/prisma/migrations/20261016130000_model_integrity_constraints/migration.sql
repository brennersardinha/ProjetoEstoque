-- Protect the persisted model from invalid writes, including writes that do not
-- pass through the API. This migration is additive and preserves all rows.
-- It stops with a clear error if existing data needs an explicit repair.
BEGIN;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM users WHERE btrim(name) = '' OR session_version < 0) THEN
    RAISE EXCEPTION 'Model integrity migration blocked: users contain empty names or invalid session versions.';
  END IF;

  IF EXISTS (
    SELECT lower(btrim(login)) FROM users GROUP BY lower(btrim(login)) HAVING count(*) > 1
  ) THEN
    RAISE EXCEPTION 'Model integrity migration blocked: duplicate logins ignoring case; resolve duplicates before retrying.';
  END IF;

  IF EXISTS (
    SELECT 1 FROM products
    WHERE btrim(internal_code) = '' OR btrim(name) = '' OR btrim(unit) = ''
  ) THEN
    RAISE EXCEPTION 'Model integrity migration blocked: products contain empty required fields.';
  END IF;

  IF EXISTS (SELECT 1 FROM categories WHERE btrim(name) = '') THEN
    RAISE EXCEPTION 'Model integrity migration blocked: categories contain empty names.';
  END IF;

  IF EXISTS (SELECT 1 FROM identifiers WHERE btrim(normalized_value) = '') THEN
    RAISE EXCEPTION 'Model integrity migration blocked: identifiers contain empty values.';
  END IF;

  IF EXISTS (SELECT 1 FROM counts WHERE quantity < 0 OR btrim(idempotency_key) = '') THEN
    RAISE EXCEPTION 'Model integrity migration blocked: counts contain invalid quantity or idempotency key.';
  END IF;

  IF EXISTS (SELECT 1 FROM audits WHERE btrim(action) = '' OR btrim(object_type) = '' OR btrim(object_id) = '') THEN
    RAISE EXCEPTION 'Model integrity migration blocked: audit records contain empty required fields.';
  END IF;
END $$;

-- Canonicalize existing logins only after proving that this cannot merge two
-- accounts. No account rows, credentials, or relations are removed.
UPDATE "users" SET "login" = lower(btrim("login"));

CREATE UNIQUE INDEX "users_login_lower_key" ON "users" (lower("login"));

ALTER TABLE "users"
  ADD CONSTRAINT "users_name_nonempty_check" CHECK (btrim("name") <> ''),
  ADD CONSTRAINT "users_login_normalized_check" CHECK ("login" = lower(btrim("login"))),
  ADD CONSTRAINT "users_session_version_nonnegative_check" CHECK ("session_version" >= 0);

ALTER TABLE "categories"
  ADD CONSTRAINT "categories_name_nonempty_check" CHECK (btrim("name") <> '');

ALTER TABLE "products"
  ADD CONSTRAINT "products_internal_code_nonempty_check" CHECK (btrim("internal_code") <> ''),
  ADD CONSTRAINT "products_name_nonempty_check" CHECK (btrim("name") <> ''),
  ADD CONSTRAINT "products_unit_nonempty_check" CHECK (btrim("unit") <> '');

ALTER TABLE "identifiers"
  ADD CONSTRAINT "identifiers_value_nonempty_check" CHECK (btrim("normalized_value") <> '');

ALTER TABLE "counts"
  ADD CONSTRAINT "counts_quantity_nonnegative_check" CHECK ("quantity" >= 0),
  ADD CONSTRAINT "counts_idempotency_key_nonempty_check" CHECK (btrim("idempotency_key") <> '');

ALTER TABLE "audits"
  ADD CONSTRAINT "audits_action_nonempty_check" CHECK (btrim("action") <> ''),
  ADD CONSTRAINT "audits_object_type_nonempty_check" CHECK (btrim("object_type") <> ''),
  ADD CONSTRAINT "audits_object_id_nonempty_check" CHECK (btrim("object_id") <> '');

COMMIT;
