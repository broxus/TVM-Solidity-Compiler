pragma tvm-solidity >= 0.72.0;

// Contract that receives excessive tons
interface Interfaces {
    function excesses(uint64 queryId) functionID(0xd53276db) external;
}

interface UserWallet {
    function transferNotification(
        uint64 queryId,
        coins jettonAmount,
        address_std from,
        optional(TvmCell) payload
    )
        functionID(0x7362d09c)
        external;
}
