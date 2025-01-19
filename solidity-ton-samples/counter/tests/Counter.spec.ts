import { Cell, toNano } from '@ton/core';
import { type KeyPair, mnemonicNew, mnemonicToPrivateKey } from '@ton/crypto';
import { Blockchain, SandboxContract, TreasuryContract } from '@ton/sandbox';

import { compileSolidityAndGenTS, getContractBalance, randomKeyPair } from '@solidity-ton/common-utils';

import { Counter } from '../auto-gen/Counter';
import { writeFileSync } from 'node:fs';

describe('Counter', () => {
    let blockchain: Blockchain;

    let code: Cell;
    let mnemonics: string[];
    let keyPair: KeyPair;
    let counter: SandboxContract<Counter>;
    let users: SandboxContract<TreasuryContract>[];

    beforeAll(async () => {
        code = await compileSolidityAndGenTS('Counter');
    });

    beforeEach(async () => {
        blockchain = await Blockchain.create();
        // blockchain.verbosity.vmLogs = 'vm_logs_full';
        mnemonics = await mnemonicNew();
        keyPair = await mnemonicToPrivateKey(mnemonics);

        const js = {
            "public": keyPair.publicKey.toString('hex'),
            "secret": keyPair.secretKey.toString('hex'),
        };
        await writeFileSync('key.json', JSON.stringify(js));

        users = [
            await blockchain.treasury('user0'),
            await blockchain.treasury('user1'),
            await blockchain.treasury('user2'),
        ];
        const params = {
            isAllowed: new Map([
                [users[0]!.address, true],
                [users[1]!.address, true],
                [users[2]!.address, true],
            ]),
        };
        counter = blockchain.openContract(await Counter.createFromABI(params, code, 0, 'key.json'));
        const deployer = await blockchain.treasury('deployer');
        const deployResult = await counter.sendDeploy(deployer.getSender(), toNano('0.05'));
        expect(deployResult.transactions).toHaveTransaction({
            from: deployer.address,
            to: counter.address,
            deploy: true,
            success: true,
        });
    });

    it('should deploy', async () => {
        // the check is done inside beforeEach
        // blockchain and counter are ready to use
    });

    it('should inc/grant', async () => {
        // Let's jump to the feature to test storage fee
        const now = Math.floor(Date.now() / 1000) + 365 * 24 * 60 * 60; // seconds
        blockchain.now = now;

        // Test `inc` function
        const prevBalance = await getContractBalance(blockchain, counter.address);
        const result = await counter.sendInc(users[0]!.getSender(), toNano('0.05'));
        expect(result.transactions).toHaveTransaction({
            from: users[0]!.address,
            to: counter.address,
            success: true,
        });
        const newBalance = await getContractBalance(blockchain, counter.address);
        expect(newBalance).toBeGreaterThanOrEqual(prevBalance);
        let count = await counter.getCount(users[0]!.address);
        expect(count).toEqual(1n);

        // Test `grant` function
        const extSendResult = await counter.sendGrantExternal(
            keyPair.secretKey,
            {
                time: now * 1000, // in ms
                lifetime: 10 * 60, // 10 min
            },
            {
                user: users[1]!.address,
                value: 10n,
            },
        );
        console.log('Message will expire at (seconds): ', extSendResult.result);

        count = await counter.getCount(users[1]!.address);
        expect(count).toEqual(10n);

        // Get state all contract state variables
        const vars = await counter.getStateVariables();
        console.log('State variables: ', vars);
    });
});
