-- Add PROGRESS action to escalation_action enum
ALTER TYPE "public"."escalation_action" ADD VALUE IF NOT EXISTS 'PROGRESS';

