-- ============================================================
-- Enable Row Level Security on ALL public tables
-- ============================================================
-- Strategy: RLS ON + zero policies = PostgREST (anon/authenticated)
-- gets 0 rows on SELECT, error on INSERT/UPDATE/DELETE.
-- Prisma (DATABASE_URL, postgres role) bypasses RLS.
-- Supabase service_role key bypasses RLS.
-- Triggers (SECURITY DEFINER) bypass RLS.
-- ============================================================

-- User & Auth
ALTER TABLE "UserProfile" ENABLE ROW LEVEL SECURITY;

-- Diagnostic
ALTER TABLE "DiagnosticSession" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "DiagnosticAnswer" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "SkillProfile" ENABLE ROW LEVEL SECURITY;

-- Learning
ALTER TABLE "Course" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Lesson" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "LearningPath" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "LessonProgress" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "LessonComment" ENABLE ROW LEVEL SECURITY;

-- RAG / AI
ALTER TABLE "content_chunk" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "ChatMessage" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "SummaryCache" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "QuestionBank" ENABLE ROW LEVEL SECURITY;

-- Billing
ALTER TABLE "Subscription" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "SubscriptionPlan" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Payment" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "PaymentEvent" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "PromoCode" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "PromoActivation" ENABLE ROW LEVEL SECURITY;

-- System
ALTER TABLE "FeatureFlag" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "_prisma_migrations" ENABLE ROW LEVEL SECURITY;
