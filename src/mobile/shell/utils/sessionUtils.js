import { apiFetch, buildApiPathUrl } from "../../../config/api";

export async function refreshSessionFlags(session) {
  const token = session?.token;
  if (!token) {
    return session;
  }

  let nextSession = { ...session };

  try {
    const roleResponse = await fetch(buildApiPathUrl("/users-role/"), {
      method: "GET",
      credentials: "include",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
    });

    if (roleResponse.ok) {
      const roleData = await roleResponse.json().catch(() => ({}));
      nextSession = {
        ...nextSession,
        role: roleData?.role || nextSession.role,
        emailVerified: Boolean(roleData?.email_verified),
        isTestUser: Boolean(roleData?.is_test_user),
      };
    }
  } catch (_error) {
    /* keep previous flags */
  }

  try {
    const subscriptionResponse = await apiFetch("/subscriptions/access-status", {
      authenticated: true,
    });

    if (subscriptionResponse.ok) {
      const subscriptionData = await subscriptionResponse.json().catch(() => ({}));
      nextSession = {
        ...nextSession,
        hasValidSubscription: Boolean(subscriptionData?.has_valid_subscription),
        isTestUser: Boolean(subscriptionData?.is_test_user) || nextSession.isTestUser,
      };
    }
  } catch (_error) {
    /* keep previous flags */
  }

  return nextSession;
}
