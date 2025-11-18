import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/services/api';
import { toast } from '@/store/toastStore';
import { useThemeStore } from '@/store/themeStore';
import { useDensity, DENSITY_CONFIGS, type DensityLevel } from '@/hooks/useDensity';
import { useLayout, LAYOUT_CONFIGS, type LayoutMode } from '@/hooks/useLayout';
import Layout from '@/components/Layout';
import AccountWizard from '@/components/AccountWizard';
import SignatureManager from '@/components/SignatureManager';
import TemplateManager from '@/components/TemplateManager';
import LabelManager from '@/components/LabelManager';
import { useAuthStore } from '@/store/authStore';
import { errorLogger } from '@/services/errorLogger';
import { config } from '@/config/env';

export default function SettingsPage() {
  const queryClient = useQueryClient();
  const user = useAuthStore((state) => state.user);
  const { theme, setTheme } = useThemeStore();
  const { density, setDensity } = useDensity();
  const { layout, setLayout } = useLayout();
  const [activeTab, setActiveTab] = useState<'accounts' | 'signatures' | 'templates' | 'labels' | 'general' | 'advanced'>('general');
  const [showWizard, setShowWizard] = useState(false);
  const [desktopNotifications, setDesktopNotifications] = useState(
    Notification.permission === 'granted'
  );

  const { data: accounts } = useQuery({
    queryKey: ['accounts'],
    queryFn: () => api.getAccounts(),
  });

  const deleteAccountMutation = useMutation({
    mutationFn: (accountId: string) => api.deleteAccount(accountId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['accounts'] });
      toast.success('Account removed successfully');
    },
    onError: () => {
      toast.error('Failed to remove account');
    },
  });

  const requestNotificationPermission = async () => {
    if ('Notification' in window) {
      const permission = await Notification.requestPermission();
      setDesktopNotifications(permission === 'granted');

      if (permission === 'granted') {
        new Notification('Notifications Enabled', {
          body: 'You will now receive desktop notifications from Mycelix Mail',
          icon: '/vite.svg',
        });
      }
    }
  };

  const exportAllData = () => {
    const data = {
      user: {
        email: user?.email,
        firstName: user?.firstName,
        lastName: user?.lastName,
      },
      signatures: JSON.parse(localStorage.getItem('signature-storage') || '{"state":{"signatures":[]}}'),
      templates: JSON.parse(localStorage.getItem('template-storage') || '{"state":{"templates":[]}}'),
      labels: JSON.parse(localStorage.getItem('label-storage') || '{"state":{"labels":[],"emailLabels":{}}}'),
      snooze: JSON.parse(localStorage.getItem('snooze-storage') || '{"state":{"snoozedEmails":[]}}'),
      theme: JSON.parse(localStorage.getItem('theme-storage') || '{"state":{"theme":"light"}}'),
      exportDate: new Date().toISOString(),
      version: config.appVersion,
    };

    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `mycelix-mail-backup-${Date.now()}.json`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success('Data exported successfully');
  };

  const viewErrorLogs = () => {
    const logs = errorLogger.getErrors();
    console.table(logs);
    alert(`${logs.length} errors logged. Check console for details.`);
  };

  return (
    <Layout>
      <div className="max-w-7xl mx-auto p-6">
        <h1 className="text-3xl font-bold text-gray-900 dark:text-gray-100 mb-6">Settings</h1>

        <div className="mb-6 border-b border-gray-200 dark:border-gray-700">
          <nav className="-mb-px flex space-x-8 overflow-x-auto">
            <button
              onClick={() => setActiveTab('general')}
              className={`${
                activeTab === 'general'
                  ? 'border-primary-600 text-primary-600 dark:text-primary-400'
                  : 'border-transparent text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300 hover:border-gray-300 dark:hover:border-gray-600'
              } whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm`}
            >
              ⚙️ General
            </button>
            <button
              onClick={() => setActiveTab('accounts')}
              className={`${
                activeTab === 'accounts'
                  ? 'border-primary-600 text-primary-600 dark:text-primary-400'
                  : 'border-transparent text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300 hover:border-gray-300 dark:hover:border-gray-600'
              } whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm`}
            >
              📧 Accounts
            </button>
            <button
              onClick={() => setActiveTab('signatures')}
              className={`${
                activeTab === 'signatures'
                  ? 'border-primary-600 text-primary-600 dark:text-primary-400'
                  : 'border-transparent text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300 hover:border-gray-300 dark:hover:border-gray-600'
              } whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm`}
            >
              ✍️ Signatures
            </button>
            <button
              onClick={() => setActiveTab('templates')}
              className={`${
                activeTab === 'templates'
                  ? 'border-primary-600 text-primary-600 dark:text-primary-400'
                  : 'border-transparent text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300 hover:border-gray-300 dark:hover:border-gray-600'
              } whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm`}
            >
              📝 Templates
            </button>
            <button
              onClick={() => setActiveTab('labels')}
              className={`${
                activeTab === 'labels'
                  ? 'border-primary-600 text-primary-600 dark:text-primary-400'
                  : 'border-transparent text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300 hover:border-gray-300 dark:hover:border-gray-600'
              } whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm`}
            >
              🏷️ Labels
            </button>
            <button
              onClick={() => setActiveTab('advanced')}
              className={`${
                activeTab === 'advanced'
                  ? 'border-primary-600 text-primary-600 dark:text-primary-400'
                  : 'border-transparent text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300 hover:border-gray-300 dark:hover:border-gray-600'
              } whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm`}
            >
              🔧 Advanced
            </button>
          </nav>
        </div>

        {/* General Tab */}
        {activeTab === 'general' && (
          <div className="space-y-6">
            <div className="card p-6 dark:bg-gray-800">
              <h2 className="text-xl font-semibold mb-6 dark:text-gray-100">General Settings</h2>

              {/* Theme */}
              <div className="mb-6">
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">
                  Theme
                </label>
                <div className="grid grid-cols-3 gap-3">
                  {(['light', 'dark', 'system'] as const).map((themeOption) => (
                    <button
                      key={themeOption}
                      onClick={() => setTheme(themeOption)}
                      className={`px-4 py-3 text-sm font-medium rounded-lg border-2 transition-colors ${
                        theme === themeOption
                          ? 'border-primary-500 bg-primary-50 dark:bg-primary-900/30 text-primary-700 dark:text-primary-300'
                          : 'border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 hover:border-gray-400 dark:hover:border-gray-500'
                      }`}
                    >
                      {themeOption === 'light' && '☀️ Light'}
                      {themeOption === 'dark' && '🌙 Dark'}
                      {themeOption === 'system' && '💻 System'}
                    </button>
                  ))}
                </div>
              </div>

              {/* Email Density */}
              <div className="pt-6 border-t border-gray-200 dark:border-gray-700">
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">
                  Email List Density
                </label>
                <div className="grid grid-cols-3 gap-3">
                  {(Object.keys(DENSITY_CONFIGS) as DensityLevel[]).map((densityOption) => {
                    const config = DENSITY_CONFIGS[densityOption];
                    return (
                      <button
                        key={densityOption}
                        onClick={() => setDensity(densityOption)}
                        className={`px-4 py-3 text-sm font-medium rounded-lg border-2 transition-colors text-left ${
                          density === densityOption
                            ? 'border-primary-500 bg-primary-50 dark:bg-primary-900/30 text-primary-700 dark:text-primary-300'
                            : 'border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 hover:border-gray-400 dark:hover:border-gray-500'
                        }`}
                      >
                        <div className="font-semibold">{config.label}</div>
                        <div className="text-xs mt-1 opacity-75">~{config.emailsVisible} emails visible</div>
                      </button>
                    );
                  })}
                </div>
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-3">
                  {DENSITY_CONFIGS[density].description}
                </p>
              </div>

              {/* Reading Layout */}
              <div className="pt-6 border-t border-gray-200 dark:border-gray-700">
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">
                  Reading Layout
                </label>
                <div className="grid grid-cols-3 gap-3">
                  {(Object.keys(LAYOUT_CONFIGS) as LayoutMode[]).map((layoutOption) => {
                    const config = LAYOUT_CONFIGS[layoutOption];
                    return (
                      <button
                        key={layoutOption}
                        onClick={() => setLayout(layoutOption)}
                        className={`px-4 py-3 text-sm font-medium rounded-lg border-2 transition-colors text-left ${
                          layout === layoutOption
                            ? 'border-primary-500 bg-primary-50 dark:bg-primary-900/30 text-primary-700 dark:text-primary-300'
                            : 'border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 hover:border-gray-400 dark:hover:border-gray-500'
                        }`}
                      >
                        <div className="flex items-center space-x-2">
                          <span className="text-lg">{config.icon}</span>
                          <div className="font-semibold">{config.label}</div>
                        </div>
                        <div className="text-xs mt-1 opacity-75">{config.description}</div>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Notifications */}
              <div className="pt-6 border-t border-gray-200 dark:border-gray-700 mt-6">
                <h3 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-4">
                  Notifications
                </h3>
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <p className="text-sm text-gray-700 dark:text-gray-300 font-medium">
                      Desktop Notifications
                    </p>
                    <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                      Get notified about new emails and snooze reminders
                    </p>
                  </div>
                  <button
                    onClick={requestNotificationPermission}
                    disabled={desktopNotifications}
                    className={`px-4 py-2 text-sm font-medium rounded-lg transition-colors ${
                      desktopNotifications
                        ? 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300 cursor-not-allowed'
                        : 'bg-primary-600 text-white hover:bg-primary-700'
                    }`}
                  >
                    {desktopNotifications ? '✓ Enabled' : 'Enable'}
                  </button>
                </div>
              </div>

              {/* App Info */}
              <div className="pt-6 border-t border-gray-200 dark:border-gray-700 mt-6">
                <h3 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">
                  Application Info
                </h3>
                <dl className="grid grid-cols-2 gap-4">
                  <div>
                    <dt className="text-xs text-gray-500 dark:text-gray-400">Version</dt>
                    <dd className="text-sm font-medium text-gray-900 dark:text-gray-100">
                      {config.appVersion}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-xs text-gray-500 dark:text-gray-400">Environment</dt>
                    <dd className="text-sm font-medium text-gray-900 dark:text-gray-100">
                      {config.isDevelopment ? 'Development' : 'Production'}
                    </dd>
                  </div>
                </dl>
              </div>
            </div>
          </div>
        )}

        {/* Accounts Tab */}
        {activeTab === 'accounts' && (
          <div className="space-y-4">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-xl font-semibold dark:text-gray-100">Email Accounts</h2>
              <button onClick={() => setShowWizard(true)} className="btn btn-primary">
                Add Account
              </button>
            </div>

            {accounts && accounts.length > 0 ? (
              <div className="space-y-3">
                {accounts.map((account) => (
                  <div key={account.id} className="card p-4 flex justify-between items-center dark:bg-gray-800">
                    <div>
                      <p className="font-medium text-gray-900 dark:text-gray-100">{account.email}</p>
                      <p className="text-sm text-gray-500 dark:text-gray-400">
                        {account.provider} {account.isDefault && '• Default'}
                      </p>
                    </div>
                    <button
                      onClick={() => deleteAccountMutation.mutate(account.id)}
                      className="btn btn-secondary text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/30"
                    >
                      Remove
                    </button>
                  </div>
                ))}
              </div>
            ) : (
              <div className="card p-12 text-center dark:bg-gray-800">
                <p className="text-gray-500 dark:text-gray-400 mb-4">No email accounts configured</p>
                <button onClick={() => setShowWizard(true)} className="btn btn-primary">
                  Add Your First Account
                </button>
              </div>
            )}
          </div>
        )}

        {/* Signatures Tab */}
        {activeTab === 'signatures' && <SignatureManager />}

        {/* Templates Tab */}
        {activeTab === 'templates' && <TemplateManager />}

        {/* Labels Tab */}
        {activeTab === 'labels' && <LabelManager />}

        {/* Advanced Tab */}
        {activeTab === 'advanced' && (
          <div className="card p-6 dark:bg-gray-800">
            <h2 className="text-xl font-semibold mb-6 dark:text-gray-100">Advanced Settings</h2>

            <div className="space-y-4">
              {/* Debug Mode */}
              <div className="flex items-center justify-between p-4 bg-gray-50 dark:bg-gray-900 rounded-lg">
                <div>
                  <h3 className="text-sm font-medium text-gray-900 dark:text-gray-100">
                    Debug Mode
                  </h3>
                  <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                    {config.enableDebug ? 'Detailed logging enabled' : 'Standard logging'}
                  </p>
                </div>
                <div className="text-sm font-medium text-gray-900 dark:text-gray-100">
                  {config.enableDebug ? '✓ On' : 'Off'}
                </div>
              </div>

              {/* Error Logs */}
              <div className="flex items-center justify-between p-4 bg-gray-50 dark:bg-gray-900 rounded-lg">
                <div>
                  <h3 className="text-sm font-medium text-gray-900 dark:text-gray-100">
                    Error Logs
                  </h3>
                  <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                    View application error history
                  </p>
                </div>
                <button
                  onClick={viewErrorLogs}
                  className="px-4 py-2 text-sm font-medium text-primary-600 dark:text-primary-400 hover:underline"
                >
                  View Logs
                </button>
              </div>

              {/* Export Data */}
              <div className="flex items-center justify-between p-4 bg-gray-50 dark:bg-gray-900 rounded-lg">
                <div>
                  <h3 className="text-sm font-medium text-gray-900 dark:text-gray-100">
                    Export Data
                  </h3>
                  <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                    Backup all settings, signatures, templates
                  </p>
                </div>
                <button
                  onClick={exportAllData}
                  className="px-4 py-2 text-sm font-medium bg-primary-600 text-white hover:bg-primary-700 rounded-lg transition-colors"
                >
                  💾 Export
                </button>
              </div>

              {/* Clear Cache */}
              <div className="flex items-center justify-between p-4 bg-gray-50 dark:bg-gray-900 rounded-lg">
                <div>
                  <h3 className="text-sm font-medium text-gray-900 dark:text-gray-100">
                    Clear Cache
                  </h3>
                  <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                    Clear cached data and reload
                  </p>
                </div>
                <button
                  onClick={() => window.location.reload()}
                  className="px-4 py-2 text-sm font-medium text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/30 rounded-lg transition-colors"
                >
                  🗑️ Clear
                </button>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Account Wizard Modal */}
      {showWizard && <AccountWizard onClose={() => setShowWizard(false)} />}
    </Layout>
  );
}
