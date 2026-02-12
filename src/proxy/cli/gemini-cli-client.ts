import type { OnboardUserResponse, ProjectDiscoveryResponse } from '@proxy/types.ts';
import { getClientMetadata, getUserAgent } from '@proxy/utils.js';
import { CONFIG } from '@shared/core/config.js';
import { CODE_ASSIST_API_VERSION, CODE_ASSIST_ENDPOINT } from '@shared/core/constants.js';
import { GeminiApiError } from '@shared/core/errors.js';
import { logger } from '@shared/core/logger.js';
import type { Recordable } from '@shared/types/common.js';
import type { RequestResult } from '@shared/types/http.js';
import { delay, ms } from '@shared/utils/helpers.js';
import { httpRequest } from '@shared/utils/http.js';
import type { GoogleAuthClient } from './auth.js';

export class GeminiCliClient {
  private projectId: string | null = null;
  private authClient: GoogleAuthClient;

  constructor(authClient: GoogleAuthClient) {
    this.authClient = authClient;
  }

  public async discoverProjectId(): Promise<string> {
    if (this.projectId) {
      return this.projectId;
    }

    if (CONFIG.GOOGLE_CLOUD_PROJECT) {
      this.projectId = CONFIG.GOOGLE_CLOUD_PROJECT;
      return this.projectId;
    }

    try {
      const initialProjectId = 'default-project';
      const metadata = getClientMetadata();

      const { data } = await this.requestEndpoint('loadCodeAssist', {
        cloudaicompanionProject: initialProjectId,
        metadata: {
          ...metadata,
          duetProject: initialProjectId,
        },
      });

      const loadResponse = JSON.parse(data) as ProjectDiscoveryResponse;

      if (loadResponse.cloudaicompanionProject) {
        this.projectId = loadResponse.cloudaicompanionProject;
        return this.projectId;
      }

      const defaultTier = loadResponse.allowedTiers?.find((tier) => tier.isDefault);
      const tierId = defaultTier?.id ?? 'free-tier';
      const onboardRequest = {
        tierId,
        cloudaicompanionProject: initialProjectId,
        metadata: getClientMetadata(initialProjectId),
      };

      // Poll until operation is complete with timeout protection
      const MAX_RETRIES = 30;
      let retryCount = 0;
      let lroResponse: OnboardUserResponse | undefined;

      logger.info('Initiating user onboarding...');

      while (retryCount < MAX_RETRIES) {
        const { data } = await this.requestEndpoint('onboardUser', onboardRequest);
        lroResponse = JSON.parse(data) as OnboardUserResponse;
        if (lroResponse.done) {
          break;
        }
        await delay(1000);
        retryCount++;
      }

      if (!lroResponse?.done) {
        throw new GeminiApiError('Onboarding timeout: Operation did not complete in time.');
      }

      this.projectId = lroResponse.response?.cloudaicompanionProject?.id ?? initialProjectId;
      logger.debug(`Discovered Project ID: ${this.projectId}`);
      return this.projectId;
    } catch (err: unknown) {
      logger.error('Failed to discover project ID', { err });
      throw err instanceof GeminiApiError ? err : new GeminiApiError('Could not discover project ID.');
    }
  }

  public async requestEndpoint(method: string, payload: Recordable): Promise<RequestResult<'text'>> {
    const token = await this.authClient.getAccessToken();

    const targetUrl = `${CODE_ASSIST_ENDPOINT}/${CODE_ASSIST_API_VERSION}:${method}`;

    const headers = {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
      'User-Agent': getUserAgent(payload['model'] as string),
    };

    logger.trace(`Sending request to Google API: ${targetUrl} (Model: ${String(payload['model'])})`);

    return httpRequest(targetUrl, {
      method: 'POST',
      headers,
      body: JSON.stringify(payload),
      responseType: 'text',
      timeout: ms.min(5),
    });
  }

  public restAuthClient() {
    this.authClient.resetClient();
  }
}
