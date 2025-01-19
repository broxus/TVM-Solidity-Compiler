pragma tvm-solidity >= 0.72.0;

import "ActionConstants.sol";
import "Interfaces.sol";

int8 constant BASE_CHAIN = 0;
uint16 constant ERROR_WRONG_WORKCHAIN = 300;

function checkSameWorkchain(address_std addr) pure {
    require(addr.wid == BASE_CHAIN, ERROR_WRONG_WORKCHAIN);
}

function sendAllTonBalance(address_std response, uint64 queryId) pure {
    if (response != address.makeAddrNone()) {
        Interfaces(response).excesses{
            value: 0,
            bounce: false,
            flag: SendMode.CARRY_ALL_BALANCE | SendMode.IGNORE_ERRORS
        }(queryId);
    }
}