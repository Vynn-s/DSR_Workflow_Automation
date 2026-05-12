import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
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

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);

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
  }, []);

  const login = async (email: string, password: string) => {
     localStorage.clear();  // ← add this
      sessionStorage.clear(); // ← add this
    await signIn({ username: email, password });

    const [session, currentUser, attributes] = await Promise.all([
      fetchAuthSession(),
      getCurrentUser(),
      fetchUserAttributes(),
    ]);

    const role = getRoleFromSessionGroups(session);
    const nextUser: User = {
      id: currentUser.userId,
      email: attributes.email ?? email,
      ministryId: attributes["custom:ministryId"] || undefined,
      name: attributes.name ?? currentUser.username ?? email,
      role,
    };

    setUser(nextUser);

    return role;
  };

  const logout = async () => {
  try {
    await signOut({ global: true });
  } catch (error) {
    console.error("Logout error:", error);
  } finally {
    setUser(null);
    localStorage.clear();
    sessionStorage.clear();
    window.location.assign("/");
  }
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
