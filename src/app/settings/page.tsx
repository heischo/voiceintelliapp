'use client';

import Link from 'next/link';
import { SettingsPanel } from '../../components/SettingsPanel';
import { useSettings } from '../../hooks/useSettings';

export default function SettingsPage() {
  const { settings, isLoading, updateSettings } = useSettings();

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b border-secondary">
        <div className="max-w-4xl mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Link
              href="/"
              className="text-text-muted hover:text-text transition-colors"
            >
              <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
            </Link>
            <h1 className="text-xl font-bold text-text">Settings</h1>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-2xl mx-auto px-4 py-8">
        {isLoading ? (
          <div className="flex items-center justify-center h-64">
            <div className="animate-spin rounded-full h-8 w-8 border-2 border-primary border-t-transparent" />
          </div>
        ) : (
          <SettingsPanel
            settings={settings}
            onSave={updateSettings}
            isLoading={isLoading}
          />
        )}
      </main>
    </div>
  );
}
