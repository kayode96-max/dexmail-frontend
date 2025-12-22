// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "@openzeppelin/contracts/utils/Pausable.sol";

library Create2 {
    /**
     * @dev Deploys a contract using CREATE2. Reverts on failure.
     */
    function deploy(uint256 amount, bytes32 salt, bytes memory bytecode) internal returns (address) {
        address addr;
        require(address(this).balance >= amount, "Create2: insufficient balance");
        require(bytecode.length != 0, "Create2: bytecode length is zero");
        assembly {
            addr := create2(amount, add(bytecode, 0x20), mload(bytecode), salt)
        }
        require(addr != address(0), "Create2: failed deploy");
        return addr;
    }

    /**
     * @dev Computes the address for a contract deployed using CREATE2.
     */
    function computeAddress(bytes32 salt, bytes32 bytecodeHash, address deployer) internal pure returns (address) {
        bytes32 _data = keccak256(abi.encodePacked(bytes1(0xff), deployer, salt, bytecodeHash));
        return address(uint160(uint256(_data)));
    }
}

interface IERC20 {
    function transferFrom(address from, address to, uint256 amount) external returns (bool);
    function transfer(address to, uint256 amount) external returns (bool);
    function balanceOf(address account) external view returns (uint256);
}

interface IERC721 {
    function transferFrom(address from, address to, uint256 tokenId) external;
    function ownerOf(uint256 tokenId) external view returns (address);
    function safeTransferFrom(address from, address to, uint256 tokenId) external;
}

/**
 * @title EmailWallet
 * @notice Smart contract wallet for email-based accounts with ERC-4337 support
 */
contract EmailWallet is ReentrancyGuard {
    address public owner;
    address public immutable FACTORY;
    
    event WalletInitialized(address indexed owner);
    event OwnerChanged(address indexed oldOwner, address indexed newOwner);
    event Executed(address indexed dest, uint256 value, bytes func);
    
    error Unauthorized();
    error AlreadyInitialized();
    error ExecutionFailed();
    error ZeroAddress();
    
    modifier onlyOwnerOrFactory() {
        if (msg.sender != owner && msg.sender != FACTORY) revert Unauthorized();
        _;
    }
    
    constructor(address _factory) {
        if (_factory == address(0)) revert ZeroAddress();
        FACTORY = _factory;
    }
    
    function initialize(address _owner) external {
        if (msg.sender != FACTORY) revert Unauthorized();
        if (owner != address(0)) revert AlreadyInitialized();
        if (_owner == address(0)) revert ZeroAddress();
        
        owner = _owner;
        emit WalletInitialized(_owner);
    }
    
    function execute(
        address dest,
        uint256 value,
        bytes calldata func
    ) external onlyOwnerOrFactory nonReentrant {
        if (dest == address(0)) revert ZeroAddress();
        
        (bool success, ) = dest.call{value: value}(func);
        if (!success) revert ExecutionFailed();
        
        emit Executed(dest, value, func);
    }
    
    function changeOwner(address newOwner) external {
        if (msg.sender != owner) revert Unauthorized();
        if (newOwner == address(0)) revert ZeroAddress();
        
        address oldOwner = owner;
        owner = newOwner;
        emit OwnerChanged(oldOwner, newOwner);
    }
    
    receive() external payable {}
}

/**
 * @title BaseMailer
 * @notice Enhanced email-crypto system with Account Abstraction support
 */
