/**
 * Central role → capability map. All UI role checks go through can() / usePermissions / Can.
 * Backend authorize() remains the source of truth for API access.
 */

const ROLE_CAPS = {
  admin: new Set([
    'viewReports',
    'exportReports',
    'filterByDepartment',
    'filterByIndividual',
    'viewAllUsers',
    'manageUsers',
    'manageDepartments',
    'editAccount',
    'editRequirement',
    'editProfile',
    'editSubmission',
    'unlockEntity',
    'viewProfiles',
    'createProfile',
    'assignRecruiters',
    'viewDashboardCharts',
    'viewPipeline',
    'viewLeadPipeline',
    'viewJobPipeline',
    'viewCandidatePipeline',
    'viewRequirementMatrix',
  ]),
  sales: new Set([
    'viewReports',
    'exportReports',
    'filterByDepartment',
    'filterByIndividual',
    'editRequirement',
    'editSubmission',
    'viewProfiles',
    'assignRecruiters',
    'viewDashboardCharts',
    'viewPipeline',
    'viewJobPipeline',
    'viewRequirementMatrix',
  ]),
  recruiter: new Set([
    'viewReports',
    'editProfile',
    'editSubmission',
    'viewProfiles',
    'createProfile',
    'viewDashboardCharts',
    'viewPipeline',
    'viewCandidatePipeline',
    'viewRequirementMatrix',
  ]),
  bda: new Set(['editAccount', 'viewPipeline', 'viewLeadPipeline', 'viewRequirementMatrix', 'viewReports']),
};

/**
 * Return true when the role has the named capability.
 *
 * Args:
 *   role: User role string (admin | sales | recruiter | bda).
 *   capability: Capability key from ROLE_CAPS.
 *
 * Returns:
 *   Whether the role is allowed.
 */
export function can(role, capability) {
  if (!role || !capability) return false;
  return ROLE_CAPS[role]?.has(capability) === true;
}

/**
 * Hook wrapping can() against the current auth user.
 *
 * Args:
 *   user: Auth user object with a role field.
 *
 * Returns:
 *   Object with can(capability) and role.
 */
export function usePermissions(user) {
  const role = user?.role;
  return {
    role,
    can(capability) {
      return can(role, capability);
    },
  };
}

/**
 * Conditionally render children when the user has the capability.
 */
export function Can({ user, capability, children, fallback = null }) {
  if (!can(user?.role, capability)) return fallback;
  return children;
}
