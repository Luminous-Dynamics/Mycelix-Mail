import axios, { AxiosInstance, AxiosError } from 'axios';
import type {
  User,
  Email,
  EmailAccount,
  Folder,
  LoginCredentials,
  RegisterData,
  ApiResponse,
} from '@/types';
import { config } from '@/config/env';
import { errorLogger } from './errorLogger';

const API_URL = config.apiUrl;

class ApiService {
  private client: AxiosInstance;

  constructor() {
    this.client = axios.create({
      baseURL: API_URL,
      headers: {
        'Content-Type': 'application/json',
      },
    });

    // Add auth token to requests
    this.client.interceptors.request.use((config) => {
      const token = localStorage.getItem('token');
      if (token) {
        config.headers.Authorization = `Bearer ${token}`;
      }
      return config;
    });

    // Handle errors and log them
    this.client.interceptors.response.use(
      (response) => response,
      (error: AxiosError) => {
        const status = error.response?.status;
        const url = error.config?.url;
        const method = error.config?.method?.toUpperCase();

        // Log API errors
        errorLogger.logError(error, {
          action: 'api_request_failed',
          metadata: {
            url,
            method,
            status,
            statusText: error.response?.statusText,
            data: error.response?.data,
          },
        }, status === 500 ? 'high' : 'medium');

        // Handle 401 errors (unauthorized)
        if (status === 401) {
          localStorage.removeItem('token');
          window.location.href = '/login';
        }

        return Promise.reject(error);
      }
    );
  }

  // Auth endpoints
  async login(credentials: LoginCredentials) {
    const { data } = await this.client.post<ApiResponse<{ user: User; token: string }>>(
      '/api/auth/login',
      credentials
    );
    return data.data;
  }

  async register(userData: RegisterData) {
    const { data } = await this.client.post<ApiResponse<{ user: User; token: string }>>(
      '/api/auth/register',
      userData
    );
    return data.data;
  }

  async getProfile() {
    const { data } = await this.client.get<ApiResponse<{ user: User }>>('/api/auth/me');
    return data.data.user;
  }

  async updateProfile(updates: Partial<User>) {
    const { data } = await this.client.put<ApiResponse<{ user: User }>>('/api/auth/me', updates);
    return data.data.user;
  }

  async changePassword(currentPassword: string, newPassword: string) {
    const { data } = await this.client.put<ApiResponse<{ message: string }>>(
      '/api/auth/password',
      { currentPassword, newPassword }
    );
    return data.data;
  }

  // Email Account endpoints
  async getAccounts() {
    const { data } = await this.client.get<ApiResponse<{ accounts: EmailAccount[] }>>(
      '/api/accounts'
    );
    return data.data.accounts;
  }

  async createAccount(accountData: Partial<EmailAccount> & { imapPassword: string; smtpPassword: string }) {
    const { data } = await this.client.post<ApiResponse<{ account: EmailAccount }>>(
      '/api/accounts',
      accountData
    );
    return data.data.account;
  }

  async updateAccount(accountId: string, updates: Partial<EmailAccount>) {
    const { data } = await this.client.put<ApiResponse<{ account: EmailAccount }>>(
      `/api/accounts/${accountId}`,
      updates
    );
    return data.data.account;
  }

  async deleteAccount(accountId: string) {
    const { data } = await this.client.delete<ApiResponse<{ message: string }>>(
      `/api/accounts/${accountId}`
    );
    return data.data;
  }

  async setDefaultAccount(accountId: string) {
    const { data } = await this.client.put<ApiResponse<{ account: EmailAccount }>>(
      `/api/accounts/${accountId}/default`
    );
    return data.data.account;
  }

  // Folder endpoints
  async getFolders(accountId?: string) {
    const { data } = await this.client.get<ApiResponse<{ folders: Folder[] }>>(
      '/api/folders',
      { params: { accountId } }
    );
    return data.data.folders;
  }

  async createFolder(folderData: { emailAccountId: string; name: string; path: string }) {
    const { data } = await this.client.post<ApiResponse<{ folder: Folder }>>(
      '/api/folders',
      folderData
    );
    return data.data.folder;
  }

  async deleteFolder(folderId: string) {
    const { data } = await this.client.delete<ApiResponse<{ message: string }>>(
      `/api/folders/${folderId}`
    );
    return data.data;
  }

  // Email endpoints
  async getEmails(params?: {
    accountId?: string;
    folderId?: string;
    page?: number;
    limit?: number;
    search?: string;
  }) {
    const { data } = await this.client.get<
      ApiResponse<{ emails: Email[]; pagination: any }>
    >('/api/emails', { params });
    return data.data;
  }

  async getEmail(emailId: string) {
    const { data } = await this.client.get<ApiResponse<{ email: Email }>>(
      `/api/emails/${emailId}`
    );
    return data.data.email;
  }

  async sendEmail(emailData: {
    accountId: string;
    to: string[];
    subject: string;
    body: string;
    cc?: string[];
    bcc?: string[];
    attachments?: any[];
  }) {
    const { data } = await this.client.post<ApiResponse<{ messageId: string }>>(
      '/api/emails',
      emailData
    );
    return data.data;
  }

  async markEmailRead(emailId: string, isRead: boolean) {
    const { data } = await this.client.put<ApiResponse<{ email: Email }>>(
      `/api/emails/${emailId}/read`,
      { isRead }
    );
    return data.data.email;
  }

  async markEmailStarred(emailId: string, isStarred: boolean) {
    const { data } = await this.client.put<ApiResponse<{ email: Email }>>(
      `/api/emails/${emailId}/star`,
      { isStarred }
    );
    return data.data.email;
  }

  async deleteEmail(emailId: string) {
    const { data } = await this.client.delete<ApiResponse<{ message: string }>>(
      `/api/emails/${emailId}`
    );
    return data.data;
  }

  async syncEmails(accountId: string, folderPath: string = 'INBOX') {
    const { data } = await this.client.post<ApiResponse<{ synced: number }>>(
      '/api/emails/sync',
      { accountId, folderPath }
    );
    return data.data;
  }
}

export const api = new ApiService();