contract BaseMailer is Ownable, Pausable, ReentrancyGuard {
    struct Mail {
        address sender;
        uint64 timestamp;
        bool isExternal;
        bool hasCrypto;
        bool isSpam;
        // The strings below are dynamic and take up their own slots + storage
        string cid;
        string recipientEmail;
        string originalSender; // For bridged emails
    }
    
    struct CryptoTransfer {
        address token;
        uint64 timestamp;
        bool isNft;
        bool claimed;
        uint256 amount;
        address sender;
        string recipientEmail;
    }
    
    // Constants
    uint256 public constant MAX_EMAIL_LENGTH = 320; // RFC 5321 standard
    uint256 public constant MIN_TRANSFER_AMOUNT = 1;
    
    // Email registration
    mapping(string => address) public emailOwner;
    mapping(bytes32 => address) public emailHashToOwner;
    mapping(address => string) public addressToEmail;
    
    // Mail inbox
    mapping(string => uint256[]) public inbox;
    Mail[] public mails;
    
    // Email-to-wallet mapping
    mapping(bytes32 => address) public emailToWallet;
    mapping(bytes32 => CryptoTransfer[]) public pendingTransfers;
    mapping(address => bool) public isWalletDeployed;
    
    // Trusted relayer for email verification

    
    // Gas sponsorship
    mapping(address => bool) public authorizedRelayers;
    
    // Security: Rate limiting
    mapping(address => uint256) public lastTransferTime;
    uint256 public transferCooldown = 1 seconds;
    
    // Security: Maximum transfers per email
    mapping(bytes32 => uint256) public transferCount;
    uint256 public maxTransfersPerEmail = 1000;

    // Whitelist and Fees
    mapping(bytes32 => mapping(bytes32 => bool)) public whitelist; // RecipientHash -> SenderHash -> Allowed
    mapping(bytes32 => string[]) private _whitelistedEmails; // RecipientHash -> List of allowed emails
    mapping(bytes32 => uint256) public contactFees; // RecipientHash -> Fee (in wei)
    
    event EmailRegistered(string email, address indexed owner);
    event MailSent(uint256 indexed mailId, address indexed sender, string recipient, string cid, string originalSender, bool isSpam);
    event CryptoSent(bytes32 indexed emailHash, address indexed token, uint256 amount, address indexed sender);
    event WhitelistUpdated(bytes32 indexed userEmailHash, bytes32 indexed targetEmailHash, bool status);
    event ContactFeeUpdated(bytes32 indexed userEmailHash, uint256 fee);
    event WalletCreated(bytes32 indexed emailHash, address walletAddress);
    event WalletClaimed(bytes32 indexed emailHash, address walletAddress, address indexed claimant);
    event RelayerAuthorized(address indexed relayer, bool authorized);

    event TransferCooldownUpdated(uint256 newCooldown);
    
    error EmailTaken();
    error EmailTooLong();
    error Unauthorized();
    error InvalidAmount();
    error InvalidAddress();
    error InvalidEmailHash();
    error TransferFailed();
    error WalletAlreadyClaimed();
    error InvalidVerification();
    error TransferLimitExceeded();
    error RateLimitExceeded();
    error InvalidMailId();
    error NFTTransferFailed();
    error NotNFTOwner();
    error InsufficientFee();
    error FeeTransferFailed();
    error WalletAlreadyLinked();
    
    modifier onlyRelayer() {
        if (!authorizedRelayers[msg.sender]) revert Unauthorized();
        _;
    }
    
    modifier rateLimited() {
        if (block.timestamp < lastTransferTime[msg.sender] + transferCooldown) {
            revert RateLimitExceeded();
        }
        lastTransferTime[msg.sender] = block.timestamp;
        _;
    }
    
    constructor(address _initialOwner) Ownable(_initialOwner) {
        authorizedRelayers[_initialOwner] = true;
    }
    
    // ============ EMAIL REGISTRATION ============
    
    function registerEmail(string calldata email) external whenNotPaused {
        if (bytes(email).length > MAX_EMAIL_LENGTH) revert EmailTooLong();
        if (emailOwner[email] != address(0)) revert EmailTaken();
        if (bytes(addressToEmail[msg.sender]).length > 0) revert WalletAlreadyLinked();
        
        emailOwner[email] = msg.sender;
        emailHashToOwner[keccak256(abi.encodePacked(email))] = msg.sender;
        addressToEmail[msg.sender] = email;
        emit EmailRegistered(email, msg.sender);
    }
    
    /**
     * @notice Register email with embedded wallet (e.g., Coinbase embedded wallet)
     * @dev This function is specifically for embedded wallet registrations
     * @param email The email address to register
     */
    function registerEmailWithEmbeddedWallet(string calldata email) external whenNotPaused {
        if (bytes(email).length > MAX_EMAIL_LENGTH) revert EmailTooLong();
        if (emailOwner[email] != address(0)) revert EmailTaken();
        if (bytes(addressToEmail[msg.sender]).length > 0) revert WalletAlreadyLinked();
        
        emailOwner[email] = msg.sender;
        emailHashToOwner[keccak256(abi.encodePacked(email))] = msg.sender;
        addressToEmail[msg.sender] = email;
        emit EmailRegistered(email, msg.sender);
    }
    
    // ============ MAIL INDEXING ============
    
    function indexMail(
        string calldata cid,
        string calldata recipientEmail,
        string calldata originalSender,
        bool isExternal,
        bool hasCrypto
    ) external payable whenNotPaused {
        if (bytes(recipientEmail).length > MAX_EMAIL_LENGTH) revert EmailTooLong();
        
        string memory senderEmail = addressToEmail[msg.sender];
        bool isSpam = _checkSpamAndFees(senderEmail, recipientEmail);

        uint256 mailId = mails.length;
        
        mails.push(Mail({
            sender: msg.sender,
            timestamp: uint64(block.timestamp),
            isExternal: isExternal,
            hasCrypto: hasCrypto,
            isSpam: isSpam,
            cid: cid,
            recipientEmail: recipientEmail,
            originalSender: originalSender
        }));
        
        inbox[recipientEmail].push(mailId);
        
        // Auto-whitelist logic: When sending mail to someone, automatically whitelist them
        // so they can reply without paying fees.
        {
            bytes32 senderHash = keccak256(abi.encodePacked(senderEmail));
            bytes32 recipientHash = keccak256(abi.encodePacked(recipientEmail));

            if (!whitelist[senderHash][recipientHash]) {
                whitelist[senderHash][recipientHash] = true;
                _whitelistedEmails[senderHash].push(recipientEmail);
                emit WhitelistUpdated(senderHash, recipientHash, true);
            }
        }
        
        emit MailSent(mailId, msg.sender, recipientEmail, cid, originalSender, isSpam);
    }

    function _checkSpamAndFees(string memory senderEmail, string calldata recipientEmail) private returns (bool) {
        // If sender is not registered, default to spam
        if (bytes(senderEmail).length == 0) return true;

        bytes32 recipientHash = keccak256(abi.encodePacked(recipientEmail));
        
        // Self-send is never spam
        if (keccak256(abi.encodePacked(senderEmail)) == recipientHash) return false;

        bytes32 senderHash = keccak256(abi.encodePacked(senderEmail));

        // If whitelisted, not spam
        if (whitelist[recipientHash][senderHash]) return false;

        // Not whitelisted, check fee
        uint256 fee = contactFees[recipientHash];
        
        if (fee > 0) {
            if (msg.value < fee) revert InsufficientFee();
            
            address recipientWallet = emailOwner[recipientEmail];
            if (recipientWallet == address(0)) revert InvalidAddress(); 

            (bool success, ) = recipientWallet.call{value: fee}("");
            if (!success) revert FeeTransferFailed();
            
            return false; // Fee paid -> Not Spam
        }

        // No fee set, not whitelisted -> Spam
        return true;
    }
    
    function getInbox(string calldata email) external view returns (uint256[] memory) {
        return inbox[email];
    }
    
    function getMail(uint256 mailId) external view returns (Mail memory) {
        if (mailId >= mails.length) revert InvalidMailId();
        return mails[mailId];
    }
    
    // ============ SMART WALLET FACTORY ============
    
    function computeWalletAddress(string calldata email) public view returns (address) {
        bytes32 emailHash = keccak256(abi.encodePacked(email));
        return getWalletAddress(emailHash);
    }
    
    function getWalletAddress(bytes32 emailHash) public view returns (address) {
        bytes32 salt = emailHash;
        bytes memory bytecode = abi.encodePacked(
            type(EmailWallet).creationCode,
            abi.encode(address(this))
        );
        
        return Create2.computeAddress(salt, keccak256(bytecode), address(this));
    }
    
    function computeWalletHash(string calldata email) public pure returns (bytes32) {
        return keccak256(abi.encodePacked(email));
    }
    
    /**
     * @notice Check if a recipient email is registered and if their wallet is deployed
     * @param email The recipient's email address
     * @return registered True if the email is registered in the system
     * @return walletDeployed True if the wallet has been deployed for this email
     */
    function isRecipientRegistered(string calldata email) public view returns (bool registered, bool walletDeployed) {
        registered = emailOwner[email] != address(0);
        if (registered) {
            bytes32 emailHash = keccak256(abi.encodePacked(email));
            address walletAddr = getWalletAddress(emailHash);
            walletDeployed = isWalletDeployed[walletAddr];
        }
    }
    
    // ============ CRYPTO TRANSFERS ============
    
    function sendToEmail(
        bytes32 emailHash,
        address token,
        uint256 amount
    ) external payable nonReentrant whenNotPaused rateLimited {
        if (amount < MIN_TRANSFER_AMOUNT) revert InvalidAmount();
        if (emailHash == bytes32(0)) revert InvalidEmailHash();
        if (transferCount[emailHash] >= maxTransfersPerEmail) revert TransferLimitExceeded();
        
        address recipient = emailHashToOwner[emailHash];
        bool isDirectTransfer = recipient != address(0);
        
        if (!isDirectTransfer) {
            recipient = getWalletAddress(emailHash);
        }
        
        // Transfer funds
        if (token == address(0)) {
            if (msg.value != amount) revert InvalidAmount();
            (bool success, ) = recipient.call{value: amount}("");
            if (!success) revert TransferFailed();
        } else {
            if (msg.value != 0) revert InvalidAmount();
            if (!IERC20(token).transferFrom(msg.sender, recipient, amount)) {
                revert TransferFailed();
            }
        }
        
        // Record pending claim
        pendingTransfers[emailHash].push(CryptoTransfer({
            token: token,
            timestamp: uint64(block.timestamp),
            isNft: false,
            claimed: isDirectTransfer,
            amount: amount,
            sender: msg.sender,
            recipientEmail: ""
        }));
        
        transferCount[emailHash]++;
        
        emit CryptoSent(emailHash, token, amount, msg.sender);
    }
    
    function sendNftToEmail(
        bytes32 emailHash,
        address nftContract,
        uint256 tokenId
    ) external nonReentrant whenNotPaused rateLimited {
        if (emailHash == bytes32(0)) revert InvalidEmailHash();
        if (nftContract == address(0)) revert InvalidAddress();
        if (transferCount[emailHash] >= maxTransfersPerEmail) revert TransferLimitExceeded();
        
        address recipient = emailHashToOwner[emailHash];
        bool isDirectTransfer = recipient != address(0);
        
        if (!isDirectTransfer) {
            recipient = getWalletAddress(emailHash);
        }
        
        // Verify sender owns the NFT
        if (IERC721(nftContract).ownerOf(tokenId) != msg.sender) revert NotNFTOwner();
        
        // Use safeTransferFrom for better compatibility
        try IERC721(nftContract).safeTransferFrom(msg.sender, recipient, tokenId) {
            // Verify transfer was successful
            if (IERC721(nftContract).ownerOf(tokenId) != recipient) {
                revert NFTTransferFailed();
            }
        } catch {
            revert NFTTransferFailed();
        }
        
        // Record pending claim
        pendingTransfers[emailHash].push(CryptoTransfer({
            token: nftContract,
            timestamp: uint64(block.timestamp),
            isNft: true,
            claimed: isDirectTransfer,
            amount: tokenId,
            sender: msg.sender,
            recipientEmail: ""
        }));
        
        transferCount[emailHash]++;
        
        emit CryptoSent(emailHash, nftContract, tokenId, msg.sender);
    }
    
    function sendMailWithCrypto(
        string calldata cid,
        string calldata recipientEmail,
        bool isExternal,
        address token,
        uint256 amount,
        bool isNft
    ) external payable nonReentrant whenNotPaused rateLimited {
        // 1. Index Mail
        if (bytes(recipientEmail).length > MAX_EMAIL_LENGTH) revert EmailTooLong();
        
        uint256 mailId = mails.length;
        mails.push(Mail({
            sender: msg.sender,
            timestamp: uint64(block.timestamp),
            isExternal: isExternal,
            hasCrypto: true,
            isSpam: false, // See note above
            cid: cid,
            recipientEmail: recipientEmail,
            originalSender: ""
        }));
        
        inbox[recipientEmail].push(mailId);
        
        emit MailSent(mailId, msg.sender, recipientEmail, cid, "", false);

        // 2. Send Crypto
        _sendCrypto(recipientEmail, token, amount, isNft);
    }

    function sendCryptoToEmail(
        string calldata recipientEmail,
        address token,
        uint256 amount,
        bool isNft
    ) external payable nonReentrant whenNotPaused rateLimited {
        _sendCrypto(recipientEmail, token, amount, isNft);
    }

    function _sendCrypto(
        string calldata recipientEmail,
        address token,
        uint256 amount,
        bool isNft
    ) internal {
        if (amount < MIN_TRANSFER_AMOUNT) revert InvalidAmount();
        if (bytes(recipientEmail).length > MAX_EMAIL_LENGTH) revert EmailTooLong();
        
        bytes32 emailHash = keccak256(abi.encodePacked(recipientEmail));
        if (transferCount[emailHash] >= maxTransfersPerEmail) revert TransferLimitExceeded();
        
        address recipient = emailHashToOwner[emailHash];
        bool isDirectTransfer = recipient != address(0);
        
        if (!isDirectTransfer) {
            recipient = getWalletAddress(emailHash);
        }
        
        // Check if recipient is registered
        // (bool registered, bool walletDeployed) = isRecipientRegistered(recipientEmail);
        // We don't need this check anymore as we check emailHashToOwner directly
        
        // Transfer assets based on registration status
        if (isNft) {
            if (token == address(0)) revert InvalidAddress();
            if (IERC721(token).ownerOf(amount) != msg.sender) revert NotNFTOwner();
            
            // For NFTs, always transfer to deterministic wallet address
            try IERC721(token).safeTransferFrom(msg.sender, recipient, amount) {
                if (IERC721(token).ownerOf(amount) != recipient) {
                    revert NFTTransferFailed();
                }
            } catch {
                revert NFTTransferFailed();
            }
        } else if (token == address(0)) {
            // Native ETH transfer
            if (msg.value != amount) revert InvalidAmount();
            (bool success, ) = recipient.call{value: amount}("");
            if (!success) revert TransferFailed();
        } else {
            // ERC20 token transfer
            if (msg.value != 0) revert InvalidAmount();
            
            // Deduct tokens from sender's balance via transferFrom
            if (!IERC20(token).transferFrom(msg.sender, recipient, amount)) {
                revert TransferFailed();
            }
        }
        
        // Record transfer
        pendingTransfers[emailHash].push(CryptoTransfer({
            token: token,
            timestamp: uint64(block.timestamp),
            isNft: isNft,
            claimed: isDirectTransfer,
            amount: amount,
            sender: msg.sender,
            recipientEmail: recipientEmail
        }));
        
        transferCount[emailHash]++;
        
        emit CryptoSent(emailHash, token, amount, msg.sender);
    }
    
    function getPendingTransfers(string calldata email) 
        external 
        view 
        returns (CryptoTransfer[] memory) 
    {
        bytes32 emailHash = keccak256(abi.encodePacked(email));
        return pendingTransfers[emailHash];
    }
    
    function getPendingTransfersByHash(bytes32 emailHash) 
        external 
        view 
        returns (CryptoTransfer[] memory) 
    {
        return pendingTransfers[emailHash];
    }
    
    // ============ WALLET CLAIMING ============
    
    function deployMyWallet(string calldata email) external nonReentrant whenNotPaused {
        if (msg.sender != emailOwner[email]) revert Unauthorized();
        
        bytes32 emailHash = keccak256(abi.encodePacked(email));
        address walletAddress = getWalletAddress(emailHash);
        
        if (isWalletDeployed[walletAddress]) revert WalletAlreadyClaimed();
        
        // Deploy the wallet using CREATE2
        bytes memory bytecode = abi.encodePacked(
            type(EmailWallet).creationCode,
            abi.encode(address(this))
        );
        
        address deployedWallet = Create2.deploy(0, emailHash, bytecode);
        if (deployedWallet != walletAddress) revert TransferFailed();
        
        // Initialize the wallet
        EmailWallet(payable(deployedWallet)).initialize(msg.sender);
        
        emailToWallet[emailHash] = walletAddress;
        isWalletDeployed[walletAddress] = true;
        
        // Mark all transfers as claimed
        CryptoTransfer[] storage transfers = pendingTransfers[emailHash];
        for (uint256 i = 0; i < transfers.length; i++) {
            transfers[i].claimed = true;
        }
        
        emit WalletCreated(emailHash, walletAddress);
        emit WalletClaimed(emailHash, walletAddress, msg.sender);
    }

    function claimWallet(
        string calldata email,
        address claimantOwner
    ) external onlyRelayer nonReentrant whenNotPaused {
        if (claimantOwner == address(0)) revert InvalidAddress();
        if (bytes(email).length > MAX_EMAIL_LENGTH) revert EmailTooLong();
        
        bytes32 emailHash = keccak256(abi.encodePacked(email));
        
        // Register email to address mapping if not already registered
        if (emailOwner[email] == address(0)) {
            if (bytes(addressToEmail[claimantOwner]).length > 0) revert WalletAlreadyLinked();
            emailOwner[email] = claimantOwner;
            emailHashToOwner[emailHash] = claimantOwner;
            addressToEmail[claimantOwner] = email;
            emit EmailRegistered(email, claimantOwner);
        }

        // Check if there are any unclaimed transfers
        CryptoTransfer[] storage transfers = pendingTransfers[emailHash];
        bool hasUnclaimed = false;
        for (uint256 i = 0; i < transfers.length; i++) {
            if (!transfers[i].claimed) {
                hasUnclaimed = true;
                transfers[i].claimed = true;
            }
        }

        address walletAddress = getWalletAddress(emailHash);

        // Only deploy wallet if there are unclaimed transfers (which are at the wallet address)
        // or if the wallet is already deployed (to be safe/consistent, though maybe not strictly necessary if empty)
        // But if we have unclaimed transfers, they are definitely at the walletAddress, so we MUST deploy.
        if (hasUnclaimed && !isWalletDeployed[walletAddress]) {
             // Deploy the wallet using CREATE2
            bytes memory bytecode = abi.encodePacked(
                type(EmailWallet).creationCode,
                abi.encode(address(this))
            );
            
            address deployedWallet = Create2.deploy(0, emailHash, bytecode);
            if (deployedWallet != walletAddress) revert TransferFailed();
            
            // Initialize the wallet
            EmailWallet(payable(deployedWallet)).initialize(claimantOwner);
            
            emailToWallet[emailHash] = walletAddress;
            isWalletDeployed[walletAddress] = true;
            
            emit WalletCreated(emailHash, walletAddress);
        }
        
        // If we didn't deploy, we still "claimed" the transfers (marked them as claimed).
        // If they were at the wallet address, we deployed.
        // If they were direct (claimed=true already), we didn't need to do anything.
        
        emit WalletClaimed(emailHash, walletAddress, claimantOwner);
    }
    

    
    // ============ ADMIN FUNCTIONS ============
    
    function authorizeRelayer(address relayer, bool authorized) external onlyOwner {
        if (relayer == address(0)) revert InvalidAddress();
        authorizedRelayers[relayer] = authorized;
        emit RelayerAuthorized(relayer, authorized);
    }
    

    
    function setTransferCooldown(uint256 newCooldown) external onlyOwner {
        transferCooldown = newCooldown;
        emit TransferCooldownUpdated(newCooldown);
    }
    
    function setMaxTransfersPerEmail(uint256 newMax) external onlyOwner {
        maxTransfersPerEmail = newMax;
    }
    
    function pause() external onlyOwner {
        _pause();
    }
    
    function unpause() external onlyOwner {
        _unpause();
    }
    
    function withdrawFees() external onlyOwner {
        payable(owner()).transfer(address(this).balance);
    }
    
    // ============ VIEW FUNCTIONS ============
    
    function isEmailRegistered(string calldata email) external view returns (bool) {
        return emailOwner[email] != address(0);
    }
    
    function getEmailOwner(string calldata email) external view returns (address) {
        return emailOwner[email];
    }
    
    function getAddressEmail(address addr) external view returns (string memory) {
        return addressToEmail[addr];
    }
    
    function getTransferCount(bytes32 emailHash) external view returns (uint256) {
        return transferCount[emailHash];
    }

    // ============ WHITELIST & FEE MANAGEMENT ============

    function updateWhitelist(string[] calldata emails, bool status) external {
        string memory userEmail = addressToEmail[msg.sender];
        if (bytes(userEmail).length == 0) revert Unauthorized();
        
        bytes32 userEmailHash = keccak256(abi.encodePacked(userEmail));
        string[] storage list = _whitelistedEmails[userEmailHash];
        
        for (uint256 i = 0; i < emails.length; i++) {
            string memory targetEmail = emails[i];
            bytes32 targetEmailHash = keccak256(abi.encodePacked(targetEmail));
            bool isCurrentlyWhitelisted = whitelist[userEmailHash][targetEmailHash];

            if (status && !isCurrentlyWhitelisted) {
                // Add to whitelist
                whitelist[userEmailHash][targetEmailHash] = true;
                list.push(targetEmail);
                emit WhitelistUpdated(userEmailHash, targetEmailHash, true);
            } else if (!status && isCurrentlyWhitelisted) {
                // Remove from whitelist
                whitelist[userEmailHash][targetEmailHash] = false;
                emit WhitelistUpdated(userEmailHash, targetEmailHash, false);
                
                // Remove from array (Swap and Pop)
                for (uint256 j = 0; j < list.length; j++) {
                    if (keccak256(abi.encodePacked(list[j])) == targetEmailHash) {
                        list[j] = list[list.length - 1];
                        list.pop();
                        break;
                    }
                }
            }
        }
    }

    function setContactFee(uint256 fee) external {
        string memory userEmail = addressToEmail[msg.sender];
        if (bytes(userEmail).length == 0) revert Unauthorized();
        
        bytes32 userEmailHash = keccak256(abi.encodePacked(userEmail));
        contactFees[userEmailHash] = fee;
        emit ContactFeeUpdated(userEmailHash, fee);
    }
    
    function isWhitelisted(string calldata userEmail, string calldata targetSenderEmail) external view returns (bool) {
        bytes32 userHash = keccak256(abi.encodePacked(userEmail));
        bytes32 targetHash = keccak256(abi.encodePacked(targetSenderEmail));
        return whitelist[userHash][targetHash];
    }
    
    function getContactFee(string calldata email) external view returns (uint256) {
        bytes32 emailHash = keccak256(abi.encodePacked(email));
        return contactFees[emailHash];
    }

    function getWhitelistedEmails(string calldata userEmail) external view returns (string[] memory) {
        bytes32 userEmailHash = keccak256(abi.encodePacked(userEmail));
        return _whitelistedEmails[userEmailHash];
    }
}