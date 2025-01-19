pragma tvm-solidity >= 0.72.0;
// Use expiration time for external messages
pragma AbiHeader expire;

import "./ActionConstants.sol";

contract Counter {

    // Note: only `static` state variables are used to generate contract's `stateInit` and influence on
    // generated contract address.
    mapping(address => bool) static isAllowed;
    mapping(address => uint) count;

    uint16 constant ERROR_NOT_ALLOWED = 101;
    uint16 constant ERROR_NOT_OWNER = 102;
    coins constant MIN_COUNTER_BALANCE = 0.01 ton;

    modifier allowed(address addr) {
        require(isAllowed[addr], ERROR_NOT_ALLOWED);
        _;
    }

    modifier onlyOwner {
        require(tvm.pubkey() == msg.pubkey(), ERROR_NOT_OWNER);
        _;
    }

    // Function is support to be called only by internal message.
    function inc() public allowed(msg.sender) {
        ++count[msg.sender];
        returnChange();
    }

    // Function is support to be called only by external message.
    function grant(address user, uint value) public onlyOwner allowed(user) {
        tvm.accept();
        count[user] += value;
    }

    // Internal function that is not part of ABI (See Counter.abi.json).
    function returnChange() pure internal {
        uint leaveOnBalance = address(this).balance - msg.value + tx.storageFees;
        // Reserve at most `leaveOnBalance` ton on the contract balance
        tvm.rawReserve(math.max(leaveOnBalance, MIN_COUNTER_BALANCE), ReserveMode.AT_MOST);
        // Send back all remaining balance
        msg.sender.transfer({value: 0, flag: SendMode.CARRY_ALL_BALANCE | SendMode.IGNORE_ERRORS});
    }

    // Getters:

    function getCount(address user) getter returns(uint qty) {
        return count[user];
    }

    function getIsAllowed(address user) getter returns(bool) {
        return isAllowed[user];
    }
}
