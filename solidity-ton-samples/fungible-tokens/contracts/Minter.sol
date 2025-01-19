pragma tvm-solidity >= 0.72.0;

import "ActionConstants.sol";
import "JettonUtils.sol";
import "Wallet.sol";

contract Minter {

    coins totalSupply;
    address_std static admin;
    TvmCell static content;
    TvmCell static jettonWalletCode;

    uint16 constant ERROR_NOT_ADMIN = 101;
    uint16 constant NOT_VALID_WALLET = 102;
    uint16 constant NOT_ENOUGH_VALUE = 103;
    coins constant MIN_MINTER_BALANCE = 0.55 ton;

    modifier onlyAdmin {
        require(msg.sender == admin, ERROR_NOT_ADMIN);
        _;
    }

    function mintTokens(uint64 queryId, address_std to, coins tonAmount, TvmCell masterMsg)
        public onlyAdmin
        functionID(0x642b7d07)
    {
        queryId; // ignore
        checkSameWorkchain(to);
        require(msg.value > tonAmount + msg.forwardFee + 0.05 ton, NOT_ENOUGH_VALUE);

        TvmSlice slice = masterMsg.toSlice();
        (
            uint64 queryId2,
            coins jettonAmount,
            address_std from,
            address_std response,
            coins forwardTonAmount,
            optional(TvmCell) forwardPayload
        ) = slice.load(uint64, coins, address_std, address_std, coins, optional(TvmCell));

        totalSupply += jettonAmount;

        tvm.rawReserve(MIN_MINTER_BALANCE, ReserveMode.REGULAR); // reserve for storage fees

        (TvmCell stateInit, Wallet toWallet) = getWalletStateInit(jettonWalletCode, to, address(this));
        toWallet.receiveJettons{
            value: tonAmount,
            bounce: true,
            stateInit: stateInit,
            flag: SendMode.PAY_FEES_SEPARATELY | SendMode.BOUNCE_ON_ACTION_FAIL
        }(queryId2, jettonAmount, from, response, forwardTonAmount, forwardPayload);
    }

    function setAdmin(uint64 queryId, address_std newAdmin) public onlyAdmin functionID(0x6501f354) {
        admin = newAdmin;

        coins toLeaveOnBalance = address(this).balance - msg.value + tx.storageFees;
        tvm.rawReserve(toLeaveOnBalance, ReserveMode.AT_MOST);
        sendAllTonBalance(msg.sender, queryId);
    }

    onBounce(TvmSlice data) external {
        uint32 funcId = data.load(uint32);
        if (funcId == abi.functionId(Wallet.receiveJettons)) {
            data.load(uint64); // skip queryId
            coins jettonAmount = data.load(coins);
            totalSupply -= jettonAmount;
        }
    }

    // Getters:

    function get_wallet_address(address_std owner) getter returns (address_std walletAddress) {
        (, Wallet addr) = getWalletStateInit(jettonWalletCode, owner, address(this));
        return addr;
    }

    function get_jetton_data() getter returns (
        coins _totalSupply,
        bool mintable,
        address_std adminAddress,
        TvmCell _content,
        TvmCell walletCode
    ) {
        mintable = admin != address.makeAddrNone();
        return (totalSupply, mintable, admin, content, jettonWalletCode);
    }

}
