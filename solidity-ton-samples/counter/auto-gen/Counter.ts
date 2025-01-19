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

export class Counter implements Contract {
    static readonly contractPath: string = 'Counter';

    constructor(
        readonly address: Address,
        readonly init?: { code: Cell; data: Cell },
    ) {}

    static async createFromABI(
        params: {
            isAllowed: Map<Address, boolean>;
        },
        code: Cell,
        workchain = 0,
        pubkey: string | null = null,
    ) {
        const p = stringifyJson(params);
        const data = await buildData(Counter.contractPath, pubkey, p);
        const init = { code, data };
        return new Counter(contractAddress(workchain, init), init);
    }

    async sendDeploy(provider: ContractProvider, via: Sender, value: bigint) {
        await provider.internal(via, {
            value,
            sendMode: SendMode.PAY_GAS_SEPARATELY,
        });
    }

    async getStateVariables(provider: ContractProvider) {
        const stateVars = await decodeStateVariables(provider, Counter.contractPath);
        return {
            _pubkey: decodeToJsTypes('uint256', undefined, stateVars._pubkey) as bigint,
            _timestamp: decodeToJsTypes('uint64', undefined, stateVars._timestamp) as bigint,
            isAllowed: decodeToJsTypes('map(address,bool)', undefined, stateVars.isAllowed) as Map<Address, boolean>,
            count: decodeToJsTypes('map(address,uint256)', undefined, stateVars.count) as Map<Address, bigint>,
        };
    }

    static async incBody(
    ) {
        const p = '{}';
        return messageBodyForInternalMessage(Counter.contractPath, 'inc', p);
    }

    async sendInc(
        provider: ContractProvider,
        via: Sender,
        value: bigint,
        bounce?: Maybe<boolean>,
        sendMode = SendMode.PAY_GAS_SEPARATELY,
    ) {
        const body: Cell = await Counter.incBody();
        await provider.internal(via, {
            value,
            bounce,
            sendMode,
            body,
        });
    }

    async incBodyExternal(
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
    ) {
        const p = '{}';
        const {message, expireAt} = await signedBodyForExternalBody(
            header,
            secretKey,
            this.address,
            Counter.contractPath,
            'inc', 
            p
        );
        return { message, expireAt };
    }

    async sendIncExternal(
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
    ) {
        const {message, expireAt} = await this.incBodyExternal(secretKey, header);
        await provider.external(message);
        return expireAt;
    }

    static async grantBody(
        params: {
            user: Address | ExternalAddress | null;
            value: bigint;
        },
    ) {
        const p = stringifyJson(params);
        return messageBodyForInternalMessage(Counter.contractPath, 'grant', p);
    }

    async sendGrant(
        provider: ContractProvider,
        via: Sender,
        value: bigint,
        params: {
            user: Address | ExternalAddress | null;
            value: bigint;
        },
        bounce?: Maybe<boolean>,
        sendMode = SendMode.PAY_GAS_SEPARATELY,
    ) {
        const body: Cell = await Counter.grantBody(params);
        await provider.internal(via, {
            value,
            bounce,
            sendMode,
            body,
        });
    }

    async grantBodyExternal(
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
            user: Address | ExternalAddress | null;
            value: bigint;
        },
    ) {
        const p = stringifyJson(params);
        const {message, expireAt} = await signedBodyForExternalBody(
            header,
            secretKey,
            this.address,
            Counter.contractPath,
            'grant', 
            p
        );
        return { message, expireAt };
    }

    async sendGrantExternal(
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
            user: Address | ExternalAddress | null;
            value: bigint;
        },
    ) {
        const {message, expireAt} = await this.grantBodyExternal(secretKey, header, params);
        await provider.external(message);
        return expireAt;
    }

    async getCount(
        provider: ContractProvider,
        user: Address | ExternalAddress | null,
    ) {
        const args: TupleItem[] = [
            { type: 'slice', cell: beginCell().storeAddress(user).endCell() },
        ];
        const result = await provider.get('getCount', args);
        const { stack } = result;
        return stack.readBigNumber();
    }

    async getIsAllowed(
        provider: ContractProvider,
        user: Address | ExternalAddress | null,
    ) {
        const args: TupleItem[] = [
            { type: 'slice', cell: beginCell().storeAddress(user).endCell() },
        ];
        const result = await provider.get('getIsAllowed', args);
        const { stack } = result;
        return stack.readBoolean();
    }

}
