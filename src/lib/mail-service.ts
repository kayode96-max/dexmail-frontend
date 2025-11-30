import { EmailMessage, CryptoAsset } from './types';
import { readContract, writeContract, waitForTransactionReceipt } from '@wagmi/core';
import { wagmiConfig } from './wagmi-config';
import { BASEMAILER_ADDRESS, baseMailerAbi } from './contracts';
import { parseUnits, parseEther, stringToHex } from 'viem';
import { cryptoService } from './crypto-service';
import { generateClaimCode, storeClaimCode, getClaimUrl, formatClaimCode } from './claim-code';

export interface SendEmailData {
  from: string;
  to: string[];
  subject: string;
  body: string;
  cryptoTransfer?: {
    enabled: boolean;
    assets: CryptoAsset[];
  };
}

export interface SendEmailResponse {
  messageId: string;
  cid: string;
  key: string;
}

export interface EmailStatus {
  read: boolean;
  spam: boolean;
  archived: boolean;
  deleted: boolean;
  draft: boolean;
}

const EMAIL_STATUS_KEY = 'dexmail_email_status';


class MailService {
  async sendEmail(data: SendEmailData): Promise<SendEmailResponse & { claimCode?: string; isDirectTransfer?: boolean }> {
    // Check if recipient is registered (only for crypto transfers)
    let isRecipientRegistered = false;
    let isWalletDeployed = false;

    if (data.cryptoTransfer?.enabled && data.cryptoTransfer.assets.length > 0 && data.to.length > 0) {
      try {
        const recipient = data.to[0];
        const registrationStatus = await readContract(wagmiConfig, {
          address: BASEMAILER_ADDRESS,
          abi: baseMailerAbi,
          functionName: 'isRecipientRegistered',
          args: [recipient]
        }) as [boolean, boolean];

        isRecipientRegistered = registrationStatus[0];
        isWalletDeployed = registrationStatus[1];

        console.log('[MailService] Recipient registration status:', {
          email: recipient,
          registered: isRecipientRegistered,
          walletDeployed: isWalletDeployed
        });
      } catch (error) {
        console.warn('[MailService] Could not check recipient registration:', error);
      }
    }

    // Generate claim code ONLY if crypto is being sent AND recipient is NOT registered
    let claimCode: string | undefined;
    const isDirectTransfer = isRecipientRegistered && isWalletDeployed;

    if (data.cryptoTransfer?.enabled && data.cryptoTransfer.assets.length > 0 && !isRecipientRegistered) {
      claimCode = generateClaimCode();
      console.log('[MailService] Generated claim code for unregistered user:', claimCode);
    }

    // Prepare email body with appropriate content
    let emailBody = data.body;
    if (data.cryptoTransfer?.enabled && data.cryptoTransfer.assets.length > 0) {
      const assetsText = data.cryptoTransfer.assets.map(asset => {
        if (asset.type === 'eth') return `${asset.amount} ETH`;
        if (asset.type === 'erc20') return `${asset.amount} ${asset.symbol || 'tokens'}`;
        if (asset.type === 'nft') return `NFT #${asset.tokenId}`;
        return 'Unknown asset';
      }).join(', ');

      emailBody += `\n\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`;
      emailBody += `🎁 CRYPTO ASSETS ATTACHED\n`;
      emailBody += `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n\n`;
      emailBody += `You've received: ${assetsText}\n\n`;

      if (isDirectTransfer) {
        // Direct transfer message for registered users
        emailBody += `✅ Assets have been transferred directly to your wallet!\n\n`;
        emailBody += `You can view them in your DexMail dashboard.\n`;
      } else if (claimCode) {
        // Claim code instructions for unregistered users
        const claimUrl = getClaimUrl(claimCode);

        emailBody += `Your Claim Code: ${formatClaimCode(claimCode)}\n\n`;
        emailBody += `To claim your assets:\n`;
        emailBody += `1. Click this link: ${claimUrl}\n`;
        emailBody += `2. Or manually enter the claim code: ${claimCode}\n\n`;
        emailBody += `This code will auto-fill when you click the link above.\n`;
      }

      emailBody += `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`;
    }

    // 1. Upload to IPFS via API route
    const ipfsResponse = await fetch('/api/ipfs', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        from: data.from,
        to: data.to,
        subject: data.subject,
        body: emailBody, // Use modified body with claim code or direct transfer message
        timestamp: new Date().toISOString(),
        cryptoTransfer: data.cryptoTransfer,
        claimCode: claimCode, // Include claim code in IPFS metadata (only for unregistered users)
        isDirectTransfer: isDirectTransfer
      })
    });

    if (!ipfsResponse.ok) {
      throw new Error('Failed to upload email to IPFS');
    }

    const { cid } = await ipfsResponse.json();
    console.log('[MailService] Uploaded to IPFS with CID:', cid);

    // 1. Handle Crypto Assets & Mail Indexing
    let txHash = '';
    const transferHashes: string[] = [];

    if (!cid) {
      throw new Error('Failed to get CID from IPFS upload');
    }

    // Convert CID to bytes32 using viem (safer for browser)
    // stringToHex returns 0x-prefixed hex string
    const cidHex = stringToHex(cid);
    // Ensure it fits in bytes32 (64 hex chars + 2 for 0x)
    const cidBytes32 = cidHex.slice(0, 66).padEnd(66, '0') as `0x${string}`;

    console.log('[MailService] Generated CID hash:', cidBytes32);

    // Store the mapping in localStorage for retrieval (Required for current mock implementation)
    if (typeof window !== 'undefined') {
      try {
        const cidMap = JSON.parse(localStorage.getItem('ipfs_cid_map') || '{}');
        cidMap[cidBytes32] = cid;
        localStorage.setItem('ipfs_cid_map', JSON.stringify(cidMap));
        console.log('[MailService] Stored CID mapping:', cidBytes32, '->', cid);
      } catch (e) {
        console.error('[MailService] Failed to store CID mapping:', e);
      }
    }

    const recipient = data.to[0];

    if (data.cryptoTransfer?.enabled && data.cryptoTransfer.assets.length > 0) {
      const asset = data.cryptoTransfer.assets[0];

      console.log(`Sending mail with crypto asset: ${asset.amount} ${asset.symbol}`);

      let amount = BigInt(0);
      let tokenAddress = asset.token || '0x0000000000000000000000000000000000000000';
      const isNft = asset.type === 'nft';

      if (asset.type === 'eth') {
        amount = parseEther(asset.amount || '0');
      } else if (asset.type === 'erc20') {
        amount = parseUnits(asset.amount || '0', 18);
      } else if (asset.type === 'nft') {
        amount = BigInt(asset.tokenId || '0');
        tokenAddress = asset.token!;
      }

      // Ensure approval if needed
      if (asset.type === 'erc20') {
        await cryptoService.ensureApproval(tokenAddress, amount);
      }

      // Call sendMailWithCrypto (Atomic operation)
      txHash = await writeContract(wagmiConfig, {
        address: BASEMAILER_ADDRESS,
        abi: baseMailerAbi,
        functionName: 'sendMailWithCrypto',
        args: [
          cidBytes32,
          recipient,
          false, // isExternal
          tokenAddress,
          amount,
          isNft
        ],
        value: asset.type === 'eth' ? amount : BigInt(0)
      });

      console.log('[MailService] Sent mail with crypto. Tx:', txHash);
      transferHashes.push(txHash);

      // Handle additional assets if any (separate transactions)
      if (data.cryptoTransfer.assets.length > 1) {
        for (let i = 1; i < data.cryptoTransfer.assets.length; i++) {
          const extraAsset = data.cryptoTransfer.assets[i];
          console.log(`Sending additional asset: ${extraAsset.symbol}`);
          const result = await cryptoService.sendCrypto({
            recipientEmail: recipient,
            senderEmail: data.from,
            assets: [extraAsset]
          });
          transferHashes.push(result.claimToken);
        }
      }

    } else if (data.to.length > 0) {
      // Regular mail indexing without crypto
      txHash = await writeContract(wagmiConfig, {
        address: BASEMAILER_ADDRESS,
        abi: baseMailerAbi,
        functionName: 'indexMail',
        args: [cidBytes32, recipient, false, false]
      });
      console.log('[MailService] Indexed mail on blockchain with tx:', txHash);
    }

    // 3. Store claim code if generated (only for unregistered users)
    if (claimCode && data.cryptoTransfer?.assets) {
      const recipient = data.to[0]; // Recipient is already determined earlier
      storeClaimCode(
        claimCode,
        txHash, // Use the mail indexing tx hash as the primary reference
        recipient,
        data.from,
        data.cryptoTransfer.assets,
        isRecipientRegistered,
        isDirectTransfer
      );
    }

    return {
      messageId: txHash,
      cid: cid,
      key: 'mock-key',
      claimCode,
      isDirectTransfer
    };
  }

  private async fetchEmailFromIPFS(cidHash: string): Promise<{ subject: string; body: string } | null> {
    try {
      // Skip if it's the dummy CID (all zeros)
      if (cidHash === '0x' + '0'.repeat(64)) {
        console.log('[MailService] Skipping dummy CID');
        return null;
      }

      // Get the actual IPFS CID from localStorage mapping
      let actualCid: string | null = null;

      if (typeof window !== 'undefined') {
        try {
          const cidMap = JSON.parse(localStorage.getItem('ipfs_cid_map') || '{}');
          actualCid = cidMap[cidHash];
          console.log('[MailService] Retrieved CID from mapping:', cidHash, '->', actualCid);
        } catch (e) {
          console.error('[MailService] Failed to parse CID map:', e);
        }
      }

      if (!actualCid) {
        console.log('[MailService] No CID mapping found for hash:', cidHash);
        return null;
      }

      // Fetch from IPFS via Pinata gateway
      const gatewayUrl = `https://gateway.pinata.cloud/ipfs/${actualCid}`;
      console.log('[MailService] Fetching from IPFS:', gatewayUrl);

      const response = await fetch(gatewayUrl);

      if (!response.ok) {
        console.error(`[MailService] Failed to fetch from IPFS: ${response.statusText}`);
        return null;
      }

      const data = await response.json();
      console.log('[MailService] Successfully fetched email from IPFS');

      return {
        subject: data.subject || 'No Subject',
        body: data.body || ''
      };
    } catch (error) {
      console.error('[MailService] Error fetching from IPFS:', error);
      return null;
    }
  }

  async getInbox(email: string): Promise<EmailMessage[]> {
    try {
      console.log(`[MailService] Fetching inbox for: ${email}`);
      console.log(`[MailService] Contract address: ${BASEMAILER_ADDRESS}`);

      // Check if we're connected to the right network
      const { getAccount, getChainId } = await import('@wagmi/core');
      const account = getAccount(wagmiConfig);
      const chainId = getChainId(wagmiConfig);

      console.log(`[MailService] Connected account: ${account.address}`);
      console.log(`[MailService] Chain ID: ${chainId} (Base Sepolia = 84532)`);

      const mailIds = await readContract(wagmiConfig, {
        address: BASEMAILER_ADDRESS,
        abi: baseMailerAbi,
        functionName: 'getInbox',
        args: [email]
      }) as bigint[];

      console.log(`[MailService] Found ${mailIds.length} mail(s) in inbox`);
      console.log(`[MailService] Mail IDs:`, mailIds);

      // Empty inbox is a valid state, not an error
      if (mailIds.length === 0) {
        console.log('[MailService] Inbox is empty - no mails indexed yet');
        return [];
      }

      const messages: EmailMessage[] = [];

      for (const id of mailIds) {
        try {
          console.log(`[MailService] Fetching mail ID: ${id}`);

          // Step 1: Get mail metadata from contract
          const mail = await readContract(wagmiConfig, {
            address: BASEMAILER_ADDRESS,
            abi: baseMailerAbi,
            functionName: 'getMail',
            args: [id]
          }) as any;

          console.log(`[MailService] Mail ${id} - CID: ${mail.cid}, Sender: ${mail.sender}`);

          // Step 2: Get sender's email from their wallet address
          let senderEmail = mail.sender; // Fallback to address if lookup fails
          try {
            const emailFromAddress = await readContract(wagmiConfig, {
              address: BASEMAILER_ADDRESS,
              abi: baseMailerAbi,
              functionName: 'addressToEmail',
              args: [mail.sender]
            }) as string;

            if (emailFromAddress && emailFromAddress.trim() !== '') {
              senderEmail = emailFromAddress;
              console.log(`[MailService] Resolved sender address ${mail.sender} to email: ${senderEmail}`);
            }
          } catch (error) {
            console.warn(`[MailService] Could not resolve email for address ${mail.sender}, using address as fallback`);
          }

          // Step 3: Fetch email content from IPFS using the CID
          const ipfsContent = await this.fetchEmailFromIPFS(mail.cid);

          const subject = ipfsContent?.subject || 'Email from blockchain';
          const body = ipfsContent?.body || 'This email was sent via DexMail';

          messages.push({
            messageId: id.toString(),
            from: senderEmail,
            to: [mail.recipientEmail],
            subject: subject,
            body: body,
            timestamp: mail.timestamp.toString(),
            hasCryptoTransfer: mail.hasCrypto,
            ipfsCid: mail.cid
          });
        } catch (mailError) {
          console.error(`[MailService] Error fetching mail ID ${id}:`, mailError);
          // Continue with other mails even if one fails
        }
      }

      console.log(`[MailService] Successfully fetched ${messages.length} message(s)`);
      return messages.reverse();
    } catch (error: any) {
      // Handle the specific case where contract returns 0x (empty data)
      // This happens when the inbox is empty or the contract doesn't exist
      if (error?.name === 'ContractFunctionZeroDataError' ||
        error?.cause?.name === 'ContractFunctionZeroDataError' ||
        error?.message?.includes('returned no data')) {
        console.log('[MailService] Contract returned no data - treating as empty inbox');
        console.log('[MailService] This could mean:');
        console.log('  1. No emails have been sent to this address yet');
        console.log('  2. Wrong network (make sure you are on Base)');
        console.log('  3. Contract not deployed at this address');
        return [];
      }

      // This is an actual error (network issue, wrong network, etc.)
      console.error('[MailService] Error fetching inbox:', error);
      console.error('[MailService] Error details:', {
        name: error?.name,
        message: error?.message,
        cause: error?.cause
      });
      throw error; // Re-throw to let caller handle it
    }
  }

  async getSent(email: string): Promise<EmailMessage[]> {
    try {
      console.log(`[MailService] Fetching sent emails for: ${email}`);

      // Get the user's wallet address from their email
      const { getAccount } = await import('@wagmi/core');
      const account = getAccount(wagmiConfig);

      if (!account.address) {
        console.log('[MailService] No wallet connected');
        return [];
      }

      // Query MailSent events where sender is the user's address
      const { getPublicClient } = await import('@wagmi/core');
      const publicClient = getPublicClient(wagmiConfig);

      if (!publicClient) {
        console.log('[MailService] No public client available');
        return [];
      }

      // Get current block number
      const currentBlock = await publicClient.getBlockNumber();

      // Query last 50,000 blocks to stay within RPC limits
      // This should cover approximately the last few days on Base Sepolia
      const fromBlock = currentBlock > BigInt(50000) ? currentBlock - BigInt(50000) : BigInt(0);

      console.log(`[MailService] Querying MailSent events from block ${fromBlock} to ${currentBlock}`);

      // Get MailSent events from the contract
      const logs = await publicClient.getLogs({
        address: BASEMAILER_ADDRESS,
        event: {
          type: 'event',
          name: 'MailSent',
          inputs: [
            { type: 'uint256', name: 'mailId', indexed: true },
            { type: 'address', name: 'sender', indexed: true },
            { type: 'string', name: 'recipient' },
            { type: 'bytes32', name: 'cid' }
          ]
        },
        args: {
          sender: account.address
        },
        fromBlock: fromBlock,
        toBlock: currentBlock
      });

      console.log(`[MailService] Found ${logs.length} sent mail event(s)`);

      const messages: EmailMessage[] = [];

      for (const log of logs) {
        try {
          const mailId = log.args.mailId as bigint;
          const recipient = log.args.recipient as string;
          const cidHash = log.args.cid as string;

          // Get full mail details from contract
          const mail = await readContract(wagmiConfig, {
            address: BASEMAILER_ADDRESS,
            abi: baseMailerAbi,
            functionName: 'getMail',
            args: [mailId]
          }) as any;

          // Fetch email content from IPFS
          const ipfsContent = await this.fetchEmailFromIPFS(cidHash);

          const subject = ipfsContent?.subject || 'Sent Email';
          const body = ipfsContent?.body || '';

          messages.push({
            messageId: mailId.toString(),
            from: email, // User's email
            to: [recipient],
            subject: subject,
            body: body,
            timestamp: mail.timestamp.toString(),
            hasCryptoTransfer: mail.hasCrypto,
            ipfsCid: cidHash
          });
        } catch (mailError) {
          console.error(`[MailService] Error processing sent mail:`, mailError);
        }
      }

      console.log(`[MailService] Successfully fetched ${messages.length} sent message(s)`);
      return messages.reverse(); // Most recent first
    } catch (error) {
      console.error('[MailService] Error fetching sent emails:', error);
      return [];
    }
  }

  async getMessage(messageId: string, email: string): Promise<EmailMessage> {
    const mail = await readContract(wagmiConfig, {
      address: BASEMAILER_ADDRESS,
      abi: baseMailerAbi,
      functionName: 'getMail',
      args: [BigInt(messageId)]
    }) as any;

    return {
      messageId: messageId,
      from: mail.sender,
      to: [mail.recipientEmail],
      subject: 'Loading...',
      body: 'Loading...',
      timestamp: mail.timestamp.toString(),
      hasCryptoTransfer: mail.hasCrypto,
      ipfsCid: mail.cid
    };
  }

  async deleteMessage(messageId: string, email: string): Promise<{ success: boolean; messageId: string }> {
    return { success: true, messageId };
  }

  // Email Status Management Methods
  private getStatusMap(): Record<string, EmailStatus> {
    if (typeof window === 'undefined') return {};
    const stored = localStorage.getItem(EMAIL_STATUS_KEY);
    return stored ? JSON.parse(stored) : {};
  }

  private saveStatusMap(statusMap: Record<string, EmailStatus>): void {
    if (typeof window === 'undefined') return;
    localStorage.setItem(EMAIL_STATUS_KEY, JSON.stringify(statusMap));
  }

  getEmailStatus(messageId: string): EmailStatus {
    const statusMap = this.getStatusMap();
    return statusMap[messageId] || {
      read: false,
      spam: false,
      archived: false,
      deleted: false,
      draft: false
    };
  }

  updateEmailStatus(messageId: string, status: Partial<EmailStatus>): void {
    const statusMap = this.getStatusMap();
    const currentStatus = this.getEmailStatus(messageId);
    statusMap[messageId] = { ...currentStatus, ...status };
    this.saveStatusMap(statusMap);
  }

  markAsRead(messageId: string): void {
    this.updateEmailStatus(messageId, { read: true });
  }

  markAsUnread(messageId: string): void {
    this.updateEmailStatus(messageId, { read: false });
  }

  moveToSpam(messageId: string): void {
    this.updateEmailStatus(messageId, { spam: true, archived: false, deleted: false });
  }

  removeFromSpam(messageId: string): void {
    this.updateEmailStatus(messageId, { spam: false });
  }

  moveToArchive(messageId: string): void {
    this.updateEmailStatus(messageId, { archived: true, spam: false, deleted: false });
  }

  removeFromArchive(messageId: string): void {
    this.updateEmailStatus(messageId, { archived: false });
  }

  moveToTrash(messageId: string): void {
    this.updateEmailStatus(messageId, { deleted: true, spam: false, archived: false });
  }

  restoreFromTrash(messageId: string): void {
    this.updateEmailStatus(messageId, { deleted: false });
  }

  markAsDraft(messageId: string): void {
    this.updateEmailStatus(messageId, { draft: true });
  }

  removeDraftStatus(messageId: string): void {
    this.updateEmailStatus(messageId, { draft: false });
  }

}

export const mailService = new MailService();
export default MailService;
