"use client";

import { useEffect, useState, type FormEvent } from "react";
import { KanbanBoard } from "@/components/KanbanBoard";

export const AuthGate = () => {
  const [isSignedIn, setIsSignedIn] = useState<boolean | null>(null);
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [logoutError, setLogoutError] = useState("");

  useEffect(() => {
    let active = true;
    fetch("/api/auth/session")
      .then(async (response) => {
        if (!response.ok) {
          throw new Error("Unable to check sign-in session.");
        }
        const session: unknown = await response.json();
        if (
          typeof session !== "object" ||
          session === null ||
          !("authenticated" in session) ||
          typeof session.authenticated !== "boolean"
        ) {
          throw new Error("Invalid sign-in session response.");
        }
        if (active) {
          setIsSignedIn(session.authenticated);
        }
      })
      .catch(() => {
        if (active) {
          setError("Unable to check sign-in session. Please try again.");
          setIsSignedIn(false);
        }
      });
    return () => {
      active = false;
    };
  }, []);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError("");
    try {
      const response = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, password }),
      });
      if (response.status === 401) {
        setError("Incorrect username or password.");
        return;
      }
      if (!response.ok) {
        throw new Error("Sign-in request failed.");
      }
      setIsSignedIn(true);
    } catch {
      setError("Unable to sign in. Please try again.");
    }
  };

  const handleLogout = async () => {
    setLogoutError("");
    try {
      const response = await fetch("/api/auth/logout", { method: "POST" });
      if (!response.ok) {
        throw new Error("Sign-out request failed.");
      }
      setIsSignedIn(false);
    } catch {
      setLogoutError("Unable to sign out. Please try again.");
    }
  };

  if (isSignedIn === true) {
    return (
      <KanbanBoard onLogout={handleLogout} logoutError={logoutError} />
    );
  }

  if (isSignedIn === null) {
    return (
      <main className="grid min-h-screen place-items-center px-6">
        <p className="text-sm text-[var(--gray-text)]">Checking sign-in...</p>
      </main>
    );
  }

  return (
    <main className="relative grid min-h-screen place-items-center overflow-hidden px-6 py-12">
      <div className="pointer-events-none absolute left-0 top-0 h-[420px] w-[420px] -translate-x-1/3 -translate-y-1/3 rounded-full bg-[radial-gradient(circle,_rgba(32,157,215,0.2)_0%,_rgba(32,157,215,0.04)_55%,_transparent_70%)]" />
      <section className="relative w-full max-w-md rounded-[32px] border border-[var(--stroke)] bg-white/90 p-8 shadow-[var(--shadow)] backdrop-blur">
        <p className="text-xs font-semibold uppercase tracking-[0.3em] text-[var(--gray-text)]">
          Kanban Studio
        </p>
        <h1 className="mt-3 font-display text-3xl font-semibold text-[var(--navy-dark)]">
          Sign in
        </h1>
        <p className="mt-2 text-sm leading-6 text-[var(--gray-text)]">
          Sign in to open your project board.
        </p>

        <form className="mt-8 flex flex-col gap-5" onSubmit={handleSubmit}>
          <label className="flex flex-col gap-2 text-sm font-medium text-[var(--navy-dark)]">
            Username
            <input
              autoComplete="username"
              className="rounded-xl border border-[var(--stroke)] bg-white px-4 py-3 outline-none focus:border-[var(--primary-blue)]"
              name="username"
              onChange={(event) => setUsername(event.target.value)}
              required
              value={username}
            />
          </label>
          <label className="flex flex-col gap-2 text-sm font-medium text-[var(--navy-dark)]">
            Password
            <input
              autoComplete="current-password"
              className="rounded-xl border border-[var(--stroke)] bg-white px-4 py-3 outline-none focus:border-[var(--primary-blue)]"
              name="password"
              onChange={(event) => setPassword(event.target.value)}
              required
              type="password"
              value={password}
            />
          </label>
          {error ? (
            <p className="text-sm text-red-700" role="alert">
              {error}
            </p>
          ) : null}
          <button
            className="rounded-xl bg-[var(--secondary-purple)] px-5 py-3 font-semibold text-white transition hover:brightness-110 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--secondary-purple)]"
            type="submit"
          >
            Sign in
          </button>
        </form>

        <p className="mt-6 text-xs text-[var(--gray-text)]">
          Demo credentials: user / password
        </p>
      </section>
    </main>
  );
};
