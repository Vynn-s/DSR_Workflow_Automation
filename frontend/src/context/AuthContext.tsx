import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from "react";
import { fetchAuthSession, fetchUserAttributes, getCurrentUser, signIn, signOut } from "aws-amplify/auth";

export enum UserRole {
  REQUESTER = "REQUESTER",
  PARISH_SECRETARY = "PARISH_SECRETARY",
  PARISH_PRIEST = "PARISH_PRIEST",
  ADMIN = "ADMIN",
}

export interface User {
  id: string;
  email: string;
  name: string;
  role: UserRole;
  ministryId?: string;
}

interface AuthContextValue {
  user: User | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  login: (email: string, password: string) => Promise<UserRole | null>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

function mapGroupToRole(group?: string): UserRole {
  switch (group) {
    case UserRole.ADMIN:
      return UserRole.ADMIN;
    case UserRole.PARISH_PRIEST:
      return UserRole.PARISH_PRIEST;
    case UserRole.PARISH_SECRETARY:
      return UserRole.PARISH_SECRETARY;
    case UserRole.REQUESTER:
    default:
      return UserRole.REQUESTER;
  }
}

function getRoleFromSessionGroups(session: Awaited<ReturnType<typeof fetchAuthSession>>): UserRole {
  const groups = session.tokens?.idToken?.payload["cognito:groups"];

  if (Array.isArray(groups) && groups.length > 0) {
    return mapGroupToRole(String(groups[0]));
  }

  return UserRole.REQUESTER;
}

function isSessionExpired(session: Awaited<ReturnType<typeof fetchAuthSession>>): boolean {
  const expiresAt = session.tokens?.idToken?.payload.exp;
  return typeof expiresAt === "number" && expiresAt * 1000 <= Date.now();
}

function clearAuthStorage() {
  sessionStorage.clear();
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const logout = useCallback(async () => {
    try {
      await signOut({ global: true });
    } catch {
      // Ignore logout failures; local auth state must still be cleared.
    } finally {
      setUser(null);
      clearAuthStorage();
      window.location.assign("/login");
    }
  }, []);

  useEffect(() => {
    let isMounted = true;

    async function loadCurrentUser() {
      try {
        const currentUser = await getCurrentUser();
        const [session, attributes] = await Promise.all([
          fetchAuthSession(),
          fetchUserAttributes(),
        ]);

        const role = getRoleFromSessionGroups(session);
        if (isSessionExpired(session)) {
          await logout();
          return;
        }

        const email = attributes.email ?? "";
        const ministryId = attributes["custom:ministryId"] || undefined;

        if (isMounted) {
          setUser({
            id: currentUser.userId,
            email,
            name: attributes.name ?? currentUser.username ?? email,
            role,
            ministryId,
          });
        }
      } catch {
        if (isMounted) {
          setUser(null);
        }
      } finally {
        if (isMounted) {
          setIsLoading(false);
        }
      }
    }

    void loadCurrentUser();

    return () => {
      isMounted = false;
    };
  }, [logout]);

  useEffect(() => {
    if (!user) {
      return;
    }

    const intervalId = window.setInterval(async () => {
      try {
        const session = await fetchAuthSession();
        if (isSessionExpired(session)) {
          await logout();
        }
      } catch {
        await logout();
      }
    }, 60_000);

    return () => window.clearInterval(intervalId);
  }, [logout, user]);

  const login = async (email: string, password: string) => {
    clearAuthStorage();
    const trimmedEmail = email.trim();
    await signIn({ username: trimmedEmail, password });

    const [session, currentUser, attributes] = await Promise.all([
      fetchAuthSession(),
      getCurrentUser(),
      fetchUserAttributes(),
    ]);

    const role = getRoleFromSessionGroups(session);
    if (isSessionExpired(session)) {
      await logout();
      return null;
    }

    const nextUser: User = {
      id: currentUser.userId,
      email: attributes.email ?? trimmedEmail,
      ministryId: attributes["custom:ministryId"] || undefined,
      name: attributes.name ?? currentUser.username ?? trimmedEmail,
      role,
    };

    setUser(nextUser);

    return role;
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        isLoading,
        isAuthenticated: Boolean(user),
        login,
        logout,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);

  if (!context) {
    throw new Error("useAuth must be used within an AuthProvider");
  }

  return context;
}
