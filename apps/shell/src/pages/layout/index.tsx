import { Link, Outlet, RouterSuspense, useRouter } from '@satilian/router';
import {
  ArrowDownUp,
  ArrowLeft,
  ArrowLeftRight,
  BarChart3,
  ChevronLeft,
  LayoutDashboard,
  Menu,
  Tag,
  Target,
  TrendingDown,
  TrendingUp,
  UserRound,
  Wallet,
  X,
} from 'lucide-react';
import { memo, useRef, useState } from 'react';
import styles from './layout.module.css';
import { profileNavigation } from './profile-navigation';
import { UserMenu } from './user-menu';

const navigation = [
  { label: 'Dashboard', icon: LayoutDashboard, to: '/' },
  { label: 'Accounts', icon: Wallet, to: '/accounts' },
  { label: 'Transactions', icon: ArrowDownUp, to: '/transactions' },
  { label: 'Income', icon: TrendingUp, to: '/income' },
  { label: 'Expenses', icon: TrendingDown, to: '/expenses' },
  { label: 'Transfers', icon: ArrowLeftRight, to: '/transfers' },
  { label: 'Categories', icon: Tag, to: '/categories' },
  { label: 'Statistics', icon: BarChart3, to: '/statistics' },
  { label: 'Budget Planning', icon: Target, to: '/budget-planning' },
] as const;

function Sidebar({
  pathname,
  onNavigate,
  control,
  isProfile,
}: {
  pathname: string;
  onNavigate?: () => void;
  control: React.ReactNode;
  isProfile: boolean;
}) {
  return (
    <>
      <div className={styles.brand}>
        <Link to="/" className={styles.brandLink} onClick={onNavigate}>
          <span className={styles.logo} aria-hidden="true">
            3T
          </span>
          <span className={styles.label}>
            <strong>3T Ledger</strong>
            <small>Personal Finance</small>
          </span>
        </Link>
        {control}
      </div>
      <nav className={styles.navigation} aria-label={isProfile ? 'Account navigation' : 'Main navigation'}>
        {isProfile && <div className={styles.navigationHeading}><span className={styles.label}>Account</span></div>}
        {(isProfile ? profileNavigation : navigation).map(({ label, icon: Icon, to }) => (
          <Link
            key={to}
            to={to}
            onClick={onNavigate}
            aria-current={pathname === to ? 'page' : undefined}
            title={label}
          >
            <Icon size={16} aria-hidden="true" />
            <span className={styles.label}>{label}</span>
          </Link>
        ))}
      </nav>
      {isProfile ? (
        <Link to="/" onClick={onNavigate} className={styles.sidebarFooter} title="Back to dashboard">
          <ArrowLeft size={16} aria-hidden="true" />
          <span className={styles.label}>Back to dashboard</span>
        </Link>
      ) : (
        <Link to="/about" onClick={onNavigate} className={styles.sidebarFooter} aria-label="About 3T Ledger">
          <span className={styles.avatar}>
            <UserRound size={14} aria-hidden="true" />
          </span>
          <span className={styles.label}>About 3T Ledger</span>
        </Link>
      )}
    </>
  );
}

export default memo(function MainLayout() {
  const { pathname: currentPathname } = useRouter();
  const pathname = currentPathname.replace(/\/+$/, '') || '/';
  const profilePage = profileNavigation.find(({ to }) => to === pathname);
  const [collapsed, setCollapsed] = useState(false);
  const drawer = useRef<HTMLDialogElement>(null);
  const title = pathname === '/about'
    ? 'About'
    : profilePage?.label ?? navigation.find(({ to }) => to === pathname)?.label ?? 'Dashboard';

  return (
    <div className={styles.shell}>
      <aside id="desktop-sidebar" className={styles.sidebar} data-collapsed={collapsed}>
        <Sidebar
          pathname={pathname}
          isProfile={Boolean(profilePage)}
          control={
            <button
              type="button"
              className={styles.iconButton}
              aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
              aria-controls="desktop-sidebar"
              aria-expanded={!collapsed}
              onClick={() => setCollapsed(!collapsed)}
            >
              <ChevronLeft size={16} aria-hidden="true" />
            </button>
          }
        />
      </aside>

      <dialog ref={drawer} id="mobile-sidebar" className={styles.drawer} aria-label="3T Ledger navigation">
        <div className={styles.drawerContent}>
          <Sidebar
            pathname={pathname}
            isProfile={Boolean(profilePage)}
            onNavigate={() => drawer.current?.close()}
            control={
              <button
                type="button"
                className={styles.iconButton}
                aria-label="Close navigation"
                onClick={() => drawer.current?.close()}
              >
                <X size={18} aria-hidden="true" />
              </button>
            }
          />
        </div>
      </dialog>

      <div className={styles.workspace}>
        <header className={styles.header}>
          <button
            type="button"
            className={styles.menuButton}
            aria-label="Open navigation"
            aria-haspopup="dialog"
            aria-controls="mobile-sidebar"
            onClick={() => drawer.current?.showModal()}
          >
            <Menu size={18} aria-hidden="true" />
          </button>
          <h1>{title}</h1>
          <UserMenu pathname={pathname} />
        </header>
        <main className={styles.content}>
          <RouterSuspense fallback={<div role="status">Loading...</div>}>
            <Outlet />
          </RouterSuspense>
        </main>
      </div>
    </div>
  );
});
