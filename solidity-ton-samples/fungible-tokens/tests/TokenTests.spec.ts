import { Address, Cell, toNano } from '@ton/core';
import { Blockchain, SandboxContract, TreasuryContract } from '@ton/sandbox';
import '@ton/test-utils';

import { checkCallingChain, compileSolidityAndGenTS, getContractBalance } from '@solidity-ton/common-utils';

import { Minter } from '../auto-gen/Minter';
import { makeJettonContent, makeTransferMessage } from '../src/JettonUtils';
import { WalletWrapper as Wallet } from '../wrappers/WalletWrapper';

describe('Fungible tokens', () => {
    let blockchain: Blockchain;

    let minterCode: Cell;
    let walletCode: Cell;

    let admin: SandboxContract<TreasuryContract>;
    let minter: SandboxContract<Minter>;

    let user: SandboxContract<TreasuryContract>;

    beforeAll(async () => {
        minterCode = await compileSolidityAndGenTS('Minter');
        walletCode = await compileSolidityAndGenTS('Wallet');
    });

    beforeEach(async () => {
        blockchain = await Blockchain.create();
        blockchain.now = Math.floor(Date.now() / 1000);
        // blockchain.verbosity.vmLogs = 'vm_logs_full';

        admin = await blockchain.treasury('admin');
        user = await blockchain.treasury('user0');

        minter = blockchain.openContract(
            await Minter.createFromABI(
                {
                    admin: admin.address,
                    jettonWalletCode: walletCode,
                    content: makeJettonContent({
                        name: 'USDT',
                        description: 'United States Dollar Testnet Stablecoin',
                        image: 'https://totalcoin.io/uploads/coins/big/usdt.png',
                        symbol: 'USDT',
                        decimals: '9',
                    }),
                },
                minterCode,
            ),
        );
        const deployResult = await minter.sendDeploy(admin.getSender(), toNano('2'));
        expect(deployResult.transactions).toHaveTransaction({
            from: admin.address,
            to: minter.address,
            deploy: true,
            success: true,
        });
    });

    it('should deploy', async () => {
        // the check is done inside beforeEach
    });

    // Admin mints 300 tokens for user
    async function mint300ForUser() {
        const result = await minter.sendMintTokens(admin.getSender(), toNano('0.5'), {
            queryId: 0n,
            to: user.address,
            tonAmount: toNano('0.05'),
            masterMsg: makeTransferMessage({
                queryId: 123456n,
                jettonAmount: 300n,
                from: null,
                response: admin.address,
                forwardTonAmount: toNano('0.005'),
                customPayload: null,
            }),
        });
        const userJettonWallet: Address = await minter.get_wallet_address(user.address);
        checkCallingChain(result.transactions, [admin.address, minter.address, userJettonWallet, admin.address]);
        checkCallingChain(result.transactions, [userJettonWallet, user.address]);
        return { userJettonWallet };
    }

    async function getAlice() {
        const alice = await blockchain.treasury('Alice');
        const aliceJettonWallet: Address = await minter.get_wallet_address(alice.address);
        const aliceWallet = blockchain.openContract(new Wallet(aliceJettonWallet));
        return { alice, aliceWallet };
    }

    it('should mint, transfer, burn, etc', async () => {
        let { _totalSupply } = await minter.get_jetton_data();
        expect(_totalSupply).toEqual(0n);

        const { userJettonWallet } = await mint300ForUser();

        // Total supply is increased
        _totalSupply = (await minter.get_jetton_data())._totalSupply;
        expect(_totalSupply).toEqual(300n);

        // Check that user's wallet has 300 tokens and enough tons
        const userWallet = blockchain.openContract(new Wallet(userJettonWallet));
        expect((await userWallet.get_wallet_data())._balance).toEqual(300n);
        expect(await getContractBalance(blockchain, userWallet.address)).toBeGreaterThanOrEqual(toNano('0.01'));

        // Jump to the feature
        blockchain.now = blockchain.now! + 365 * 24 * 60 * 60;

        // User sends 20 tokens to Alice
        const { alice, aliceWallet } = await getAlice();
        const result = await userWallet.sendJettons(user.getSender(), toNano('15'), {
            queryId: 1n,
            jettonAmount: 20n,
            toOwner: alice.address,
            response: user.address,
            customPayload: null,
            forwardTonAmount: toNano('0.01'),
            forwardPayload: null,
        });
        checkCallingChain(result.transactions, [user.address, userWallet.address, aliceWallet.address]);
        expect((await aliceWallet.get_wallet_data())._balance).toEqual(20n);
        expect(await aliceWallet.getJettonBalance()).toEqual(20n);
        expect(await getContractBalance(blockchain, userWallet.address)).toBeGreaterThanOrEqual(toNano('0.01'));
        expect(await getContractBalance(blockchain, alice.address)).toBeGreaterThanOrEqual(toNano('0.01'));
    });

    it('should change minter', async () => {
        const newAdmin = await blockchain.treasury('New admin');
        const result = await minter.sendSetAdmin(admin.getSender(), toNano('0.05'), {
            queryId: 0n,
            newAdmin: newAdmin.address,
        });
        checkCallingChain(result.transactions, [admin.address, minter.address]);

        const { adminAddress } = await minter.get_jetton_data();
        expect(adminAddress).toEqualAddress(newAdmin.address);
    });

    it('should call onBounce in minter contract', async () => {
        // Admin mints 300 tokens for user
        const result = await minter.sendMintTokens(admin.getSender(), toNano('1'), {
            queryId: 0n,
            to: user.address,
            tonAmount: toNano('0.05'),
            masterMsg: makeTransferMessage({
                queryId: 123456n,
                jettonAmount: 300n,
                from: null,
                response: admin.address,
                forwardTonAmount: toNano('100500'),
                customPayload: null,
            }),
        });
        const userJettonWallet: Address = await minter.get_wallet_address(user.address);
        checkCallingChain(result.transactions, [admin.address, minter.address]);
        expect(result.transactions).toHaveTransaction({
            from: userJettonWallet,
            to: minter.address,
            success: true,
            inMessageBounced: true,
        });
        const { _totalSupply } = await minter.get_jetton_data();
        expect(_totalSupply).toEqual(0n);
    });

    it('should call onBounce in wallet contract', async () => {
        const { userJettonWallet } = await mint300ForUser();
        const userWallet = blockchain.openContract(new Wallet(userJettonWallet));
        const { alice, aliceWallet } = await getAlice();
        const result = await userWallet.sendJettons(user.getSender(), toNano('1'), {
            queryId: 1n,
            jettonAmount: 20n,
            toOwner: alice.address,
            response: user.address,
            customPayload: null,
            forwardTonAmount: toNano('100500'),
            forwardPayload: null,
        });
        expect(result.transactions).toHaveTransaction({
            from: user.address,
            to: userWallet.address,
            success: true,
            inMessageBounced: false,
        });
        expect(result.transactions).toHaveTransaction({
            from: aliceWallet.address,
            to: userWallet.address,
            success: true,
            inMessageBounced: true,
        });
        expect(await aliceWallet.getJettonBalance()).toEqual(0n);
        expect(await userWallet.getJettonBalance()).toEqual(300n);
    });
});
