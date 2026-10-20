-- Make balance ownership explicit while preserving access to active legacy
-- balances: historically every active seller could count every open balance.
BEGIN;

CREATE TABLE "balance_assignments" (
    "balance_id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "assigned_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "balance_assignments_pkey" PRIMARY KEY ("balance_id", "user_id")
);

CREATE INDEX "balance_assignments_user_id_idx" ON "balance_assignments"("user_id");

ALTER TABLE "balance_assignments"
    ADD CONSTRAINT "balance_assignments_balance_id_fkey"
    FOREIGN KEY ("balance_id") REFERENCES "balances"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "balance_assignments"
    ADD CONSTRAINT "balance_assignments_user_id_fkey"
    FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

INSERT INTO "balance_assignments" ("balance_id", "user_id")
SELECT b."id", u."id"
FROM "balances" b
CROSS JOIN "users" u
WHERE b."status" IN ('ABERTO', 'EM_REVISAO')
  AND u."role" = 'VENDEDOR'
  AND u."active" = TRUE;

COMMIT;
