import { Link } from '@satilian/router';
import { ChevronDown, LogOut, UserRound } from 'lucide-react';
import { useRef, useState } from 'react';
import { useOnClickOutside } from 'src/hooks';
import styles from './layout.module.css';
import { profileNavigation } from './profile-navigation';

export function UserMenu({ pathname }: { pathname: string }) {
  const menu = useRef<HTMLDetailsElement>(null);
  const trigger = useRef<HTMLElement>(null);

  useOnClickOutside(menu, () => {
    if (menu.current?.open) menu.current.open = false;
  });

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
      ref={menu}
      className={styles.userMenu}
      onKeyDown={(event) => {
        if (event.key !== 'Escape' || !event.currentTarget.open) return;
        event.currentTarget.open = false;
        trigger.current?.focus();
      }}
    >
      <summary ref={trigger} className={styles.account} aria-label="User menu">
        <span className={styles.avatar}>
          <UserRound size={14} aria-hidden="true" />
        </span>
        <span className={styles.accountLabel}>3T Ledger</span>
        <ChevronDown size={14} className={styles.accountLabel} aria-hidden="true" />
      </summary>
      <div className={styles.userMenuPanel}>
        <div className={styles.userMenuHeader}>
          <span className={styles.avatar}><UserRound size={14} aria-hidden="true" /></span>
          <strong>3T Ledger</strong>
        </div>
        <nav className={styles.userMenuLinks} aria-label="Profile pages">
          {profileNavigation.map(({ label, description, icon: Icon, to }) => (
            <Link
              key={to}
              to={to}
              className={styles.userMenuAction}
              aria-current={pathname === to ? 'page' : undefined}
              onClick={() => {
                if (menu.current) menu.current.open = false;
                trigger.current?.focus();
              }}
            >
              <Icon size={16} aria-hidden="true" />
              <span>
                {label}
                {description && <small>{description}</small>}
              </span>
            </Link>
          ))}
        </nav>
        <button
          type="button"
          className={`${styles.userMenuAction} ${styles.signOutAction}`}
          disabled={signOutStatus === 'pending'}
          onClick={signOut}
        >
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
