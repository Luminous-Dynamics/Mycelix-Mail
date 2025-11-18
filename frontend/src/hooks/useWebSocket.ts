import { useEffect, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { websocketService } from '@/services/websocket';
import { useAuthStore } from '@/store/authStore';

export const useWebSocket = () => {
  const [isConnected, setIsConnected] = useState(false);
  const token = useAuthStore((state) => state.token);
  const queryClient = useQueryClient();

  useEffect(() => {
    if (!token) {
      websocketService.disconnect();
      setIsConnected(false);
      return;
    }

    // Connect to WebSocket
    websocketService.connect(token);

    // Handle connection status
    const handleConnected = () => {
      setIsConnected(true);
      console.log('📡 Real-time updates enabled');
    };

    // Handle new email event
    const handleNewEmail = (event: any) => {
      console.log('📧 New email received:', event.data);
      // Invalidate email queries to refetch
      queryClient.invalidateQueries({ queryKey: ['emails'] });
      queryClient.invalidateQueries({ queryKey: ['folders'] });

      // Optional: Show notification
      if ('Notification' in window && Notification.permission === 'granted') {
        new Notification('New Email', {
          body: event.data?.email?.subject || 'You have a new email',
          icon: '/vite.svg',
        });
      }
    };

    // Handle email read event
    const handleEmailRead = (event: any) => {
      console.log('✅ Email marked as read:', event.data?.emailId);
      // Invalidate specific email and folder queries
      if (event.data?.emailId) {
        queryClient.invalidateQueries({ queryKey: ['email', event.data.emailId] });
      }
      queryClient.invalidateQueries({ queryKey: ['emails'] });
      queryClient.invalidateQueries({ queryKey: ['folders'] });
    };

    // Handle errors
    const handleError = (event: any) => {
      console.error('WebSocket error:', event.data || event.message);
      setIsConnected(false);
    };

    // Register event listeners
    websocketService.on('connected', handleConnected);
    websocketService.on('new_email', handleNewEmail);
    websocketService.on('email_read', handleEmailRead);
    websocketService.on('error', handleError);

    // Request notification permission
    if ('Notification' in window && Notification.permission === 'default') {
      Notification.requestPermission();
    }

    // Cleanup on unmount
    return () => {
      websocketService.off('connected', handleConnected);
      websocketService.off('new_email', handleNewEmail);
      websocketService.off('email_read', handleEmailRead);
      websocketService.off('error', handleError);
    };
  }, [token, queryClient]);

  return { isConnected };
};
