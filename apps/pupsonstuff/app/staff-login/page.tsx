'use client';

import { FormEvent, useState } from 'react';

export default function StaffLoginPage() {
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setBusy(true);
    setError(null);
    const form = new FormData(event.currentTarget);
    const response = await fetch('/api/admin/session', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: form.get('username'), password: form.get('password') }),
    });
    const body = await response.json();
    if (!response.ok) {
      setError(body.error ?? 'Sign in failed.');
      setBusy(false);
      return;
    }
    window.location.href = '/admin';
  };
  return (
    <main className="flex min-h-screen items-center justify-center bg-ink p-6">
      <form
        onSubmit={submit}
        className="w-full max-w-sm space-y-4 rounded-xl bg-cream p-8 text-ink shadow-2xl"
      >
        <h1 className="font-display text-2xl text-bronze">PupsonStuff Staff</h1>
        <label className="block text-sm">
          Username
          <input
            name="username"
            required
            autoComplete="username"
            className="mt-1 w-full rounded-md border border-greige px-3 py-2"
          />
        </label>
        <label className="block text-sm">
          Password
          <input
            name="password"
            type="password"
            required
            autoComplete="current-password"
            className="mt-1 w-full rounded-md border border-greige px-3 py-2"
          />
        </label>
        {error ? <p className="text-sm text-red-700">{error}</p> : null}
        <button
          disabled={busy}
          className="w-full rounded-md bg-bronze py-2 text-cream disabled:opacity-50"
        >
          {busy ? 'Signing in…' : 'Sign in'}
        </button>
      </form>
    </main>
  );
}
