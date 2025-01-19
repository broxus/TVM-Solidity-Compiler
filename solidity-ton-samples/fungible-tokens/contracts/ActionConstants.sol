pragma tvm-solidity >= 0.72.0;

library ReserveMode {
    //  RESERVE MODES - https://docs.ton.org/tvm.pdf page 137, RAWRESERVE
    // Creates an output action which would reserve exactly x nanograms (if y = 0).
    uint16 constant REGULAR = 0;
    // Creates an output action which would reserve at most x nanograms (if y = 2).
    // Bit +2 in y means that the external action does not fail if the specified amount cannot be reserved; instead, all remaining balance is reserved.
    uint16 constant AT_MOST = 2;
    // in the case of action fail - bounce transaction. No effect if RESERVE_AT_MOST (+2) is used. TVM UPGRADE 2023-07. https://docs.ton.org/learn/tvm-instructions/tvm-upgrade-2023-07#sending-messages
    uint16 constant BOUNCE_ON_ACTION_FAIL = 16;
}

library SendMode {
    // SEND MODES - https://docs.ton.org/tvm.pdf page 137, SENDRAWMSG
    //  For sending a message
    // x = 0 is used for ordinary messages; the gas fees are deducted from the senging amount; action phaes should NOT be ignored.
    uint16 constant REGULAR = 0;
    // +1 means that the sender wants to pay transfer fees separately.
    uint16 constant PAY_FEES_SEPARATELY = 1;
    // + 2 means that any errors arising while processing this message during the action phase should be ignored.
    uint16 constant IGNORE_ERRORS = 2;
    // + 32 means that the current account must be destroyed if its resulting balance is zero.
    uint16 constant DESTROY = 32;
    // x = 64 is used for messages that carry all the remaining value of the inbound message in addition to the value initially indicated in the new message.
    uint16 constant ALL_REMAINING_MESSAGE_VALUE = 64;
    // x = 128 is used for messages that are to carry all the remaining balance of the current smart contract (instead of the value originally indicated in the message).
    uint16 constant CARRY_ALL_BALANCE = 128;
    // in the case of action fail - bounce transaction. No effect if SEND_MODE_IGNORE_ERRORS (+2) is used. TVM UPGRADE 2023-07. https://docs.ton.org/learn/tvm-instructions/tvm-upgrade-2023-07#sending-messages
    uint16 constant BOUNCE_ON_ACTION_FAIL = 16;
}
