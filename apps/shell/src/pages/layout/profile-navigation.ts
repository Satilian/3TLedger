import { Bell, CircleHelp, CreditCard, Settings, Shield, UserRound } from 'lucide-react';

export const profileNavigation = [
  { section: 'profile', to: '/profile', label: 'Profile', description: 'Personal information', icon: UserRound },
  { section: 'settings', to: '/profile/settings', label: 'Settings', description: 'Preferences & security', icon: Settings },
  { section: 'notifications', to: '/profile/notifications', label: 'Notifications', description: 'Notification preferences', icon: Bell },
  { section: 'billing', to: '/profile/billing', label: 'Billing', description: 'Plan & payment details', icon: CreditCard },
  { section: 'privacy', to: '/profile/privacy', label: 'Privacy', description: 'Data & permissions', icon: Shield },
  { section: 'help-support', to: '/profile/help-support', label: 'Help & support', description: undefined, icon: CircleHelp },
] as const;
