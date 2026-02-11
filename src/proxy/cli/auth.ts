import { AuthError } from '@shared/core/errors.js';
import { logger } from '@shared/core/logger.js';
import { OAuth2Client, type Credentials } from 'google-auth-library';

export class GoogleAuthClient {
  private clientId: string;
  private clientSecret: string;
  private creds: Credentials;
  private oauthClient: OAuth2Client | null = null;

  constructor(id: string, secret: string, creds: Credentials) {
    this.clientId = id;
    this.clientSecret = secret;
    this.creds = creds;
  }

  public async getClient(): Promise<OAuth2Client> {
    if (this.oauthClient) return this.oauthClient;
    await this.getAccessToken();
    return this.oauthClient!;
  }

  public resetClient() {
    this.oauthClient = null;
    logger.info('OAuth client reset. Next request will re-initialize credentials.');
  }

  public async getAccessToken(): Promise<string> {
    if (!this.oauthClient) {
      this.oauthClient = this.createOAuthClient();
      this.oauthClient.setCredentials(this.creds);
    }

    try {
      const { token } = await this.oauthClient.getAccessToken();
      if (!token) {
        throw new AuthError('Failed to retrieve access token.');
      }
      logger.info('Google access token verified/refreshed successfully.');
      return token;
    } catch (err) {
      this.oauthClient = null;
      const errMsg = err instanceof Error ? err.message : String(err);
      logger.error('Failed to verify/refresh Google access token during initialization:', { err: errMsg });
      throw new AuthError(`Failed to initialize Google authentication client. ${errMsg}`);
    }
  }

  private createOAuthClient(): OAuth2Client {
    return new OAuth2Client({
      clientId: this.clientId,
      clientSecret: this.clientSecret,
    });
  }
}
