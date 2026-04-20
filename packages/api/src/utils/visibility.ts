/**
 * Pure helpers for hidden-content visibility rules.
 *
 * Used by admin router to keep role/flag logic consistent and testable.
 */

export type AdminRole = 'ADMIN' | 'SUPERADMIN';

/**
 * Resolve the effective includeHidden flag for admin listings.
 *
 * - ADMIN never sees hidden items regardless of what the client requested.
 *   This enforces the «hide is one-way for ADMIN» rule at the query layer too,
 *   in addition to the mutation-level check.
 * - SUPERADMIN defaults to includeHidden=true so the admin tooling is
 *   fully functional out of the box. They can opt-out explicitly.
 */
export function resolveIncludeHidden(
  role: AdminRole,
  requested: boolean | undefined,
): boolean {
  if (role !== 'SUPERADMIN') return false;
  return requested ?? true;
}

/**
 * Whether the actor is allowed to flip a hide flag to the given target state.
 *
 * Hide (true): both ADMIN and SUPERADMIN.
 * Unhide (false): only SUPERADMIN — an ADMIN that hid something loses sight of
 * it and cannot get it back on their own; they ask the superadmin.
 */
export function canToggleHidden(role: AdminRole, nextHidden: boolean): boolean {
  if (nextHidden) return true; // hiding is allowed for both admin roles
  return role === 'SUPERADMIN'; // only superadmin can unhide
}
