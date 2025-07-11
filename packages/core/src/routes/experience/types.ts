import { type SocialUserInfo, socialUserInfoGuard, type ToZodObject } from '@logto/connector-kit';
import {
  type CreateUser,
  InteractionEvent,
  type User,
  Users,
  UserSsoIdentities,
  type UserSsoIdentity,
} from '@logto/schemas';
import type { Provider } from 'oidc-provider';
import { z } from 'zod';

import { type WithLogContext } from '#src/middleware/koa-audit-log.js';
import { type WithInteractionDetailsContext } from '#src/middleware/koa-interaction-details.js';

import { type WithI18nContext } from '../../middleware/koa-i18next.js';

import { mfaDataGuard, type MfaData } from './classes/mfa.js';
import {
  type VerificationRecordData,
  type VerificationRecord,
  type VerificationRecordMap,
  verificationRecordDataGuard,
} from './classes/verifications/index.js';
import { type WithExperienceInteractionHooksContext } from './middleware/koa-experience-interaction-hooks.js';
import { type WithExperienceInteractionContext } from './middleware/koa-experience-interaction.js';

export type Interaction = Awaited<ReturnType<Provider['interactionDetails']>>;

export type InteractionProfile = {
  socialIdentity?: {
    target: string;
    userInfo: SocialUserInfo;
  };
  enterpriseSsoIdentity?: Pick<
    UserSsoIdentity,
    'identityId' | 'ssoConnectorId' | 'issuer' | 'detail'
  >;
  /**
   * This is from one-time token verification. User will be automatically added to the specified organizations.
   */
  jitOrganizationIds?: string[];
  // Syncing the existing enterprise SSO identity detail
  syncedEnterpriseSsoIdentity?: Pick<UserSsoIdentity, 'identityId' | 'issuer' | 'detail'>;
} & Pick<
  CreateUser,
  | 'avatar'
  | 'name'
  | 'username'
  | 'primaryEmail'
  | 'primaryPhone'
  | 'passwordEncrypted'
  | 'passwordEncryptionMethod'
>;

const interactionProfileGuard = Users.createGuard
  .pick({
    avatar: true,
    name: true,
    username: true,
    primaryEmail: true,
    primaryPhone: true,
    passwordEncrypted: true,
    passwordEncryptionMethod: true,
  })
  .extend({
    socialIdentity: z
      .object({
        target: z.string(),
        userInfo: socialUserInfoGuard,
      })
      .optional(),
    enterpriseSsoIdentity: UserSsoIdentities.guard
      .pick({
        identityId: true,
        ssoConnectorId: true,
        issuer: true,
        detail: true,
      })
      .optional(),
    syncedEnterpriseSsoIdentity: UserSsoIdentities.guard
      .pick({
        identityId: true,
        issuer: true,
        detail: true,
      })
      .optional(),
    jitOrganizationIds: z.array(z.string()).optional(),
  }) satisfies ToZodObject<InteractionProfile>;

/**
 * The interaction context provides the callback functions to get the user and verification record from the interaction
 */
export type InteractionContext = {
  getInteractionEvent: () => InteractionEvent;
  getIdentifiedUser: () => Promise<User>;
  getVerificationRecordById: (verificationId: string) => VerificationRecord;
  getVerificationRecordByTypeAndId: <K extends keyof VerificationRecordMap>(
    type: K,
    verificationId: string
  ) => VerificationRecordMap[K];
};

export type ExperienceInteractionRouterContext<ContextT extends WithLogContext = WithLogContext> =
  ContextT &
    WithI18nContext &
    WithInteractionDetailsContext &
    WithExperienceInteractionHooksContext &
    WithExperienceInteractionContext;

export type WithHooksAndLogsContext<ContextT extends WithLogContext = WithLogContext> = ContextT &
  WithInteractionDetailsContext &
  WithExperienceInteractionHooksContext;

/**
 * Interaction storage is used to store the interaction data during the interaction process.
 * It is used to pass data between different interaction steps and to store the interaction state.
 * It is stored in the oidc provider interaction session.
 */
export type InteractionStorage = {
  interactionEvent: InteractionEvent;
  userId?: string;
  profile?: InteractionProfile;
  mfa?: MfaData;
  verificationRecords?: VerificationRecordData[];
  captcha?: {
    verified: boolean;
    skipped: boolean;
  };
};

export const interactionStorageGuard = z.object({
  interactionEvent: z.nativeEnum(InteractionEvent),
  userId: z.string().optional(),
  profile: interactionProfileGuard.optional(),
  mfa: mfaDataGuard.optional(),
  verificationRecords: verificationRecordDataGuard.array().optional(),
  captcha: z
    .object({
      verified: z.boolean(),
      skipped: z.boolean(),
    })
    .optional(),
}) satisfies ToZodObject<InteractionStorage>;
