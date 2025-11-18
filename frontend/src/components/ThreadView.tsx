import { useState } from 'react';
import type { EmailThread } from '@/utils/threading';
import { formatParticipants } from '@/utils/threading';
import LabelChip from './LabelChip';
import { useLabelStore } from '@/store/labelStore';

interface ThreadViewProps {
  thread: EmailThread;
  onSelectEmail: (emailId: string) => void;
  selectedEmailId: string | null;
  isExpanded?: boolean;
}

export default function ThreadView({
  thread,
  onSelectEmail,
  selectedEmailId,
  isExpanded = false,
}: ThreadViewProps) {
  const [expanded, setExpanded] = useState(isExpanded);
  const { getLabelsForEmail } = useLabelStore();

  // Get the latest email (shown when collapsed)
  const latestEmail = thread.emails[thread.emails.length - 1];

  // Get all labels for the thread
  const allLabels = new Set<string>();
  thread.emails.forEach((email) => {
    getLabelsForEmail(email.id).forEach((label) => allLabels.add(label.id));
  });
  const threadLabels = Array.from(allLabels)
    .map((labelId) => {
      const email = thread.emails.find((e) =>
        getLabelsForEmail(e.id).some((l) => l.id === labelId)
      );
      return email ? getLabelsForEmail(email.id).find((l) => l.id === labelId) : null;
    })
    .filter((label): label is NonNullable<typeof label> => label !== null);

  const handleThreadClick = (e: React.MouseEvent) => {
    // If clicking on the thread header, toggle expansion
    if ((e.target as HTMLElement).closest('.thread-header')) {
      setExpanded(!expanded);
      e.stopPropagation();
    }
  };

  const handleEmailClick = (emailId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    onSelectEmail(emailId);
  };

  return (
    <div
      className={`border-b border-gray-200 dark:border-gray-700 transition-all ${
        selectedEmailId === latestEmail.id && !expanded ? 'bg-primary-50 dark:bg-primary-900/30' : ''
      }`}
    >
      {/* Thread Header - Always Visible */}
      <div
        className="thread-header px-4 py-3 hover:bg-gray-50 dark:hover:bg-gray-700 cursor-pointer transition-colors"
        onClick={handleThreadClick}
      >
        <div className="flex items-start justify-between mb-1">
          <div className="flex items-center space-x-2 flex-1 min-w-0">
            {/* Expand/Collapse Icon */}
            <button
              className="flex-shrink-0 text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300"
              aria-label={expanded ? 'Collapse thread' : 'Expand thread'}
            >
              <svg
                className={`w-4 h-4 transition-transform ${expanded ? 'rotate-90' : ''}`}
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M9 5l7 7-7 7"
                />
              </svg>
            </button>

            {/* Participants */}
            <span className={`text-sm flex-1 truncate ${!latestEmail.isRead ? 'font-bold' : ''} text-gray-900 dark:text-gray-100`}>
              {formatParticipants(thread.participants, 2)}
            </span>
          </div>

          {/* Metadata */}
          <div className="flex items-center space-x-2 ml-2 flex-shrink-0">
            {thread.messageCount > 1 && (
              <span className="text-xs bg-gray-200 dark:bg-gray-600 text-gray-700 dark:text-gray-300 px-2 py-0.5 rounded-full">
                {thread.messageCount}
              </span>
            )}
            {thread.unreadCount > 0 && (
              <span className="text-xs bg-primary-500 text-white px-2 py-0.5 rounded-full">
                {thread.unreadCount} new
              </span>
            )}
            {thread.isStarred && <span className="text-yellow-500">⭐</span>}
            {thread.hasAttachments && <span className="text-gray-500 dark:text-gray-400">📎</span>}
            <span className="text-xs text-gray-500 dark:text-gray-400">
              {new Date(thread.lastMessageDate).toLocaleDateString()}
            </span>
          </div>
        </div>

        {/* Subject */}
        <div className={`text-sm ml-6 mb-1 ${!latestEmail.isRead ? 'font-semibold' : ''} text-gray-900 dark:text-gray-100`}>
          {thread.subject}
        </div>

        {/* Preview (only when collapsed) */}
        {!expanded && (
          <>
            <div className="text-xs text-gray-500 dark:text-gray-400 ml-6 truncate">
              {thread.preview}
            </div>

            {/* Thread Labels */}
            {threadLabels.length > 0 && (
              <div className="flex flex-wrap gap-1 mt-2 ml-6">
                {threadLabels.slice(0, 3).map((label) => (
                  <LabelChip key={label.id} label={label} size="sm" />
                ))}
                {threadLabels.length > 3 && (
                  <span className="text-xs text-gray-500 dark:text-gray-400">
                    +{threadLabels.length - 3} more
                  </span>
                )}
              </div>
            )}
          </>
        )}
      </div>

      {/* Expanded Thread Timeline */}
      {expanded && (
        <div className="ml-6 border-l-2 border-gray-200 dark:border-gray-700">
          {thread.emails.map((email, index) => {
            const isSelected = selectedEmailId === email.id;
            const emailLabels = getLabelsForEmail(email.id);
            const isLast = index === thread.emails.length - 1;

            return (
              <div
                key={email.id}
                className={`relative pl-6 pr-4 py-3 hover:bg-gray-50 dark:hover:bg-gray-700 cursor-pointer transition-colors ${
                  isSelected ? 'bg-primary-50 dark:bg-primary-900/30' : ''
                }`}
                onClick={(e) => handleEmailClick(email.id, e)}
              >
                {/* Timeline Dot */}
                <div className="absolute left-0 top-5 w-2 h-2 -translate-x-1/2 rounded-full bg-gray-400 dark:bg-gray-500" />

                {/* Email Header */}
                <div className="flex items-start justify-between mb-1">
                  <div className="flex-1 min-w-0">
                    <div className={`text-sm truncate ${!email.isRead ? 'font-bold' : ''} text-gray-900 dark:text-gray-100`}>
                      {email.from.name || email.from.address}
                    </div>
                    <div className="text-xs text-gray-500 dark:text-gray-400">
                      to {email.to.map((t) => t.name || t.address).join(', ')}
                    </div>
                  </div>
                  <div className="flex items-center space-x-2 ml-2 flex-shrink-0">
                    {email.isStarred && <span className="text-yellow-500 text-sm">⭐</span>}
                    <span className="text-xs text-gray-500 dark:text-gray-400">
                      {new Date(email.date).toLocaleString(undefined, {
                        month: 'short',
                        day: 'numeric',
                        hour: 'numeric',
                        minute: '2-digit',
                      })}
                    </span>
                  </div>
                </div>

                {/* Email Preview */}
                <div className="text-xs text-gray-600 dark:text-gray-400 truncate mb-1">
                  {email.bodyText?.substring(0, 100)}
                </div>

                {/* Email Labels */}
                {emailLabels.length > 0 && (
                  <div className="flex flex-wrap gap-1 mt-1">
                    {emailLabels.slice(0, 3).map((label) => (
                      <LabelChip key={label.id} label={label} size="sm" />
                    ))}
                    {emailLabels.length > 3 && (
                      <span className="text-xs text-gray-500 dark:text-gray-400">
                        +{emailLabels.length - 3}
                      </span>
                    )}
                  </div>
                )}

                {/* Attachments Indicator */}
                {email.attachments && email.attachments.length > 0 && (
                  <div className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                    📎 {email.attachments.length} attachment{email.attachments.length > 1 ? 's' : ''}
                  </div>
                )}

                {/* Unread Indicator */}
                {!email.isRead && (
                  <div className="absolute right-4 top-3">
                    <div className="w-2 h-2 bg-primary-500 rounded-full" />
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
