"use client";

import { useState } from "react";
import { useSearchParams } from "next/navigation";
import { Loader2, Mail, Lock, User, ArrowRight, AlertCircle, CheckCircle2 } from "lucide-react";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import { safeNext } from "@/lib/auth/next";
import { cn } from "@/lib/utils";

type Mode = "signin" | "signup" | "forgot";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function friendlyError(message: string): string {
  const m = message.toLowerCase();
  if (m.includes("invalid login")) return "Wrong email or password. Try again.";
  if (m.includes("email not confirmed"))
    return "Please confirm your email first — check your inbox for the link.";
  if (m.includes("already registered") || m.includes("already been registered"))
    return "That email is already registered. Try signing in instead.";
  if (m.includes("password should be")) return "Password must be at least 6 characters.";
  if (m.includes("rate limit")) return "Too many attempts — please wait a moment and retry.";
  return message || "Something went wrong. Please try again.";
}

export function AuthForm() {
  const searchParams = useSearchParams();
  const next = safeNext(searchParams.get("next"));
  const oauthError = searchParams.get("error") === "oauth";
  // Open in sign-up mode when reached via /login?mode=signup.
  const initialMode: Mode = searchParams.get("mode") === "signup" ? "signup" : "signin";

  const [mode, setMode] = useState<Mode>(initialMode);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState<null | "google" | "email">(null);
  const [error, setError] = useState<string | null>(oauthError ? "Google sign-in failed. Please try again." : null);
  const [notice, setNotice] = useState<string | null>(null);

  const supabase = createSupabaseBrowserClient();
  const origin = typeof window !== "undefined" ? window.location.origin : "";
  const callbackUrl = `${origin}/auth/callback?next=${encodeURIComponent(next)}`;

  function validate(): string | null {
    if (!EMAIL_RE.test(email)) return "Enter a valid email address.";
    if (mode !== "forgot" && password.length < 6) return "Password must be at least 6 characters.";
    if (mode === "signup" && !name.trim()) return "Please tell us your name.";
    return null;
  }

  async function handleGoogle() {
    setError(null);
    setNotice(null);
    setBusy("google");
    const { error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo: callbackUrl },
    });
    if (error) {
      setError(friendlyError(error.message));
      setBusy(null);
    }
    // On success the browser navigates to Google — no further action here.
  }

  async function handleEmail(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setNotice(null);
    const v = validate();
    if (v) {
      setError(v);
      return;
    }
    setBusy("email");

    try {
      if (mode === "signin") {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
        window.location.assign(next);
        return;
      }

      if (mode === "signup") {
        const { data, error } = await supabase.auth.signUp({
          email,
          password,
          options: { data: { full_name: name.trim() }, emailRedirectTo: callbackUrl },
        });
        if (error) throw error;
        // Supabase returns an obfuscated user with empty identities when the
        // email already exists (to avoid enumeration).
        if (data.user && data.user.identities && data.user.identities.length === 0) {
          setError("That email is already registered. Try signing in instead.");
          setBusy(null);
          return;
        }
        if (data.session) {
          // Email confirmation disabled — signed in immediately.
          window.location.assign(next);
          return;
        }
        setNotice(
          `We've sent a confirmation link to ${email}. Click it to activate your account, then sign in.`
        );
        setMode("signin");
        setBusy(null);
        return;
      }

      // forgot
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${origin}/auth/callback?next=/dashboard`,
      });
      if (error) throw error;
      setNotice(`If an account exists for ${email}, a password-reset link is on its way.`);
      setMode("signin");
      setBusy(null);
    } catch (err) {
      setError(friendlyError(err instanceof Error ? err.message : String(err)));
      setBusy(null);
    }
  }

  const title =
    mode === "signin" ? "Welcome back" : mode === "signup" ? "Create your account" : "Reset your password";
  const subtitle =
    mode === "signin"
      ? "Sign in to unlock your report and AI Mentor."
      : mode === "signup"
        ? "Free to start — no card, unlock only when you're ready."
        : "We'll email you a secure link to set a new password.";

  return (
    <div className="w-full">
      <h1 className="text-2xl font-semibold tracking-tight text-ink sm:text-3xl">{title}</h1>
      <p className="mt-2 text-sm text-ink-secondary">{subtitle}</p>

      {notice && (
        <div className="mt-6 flex items-start gap-2.5 rounded-xl border border-success/30 bg-success-soft px-4 py-3 text-sm text-ink">
          <CheckCircle2 className="mt-0.5 h-4 w-4 flex-shrink-0 text-success" />
          <span>{notice}</span>
        </div>
      )}
      {error && (
        <div className="mt-6 flex items-start gap-2.5 rounded-xl border border-danger/30 bg-danger-soft px-4 py-3 text-sm text-danger">
          <AlertCircle className="mt-0.5 h-4 w-4 flex-shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {mode !== "forgot" && (
        <>
          {/* Google — the primary, faster path */}
          <button
            type="button"
            onClick={handleGoogle}
            disabled={busy !== null}
            className="mt-6 flex min-h-[48px] w-full items-center justify-center gap-3 rounded-lg border border-hairline-strong bg-surface px-4 py-3 text-sm font-semibold text-ink transition-premium hover:bg-panel disabled:opacity-60"
          >
            {busy === "google" ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <GoogleIcon className="h-5 w-5" />
            )}
            Continue with Google
          </button>

          <div className="my-6 flex items-center gap-3">
            <span className="h-px flex-1 bg-hairline" />
            <span className="text-xs font-medium uppercase tracking-wider text-ink-tertiary">or</span>
            <span className="h-px flex-1 bg-hairline" />
          </div>
        </>
      )}

      <form onSubmit={handleEmail} className="space-y-4">
        {mode === "signup" && (
          <Field
            icon={User}
            label="Full name"
            type="text"
            value={name}
            onChange={setName}
            placeholder="Your name"
            autoComplete="name"
          />
        )}
        <Field
          icon={Mail}
          label="Email"
          type="email"
          value={email}
          onChange={setEmail}
          placeholder="you@example.com"
          autoComplete="email"
        />
        {mode !== "forgot" && (
          <Field
            icon={Lock}
            label="Password"
            type="password"
            value={password}
            onChange={setPassword}
            placeholder={mode === "signup" ? "At least 6 characters" : "Your password"}
            autoComplete={mode === "signup" ? "new-password" : "current-password"}
          />
        )}

        {mode === "signin" && (
          <div className="flex justify-end">
            <button
              type="button"
              onClick={() => {
                setMode("forgot");
                setError(null);
                setNotice(null);
              }}
              className="text-xs font-medium text-accent transition-premium hover:text-accent-hover"
            >
              Forgot password?
            </button>
          </div>
        )}

        <button
          type="submit"
          disabled={busy !== null}
          className="flex min-h-[48px] w-full items-center justify-center gap-2 rounded-lg bg-accent px-4 py-3 text-sm font-semibold text-white shadow-soft transition-premium hover:bg-accent-hover disabled:opacity-60"
        >
          {busy === "email" ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <>
              {mode === "signin" ? "Sign in" : mode === "signup" ? "Create account" : "Send reset link"}
              <ArrowRight className="h-4 w-4" />
            </>
          )}
        </button>
      </form>

      <div className="mt-6 text-center text-sm text-ink-secondary">
        {mode === "signin" && (
          <>
            New here?{" "}
            <SwitchBtn onClick={() => { setMode("signup"); setError(null); setNotice(null); }}>
              Create an account
            </SwitchBtn>
          </>
        )}
        {mode === "signup" && (
          <>
            Already have an account?{" "}
            <SwitchBtn onClick={() => { setMode("signin"); setError(null); setNotice(null); }}>
              Sign in
            </SwitchBtn>
          </>
        )}
        {mode === "forgot" && (
          <SwitchBtn onClick={() => { setMode("signin"); setError(null); setNotice(null); }}>
            ← Back to sign in
          </SwitchBtn>
        )}
      </div>
    </div>
  );
}

function Field({
  icon: Icon,
  label,
  type,
  value,
  onChange,
  placeholder,
  autoComplete,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  type: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  autoComplete?: string;
}) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-ink-tertiary">
        {label}
      </span>
      <div className="relative">
        <Icon className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-tertiary" />
        <input
          type={type}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          autoComplete={autoComplete}
          required
          className="w-full rounded-lg border border-hairline bg-surface py-3 pl-10 pr-3.5 text-sm text-ink shadow-soft outline-none transition-premium placeholder:text-ink-tertiary focus:border-accent focus:ring-2 focus:ring-accent/25"
        />
      </div>
    </label>
  );
}

function SwitchBtn({ onClick, children }: { onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn("font-semibold text-accent transition-premium hover:text-accent-hover")}
    >
      {children}
    </button>
  );
}

function GoogleIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" aria-hidden>
      <path
        fill="#4285F4"
        d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1Z"
      />
      <path
        fill="#34A853"
        d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84A11 11 0 0 0 12 23Z"
      />
      <path
        fill="#FBBC05"
        d="M5.84 14.1a6.6 6.6 0 0 1 0-4.2V7.06H2.18a11 11 0 0 0 0 9.88l3.66-2.84Z"
      />
      <path
        fill="#EA4335"
        d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1A11 11 0 0 0 2.18 7.06l3.66 2.84C6.71 7.31 9.14 5.38 12 5.38Z"
      />
    </svg>
  );
}
