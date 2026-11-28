import { Link } from '@satilian/router';
import { ChevronDown, LogOut, UserRound } from 'lucide-react';
import { useState } from 'react';
import styles from './layout.module.css';

export function UserMenu() {
  const [signOutStatus, setSignOutStatus] = useState<'idle' | 'pending' | 'error'>('idle');

  async function signOut() {
    setSignOutStatus('pending');

    try {
      const session = await fetch('/api/v1/session', { cache: 'no-store' });
      if (session.status === 401) {
        window.location.replace('/');
        return;
      }
      if (!session.ok) {
        throw new Error('Could not read session');
      }

      const { csrfToken }: { csrfToken?: unknown } = await session.json();
      if (typeof csrfToken !== 'string' || !csrfToken) {
        throw new Error('Missing CSRF token');
      }

      const logout = await fetch('/api/v1/session/logout', {
        method: 'POST',
        headers: { 'X-CSRF-Token': csrfToken },
      });
      if (logout.status !== 204 && logout.status !== 401) {
        throw new Error('Could not end session');
      }
      window.location.replace('/');
    } catch {
      setSignOutStatus('error');
    }
  }

  return (
    <details
      className={styles.userMenu}
      onKeyDown={(event) => {
        if (event.key !== 'Escape' || !event.currentTarget.open) return;
        event.currentTarget.open = false;
        event.currentTarget.querySelector('summary')?.focus();
      }}
    >
      <summary className={styles.account} aria-label="User menu">
        <span className={styles.avatar}>
          <UserRound size={14} aria-hidden="true" />
        </span>
        <span className={styles.accountLabel}>3T Ledger</span>
        <ChevronDown size={14} className={styles.accountLabel} aria-hidden="true" />
      </summary>
      <div className={styles.userMenuPanel}>
        <Link
          to="/profile"
          className={styles.userMenuAction}
          onClick={(event) => {
            const menu = event.currentTarget.closest('details');
            if (menu) menu.open = false;
          }}
        >
          <UserRound size={16} aria-hidden="true" />
          Profile
        </Link>
        <button type="button" className={styles.userMenuAction} disabled={signOutStatus === 'pending'} onClick={signOut}>
          <LogOut size={16} aria-hidden="true" />
          {signOutStatus === 'pending' ? 'Signing out…' : 'Sign out'}
        </button>
        {signOutStatus === 'error' && (
          <p className={styles.signOutError} role="alert">
            Could not sign out. Try again.
          </p>
        )}
      </div>
    </details>
  );
}
