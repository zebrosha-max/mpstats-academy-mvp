-- Migration: Replace isAdmin boolean with Role enum (USER/ADMIN/SUPERADMIN)
-- Run this BEFORE removing isAdmin from schema.prisma and running db:push
--
-- Step 1: Create the Role enum type
-- Step 2: Add role column with default USER
-- Step 3: Copy isAdmin=true users to role=SUPERADMIN
-- Step 4: Drop isAdmin column
--
-- After running this, do: pnpm db:push (with isAdmin removed from schema)

-- Step 1: Create enum (idempotent)
DO $$ BEGIN
  CREATE TYPE "Role" AS ENUM ('USER', 'ADMIN', 'SUPERADMIN');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

-- Step 2: Add role column if not exists
DO $$ BEGIN
  ALTER TABLE "UserProfile" ADD COLUMN "role" "Role" NOT NULL DEFAULT 'USER';
EXCEPTION
  WHEN duplicate_column THEN NULL;
END $$;

-- Step 3: Migrate existing admins to SUPERADMIN
UPDATE "UserProfile" SET "role" = 'SUPERADMIN' WHERE "isAdmin" = true;

-- Step 4: Drop isAdmin column
ALTER TABLE "UserProfile" DROP COLUMN IF EXISTS "isAdmin";

-- Also update handle_new_user trigger if it references isAdmin
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  INSERT INTO public."UserProfile" (id, name, "avatarUrl", role, "isActive", "createdAt", "updatedAt")
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.raw_user_meta_data->>'name'),
    NEW.raw_user_meta_data->>'avatar_url',
    'USER',
    true,
    NOW(),
    NOW()
  );
  RETURN NEW;
END;
$$;
