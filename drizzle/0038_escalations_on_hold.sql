-- Add ON_HOLD status to escalation_status enum
ALTER TYPE "public"."escalation_status" ADD VALUE IF NOT EXISTS 'ON_HOLD';
