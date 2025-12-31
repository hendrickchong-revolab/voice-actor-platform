-- Add User.languages as a TEXT[] with an empty default so existing rows remain valid.
ALTER TABLE "User"
ADD COLUMN "languages" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[];


