import type { Abi } from 'viem';
import baseMailerJson from './basemailer.json';
import trustedRelayerJson from './trustedrelayer.json';
export const baseMailerAbi: Abi = baseMailerJson as Abi;
export const trustedRelayerAbi: Abi = trustedRelayerJson as Abi;

export type BaseMailerAbi = typeof baseMailerAbi;
export type TrustedRelayerAbi = typeof trustedRelayerAbi;

export type BaseMailerEventName =
  | 'CryptoSent'
  | 'EmailRegistered'
  | 'MailSent'
  | 'OwnershipTransferred'
  | 'Paused'
  | 'RelayerAuthorized'
  | 'TransferCooldownUpdated'
  | 'Unpaused'
  | 'WalletClaimed'
  | 'WalletCreated';

export type TrustedRelayerEventName =
  | 'EmailRegistered'
  | 'EmailVerificationRequested'
  | 'EmailVerified'
  | 'EmergencyStopToggled'
  | 'FeeUpdated'
  | 'FeesWithdrawn'
  | 'OwnershipTransferred'
  | 'Paused'
  | 'RelayerAdded'
  | 'RelayerConfigUpdated'
  | 'RelayerRemoved'
  | 'SecurityConfigUpdated'
  | 'Unpaused'
  | 'WalletClaimed';

export default {
  baseMailerAbi,
  trustedRelayerAbi,
};
