import axios from 'axios';

import { env } from './envConfig';

export interface GoogleUserInfo {
  id: string;
  email: string;
  verified_email: boolean;
  name: string;
  given_name: string;
  family_name: string;
  picture: string;
  locale: string;
}

export interface GoogleTokenResponse {
  access_token: string;
  expires_in: number;
  refresh_token?: string;
  scope: string;
  token_type: string;
  id_token: string;
}

export class GoogleOAuthService {
  private static instance: GoogleOAuthService;
  private clientId: string;
  private clientSecret: string;
  private redirectUri: string;

  private constructor() {
    // Use environment variables with fallbacks for development
    this.clientId = env.GOOGLE_CLIENT_ID || '288338485924-oan74irqmh3p7o4pu5ghgf7fle2aeitq.apps.googleusercontent.com';
    this.clientSecret = env.GOOGLE_CLIENT_SECRET || '';
    this.redirectUri = env.GOOGLE_REDIRECT_URI || 'http://localhost:3000/auth/google/callback';

    // Log configuration status
    if (!env.GOOGLE_CLIENT_ID) {
      console.warn('⚠️  GOOGLE_CLIENT_ID not set in environment, using fallback');
    }
    if (!env.GOOGLE_CLIENT_SECRET) {
      console.warn('⚠️  GOOGLE_CLIENT_SECRET not set in environment');
    }
  }

  public static getInstance(): GoogleOAuthService {
    if (!GoogleOAuthService.instance) {
      GoogleOAuthService.instance = new GoogleOAuthService();
    }
    return GoogleOAuthService.instance;
  }

  /**
   * Get Google OAuth URL for authorization
   */
  public getAuthUrl(state?: string): string {
    if (!this.clientId) {
      throw new Error('Google Client ID not configured');
    }

    const params = new URLSearchParams({
      client_id: this.clientId,
      redirect_uri: this.redirectUri,
      response_type: 'code',
      scope: 'openid email profile',
      access_type: 'offline',
      prompt: 'consent',
    });

    if (state) {
      params.append('state', state);
    }

    return `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`;
  }

  /**
   * Exchange authorization code for access token
   */
  public async getAccessToken(code: string): Promise<GoogleTokenResponse> {
    if (!this.clientId || !this.clientSecret) {
      throw new Error('Google OAuth credentials not properly configured');
    }

    try {
      const response = await axios.post('https://oauth2.googleapis.com/token', {
        client_id: this.clientId,
        client_secret: this.clientSecret,
        code,
        grant_type: 'authorization_code',
        redirect_uri: this.redirectUri,
      });

      return response.data;
    } catch (error) {
      console.error('Error getting Google access token:', error);
      throw new Error('Failed to get Google access token');
    }
  }

  /**
   * Get user information from Google using access token
   */
  public async getUserInfo(accessToken: string): Promise<GoogleUserInfo> {
    try {
      const response = await axios.get('https://www.googleapis.com/oauth2/v2/userinfo', {
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      });

      return response.data;
    } catch (error) {
      console.error('Error getting Google user info:', error);
      throw new Error('Failed to get Google user info');
    }
  }

  /**
   * Verify Google ID token
   */
  public async verifyIdToken(idToken: string): Promise<GoogleUserInfo> {
    try {
      const response = await axios.get(`https://oauth2.googleapis.com/tokeninfo?id_token=${idToken}`);
      return response.data;
    } catch (error) {
      console.error('Error verifying Google ID token:', error);
      throw new Error('Failed to verify Google ID token');
    }
  }

  /**
   * Complete OAuth flow with authorization code
   */
  public async completeOAuthFlow(code: string): Promise<{
    userInfo: GoogleUserInfo;
    accessToken: string;
  }> {
    try {
      // Get access token
      const tokenResponse = await this.getAccessToken(code);

      // Get user info
      const userInfo = await this.getUserInfo(tokenResponse.access_token);

      return {
        userInfo,
        accessToken: tokenResponse.access_token,
      };
    } catch (error) {
      console.error('Error completing Google OAuth flow:', error);
      throw new Error('Failed to complete Google OAuth flow');
    }
  }
}

export default GoogleOAuthService;
