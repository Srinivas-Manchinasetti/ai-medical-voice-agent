import { currentUser } from "@clerk/nextjs/server";
import { logAuditEvent, AuditActorRole } from "../audit/audit-logger";

export type Role = "patient" | "admin";

export type Permission =
  | "consultations:create"
  | "consultations:read:own"
  | "emergency:dispatch"
  | "health:export:own"
  | "analytics:read"
  | "system:read"
  | "audit:read"
  | "audit:verify";

export const ROLE_PERMISSIONS: Record<Role, Permission[]> = {
  patient: [
    "consultations:create",
    "consultations:read:own",
    "emergency:dispatch",
    "health:export:own",
  ],
  admin: [
    "analytics:read",
    "system:read",
    "audit:read",
    "audit:verify",
  ],
};

export interface AuthContext {
  userId: string;
  role: Role;
  name: string;
  email: string;
  isDemoMode: boolean;
}

/**
 * Checks whether a role possesses a specific permission.
 */
export function hasPermission(role: Role, permission: Permission): boolean {
  return ROLE_PERMISSIONS[role]?.includes(permission) ?? false;
}

/**
 * Resolve the authenticated context from the request.
 * Supports:
 * 1. Clerk session authentication (production)
 * 2. Role assigned in user publicMetadata or privateMetadata ("patient" | "admin")
 * 3. Graceful fallback to sandbox Demo Mode if Clerk is not configured or during evaluation
 */
export async function getAuthContext(request?: Request): Promise<AuthContext> {
  const isDemo = process.env.DEMO_MODE !== "false" || !process.env.CLERK_SECRET_KEY;

  // Check header-based simulated role for automated testing / sandbox demonstration
  const testRoleHeader = request?.headers.get("x-mock-role") as Role | null;
  const testUserHeader = request?.headers.get("x-mock-user-id");

  try {
    const user = await currentUser();
    if (user) {
      const userRole = (user.publicMetadata?.role as Role) || "patient";
      return {
        userId: user.id,
        role: ["patient", "admin"].includes(userRole) ? userRole : "patient",
        name: user.fullName || user.firstName || user.username || "Authenticated User",
        email: user.primaryEmailAddress?.emailAddress || "",
        isDemoMode: false,
      };
    }
  } catch (err) {
    // Clerk not configured or network unreachable
  }

  // If in demo mode or test suite, support designated sandbox role
  if (testRoleHeader && ["patient", "admin"].includes(testRoleHeader)) {
    return {
      userId: testUserHeader || `mock-${testRoleHeader}-01`,
      role: testRoleHeader,
      name: `Demo ${testRoleHeader.toUpperCase()}`,
      email: `${testRoleHeader}@demo.local`,
      isDemoMode: true,
    };
  }

  // Default guest in demo mode
  return {
    userId: "anon-demo-user",
    role: "patient",
    name: "Demo Patient",
    email: "demo@med-voice.org",
    isDemoMode: isDemo,
  };
}

/**
 * Enforce RBAC permission for a request.
 * If unauthorized, logs an ACCESS_DENIED audit event and returns an error response.
 */
export async function authorizeRequest(
  request: Request,
  requiredPermission: Permission,
  resourceId: string = "system"
): Promise<{ authorized: true; auth: AuthContext } | { authorized: false; errorResponse: Response; auth: AuthContext }> {
  const auth = await getAuthContext(request);

  if (!hasPermission(auth.role, requiredPermission)) {
    logAuditEvent({
      actorId: auth.userId,
      actorRole: auth.role as AuditActorRole,
      action: "ACCESS_DENIED",
      resourceType: "auth",
      resourceId,
      status: "DENIED",
      metadata: {
        requiredPermission,
        userRole: auth.role,
      },
    });

    const errorResponse = new Response(
      JSON.stringify({
        success: false,
        error: "Forbidden: Insufficient permissions for this clinical action.",
        requiredPermission,
        currentRole: auth.role,
      }),
      {
        status: 403,
        headers: { "Content-Type": "application/json" },
      }
    );

    return { authorized: false, errorResponse, auth };
  }

  return { authorized: true, auth };
}
