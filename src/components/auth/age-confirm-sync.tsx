"use client";

import { useEffect } from "react";

/**
 * Persists the signup-time 18+ confirmation to the user's profile once they are
 * authenticated (covers the OAuth path, where user metadata isn't set at signup).
 * The affirmative act was the required checkbox on the signup form; this records
 * it to the account. Renders nothing.
 */
export function AgeConfirmSync() {
  useEffect(() => {
    let flag = false;
    try {
      flag = localStorage.getItem("lmp_age_confirmed") === "1";
    } catch {
      return;
    }
    if (!flag) return;
    fetch("/api/profile/age", { method: "POST" })
      .then(() => {
        try { localStorage.removeItem("lmp_age_confirmed"); } catch {}
      })
      .catch(() => {});
  }, []);
  return null;
}
