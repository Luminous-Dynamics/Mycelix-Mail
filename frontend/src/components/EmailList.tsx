import { useState, useRef, useImperativeHandle, forwardRef, useMemo, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { api } from '@/services/api';
import type { Email } from '@/types';
import { EmailListSkeleton } from './Skeleton';
import { useDebounce } from '@/hooks/useDebounce';
import { useDensity } from '@/hooks/useDensity';
import { useEmailNavigation } from '@/hooks/useEmailNavigation';
import EmailSortFilter, { type SortBy, type SortOrder, type FilterType } from './EmailSortFilter';
import BulkActionsToolbar from './BulkActionsToolbar';
import EmptyState from './EmptyState';
import { formatEmailDate } from '@/utils/format';
import { useLabelStore } from '@/store/labelStore';
import LabelChip from './LabelChip';
import ThreadView from './ThreadView';
import { groupEmailsIntoThreads } from '@/utils/threading';
import Avatar from './Avatar';
import { useContactStore } from '@/store/contactStore';
import AdvancedSearchPanel from './AdvancedSearchPanel';
import { filterEmailsBySearch } from '@/utils/advancedSearch';

interface EmailListProps {
  folderId: string | null;
  selectedEmailId: string | null;
  onSelectEmail: (emailId: string) => void;
  onBulkMarkRead?: (emailIds: string[], isRead: boolean) => void;
  onBulkStar?: (emailIds: string[], isStarred: boolean) => void;
  onBulkDelete?: (emailIds: string[]) => void;
  bulkOperationsPending?: boolean;
}

export interface EmailListRef {
  focusSearch: () => void;
  clearSelection: () => void;
  getSelectedIds: () => string[];
  selectAll: () => void;
}

const EmailList = forwardRef<EmailListRef, EmailListProps>(
  ({ folderId, selectedEmailId, onSelectEmail, onBulkMarkRead, onBulkStar, onBulkDelete, bulkOperationsPending = false }, ref) => {
    const [searchQuery, setSearchQuery] = useState('');
    const debouncedSearch = useDebounce(searchQuery, 300);
    const searchInputRef = useRef<HTMLInputElement>(null);
    const [sortBy, setSortBy] = useState<SortBy>('date');
    const [sortOrder, setSortOrder] = useState<SortOrder>('desc');
    const [filterType, setFilterType] = useState<FilterType>('all');
    const [selectedEmailIds, setSelectedEmailIds] = useState<Set<string>>(new Set());
    const [showAdvancedSearch, setShowAdvancedSearch] = useState(false);
    const { getLabelsForEmail } = useLabelStore();
    const { recordInteraction } = useContactStore();
    const { config: densityConfig } = useDensity();

    // Conversation threading preference
    const [threadingEnabled, setThreadingEnabled] = useState(() => {
      const saved = localStorage.getItem('conversation-threading');
      return saved ? JSON.parse(saved) : false;
    });

    // Save threading preference when it changes
    useEffect(() => {
      localStorage.setItem('conversation-threading', JSON.stringify(threadingEnabled));
    }, [threadingEnabled]);

    useImperativeHandle(ref, () => ({
      focusSearch: () => {
        searchInputRef.current?.focus();
      },
      clearSelection: () => {
        setSelectedEmailIds(new Set());
      },
      getSelectedIds: () => {
        return Array.from(selectedEmailIds);
      },
      selectAll: () => {
        const allEmails = data?.emails || [];
        const allIds = new Set(allEmails.map((email: Email) => email.id));
        setSelectedEmailIds(allIds);
      },
    }));

  const { data, isLoading } = useQuery({
    queryKey: ['emails', folderId, debouncedSearch],
    queryFn: () => api.getEmails({
      folderId: folderId || undefined,
      search: debouncedSearch || undefined
    }),
    enabled: !!folderId,
  });

  if (!folderId) {
    return (
      <div className="flex items-center justify-center h-full text-gray-500">
        Select a folder to view emails
      </div>
    );
  }

  if (isLoading) {
    return <EmailListSkeleton />;
  }

  const rawEmails = data?.emails || [];

  // Filter emails based on filter type and advanced search
  const filteredEmails = useMemo(() => {
    let filtered = [...rawEmails];

    // Apply filter type
    switch (filterType) {
      case 'unread':
        filtered = filtered.filter((email) => !email.isRead);
        break;
      case 'starred':
        filtered = filtered.filter((email) => email.isStarred);
        break;
      case 'attachments':
        filtered = filtered.filter((email) => email.attachments && email.attachments.length > 0);
        break;
      default:
        // 'all' - no filtering
        break;
    }

    // Apply advanced search if there's a search query
    if (debouncedSearch) {
      filtered = filterEmailsBySearch(filtered, debouncedSearch, getLabelsForEmail);
    }

    return filtered;
  }, [rawEmails, filterType, debouncedSearch, getLabelsForEmail]);

  // Sort emails
  const emails = useMemo(() => {
    const sorted = [...filteredEmails];

    sorted.sort((a, b) => {
      let comparison = 0;

      switch (sortBy) {
        case 'date':
          comparison = new Date(a.date).getTime() - new Date(b.date).getTime();
          break;
        case 'sender':
          comparison = (a.from.name || a.from.address).localeCompare(
            b.from.name || b.from.address
          );
          break;
        case 'subject':
          comparison = a.subject.localeCompare(b.subject);
          break;
      }

      return sortOrder === 'asc' ? comparison : -comparison;
    });

    return sorted;
  }, [filteredEmails, sortBy, sortOrder]);

  // Group into threads if threading is enabled
  const threads = useMemo(() => {
    if (!threadingEnabled) return null;
    return groupEmailsIntoThreads(emails, getLabelsForEmail);
  }, [emails, threadingEnabled, getLabelsForEmail]);

  const hasNoResults = emails.length === 0 && (searchQuery || filterType !== 'all');
  const hasNoEmails = emails.length === 0 && !searchQuery && filterType === 'all';

  // Bulk operation handlers
  const toggleEmailSelection = (emailId: string) => {
    const newSelected = new Set(selectedEmailIds);
    if (newSelected.has(emailId)) {
      newSelected.delete(emailId);
    } else {
      newSelected.add(emailId);
    }
    setSelectedEmailIds(newSelected);
  };

  const handleSelectAll = () => {
    const allIds = new Set(emails.map(email => email.id));
    setSelectedEmailIds(allIds);
  };

  const handleDeselectAll = () => {
    setSelectedEmailIds(new Set());
  };

  const handleBulkMarkRead = () => {
    if (onBulkMarkRead) {
      onBulkMarkRead(Array.from(selectedEmailIds), true);
      setSelectedEmailIds(new Set());
    }
  };

  const handleBulkMarkUnread = () => {
    if (onBulkMarkRead) {
      onBulkMarkRead(Array.from(selectedEmailIds), false);
      setSelectedEmailIds(new Set());
    }
  };

  const handleBulkStar = () => {
    if (onBulkStar) {
      onBulkStar(Array.from(selectedEmailIds), true);
      setSelectedEmailIds(new Set());
    }
  };

  const handleBulkUnstar = () => {
    if (onBulkStar) {
      onBulkStar(Array.from(selectedEmailIds), false);
      setSelectedEmailIds(new Set());
    }
  };

  const handleBulkDelete = () => {
    if (onBulkDelete) {
      onBulkDelete(Array.from(selectedEmailIds));
      setSelectedEmailIds(new Set());
    }
  };

  // Gmail-style keyboard navigation
  const {
    focusedIndex,
    setFocusedIndex,
    handleNext,
    handlePrevious,
    handleOpen,
    handleToggleSelect,
  } = useEmailNavigation({
    emails,
    onSelectEmail,
    selectedEmailId,
    enabled: !threadingEnabled, // Disable when threading is on
  });

  // Keyboard navigation shortcuts (j/k/o/x)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Don't trigger if typing in an input
      if (
        e.target instanceof HTMLInputElement ||
        e.target instanceof HTMLTextAreaElement ||
        showAdvancedSearch
      ) {
        return;
      }

      // Ignore if threading is enabled (not supported yet)
      if (threadingEnabled) return;

      switch (e.key.toLowerCase()) {
        case 'j':
          e.preventDefault();
          handleNext();
          break;
        case 'k':
          e.preventDefault();
          handlePrevious();
          break;
        case 'o':
        case 'enter':
          e.preventDefault();
          handleOpen();
          break;
        case 'x':
          e.preventDefault();
          const emailId = handleToggleSelect();
          if (emailId) {
            toggleEmailSelection(emailId as string);
          }
          break;
        case 'u':
          // Return to list from email view
          if (selectedEmailId) {
            e.preventDefault();
            onSelectEmail(''); // Clear selection
          }
          break;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [
    handleNext,
    handlePrevious,
    handleOpen,
    handleToggleSelect,
    toggleEmailSelection,
    showAdvancedSearch,
    threadingEnabled,
    selectedEmailId,
    onSelectEmail,
  ]);

  return (
    <div className="h-full flex flex-col">
      {/* Search Bar */}
      <div className="p-3 border-b border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 sticky top-0 z-10">
        <div className="flex items-center space-x-2">
          <div className="relative flex-1">
            <input
              ref={searchInputRef}
              type="text"
              placeholder="Search emails... (try: from:user@example.com, has:attachment, is:unread)"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent text-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 placeholder-gray-500 dark:placeholder-gray-400"
            />
            <svg
              className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400 dark:text-gray-500"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
              />
            </svg>
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-300"
                aria-label="Clear search"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            )}
          </div>
          <button
            onClick={() => setShowAdvancedSearch(true)}
            className="px-3 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 rounded-lg transition-colors flex items-center space-x-1"
            title="Advanced Search"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6V4m0 2a2 2 0 100 4m0-4a2 2 0 110 4m-6 8a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4m6 6v10m6-2a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4" />
            </svg>
            <span className="hidden sm:inline">Advanced</span>
          </button>
        </div>
      </div>

      {/* Sort and Filter */}
      <div className="border-b border-gray-200 dark:border-gray-700">
        <div className="flex items-center justify-between px-3 py-2 bg-gray-50 dark:bg-gray-800/50">
          <div className="flex items-center space-x-2">
            <input
              type="checkbox"
              checked={selectedEmailIds.size > 0 && selectedEmailIds.size === emails.length}
              onChange={(e) => e.target.checked ? handleSelectAll() : handleDeselectAll()}
              className="rounded border-gray-300 dark:border-gray-600 text-primary-600 focus:ring-primary-500"
              title="Select all"
            />
            <EmailSortFilter
              sortBy={sortBy}
              sortOrder={sortOrder}
              filterType={filterType}
              onSortChange={(newSortBy, newSortOrder) => {
                setSortBy(newSortBy);
                setSortOrder(newSortOrder);
              }}
              onFilterChange={setFilterType}
            />
          </div>
          {/* Threading Toggle */}
          <button
            onClick={() => setThreadingEnabled(!threadingEnabled)}
            className={`flex items-center space-x-1 px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${
              threadingEnabled
                ? 'bg-primary-100 dark:bg-primary-900/30 text-primary-700 dark:text-primary-300'
                : 'bg-white dark:bg-gray-700 text-gray-700 dark:text-gray-300 border border-gray-300 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-600'
            }`}
            title="Toggle conversation view"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z"
              />
            </svg>
            <span>{threadingEnabled ? 'Conversations' : 'Messages'}</span>
          </button>
        </div>
      </div>

      {/* Bulk Actions Toolbar */}
      <BulkActionsToolbar
        selectedCount={selectedEmailIds.size}
        isPending={bulkOperationsPending}
        onMarkRead={handleBulkMarkRead}
        onMarkUnread={handleBulkMarkUnread}
        onStar={handleBulkStar}
        onUnstar={handleBulkUnstar}
        onDelete={handleBulkDelete}
        onDeselectAll={handleDeselectAll}
      />

      {/* Email List */}
      <div
        className="flex-1 overflow-y-auto divide-y divide-gray-200 dark:divide-gray-700"
        role="list"
        aria-label="Email messages"
      >
        {hasNoEmails && (
          <EmptyState
            icon="📭"
            title="No emails in this folder"
            description="When you receive emails, they will appear here. Your inbox is currently empty."
          />
        )}

        {hasNoResults && (
          <EmptyState
            icon={
              <svg className="w-16 h-16 text-gray-300 dark:text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
            }
            title="No emails found"
            description={
              searchQuery
                ? 'Try different keywords or check your spelling'
                : filterType !== 'all'
                ? `No ${filterType} emails in this folder`
                : 'Try different filters to find what you\'re looking for'
            }
            action={
              (searchQuery || filterType !== 'all') && (
                <button
                  onClick={() => {
                    setSearchQuery('');
                    setFilterType('all');
                  }}
                  className="btn btn-secondary"
                >
                  Clear filters
                </button>
              )
            }
          />
        )}

        {/* Render threads or individual emails */}
        {threadingEnabled && threads ? (
          // Conversation Threading View
          threads.map((thread) => (
            <ThreadView
              key={thread.id}
              thread={thread}
              onSelectEmail={onSelectEmail}
              selectedEmailId={selectedEmailId}
            />
          ))
        ) : (
          // Flat Email List View
          emails.map((email, index) => {
            // Record contact interaction for emails displayed
            if (email.from.address) {
              recordInteraction(email.from.address, email.from.name);
            }

            const isFocused = !threadingEnabled && focusedIndex === index;
            const isSelected = selectedEmailId === email.id;
            const isChecked = selectedEmailIds.has(email.id);

            return (
              <div
                key={email.id}
                data-email-index={index}
                role="listitem"
                aria-label={`Email from ${email.from.name || email.from.address}, subject: ${email.subject}${!email.isRead ? ', unread' : ''}`}
                className={`flex items-start space-x-3 ${densityConfig.padding} hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors relative ${
                  isSelected ? 'bg-primary-50 dark:bg-primary-900/30' : ''
                } ${isChecked ? 'bg-blue-50 dark:bg-blue-900/20' : ''} ${
                  isFocused ? 'ring-2 ring-inset ring-primary-500 dark:ring-primary-400 bg-primary-50/50 dark:bg-primary-900/20' : ''
                }`}
              >
                <input
                  type="checkbox"
                  checked={selectedEmailIds.has(email.id)}
                  onChange={(e) => {
                    e.stopPropagation();
                    toggleEmailSelection(email.id);
                  }}
                  className="mt-1 rounded border-gray-300 dark:border-gray-600 text-primary-600 focus:ring-primary-500"
                  onClick={(e) => e.stopPropagation()}
                  aria-label={`Select email from ${email.from.name || email.from.address}`}
                />
                {/* Avatar */}
                <Avatar
                  email={email.from.address}
                  name={email.from.name}
                  size="md"
                  className="mt-1"
                />
                <button
                  onClick={() => onSelectEmail(email.id)}
                  className={`flex-1 text-left ${!email.isRead ? 'font-semibold' : ''}`}
                  aria-label={`Open email: ${email.subject}`}
                  aria-pressed={selectedEmailId === email.id}
                >
                  <div className="flex items-start justify-between mb-1">
                    <span className={`${densityConfig.textSize} text-gray-900 dark:text-gray-100 truncate flex-1`}>
                      {email.from.name || email.from.address}
                    </span>
                    <span className="text-xs text-gray-500 dark:text-gray-400 ml-2 flex-shrink-0">
                      {formatEmailDate(email.date)}
                    </span>
                  </div>
                <div className={`${densityConfig.textSize} text-gray-900 dark:text-gray-100 truncate mb-1`}>{email.subject}</div>
                <div className="text-xs text-gray-500 dark:text-gray-400 truncate">
                  {email.bodyText?.substring(0, 100)}
                </div>
                {email.attachments && email.attachments.length > 0 && (
                  <div className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                    📎 {email.attachments.length} attachment{email.attachments.length > 1 ? 's' : ''}
                  </div>
                )}
                {(() => {
                  const emailLabels = getLabelsForEmail(email.id);
                  if (emailLabels.length > 0) {
                    return (
                      <div className="flex flex-wrap gap-1 mt-2">
                        {emailLabels.slice(0, 3).map((label) => (
                          <LabelChip
                            key={label.id}
                            label={label}
                            size="sm"
                            clickable={false}
                          />
                        ))}
                        {emailLabels.length > 3 && (
                          <span className="text-xs text-gray-500 dark:text-gray-400 px-2 py-0.5">
                            +{emailLabels.length - 3} more
                          </span>
                        )}
                      </div>
                    );
                  }
                  return null;
                })()}
              </button>
            </div>
            );
          })
        )}
      </div>

      {/* Advanced Search Panel */}
      {showAdvancedSearch && (
        <AdvancedSearchPanel
          onSearch={(query) => setSearchQuery(query)}
          onClose={() => setShowAdvancedSearch(false)}
          initialQuery={searchQuery}
        />
      )}
    </div>
  );
});

EmailList.displayName = 'EmailList';

export default EmailList;
