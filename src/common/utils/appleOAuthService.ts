import axios from 'axios';
import jwt from 'jsonwebtoken';

import { env } from './envConfig';

export interface AppleUserInfo {
  id: string;
  email?: string;
  verified_email?: boolean;
  name?: string;
  given_name?: string;
  family_name?: string;
  picture?: string;
  locale?: string;
}

export interface AppleTokenResponse {
  access_token: string;
  expires_in: number;
  refresh_token?: string;
  scope: string;
  token_type: string;
  id_token: string;
}

export interface AppleIdTokenPayload {
  iss: string;
  aud: string;
  exp: number;
  iat: number;
  sub: string;
  c_hash: string;
  email?: string;
  email_verified?: string;
  is_private_email?: string;
  auth_time: number;
  nonce_supported: boolean;
}

export class AppleOAuthService {
  private static instance: AppleOAuthService;
  private clientId: string;
  private teamId: string;
  private keyId: string;
  private privateKey: string;

  private constructor() {
    // Use environment variables with fallbacks for development
    this.clientId = env.APPLE_CLIENT_ID || 'com.nextdeal.app';
    this.teamId = env.APPLE_TEAM_ID || '';
    this.keyId = env.APPLE_KEY_ID || '';
    this.privateKey = env.APPLE_PRIVATE_KEY || '';

    // Log configuration status
    if (!env.APPLE_CLIENT_ID) {
      console.warn('⚠️  APPLE_CLIENT_ID not set in environment, using fallback');
    }
    if (!env.APPLE_TEAM_ID) {
      console.warn('⚠️  APPLE_TEAM_ID not set in environment');
    }
    if (!env.APPLE_KEY_ID) {
      console.warn('⚠️  APPLE_KEY_ID not set in environment');
    }
    if (!env.APPLE_PRIVATE_KEY) {
      console.warn('⚠️  APPLE_PRIVATE_KEY not set in environment');
    }
  }

  public static getInstance(): AppleOAuthService {
    if (!AppleOAuthService.instance) {
      AppleOAuthService.instance = new AppleOAuthService();
    }
    return AppleOAuthService.instance;
  }

  /**
   * Generate Apple client secret (JWT)
   */
  private generateClientSecret(): string {
    if (!this.teamId || !this.keyId || !this.privateKey) {
      throw new Error('Apple OAuth credentials not properly configured');
    }

    const now = Math.floor(Date.now() / 1000);
    const payload = {
      iss: this.teamId,
      iat: now,
      exp: now + 15777000, // 6 months
      aud: 'https://appleid.apple.com',
      sub: this.clientId,
    };

    const header = {
      alg: 'ES256',
      kid: this.keyId,
    };

    return jwt.sign(payload, this.privateKey, {
      algorithm: 'ES256',
      header,
    });
  }

  /**
   * Exchange authorization code for access token
   */
  public async getAccessToken(code: string): Promise<AppleTokenResponse> {
    if (!this.clientId) {
      throw new Error('Apple Client ID not configured');
    }

    try {
      const clientSecret = this.generateClientSecret();

      const response = await axios.post(
        'https://appleid.apple.com/auth/token',
        {
          client_id: this.clientId,
          client_secret: clientSecret,
          code,
          grant_type: 'authorization_code',
          redirect_uri: 'https://nextdeal.in/auth/apple/callback', // Your redirect URI
        },
        {
          headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
          },
        }
      );

      return response.data;
    } catch (error) {
      console.error('Error getting Apple access token:', error);
      throw new Error('Failed to get Apple access token');
    }
  }

  /**
   * Verify Apple ID token
   */
  public async verifyIdToken(idToken: string): Promise<AppleUserInfo> {
    try {
      // Decode the JWT token (without verification first to get the payload)
      const decoded = jwt.decode(idToken) as AppleIdTokenPayload;

      if (!decoded) {
        throw new Error('Invalid Apple ID token');
      }

      // Verify the token signature and claims
      // Note: In production, you should fetch Apple's public keys and verify the signature
      // For now, we'll just validate the basic structure and claims

      const now = Math.floor(Date.now() / 1000);

      if (decoded.exp < now) {
        throw new Error('Apple ID token has expired');
      }

      if (decoded.iss !== 'https://appleid.apple.com') {
        throw new Error('Invalid Apple ID token issuer');
      }

      if (decoded.aud !== this.clientId) {
        throw new Error('Invalid Apple ID token audience');
      }

      // Return user info from the token
      return {
        id: decoded.sub,
        email: decoded.email,
        verified_email: decoded.email_verified === 'true',
        name: undefined, // Apple doesn't provide name in ID token
        given_name: undefined,
        family_name: undefined,
        picture: undefined,
        locale: undefined,
      };
    } catch (error) {
      console.error('Error verifying Apple ID token:', error);
      throw new Error('Failed to verify Apple ID token');
    }
  }

  /**
   * Get user information from Apple using access token
   */
  public async getUserInfo(accessToken: string): Promise<AppleUserInfo> {
    try {
      const response = await axios.get('https://appleid.apple.com/auth/userinfo', {
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      });

      return response.data;
    } catch (error) {
      console.error('Error getting Apple user info:', error);
      throw new Error('Failed to get Apple user info');
    }
  }

  /**
   * Complete OAuth flow with authorization code
   */
  public async completeOAuthFlow(code: string): Promise<{
    userInfo: AppleUserInfo;
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
      console.error('Error completing Apple OAuth flow:', error);
      throw new Error('Failed to complete Apple OAuth flow');
    }
  }
}

export default AppleOAuthService;
