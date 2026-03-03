import { useState, FormEvent } from 'react';

export function LoginPage() {
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!password.trim()) return;

    setError('');
    setLoading(true);

    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({ error: 'Login failed' }));
        throw new Error(data.error || 'Invalid password');
      }

      const { token } = await res.json();
      localStorage.setItem('katsu_auth_token', token);
      window.location.reload();
    } catch (err: any) {
      setError(err.message || 'Login failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#0f0f0f] flex items-center justify-center p-4">
      <div className="w-full max-w-sm">
        {/* Branding */}
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-katsu-accent mb-1">Katsu</h1>
          <p className="text-sm text-katsu-text-muted">Creative Project Manager</p>
        </div>

        {/* Login Form */}
        <form onSubmit={handleSubmit} className="bg-katsu-surface rounded-lg border border-katsu-border p-6">
          <div className="mb-4">
            <label htmlFor="password" className="block text-xs text-katsu-text-muted mb-1.5">
              Password
            </label>
            <input
              id="password"
              type="password"
              value={password}
              onChange={e => setPassword(e.target.value)}
              placeholder="Enter your password"
              autoFocus
              className="w-full bg-katsu-surface-2 border border-katsu-border rounded px-3 py-2.5 text-sm text-katsu-text placeholder:text-katsu-text-dim focus:outline-none focus:border-katsu-accent"
            />
          </div>

          {error && (
            <p className="text-xs text-red-400 mb-3">{error}</p>
          )}

          <button
            type="submit"
            disabled={loading || !password.trim()}
            className="w-full py-2.5 bg-katsu-accent text-black text-sm font-medium rounded hover:bg-katsu-accent-hover disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {loading ? 'Signing in...' : 'Sign In'}
          </button>
        </form>
      </div>
    </div>
  );
}
