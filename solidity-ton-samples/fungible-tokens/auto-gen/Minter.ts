import {
    Address,
    Cell,
    Contract,
    ContractProvider,
    ExternalAddress,
    SendMode,
    Sender,
    TupleItem,
    beginCell,
    contractAddress,
} from '@ton/core';

import type { Maybe } from '@ton/core/src/utils/maybe';

import {
    buildData,
    decodeArray,
    decodeCell,
    decodeMap,
    decodeStateVariables,
    decodeToJsTypes,
    encodeCell,
    messageBodyForInternalMessage,
    sendInternalMessage,
    signedBodyForExternalBody,
    stringifyJson,
} from '@solidity-ton/common-utils';
import type { AbiParam } from '@solidity-ton/common-utils';

// **********************************************
// This file is auto-generated. Do not modify it.
// **********************************************

export class Minter implements Contract {
    static readonly contractPath: string = 'Minter';

    constructor(
        readonly address: Address,
        readonly init?: { code: Cell; data: Cell },
    ) {}

    static async createFromABI(
        params: {
            admin: Address | null;
            content: Cell;
            jettonWalletCode: Cell;
        },
        code: Cell,
        workchain = 0,
        pubkey: string | null = null,
    ) {
        const p = stringifyJson(params);
        const data = await buildData(Minter.contractPath, pubkey, p);
        const init = { code, data };
        return new Minter(contractAddress(workchain, init), init);
    }

    async sendDeploy(provider: ContractProvider, via: Sender, value: bigint) {
        await provider.internal(via, {
            value,
            sendMode: SendMode.PAY_GAS_SEPARATELY,
        });
    }

    async getStateVariables(provider: ContractProvider) {
        const stateVars = await decodeStateVariables(provider, Minter.contractPath);
        return {
            _pubkey: decodeToJsTypes('uint256', undefined, stateVars._pubkey) as bigint,
            _timestamp: decodeToJsTypes('uint64', undefined, stateVars._timestamp) as bigint,
            totalSupply: decodeToJsTypes('varuint16', undefined, stateVars.totalSupply) as bigint,
            admin: decodeToJsTypes('address_std', undefined, stateVars.admin) as Address | null,
            content: decodeToJsTypes('cell', undefined, stateVars.content) as Cell,
            jettonWalletCode: decodeToJsTypes('cell', undefined, stateVars.jettonWalletCode) as Cell,
        };
    }

    static async mintTokensBody(
        params: {
            queryId: bigint;
            to: Address | null;
            tonAmount: bigint;
            masterMsg: Cell;
        },
    ) {
        const p = stringifyJson(params);
        return messageBodyForInternalMessage(Minter.contractPath, 'mintTokens', p);
    }

    async sendMintTokens(
        provider: ContractProvider,
        via: Sender,
        value: bigint,
        params: {
            queryId: bigint;
            to: Address | null;
            tonAmount: bigint;
            masterMsg: Cell;
        },
        bounce?: Maybe<boolean>,
        sendMode = SendMode.PAY_GAS_SEPARATELY,
    ) {
        const body: Cell = await Minter.mintTokensBody(params);
        await provider.internal(via, {
            value,
            bounce,
            sendMode,
            body,
        });
    }

    async mintTokensBodyExternal(
        secretKey: Buffer,
        header: {
            /**
             * Current time in milliseconds elapsed since the UNIX epoch in milliseconds
             */
            time: number;
            /**
             * Lifetime of the message in seconds
             */
            lifetime?: number;
        },
        params: {
            queryId: bigint;
            to: Address | null;
            tonAmount: bigint;
            masterMsg: Cell;
        },
    ) {
        const p = stringifyJson(params);
        const {message, expireAt} = await signedBodyForExternalBody(
            header,
            secretKey,
            this.address,
            Minter.contractPath,
            'mintTokens', 
            p
        );
        return { message, expireAt };
    }

    async sendMintTokensExternal(
        provider: ContractProvider,
        secretKey: Buffer,
        header: {
            /**
             * Current time in milliseconds elapsed since the UNIX epoch in milliseconds
             */
            time: number;
            /**
             * Lifetime of the message in seconds
             */
            lifetime?: number;
        },
        params: {
            queryId: bigint;
            to: Address | null;
            tonAmount: bigint;
            masterMsg: Cell;
        },
    ) {
        const {message, expireAt} = await this.mintTokensBodyExternal(secretKey, header, params);
        await provider.external(message);
        return expireAt;
    }

    static async setAdminBody(
        params: {
            queryId: bigint;
            newAdmin: Address | null;
        },
    ) {
        const p = stringifyJson(params);
        return messageBodyForInternalMessage(Minter.contractPath, 'setAdmin', p);
    }

    async sendSetAdmin(
        provider: ContractProvider,
        via: Sender,
        value: bigint,
        params: {
            queryId: bigint;
            newAdmin: Address | null;
        },
        bounce?: Maybe<boolean>,
        sendMode = SendMode.PAY_GAS_SEPARATELY,
    ) {
        const body: Cell = await Minter.setAdminBody(params);
        await provider.internal(via, {
            value,
            bounce,
            sendMode,
            body,
        });
    }

    async setAdminBodyExternal(
        secretKey: Buffer,
        header: {
            /**
             * Current time in milliseconds elapsed since the UNIX epoch in milliseconds
             */
            time: number;
            /**
             * Lifetime of the message in seconds
             */
            lifetime?: number;
        },
        params: {
            queryId: bigint;
            newAdmin: Address | null;
        },
    ) {
        const p = stringifyJson(params);
        const {message, expireAt} = await signedBodyForExternalBody(
            header,
            secretKey,
            this.address,
            Minter.contractPath,
            'setAdmin', 
            p
        );
        return { message, expireAt };
    }

    async sendSetAdminExternal(
        provider: ContractProvider,
        secretKey: Buffer,
        header: {
            /**
             * Current time in milliseconds elapsed since the UNIX epoch in milliseconds
             */
            time: number;
            /**
             * Lifetime of the message in seconds
             */
            lifetime?: number;
        },
        params: {
            queryId: bigint;
            newAdmin: Address | null;
        },
    ) {
        const {message, expireAt} = await this.setAdminBodyExternal(secretKey, header, params);
        await provider.external(message);
        return expireAt;
    }

    async get_wallet_address(
        provider: ContractProvider,
        owner: Address | null,
    ) {
        const args: TupleItem[] = [
            { type: 'slice', cell: beginCell().storeAddress(owner).endCell() },
        ];
        const result = await provider.get('get_wallet_address', args);
        const { stack } = result;
        return stack.readAddress();
    }

    async get_jetton_data(
        provider: ContractProvider,
    ) {
        const args: TupleItem[] = [
        ];
        const result = await provider.get('get_jetton_data', args);
        const { stack } = result;
        return {
            _totalSupply: stack.readBigNumber(),
            mintable: stack.readBoolean(),
            adminAddress: stack.readAddress(),
            _content: stack.readCell(),
            walletCode: stack.readCell(),
        };
    }

}
