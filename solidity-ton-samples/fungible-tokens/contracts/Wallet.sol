pragma tvm-solidity >= 0.72.0;

import "ActionConstants.sol";
import "Interfaces.sol";
import "JettonUtils.sol";
import "Minter.sol";

function getWalletStateInit(TvmCell code, address_std owner, address_std jettonMaster) inline pure
    returns(TvmCell stateInit, Wallet wallet)
{
    stateInit = abi.encodeStateInit({
        contr: Wallet,
        code: code,
        varInit: {
            owner: owner,
            jettonMaster: jettonMaster
        }
    });
    wallet = Wallet(address_std.makeAddrStd(BASE_CHAIN, tvm.hash(stateInit)));
}

contract Wallet {

    coins balance;
    address_std static owner;
    Minter static jettonMaster;

    uint16 constant NOT_VALID_SENDER = 101;
    coins constant MIN_WALLET_BALANCE = 0.01 ton;

    modifier checkSender(address_std expectedSender) {
        require(msg.sender == expectedSender, NOT_VALID_SENDER);
        _;
    }

    // Receive jettons from minter or from another wallet
    function receiveJettons(
        uint64 queryId,
        coins jettonAmount,
        address_std fromOwner,
        address_std response,
        coins forwardTonAmount,
        optional(TvmCell) forwardPayload
    )
        public functionID(0x178d4519)
    {
        (, Wallet fromWallet) = getWalletStateInit(tvm.code(), fromOwner, jettonMaster);

        require(msg.sender == jettonMaster || msg.sender == fromWallet, NOT_VALID_SENDER);

        balance += jettonAmount;

        if (forwardTonAmount != 0) {
            UserWallet(owner).transferNotification{
                value: forwardTonAmount,
                bounce: false,
                flag: SendMode.PAY_FEES_SEPARATELY | SendMode.BOUNCE_ON_ACTION_FAIL
            }(queryId, jettonAmount, fromOwner, forwardPayload);
        }

        reserveBalance();
        sendAllTonBalance(response, queryId);
    }

    // Send jettons to another wallet
    function sendJettons(
        uint64 queryId,
        coins jettonAmount,
        address_std toOwner,
        address_std response,
        optional(TvmCell) customPayload,
        coins forwardTonAmount,
        optional(TvmCell) forwardPayload
    )
        public functionID(0x0f8a7ea5) checkSender(owner)
    {
        customPayload; // ignore

        checkSameWorkchain(toOwner);

        balance -= jettonAmount; // throws an error on underflow (if balance < 0)

        (TvmCell stateInit, Wallet toWallet) = getWalletStateInit(tvm.code(), toOwner, jettonMaster);

        reserveBalance();
        toWallet.receiveJettons{
            value: 0,
            bounce: true,
            stateInit: stateInit,
            flag: SendMode.CARRY_ALL_BALANCE | SendMode.BOUNCE_ON_ACTION_FAIL
        }(queryId, jettonAmount, owner, response, forwardTonAmount, forwardPayload);
    }

    function reserveBalance() private pure {
        coins toLeaveOnBalance = address(this).balance - msg.value + tx.storageFees;
        tvm.rawReserve(math.max(toLeaveOnBalance, MIN_WALLET_BALANCE), ReserveMode.AT_MOST);
    }

    onBounce(TvmSlice data) external {
        uint32 funcId = data.load(uint32);
        if (funcId == abi.functionId(Wallet.receiveJettons)) {
            data.load(uint64); // skip queryId
            coins jettonAmount = data.load(coins);
            balance += jettonAmount;
        }
    }

    // Getters:

    function get_wallet_data() getter returns (
        coins _balance,
        address_std _owner,
        address_std _jettonMaster,
        TvmCell myCode
    ) {
        return (balance, owner, jettonMaster, tvm.code());
    }
}
