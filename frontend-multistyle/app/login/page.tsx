"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/hooks/use-auth";

interface TestUser {
  email: string;
  full_name: string;
  role: string;
}

const ROLE_LABELS: Record<string, string> = {
  ADMIN: "Admin",
  BROKER: "Broker",
  CONTRACTOR: "Contractor",
  CLIENT_CONTACT: "Client Contact",
};

export default function LoginPage() {
  const [email, setEmail] = useState("admin@test.com");
  const [password, setPassword] = useState("a");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [testUsers, setTestUsers] = useState<TestUser[]>([]);
  const { login } = useAuth();
  const router = useRouter();

  useEffect(() => {
    fetch("/api/v1/test-users")
      .then((r) => r.json())
      .then((users) => setTestUsers(users))
      .catch(() => {});
  }, []);

  const handleUserSelect = (selectedEmail: string) => {
    setEmail(selectedEmail);
    setPassword("a");
    setError("");
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      await login(email, password);
      router.push("/");
    } catch {
      setError("Invalid email or password");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-brand-600">TimeHit</h1>
          <p className="text-gray-500 mt-1">IT Contracting Platform</p>
        </div>
        <form onSubmit={handleSubmit} className="bg-surface rounded-lg shadow-sm border p-6 space-y-4">
          {testUsers.length > 0 && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Quick Login</label>
              <select
                data-testid="login-user-select"
                value={email}
                onChange={(e) => handleUserSelect(e.target.value)}
                className="w-full border rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-600 bg-surface"
              >
                {testUsers.map((u) => (
                  <option key={u.email} value={u.email}>
                    {u.full_name} — {ROLE_LABELS[u.role] || u.role} ({u.email})
                  </option>
                ))}
              </select>
            </div>
          )}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
            <input
              data-testid="login-email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full border rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-600"
              required
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Password</label>
            <input
              data-testid="login-password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full border rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-600"
              required
            />
          </div>
          {error && <p className="text-sm text-red-600">{error}</p>}
          <button
            data-testid="login-submit"
            type="submit"
            disabled={loading}
            className="w-full bg-brand-600 text-white rounded-md py-2 text-sm font-medium hover:bg-brand-700 disabled:opacity-50"
          >
            {loading ? "Signing in..." : "Sign in"}
          </button>
        </form>
      </div>
    </div>
  );
}
