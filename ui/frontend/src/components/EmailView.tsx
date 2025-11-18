import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/services/api';
import { toast } from '@/store/toastStore';
import type { Email } from '@/types';
import { EmailViewSkeleton } from './Skeleton';
import EmailViewToolbar from './EmailViewToolbar';
import { formatEmailDateDetailed, formatBytes, formatRecipients } from '@/utils/format';
import { useLabelStore } from '@/store/labelStore';
import LabelChip from './LabelChip';
import LabelPicker from './LabelPicker';
import Avatar, { AvatarGroup } from './Avatar';
import { useContactStore } from '@/store/contactStore';
import { useActionHistoryStore } from '@/store/actionHistoryStore';

interface EmailViewProps {
  emailId: string;
  onBack?: () => void;
  onReply?: (email: Email) => void;
  onReplyAll?: (email: Email) => void;
  onForward?: (email: Email) => void;
  onDeleteAndNext?: () => void;
  onNextEmail?: () => void;
  onPreviousEmail?: () => void;
}

export default function EmailView({ emailId, onBack, onReply, onReplyAll, onForward, onDeleteAndNext, onNextEmail, onPreviousEmail }: EmailViewProps) {
  const queryClient = useQueryClient();
  const [showLabelPicker, setShowLabelPicker] = useState(false);
  const { getLabelsForEmail, removeLabelFromEmail } = useLabelStore();
  const { recordInteraction } = useContactStore();
  const { addAction, undo } = useActionHistoryStore();

  const { data: email, isLoading } = useQuery({
    queryKey: ['email', emailId],
    queryFn: () => api.getEmail(emailId),
  });

  const starMutation = useMutation({
    mutationFn: (isStarred: boolean) => api.markEmailStarred(emailId, isStarred),
    onMutate: async (isStarred) => {
      // Cancel outgoing queries
      await queryClient.cancelQueries({ queryKey: ['email', emailId] });

      // Snapshot previous value
      const previousEmail = queryClient.getQueryData(['email', emailId]);

      // Optimistically update the cache
      queryClient.setQueryData(['email', emailId], (old: any) => ({
        ...old,
        isStarred,
      }));

      return { previousEmail, isStarred };
    },
    onError: (err, variables, context) => {
      // Rollback on error
      if (context?.previousEmail) {
        queryClient.setQueryData(['email', emailId], context.previousEmail);
      }
      toast.error('Failed to update email');
    },
    onSuccess: (_, isStarred, context) => {
      const wasStarred = !isStarred;

      // Add to undo history
      addAction({
        type: isStarred ? 'star' : 'unstar',
        emailIds: [emailId],
        previousState: { wasStarred },
        undo: async () => {
          await api.markEmailStarred(emailId, wasStarred);
          queryClient.invalidateQueries({ queryKey: ['email', emailId] });
          queryClient.invalidateQueries({ queryKey: ['emails'] });
        },
        redo: async () => {
          await api.markEmailStarred(emailId, isStarred);
          queryClient.invalidateQueries({ queryKey: ['email', emailId] });
          queryClient.invalidateQueries({ queryKey: ['emails'] });
        },
        description: isStarred ? 'Starred email' : 'Unstarred email',
      });

      toast.success(
        isStarred ? 'Email starred' : 'Email unstarred',
        5000,
        {
          label: 'Undo',
          onClick: () => undo(),
        }
      );
    },
    onSettled: () => {
      // Always refetch to ensure consistency
      queryClient.invalidateQueries({ queryKey: ['email', emailId] });
      queryClient.invalidateQueries({ queryKey: ['emails'] });
    },
  });

  const markReadMutation = useMutation({
    mutationFn: (isRead: boolean) => api.markEmailRead(emailId, isRead),
    onMutate: async (isRead) => {
      // Cancel outgoing queries
      await queryClient.cancelQueries({ queryKey: ['email', emailId] });

      // Snapshot previous value
      const previousEmail = queryClient.getQueryData(['email', emailId]);

      // Optimistically update the cache
      queryClient.setQueryData(['email', emailId], (old: any) => ({
        ...old,
        isRead,
      }));

      return { previousEmail, isRead };
    },
    onError: (err, variables, context) => {
      // Rollback on error
      if (context?.previousEmail) {
        queryClient.setQueryData(['email', emailId], context.previousEmail);
      }
      toast.error('Failed to update email');
    },
    onSuccess: (_, isRead, context) => {
      const wasRead = !isRead;

      // Add to undo history
      addAction({
        type: isRead ? 'mark_read' : 'mark_unread',
        emailIds: [emailId],
        previousState: { wasRead },
        undo: async () => {
          await api.markEmailRead(emailId, wasRead);
          queryClient.invalidateQueries({ queryKey: ['email', emailId] });
          queryClient.invalidateQueries({ queryKey: ['emails'] });
        },
        redo: async () => {
          await api.markEmailRead(emailId, isRead);
          queryClient.invalidateQueries({ queryKey: ['email', emailId] });
          queryClient.invalidateQueries({ queryKey: ['emails'] });
        },
        description: isRead ? 'Marked as read' : 'Marked as unread',
      });

      toast.success(
        isRead ? 'Marked as read' : 'Marked as unread',
        5000,
        {
          label: 'Undo',
          onClick: () => undo(),
        }
      );
    },
    onSettled: () => {
      // Always refetch to ensure consistency
      queryClient.invalidateQueries({ queryKey: ['email', emailId] });
      queryClient.invalidateQueries({ queryKey: ['emails'] });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: () => api.deleteEmail(emailId),
    onSuccess: () => {
      // Store email data for undo
      const deletedEmail = email;

      // Add to undo history
      addAction({
        type: 'delete',
        emailIds: [emailId],
        previousState: { email: deletedEmail },
        undo: async () => {
          // Note: This requires a restore API endpoint to truly restore
          // For now, we just invalidate queries to show the email again
          queryClient.invalidateQueries({ queryKey: ['emails'] });
          queryClient.invalidateQueries({ queryKey: ['email', emailId] });
          toast.success('Email restored');
        },
        description: 'Deleted email',
      });

      queryClient.invalidateQueries({ queryKey: ['emails'] });

      toast.success(
        'Email deleted',
        5000,
        {
          label: 'Undo',
          onClick: () => undo(),
        }
      );

      onBack?.();
    },
    onError: () => {
      toast.error('Failed to delete email');
    },
  });

  const handlePrint = () => {
    window.print();
  };

  if (isLoading) {
    return <EmailViewSkeleton />;
  }

  if (!email) {
    return (
      <div className="flex items-center justify-center h-full text-gray-500">
        Email not found
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col email-print-view">
      {/* Toolbar */}
      <div className="no-print">
        <EmailViewToolbar
          email={email}
          onBack={() => onBack?.()}
          onDelete={() => deleteMutation.mutate()}
          onStar={() => starMutation.mutate(!email.isStarred)}
          onMarkRead={() => markReadMutation.mutate(!email.isRead)}
          onReply={() => onReply?.(email)}
          onReplyAll={() => onReplyAll?.(email)}
          onForward={() => onForward?.(email)}
          onPrint={handlePrint}
          onDeleteAndNext={onDeleteAndNext}
          onNextEmail={onNextEmail}
          onPreviousEmail={onPreviousEmail}
        />
      </div>

      {/* Header */}
      <div className="bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 p-6 email-metadata">
        <h1 className="text-2xl font-semibold text-gray-900 dark:text-gray-100 mb-4">{email.subject}</h1>

        <div className="space-y-3 text-sm">
          {/* From with Avatar */}
          <div className="flex items-center space-x-3">
            <span className="font-medium text-gray-700 dark:text-gray-300 w-16 flex-shrink-0">From:</span>
            <Avatar
              email={email.from.address}
              name={email.from.name}
              size="lg"
            />
            <span className="text-gray-900 dark:text-gray-100">
              {email.from.name ? `${email.from.name} <${email.from.address}>` : email.from.address}
            </span>
          </div>
          {/* Track interaction */}
          {(() => {
            recordInteraction(email.from.address, email.from.name);
            // Track recipient interactions as well
            email.to.forEach(to => recordInteraction(to.address, to.name));
            if (email.cc) {
              email.cc.forEach(cc => recordInteraction(cc.address, cc.name));
            }
            return null;
          })()}

          {/* To with Avatar Group */}
          <div className="flex items-center space-x-3">
            <span className="font-medium text-gray-700 dark:text-gray-300 w-16 flex-shrink-0">To:</span>
            <AvatarGroup
              emails={email.to.map(t => ({ email: t.address, name: t.name }))}
              max={3}
              size="sm"
            />
            <span className="text-gray-900 dark:text-gray-100" title={email.to.map((t) => t.name ? `${t.name} <${t.address}>` : t.address).join(', ')}>
              {email.to.length > 3 ? formatRecipients(email.to, 3) : email.to.map((t) => t.name ? `${t.name} <${t.address}>` : t.address).join(', ')}
            </span>
          </div>

          {/* Cc with Avatar Group */}
          {email.cc && email.cc.length > 0 && (
            <div className="flex items-center space-x-3">
              <span className="font-medium text-gray-700 dark:text-gray-300 w-16 flex-shrink-0">Cc:</span>
              <AvatarGroup
                emails={email.cc.map(c => ({ email: c.address, name: c.name }))}
                max={3}
                size="sm"
              />
              <span className="text-gray-900 dark:text-gray-100" title={email.cc.map((c) => c.name ? `${c.name} <${c.address}>` : c.address).join(', ')}>
                {email.cc.length > 3 ? formatRecipients(email.cc, 3) : email.cc.map((c) => c.name ? `${c.name} <${c.address}>` : c.address).join(', ')}
              </span>
            </div>
          )}

          <div className="flex">
            <span className="font-medium text-gray-700 dark:text-gray-300 w-16">Date:</span>
            <span className="text-gray-900 dark:text-gray-100">
              {formatEmailDateDetailed(email.date)}
            </span>
          </div>

          {email.size > 0 && (
            <div className="flex">
              <span className="font-medium text-gray-700 dark:text-gray-300 w-16">Size:</span>
              <span className="text-gray-900 dark:text-gray-100">
                {formatBytes(email.size)}
              </span>
            </div>
          )}

          {email.folder && (
            <div className="flex">
              <span className="font-medium text-gray-700 dark:text-gray-300 w-16">Folder:</span>
              <span className="text-gray-900 dark:text-gray-100">
                {email.folder.name}
              </span>
            </div>
          )}
        </div>

        {/* Labels Section */}
        <div className="mt-4">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-medium text-gray-700 dark:text-gray-300">Labels</span>
            <button
              onClick={() => setShowLabelPicker(true)}
              className="flex items-center space-x-1 text-sm text-primary-600 dark:text-primary-400 hover:text-primary-700 dark:hover:text-primary-300 transition-colors"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M12 4v16m8-8H4"
                />
              </svg>
              <span>Add Label</span>
            </button>
          </div>
          {(() => {
            const emailLabels = getLabelsForEmail(emailId);
            if (emailLabels.length > 0) {
              return (
                <div className="flex flex-wrap gap-2">
                  {emailLabels.map((label) => (
                    <LabelChip
                      key={label.id}
                      label={label}
                      size="md"
                      removable
                      onRemove={() => removeLabelFromEmail(emailId, label.id)}
                    />
                  ))}
                </div>
              );
            } else {
              return (
                <p className="text-sm text-gray-500 dark:text-gray-400">
                  No labels applied. Click "Add Label" to organize this email.
                </p>
              );
            }
          })()}
        </div>

        {email.attachments && email.attachments.length > 0 && (
          <div className="mt-4 attachments-list">
            <div className="flex items-center justify-between mb-2">
              <p className="text-sm font-medium text-gray-700 dark:text-gray-300">
                Attachments ({email.attachments.length})
              </p>
              <span className="text-xs text-gray-500 dark:text-gray-400">
                Total: {formatBytes(email.attachments.reduce((sum, att) => sum + att.size, 0))}
              </span>
            </div>
            <div className="flex flex-wrap gap-2">
              {email.attachments.map((attachment) => (
                <div
                  key={attachment.id}
                  className="flex items-center space-x-2 px-3 py-2 bg-gray-100 dark:bg-gray-700 rounded text-sm"
                >
                  <span>📎</span>
                  <span className="text-gray-900 dark:text-gray-100">{attachment.filename}</span>
                  <span className="text-gray-500 dark:text-gray-400">
                    ({formatBytes(attachment.size)})
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Body */}
      <div className="flex-1 overflow-y-auto p-6 bg-white dark:bg-gray-800 email-content">
        {email.bodyHtml ? (
          <div
            className="prose dark:prose-invert max-w-none"
            dangerouslySetInnerHTML={{ __html: email.bodyHtml }}
          />
        ) : (
          <pre className="whitespace-pre-wrap font-sans text-gray-900 dark:text-gray-100">
            {email.bodyText}
          </pre>
        )}
      </div>

      {/* Label Picker Modal */}
      {showLabelPicker && (
        <LabelPicker
          emailId={emailId}
          onClose={() => setShowLabelPicker(false)}
        />
      )}
    </div>
  );
}
