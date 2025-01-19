import { Address, Cell, ExternalAddress, toNano } from '@ton/core';
import type { KeyPair } from '@ton/crypto';
import { Blockchain, SandboxContract, TreasuryContract } from '@ton/sandbox';

import { compileSolidityAndGenTS, noneAddress, randomKeyPair } from '@solidity-ton/common-utils';

import { MyDex } from '../auto-gen/dex/MyDex';

describe('Dex', () => {
    let blockchain: Blockchain;
    let code: Cell;
    let dex: SandboxContract<MyDex>;
    let user: SandboxContract<TreasuryContract>;
    let keyPair: KeyPair;

    beforeAll(async () => {
        code = await compileSolidityAndGenTS('dex/MyDex');
    });

    beforeEach(async () => {
        blockchain = await Blockchain.create();
        // blockchain.verbosity.vmLogs = 'vm_logs_full';
        user = await blockchain.treasury('user0');
        keyPair = await randomKeyPair();
        dex = blockchain.openContract(
            await MyDex.createFromABI(
                {
                    _pubkey: keyPair.publicKey,
                },
                code,
            ),
        );
        const result = await dex.sendConstructor(user.getSender(), toNano('0.5'), 15n);
        expect(result.transactions).toHaveTransaction({
            from: user.address,
            to: dex.address,
            success: true,
            deploy: true,
        });
    });

    it('should deploy', async () => {
        // the check is done inside beforeEach
        // blockchain and counter are ready to use
    });

    it('Test something', async () => {
        let stateVars = await dex.getStateVariables();
        expect(stateVars.a).toEqual(112n);

        await dex.sendAddToA(user.getSender(), toNano('0.5'), 15n);
        const now = Date.now();
        await dex.sendAddToAExternal(
            keyPair.secretKey,
            {
                time: now,
                lifetime: 60,
            },
            10_000n,
        );
        stateVars = await dex.getStateVariables();
        expect(stateVars.a).toEqual(112n + 15n + 10_000n);
    });
});
