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

export class MyDex implements Contract {
    static readonly contractPath: string = 'dex/MyDex';

    constructor(
        readonly address: Address,
        readonly init?: { code: Cell; data: Cell },
    ) {}

    static async createFromABI(
        params: {
        },
        code: Cell,
        workchain = 0,
    ) {
        const p = stringifyJson(params);
        const data = await buildData(MyDex.contractPath, p);
        const init = { code, data };
        return new MyDex(contractAddress(workchain, init), init);
    }


    async getStateVariables(provider: ContractProvider) {
        const stateVars = await decodeStateVariables(provider, MyDex.contractPath);
        return {
            _pubkey: decodeToJsTypes('uint256', undefined, stateVars._pubkey) as bigint,
            _timestamp: decodeToJsTypes('uint64', undefined, stateVars._timestamp) as bigint,
            _constructorFlag: decodeToJsTypes('bool', undefined, stateVars._constructorFlag) as boolean,
            a: decodeToJsTypes('uint256', undefined, stateVars.a) as bigint,
            b: decodeToJsTypes('uint256', undefined, stateVars.b) as bigint,
        };
    }

    static async constructorBody(
        _b: bigint,
    ) {
        const p = stringifyJson({ _b });
        return messageBodyForInternalMessage(MyDex.contractPath, 'constructor', p);
    }

    async sendConstructor(
        provider: ContractProvider,
        via: Sender,
        value: bigint,
        _b: bigint,
        bounce?: Maybe<boolean>,
        sendMode = SendMode.PAY_GAS_SEPARATELY,
    ) {
        const body: Cell = await MyDex.constructorBody(_b);
        await provider.internal(via, {
            value,
            bounce,
            sendMode,
            body,
        });
    }

    async constructorBodyExternal(
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
        _b: bigint,
    ) {
        const p = stringifyJson({ _b });
        const {message, expireAt} = await signedBodyForExternalBody(
            header,
            secretKey,
            this.address,
            MyDex.contractPath,
            'constructor', 
            p
        );
        return { message, expireAt };
    }

    async sendConstructorExternal(
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
        _b: bigint,
    ) {
        const {message, expireAt} = await this.constructorBodyExternal(secretKey, header, _b);
        await provider.external(message);
        return expireAt;
    }

    static async addToABody(
        _a: bigint,
    ) {
        const p = stringifyJson({ _a });
        return messageBodyForInternalMessage(MyDex.contractPath, 'addToA', p);
    }

    async sendAddToA(
        provider: ContractProvider,
        via: Sender,
        value: bigint,
        _a: bigint,
        bounce?: Maybe<boolean>,
        sendMode = SendMode.PAY_GAS_SEPARATELY,
    ) {
        const body: Cell = await MyDex.addToABody(_a);
        await provider.internal(via, {
            value,
            bounce,
            sendMode,
            body,
        });
    }

    async addToABodyExternal(
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
        _a: bigint,
    ) {
        const p = stringifyJson({ _a });
        const {message, expireAt} = await signedBodyForExternalBody(
            header,
            secretKey,
            this.address,
            MyDex.contractPath,
            'addToA', 
            p
        );
        return { message, expireAt };
    }

    async sendAddToAExternal(
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
        _a: bigint,
    ) {
        const {message, expireAt} = await this.addToABodyExternal(secretKey, header, _a);
        await provider.external(message);
        return expireAt;
    }

}
