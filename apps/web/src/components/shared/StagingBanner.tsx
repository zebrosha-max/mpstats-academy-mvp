/**
 * Жёлтая sticky-плашка на staging-стенде.
 * Рендерится только если NEXT_PUBLIC_STAGING=true (устанавливается в docker-compose.staging.yml).
 * Server Component — нет hydration overhead.
 * См. .claude/memory/project_staging_environment.md
 */
export function StagingBanner() {
  if (process.env.NEXT_PUBLIC_STAGING !== 'true') return null;
  return (
    <div
      role="status"
      aria-label="Staging environment warning"
      className="sticky top-0 z-[100] w-full bg-yellow-400 text-yellow-950 px-4 py-2 text-sm font-semibold text-center shadow-md"
    >
      STAGING — данные реальные, не заказывайте, не платите
    </div>
  );
}
