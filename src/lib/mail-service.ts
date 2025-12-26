import { EmailMessage, CryptoAsset } from './types';
import { readContract, writeContract, waitForTransactionReceipt } from '@wagmi/core';
import { wagmiConfig } from './wagmi-config';
import { BASEMAILER_ADDRESS, baseMailerAbi } from './contracts';
import { parseUnits, parseEther, stringToHex, encodeFunctionData } from 'viem';
import { cryptoService } from './crypto-service';
import { generateClaimCode, storeClaimCode, getClaimUrl, formatClaimCode } from './claim-code';

export interface EmailAttachment {
  name: string;
  size: number;
  type: string;
  cid: string; // IPFS CID
}

export interface SendEmailData {
  from: string;
  to: string[];
  subject: string;
  body: string;
  attachments?: EmailAttachment[];
  cryptoTransfer?: {
    enabled: boolean;
    assets: CryptoAsset[];
  };
  inReplyTo?: string;
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
  labels: string[];
  deletedAt?: number;
  purged?: boolean;
}

export interface DraftEmail {
  id: string;
  to: string;
  subject: string;
  body: string;
  timestamp: number;
}

const EMAIL_STATUS_KEY = 'dexmail_email_status';

export interface FeeInfo {
  totalFee: bigint;
  details: {
    email: string;
    fee: bigint;
    requiresFee: boolean;
  }[];
}


class MailService {
  async sendEmail(
    data: SendEmailData,
    authType?: 'wallet' | 'coinbase-embedded',
    sendTransaction?: (args: { to: string; data: string; value?: bigint }) => Promise<string>
  ): Promise<SendEmailResponse & { claimCode?: string; isDirectTransfer?: boolean }> {
    // Validate crypto transfers only work with single recipient
    if (data.cryptoTransfer?.enabled && data.cryptoTransfer.assets.length > 0 && data.to.length > 1) {
      throw new Error('Crypto transfers can only be sent to a single recipient. Please remove additional recipients or disable crypto attachment.');
    }

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

    let claimCode: string | undefined;
    const isDirectTransfer = isRecipientRegistered && isWalletDeployed;

    if (data.cryptoTransfer?.enabled && data.cryptoTransfer.assets.length > 0 && !isRecipientRegistered) {
      claimCode = generateClaimCode();
      console.log('[MailService] Generated claim code for unregistered user:', claimCode);
    }

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
        emailBody += `✅ Assets have been transferred directly to your wallet!\n\n`;
        emailBody += `You can view them in your DexMail dashboard.\n`;
      } else if (claimCode) {
        const claimUrl = getClaimUrl(claimCode);

        emailBody += `Your Claim Code: ${formatClaimCode(claimCode)}\n\n`;
        emailBody += `To claim your assets:\n`;
        emailBody += `1. Click this link: ${claimUrl}\n`;
        emailBody += `2. Or manually enter the claim code: ${claimCode}\n\n`;
        emailBody += `This code will auto-fill when you click the link above.\n`;
      }

