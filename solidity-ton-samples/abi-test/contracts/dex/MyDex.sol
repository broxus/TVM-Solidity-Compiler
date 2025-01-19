pragma tvm-solidity >= 0.72.0;
// Use expiration time for external messages
pragma AbiHeader expire;

contract MyDex {

    uint a = 12;
    uint b;

    constructor(uint _b) {
        a += 100;
        b = _b;
    }


    function addToA(uint _a) public {
        tvm.accept();
        a += _a;
    }

}
