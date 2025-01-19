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

export class Wallet implements Contract {
    static readonly contractPath: string = 'Wallet';

    constructor(
        readonly address: Address,
        readonly init?: { code: Cell; data: Cell },
    ) {}

    static async createFromABI(
        params: {
            owner: Address | null;
            jettonMaster: Address | ExternalAddress | null;
        },
        code: Cell,
        workchain = 0,
        pubkey: string | null = null,
    ) {
        const p = stringifyJson(params);
        const data = await buildData(Wallet.contractPath, pubkey, p);
        const init = { code, data };
        return new Wallet(contractAddress(workchain, init), init);
    }

    async sendDeploy(provider: ContractProvider, via: Sender, value: bigint) {
        await provider.internal(via, {
            value,
            sendMode: SendMode.PAY_GAS_SEPARATELY,
        });
    }

    async getStateVariables(provider: ContractProvider) {
        const stateVars = await decodeStateVariables(provider, Wallet.contractPath);
        return {
            _pubkey: decodeToJsTypes('uint256', undefined, stateVars._pubkey) as bigint,
            _timestamp: decodeToJsTypes('uint64', undefined, stateVars._timestamp) as bigint,
            balance: decodeToJsTypes('varuint16', undefined, stateVars.balance) as bigint,
            owner: decodeToJsTypes('address_std', undefined, stateVars.owner) as Address | null,
            jettonMaster: decodeToJsTypes('address', undefined, stateVars.jettonMaster) as Address | ExternalAddress | null,
        };
    }

    static async receiveJettonsBody(
        params: {
            queryId: bigint;
            jettonAmount: bigint;
            fromOwner: Address | null;
            response: Address | null;
            forwardTonAmount: bigint;
            forwardPayload: Maybe<Cell>;
        },
    ) {
        const p = stringifyJson(params);
        return messageBodyForInternalMessage(Wallet.contractPath, 'receiveJettons', p);
    }

    async sendReceiveJettons(
        provider: ContractProvider,
        via: Sender,
        value: bigint,
        params: {
            queryId: bigint;
            jettonAmount: bigint;
            fromOwner: Address | null;
            response: Address | null;
            forwardTonAmount: bigint;
            forwardPayload: Maybe<Cell>;
        },
        bounce?: Maybe<boolean>,
        sendMode = SendMode.PAY_GAS_SEPARATELY,
    ) {
        const body: Cell = await Wallet.receiveJettonsBody(params);
        await provider.internal(via, {
            value,
            bounce,
            sendMode,
            body,
        });
    }

    async receiveJettonsBodyExternal(
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
            jettonAmount: bigint;
            fromOwner: Address | null;
            response: Address | null;
            forwardTonAmount: bigint;
            forwardPayload: Maybe<Cell>;
        },
    ) {
        const p = stringifyJson(params);
        const {message, expireAt} = await signedBodyForExternalBody(
            header,
            secretKey,
            this.address,
            Wallet.contractPath,
            'receiveJettons', 
            p
        );
        return { message, expireAt };
    }

    async sendReceiveJettonsExternal(
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
            jettonAmount: bigint;
            fromOwner: Address | null;
            response: Address | null;
            forwardTonAmount: bigint;
            forwardPayload: Maybe<Cell>;
        },
    ) {
        const {message, expireAt} = await this.receiveJettonsBodyExternal(secretKey, header, params);
        await provider.external(message);
        return expireAt;
    }

    static async sendJettonsBody(
        params: {
            queryId: bigint;
            jettonAmount: bigint;
            toOwner: Address | null;
            response: Address | null;
            customPayload: Maybe<Cell>;
            forwardTonAmount: bigint;
            forwardPayload: Maybe<Cell>;
        },
    ) {
        const p = stringifyJson(params);
        return messageBodyForInternalMessage(Wallet.contractPath, 'sendJettons', p);
    }

    async sendJettons(
        provider: ContractProvider,
        via: Sender,
        value: bigint,
        params: {
            queryId: bigint;
            jettonAmount: bigint;
            toOwner: Address | null;
            response: Address | null;
            customPayload: Maybe<Cell>;
            forwardTonAmount: bigint;
            forwardPayload: Maybe<Cell>;
        },
        bounce?: Maybe<boolean>,
        sendMode = SendMode.PAY_GAS_SEPARATELY,
    ) {
        const body: Cell = await Wallet.sendJettonsBody(params);
        await provider.internal(via, {
            value,
            bounce,
            sendMode,
            body,
        });
    }

    async sendJettonsBodyExternal(
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
            jettonAmount: bigint;
            toOwner: Address | null;
            response: Address | null;
            customPayload: Maybe<Cell>;
            forwardTonAmount: bigint;
            forwardPayload: Maybe<Cell>;
        },
    ) {
        const p = stringifyJson(params);
        const {message, expireAt} = await signedBodyForExternalBody(
            header,
            secretKey,
            this.address,
            Wallet.contractPath,
            'sendJettons', 
            p
        );
        return { message, expireAt };
    }

    async sendJettonsExternal(
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
            jettonAmount: bigint;
            toOwner: Address | null;
            response: Address | null;
            customPayload: Maybe<Cell>;
            forwardTonAmount: bigint;
            forwardPayload: Maybe<Cell>;
        },
    ) {
        const {message, expireAt} = await this.sendJettonsBodyExternal(secretKey, header, params);
        await provider.external(message);
        return expireAt;
    }

    async get_wallet_data(
        provider: ContractProvider,
    ) {
        const args: TupleItem[] = [
        ];
        const result = await provider.get('get_wallet_data', args);
        const { stack } = result;
        return {
            _balance: stack.readBigNumber(),
            _owner: stack.readAddress(),
            _jettonMaster: stack.readAddress(),
            myCode: stack.readCell(),
        };
    }

}