      emailBody += `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`;
    }

    const { to, subject, body, inReplyTo, attachments } = data;
    const assets = data.cryptoTransfer?.assets;

    // Validation: Ensure body is not empty to avoid "empty content saved" issues
    if (!body || body.trim() === '') {
      throw new Error("Email body cannot be empty");
    }

    // 1. Upload email content to IPFS
    const emailContent = {
      subject,
      body: emailBody, // Use the potentially modified emailBody
      from: data.from, // Ensure we save who sent it inside the content
      timestamp: Date.now(),
      assets: assets?.map(a => ({ ...a, claimCode: undefined })), // Security: Redact claim code from IPFS
      claimCode: claimCode ? true : false,
      inReplyTo: inReplyTo,
      attachments: attachments // Include file attachments metadata
    };

    const ipfsResponse = await fetch('/api/ipfs', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(emailContent)
    });

    if (!ipfsResponse.ok) {
      throw new Error('Failed to upload email to IPFS');
    }

    const { cid } = await ipfsResponse.json();
    console.log('[MailService] Uploaded to IPFS with CID:', cid);

    let txHash = '';
    const transferHashes: string[] = [];

    if (!cid) {
      throw new Error('Failed to get CID from IPFS upload');
    }

    const cidHex = stringToHex(cid);
    const cidBytes32 = cidHex.slice(0, 66).padEnd(66, '0') as `0x${string}`;

    console.log('[MailService] Generated CID hash:', cidBytes32);

    try {
      const storeResponse = await fetch('/api/cid/store', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          cidHash: cidBytes32,
          fullCid: cid
        })
      });

      if (storeResponse.ok) {
        console.log('[MailService] ✅ Stored CID mapping in MongoDB:', cidBytes32, '->', cid);
      } else {
        console.warn('[MailService] Failed to store CID in MongoDB, using localStorage fallback');
      }
    } catch (apiError) {
      console.error('[MailService] Error calling CID store API:', apiError);
    }

    if (typeof window !== 'undefined') {
      try {
        const cidMap = JSON.parse(localStorage.getItem('ipfs_cid_map') || '{}');
        cidMap[cidBytes32] = cid;
        localStorage.setItem('ipfs_cid_map', JSON.stringify(cidMap));
        console.log('[MailService] Stored CID mapping in localStorage (fallback):', cidBytes32, '->', cid);
      } catch (e) {
        console.error('[MailService] Failed to store CID mapping in localStorage:', e);
      }
    }


    const recipient = data.to[0];
    const isExternal = recipient.includes('@') && !recipient.endsWith('@dexmail.app');

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

      if (asset.type === 'erc20') {
        await cryptoService.ensureApproval(tokenAddress, amount);
      }

      // Use appropriate transaction method based on auth type
      if (authType === 'coinbase-embedded' && sendTransaction) {
        // Embedded wallet: use CDP transaction
        const encodedData = encodeFunctionData({
          abi: baseMailerAbi,
          functionName: 'sendMailWithCrypto',
          args: [
            cid,
            recipient,
            isExternal,
            tokenAddress,
            amount,
            isNft
          ]
        });

        txHash = await sendTransaction({
          to: BASEMAILER_ADDRESS,
          data: encodedData,
          value: asset.type === 'eth' ? amount : BigInt(0)
        });
      } else {
        txHash = await writeContract(wagmiConfig, {
          address: BASEMAILER_ADDRESS,
          abi: baseMailerAbi,
          functionName: 'sendMailWithCrypto',
          args: [
            cid,
            recipient,
            isExternal,
            tokenAddress,
            amount,
            isNft
          ],
          value: asset.type === 'eth' ? amount : BigInt(0)
        });
      }

      console.log('[MailService] Sent mail with crypto. Tx:', txHash);
      transferHashes.push(txHash);

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

      if (claimCode && data.cryptoTransfer?.assets) {
        const recipient = data.to[0];
        storeClaimCode(
          claimCode,
          txHash,
          recipient,
          data.from,
          data.cryptoTransfer.assets,
          isRecipientRegistered,
          isDirectTransfer
        );
      }

    } else if (data.to.length > 0) {
      console.log(`[MailService] Sending to ${data.to.length} recipient(s)`);
      const txHashes: string[] = [];

      for (const recipient of data.to) {
        const isExternal = recipient.includes('@') && !recipient.endsWith('@dexmail.app');

        try {
          let recipientTxHash = '';
          let value = BigInt(0);
          if (!isExternal) {
            try {
              const isWhitelisted = await readContract(wagmiConfig, {
                address: BASEMAILER_ADDRESS,
                abi: baseMailerAbi,
                functionName: 'isWhitelisted',
                args: [recipient, data.from]
              }) as boolean;

              if (!isWhitelisted) {
                const fee = await readContract(wagmiConfig, {
                  address: BASEMAILER_ADDRESS,
                  abi: baseMailerAbi,
                  functionName: 'getContactFee',
                  args: [recipient]
                }) as bigint;

                if (fee > BigInt(0)) {
                  console.log(`[MailService] Recipient ${recipient} requires contact fee: ${fee}`);
                  value = fee;
                }
              }
            } catch (checkError) {
              console.warn('[MailService] Failed to check whitelist/fee:', checkError);
            }
          }

          if (authType === 'coinbase-embedded' && sendTransaction) {
            const encodedData = encodeFunctionData({
              abi: baseMailerAbi,
              functionName: 'indexMail',
              args: [cid, recipient, "", isExternal, false]
            });

            recipientTxHash = await sendTransaction({
              to: BASEMAILER_ADDRESS,
              data: encodedData,
              value: value
            });
          } else {
            recipientTxHash = await writeContract(wagmiConfig, {
              address: BASEMAILER_ADDRESS,
              abi: baseMailerAbi,
              functionName: 'indexMail',
              args: [cid, recipient, "", isExternal, false],
              value: value
            });
          }

          console.log(`[MailService] Indexed mail for ${recipient} with tx:`, recipientTxHash);
          txHashes.push(recipientTxHash);

          if (isExternal) {
            try {
              console.log('--------------------------------------------------');
              console.log('[Bridge] 🌉 EXTERNAL MAIL DETECTED');
              console.log('[Bridge] 📤 Relaying via SendGrid Bridge...');
              console.log('[Bridge] 📧 Recipient:', recipient);
              console.log('[Bridge] 📨 Sender (Reply-To):', data.from);

              const isDexMail = data.from.toLowerCase().endsWith('@dexmail.app');
              const fromEmail = isDexMail ? data.from : 'no-reply@dexmail.app';

              const sendGridResponse = await fetch('/api/sendgrid/send', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                  to: recipient,
                  from: {
                    email: fromEmail,
                    name: data.from
                  },
                  replyTo: data.from,
                  subject: data.subject,
                  text: emailBody,
                  html: emailBody.replace(/\n/g, '<br/>')
                })
              });

              if (sendGridResponse.ok) {
                console.log('[Bridge] ✅ Successfully relayed via SendGrid');
                console.log('--------------------------------------------------');
              } else {
                console.warn('[Bridge] ❌ Failed to relay via SendGrid:', await sendGridResponse.text());
                console.log('--------------------------------------------------');
              }
            } catch (sgError) {
              console.error(`[MailService] Error sending to ${recipient} via SendGrid:`, sgError);
            }
          }
        } catch (recipientError) {
          console.error(`[MailService] Failed to send to ${recipient}:`, recipientError);
        }
      }

      txHash = txHashes[0] || '';
      console.log(`[MailService] Bulk send complete. ${txHashes.length}/${data.to.length} successful`);
    }

    return {
      messageId: txHash,
      cid: cid,
      key: 'mock-key',
      claimCode,
      isDirectTransfer
    };
  };


  async getRequiredFees(sender: string, recipients: string[]): Promise<FeeInfo> {
    const details: { email: string; fee: bigint; requiresFee: boolean }[] = [];
    let totalFee = BigInt(0);
    const internalRecipients = recipients.filter(r => r.endsWith('@dexmail.app'));

    for (const recipient of internalRecipients) {
      try {
        const isWhitelisted = await readContract(wagmiConfig, {
          address: BASEMAILER_ADDRESS,
          abi: baseMailerAbi,
          functionName: 'isWhitelisted',
          args: [recipient, sender]
        }) as boolean;

        let fee = BigInt(0);
        let requiresFee = false;

        if (!isWhitelisted) {
          fee = await readContract(wagmiConfig, {
            address: BASEMAILER_ADDRESS,
            abi: baseMailerAbi,
            functionName: 'getContactFee',
            args: [recipient]
          }) as bigint;

          if (fee > BigInt(0)) {
            requiresFee = true;
            totalFee += fee;
          }
        }

        if (requiresFee) {
          details.push({ email: recipient, fee, requiresFee });
        }

      } catch (error) {
        console.warn(`[MailService] Failed to check fee for ${recipient}:`, error);
      }
    }

    return { totalFee, details };
  }

  async validateEmail(email: string): Promise<{ isValid: boolean; exists: boolean; reason?: string }> {
    const results = await this.validateEmailsBatch([email]);
    return results[email];
  }

  async validateEmailsBatch(emails: string[]): Promise<Record<string, { isValid: boolean; exists: boolean; reason?: string }>> {
    const results: Record<string, { isValid: boolean; exists: boolean; reason?: string }> = {};
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

    for (const email of emails) {
      if (!emailRegex.test(email)) {
        results[email] = { isValid: false, exists: false, reason: 'Invalid email format' };
        continue;
      }

      if (!email.toLowerCase().endsWith('@dexmail.app')) {
        results[email] = { isValid: true, exists: true };
        continue;
      }

      try {
        const registrationStatus = await readContract(wagmiConfig, {
          address: BASEMAILER_ADDRESS,
          abi: baseMailerAbi,
          functionName: 'isRecipientRegistered',
          args: [email]
        }) as [boolean, boolean];

        const isRegistered = registrationStatus[0];

        if (!isRegistered) {
          results[email] = { isValid: false, exists: false, reason: 'Address not found' };
        } else {
          results[email] = { isValid: true, exists: true };
        }

        // Simple throttle to prevent 429 errors
        await new Promise(resolve => setTimeout(resolve, 200));

      } catch (error) {
        console.error(`[MailService] Error validating email ${email}:`, error);
        // On error, assume valid to avoid blocking sends
        results[email] = { isValid: true, exists: true, reason: 'Could not verify' };
      }
    }

    return results;
  }

  private async fetchEmailFromIPFS(cidHash: string): Promise<{ subject: string; body: string; from?: string; inReplyTo?: string } | null> {
    try {
      console.log('[MailService] fetchEmailFromIPFS called with CID hash:', cidHash);

      if (cidHash === '0x' + '0'.repeat(64)) {
        console.log('[MailService] Skipping dummy CID');
        return null;
      }

      let actualCid: string | undefined;

      if (!cidHash.startsWith('0x')) {
        actualCid = cidHash;
        console.log('[MailService] Input is already a full CID, skipping lookup:', actualCid);
      } else {
        try {
          const retrieveResponse = await fetch(`/api/cid/retrieve?cidHash=${encodeURIComponent(cidHash)}`);

          if (retrieveResponse.ok) {
            const data = await retrieveResponse.json();
            actualCid = data.fullCid;
            console.log('[MailService] ✅ Retrieved CID from MongoDB:', { cidHash, actualCid });
          } else if (retrieveResponse.status === 404) {
            console.log('[MailService] CID not found in MongoDB, trying localStorage fallback');
          } else {
            console.warn('[MailService] MongoDB API error, trying localStorage fallback');
          }
        } catch (apiError) {
          console.error('[MailService] Error calling CID retrieve API:', apiError);
        }

        if (!actualCid && typeof window !== 'undefined') {
          try {
            const cidMap = JSON.parse(localStorage.getItem('ipfs_cid_map') || '{}');
            actualCid = cidMap[cidHash];
            if (actualCid) {
              console.log('[MailService] Retrieved CID from localStorage (fallback):', { cidHash, actualCid });
            }
          } catch (e) {
            console.error('[MailService] Failed to parse localStorage CID map:', e);
          }
        }
      }

      if (!actualCid) {
        console.warn('[MailService] ⚠️ Could not retrieve CID from MongoDB or localStorage:', cidHash);
        console.warn('[MailService] This means the email content cannot be retrieved from IPFS');
        return null;
      }

      const gatewayUrl = `https://green-managerial-cheetah-105.mypinata.cloud/ipfs/${actualCid}`;
      console.log('[MailService] Fetching from IPFS:', gatewayUrl);

      const response = await fetch(gatewayUrl);

      if (!response.ok) {
        console.warn(`[MailService] Failed to fetch from IPFS: ${response.statusText}`);
        return null;
      }

      const data = await response.json();
      console.log('[MailService] ✅ Successfully fetched email from IPFS:', { subject: data.subject, bodyLength: data.body?.length });

      return {
        subject: data.subject || 'No Subject',
        body: data.htmlBody || data.html || data.body || data.textBody || data.text || '',
        from: data.from,
        inReplyTo: data.inReplyTo
      };
    } catch (error) {
      console.error('[MailService] Error fetching from IPFS:', error);
      return null;
    }
  }

  private getCache(key: string): Record<string, EmailMessage> {
    if (typeof window === 'undefined') return {};
    try {
      return JSON.parse(localStorage.getItem(key) || '{}');
    } catch {
      return {};
    }
  }

  private setCache(key: string, cache: Record<string, EmailMessage>) {
    if (typeof window === 'undefined') return;
    try {
      localStorage.setItem(key, JSON.stringify(cache));
    } catch (e) {
      console.warn('[MailService] Cache storage failed (quota exceeded?)', e);
    }
  }

  async getInbox(email: string): Promise<EmailMessage[]> {
    try {
      const cacheKey = `dexmail_inbox_${email}`;
      const cache = this.getCache(cacheKey);

      console.log(`[MailService] Fetching inbox for: ${email}`);

      const mailIds = await readContract(wagmiConfig, {
        address: BASEMAILER_ADDRESS,
        abi: baseMailerAbi,
        functionName: 'getInbox',
        args: [email]
      }) as bigint[];

      console.log(`[MailService] Found ${mailIds.length} mail(s) in inbox`);

      if (mailIds.length === 0) {
        return [];
      }

      const messages: EmailMessage[] = [];
      let hasNewData = false;

      const fetchPromises = mailIds.map(async (id) => {
        const idStr = id.toString();

        // Use cached message if available
        if (cache[idStr]) {
          return cache[idStr];
        }

        try {
          console.log(`[MailService] Fetching new mail ID: ${id}`);

          const mail = await readContract(wagmiConfig, {
            address: BASEMAILER_ADDRESS,
            abi: baseMailerAbi,
            functionName: 'getMail',
            args: [id]
          }) as any;

          let senderEmail = mail.sender;
          try {
            const emailFromAddress = await readContract(wagmiConfig, {
              address: BASEMAILER_ADDRESS,
              abi: baseMailerAbi,
              functionName: 'addressToEmail',
              args: [mail.sender]
            }) as string;

            if (emailFromAddress && emailFromAddress.trim() !== '') {
              senderEmail = emailFromAddress;
            }
          } catch (error) {
            // Ignore resolution error
          }

          const ipfsContent = await this.fetchEmailFromIPFS(mail.cid);

          // Better fallback to distinguish between "Loading..." vs "Failed" vs "Empty"
          const subject = ipfsContent ? (ipfsContent.subject || '(No Subject)') : 'Loading Subject...';
          const body = ipfsContent ? (ipfsContent.body || '') : 'Loading content from decentralized storage...';

          const finalSender = (mail.isExternal && mail.originalSender) ? mail.originalSender : senderEmail;

          const newMessage: EmailMessage = {
            messageId: idStr,
            from: finalSender,
            to: [mail.recipientEmail],
            subject: subject,
            body: body,
            timestamp: mail.timestamp.toString(),
            ipfsCid: mail.cid,
            inReplyTo: ipfsContent?.inReplyTo,
            isSpam: mail.isSpam
          };

          cache[idStr] = newMessage;
          hasNewData = true;
          return newMessage;

        } catch (mailError) {
          console.error(`[MailService] Error fetching mail ID ${id}:`, mailError);
          return null;
        }
      });

      const results = await Promise.all(fetchPromises);
      results.forEach(msg => {
        if (msg) messages.push(msg);
      });

      if (hasNewData) {
        this.setCache(cacheKey, cache);
        console.log('[MailService] Updated inbox cache');
      }

      return messages.reverse();
    } catch (error: any) {
      if (error?.name === 'ContractFunctionZeroDataError' ||
        error?.cause?.name === 'ContractFunctionZeroDataError' ||
        error?.message?.includes('returned no data')) {
        return [];
      }
      console.error('[MailService] Error fetching inbox:', error);
      throw error;
    }
  }

  async getSent(email: string, walletAddress?: string): Promise<EmailMessage[]> {
    try {
      const cacheKey = `dexmail_sent_${email}`;
      const cache = this.getCache(cacheKey);

      console.log(`[MailService] Fetching sent emails for: ${email}`);

      // Use provided wallet address or fall back to wagmi
      let senderAddress: `0x${string}` | undefined;

      if (walletAddress) {
        senderAddress = walletAddress as `0x${string}`;
      } else {
        const { getAccount } = await import('@wagmi/core');
        const account = getAccount(wagmiConfig);
        senderAddress = account.address;
      }

      if (!senderAddress) return [];

      const { getPublicClient } = await import('@wagmi/core');
      const publicClient = getPublicClient(wagmiConfig);

      if (!publicClient) return [];

      const currentBlock = await publicClient.getBlockNumber();
      let mailIds: bigint[] = [];
      let usingLogFallback = false;

      try {
        // fast path: try to get directly from smart contract indexing
        const sentIds = await readContract(wagmiConfig, {
          address: BASEMAILER_ADDRESS,
          abi: baseMailerAbi,
          functionName: 'getSentMails',
          args: [email]
        }) as unknown as bigint[];

        if (sentIds && Array.isArray(sentIds)) {
          mailIds = [...sentIds];
          console.log('[MailService] Used on-chain index for sent mails:', mailIds.length);
        } else {
          usingLogFallback = true;
        }
      } catch (err) {
        console.warn('[MailService] getSentMails failed (contract likely older), falling back to logs');
        usingLogFallback = true;
      }

      let fetchPromises;

      if (usingLogFallback) {
        // Fallback: Fetch logs for last 3000 blocks
        const fromBlock = currentBlock > BigInt(3000) ? currentBlock - BigInt(3000) : BigInt(0);

        const logs = await publicClient.getLogs({
          address: BASEMAILER_ADDRESS,
          event: {
            type: 'event',
            name: 'MailSent',
            inputs: [
              { type: 'uint256', name: 'mailId', indexed: true },
              { type: 'address', name: 'sender', indexed: true },
              { type: 'string', name: 'recipient' },
              { type: 'string', name: 'cid' },
              { type: 'string', name: 'originalSender' },
              { type: 'bool', name: 'isSpam' }
            ]
          },
          args: {
            sender: senderAddress
          },
          fromBlock: fromBlock,
          toBlock: currentBlock
        });

        console.log(`[MailService] Found ${logs.length} sent mail event(s)`);

        fetchPromises = logs.map(async (log) => {
          const mailId = log.args.mailId as bigint;
          return this.fetchMailDetails(mailId, email, cache);
        });

      } else {
        // Process IDs from on-chain index
        fetchPromises = mailIds.map(async (id) => {
          return this.fetchMailDetails(id, email, cache);
        });
      }

      const results = await Promise.all(fetchPromises);
      const messages: EmailMessage[] = [];
      let hasNewData = false;

      results.forEach(msg => {
        if (msg) {
          messages.push(msg);
          // Verify if it's new for cache
          if (!cache[msg.messageId]) hasNewData = true;
          cache[msg.messageId] = msg;
        }
      });

      if (hasNewData) {
        this.setCache(cacheKey, cache);
        console.log('[MailService] Updated sent cache');
      }

      // Sort by timestamp desc
      return messages.sort((a, b) => Number(b.timestamp) - Number(a.timestamp));

    } catch (error) {
      console.error('[MailService] Error fetching sent emails:', error);
      return [];
    }
  }

  // Helper to fetch details for a single mail ID (used by both strategies)
  private async fetchMailDetails(mailId: bigint, userEmail: string, cache: Record<string, EmailMessage>): Promise<EmailMessage | null> {
    try {
      const idStr = mailId.toString();

      if (cache[idStr]) {
        return cache[idStr];
      }

      const mail = await readContract(wagmiConfig, {
        address: BASEMAILER_ADDRESS,
        abi: baseMailerAbi,
        functionName: 'getMail',
        args: [mailId]
      }) as any;

      const cidHash = mail.cid;
      const ipfsContent = await this.fetchEmailFromIPFS(cidHash);
      const subject = ipfsContent?.subject || 'Sent Email';
      const body = ipfsContent?.body || '';

      const newMessage: EmailMessage = {
        messageId: idStr,
        from: userEmail, // We know it's from us
        to: [mail.recipientEmail],
        subject: subject,
        body: body,
        timestamp: mail.timestamp.toString(),
        hasCryptoTransfer: mail.hasCrypto,
        ipfsCid: cidHash,
        inReplyTo: ipfsContent?.inReplyTo,
        isSpam: mail.isSpam
      };
      return newMessage;
    } catch (e) {
      console.error(`Failed to fetch mail details for ID ${mailId}`, e);
      return null;
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
      ipfsCid: mail.cid,
      isSpam: mail.isSpam
    };
  }

  async deleteMessage(messageId: string, email: string): Promise<{ success: boolean; messageId: string }> {
    return { success: true, messageId };
  }

  // In-memory cache for status to avoid frequent API calls
  private statusCache: Record<string, EmailStatus> = {};
  private hasInitializedCache = false;

  async initializeStatusCache(address: string, force = false): Promise<void> {
    if (this.hasInitializedCache && !force) return;
    try {
      const response = await fetch(`/api/email/status?address=${address}`);
      if (response.ok) {
        this.statusCache = await response.json();
        this.hasInitializedCache = true;
      }
    } catch (error) {
      console.error('Failed to initialize status cache:', error);
    }
  }

  getEmailStatus(messageId: string): EmailStatus {
    return this.statusCache[messageId] || {
      read: false,
      spam: false,
      archived: false,
      deleted: false,
      draft: false,
      labels: []
    };
  }

  async updateEmailStatus(messageId: string, status: Partial<EmailStatus>, address?: string): Promise<void> {
    const currentStatus = this.getEmailStatus(messageId);
    const newStatus = { ...currentStatus, ...status };
    this.statusCache[messageId] = newStatus;

    if (address) {
      try {
        // Optimistic update done in cache, sync to server in background
        fetch('/api/email/status', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ messageId, status: newStatus, address })
        }).catch(err => console.error('Failed to sync status update:', err));
      } catch (e) {
        console.error('Error triggering status update:', e);
      }
    }
  }

  markAsRead(messageId: string, address: string): void {
    this.updateEmailStatus(messageId, { read: true }, address);
  }

  markAsUnread(messageId: string, address: string): void {
    this.updateEmailStatus(messageId, { read: false }, address);
  }

  moveToSpam(messageId: string, address: string): void {
    this.updateEmailStatus(messageId, { spam: true, archived: false, deleted: false }, address);
  }

  removeFromSpam(messageId: string, address: string): void {
    this.updateEmailStatus(messageId, { spam: false }, address);
  }

  moveToArchive(messageId: string, address: string): void {
    this.updateEmailStatus(messageId, { archived: true, spam: false, deleted: false }, address);
  }

  removeFromArchive(messageId: string, address: string): void {
    this.updateEmailStatus(messageId, { archived: false }, address);
  }

  moveToTrash(messageId: string, address: string): void {
    this.updateEmailStatus(messageId, { deleted: true, spam: false, archived: false, deletedAt: Date.now() }, address);
  }

  restoreFromTrash(messageId: string, address: string): void {
    this.updateEmailStatus(messageId, { deleted: false }, address);
  }

  markAsDraft(messageId: string, address: string): void {
    this.updateEmailStatus(messageId, { draft: true }, address);
  }
  removeDraftStatus(messageId: string, address: string): void {
    this.updateEmailStatus(messageId, { draft: false }, address);
  }

  addLabel(messageId: string, label: string, address: string): void {
    const currentStatus = this.getEmailStatus(messageId);
    const labels = currentStatus.labels || [];
    if (!labels.includes(label)) {
      this.updateEmailStatus(messageId, { labels: [...labels, label] }, address);
    }
  }

  cleanupTrash(address: string): void {
    const statusMap = this.statusCache;
    const now = Date.now();
    const THIRTY_DAYS_MS = 30 * 24 * 60 * 60 * 1000;

    Object.keys(statusMap).forEach(id => {
      const status = statusMap[id];
      if (status.deleted && status.deletedAt && (now - status.deletedAt > THIRTY_DAYS_MS)) {
        this.updateEmailStatus(id, { purged: true }, address);
      }
    });
  }

  // Drafts
  async getDrafts(address: string): Promise<DraftEmail[]> {
    if (!address) return [];
    try {
      const response = await fetch(`/api/email/drafts?address=${address}`);
      if (!response.ok) return [];
      const drafts = await response.json();
      return drafts.map((d: any) => ({
        id: d.draftId,
        to: d.to,
        subject: d.subject,
        body: d.body,
        timestamp: d.timestamp
      }));
    } catch (error) {
      console.error('Failed to fetch drafts:', error);
      return [];
    }
  }

  async saveDraft(draft: DraftEmail, address: string): Promise<void> {
    if (!address) return;
    try {
      await fetch('/api/email/drafts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...draft, address })
      });
    } catch (error) {
      console.error('Failed to save draft:', error);
    }
  }

  async deleteDraft(id: string, address: string): Promise<void> {
    if (!address) return;
    try {
      await fetch(`/api/email/drafts?id=${id}&address=${address}`, {
        method: 'DELETE'
      });
    } catch (error) {
      console.error('Failed to delete draft:', error);
    }
  }

  removeLabel(messageId: string, label: string, address: string): void {
    const currentStatus = this.getEmailStatus(messageId);
    const labels = currentStatus.labels || [];
    this.updateEmailStatus(messageId, { labels: labels.filter(l => l !== label) }, address);
  }
}

export const mailService = new MailService();
export default MailService;
