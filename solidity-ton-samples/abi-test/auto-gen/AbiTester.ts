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

export class AbiTester implements Contract {
    static readonly contractPath: string = 'AbiTester';

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
        const data = await buildData(AbiTester.contractPath, p);
        const init = { code, data };
        return new AbiTester(contractAddress(workchain, init), init);
    }

    async sendDeploy(provider: ContractProvider, via: Sender, value: bigint) {
        await provider.internal(via, {
            value,
            sendMode: SendMode.PAY_GAS_SEPARATELY,
        });
    }

    async getStateVariables(provider: ContractProvider) {
        const stateVars = await decodeStateVariables(provider, AbiTester.contractPath);
        return {
            _pubkey: decodeToJsTypes('uint256', undefined, stateVars._pubkey) as bigint,
            _timestamp: decodeToJsTypes('uint64', undefined, stateVars._timestamp) as bigint,
            m_a: decodeToJsTypes('int8', undefined, stateVars.m_a) as bigint,
            m_b: decodeToJsTypes('varint32', undefined, stateVars.m_b) as bigint,
            m_c: decodeToJsTypes('bool', undefined, stateVars.m_c) as boolean,
            m_d: decodeToJsTypes('map(uint256,map(uint256,uint256))', undefined, stateVars.m_d) as Map<bigint, Map<bigint, bigint>>,
            m_e: decodeToJsTypes('address', undefined, stateVars.m_e) as Address | ExternalAddress | null,
            m_str: decodeToJsTypes('string', undefined, stateVars.m_str) as string,
            m_data: decodeToJsTypes('bytes', undefined, stateVars.m_data) as Buffer,
            m_optCell: decodeToJsTypes('optional(cell)', undefined, stateVars.m_optCell) as Maybe<Cell>,
            m_p: decodeToJsTypes('tuple', JSON.parse('[{"name":"x","type":"uint256"},{"name":"y","type":"uint256"}]') as AbiParam[], stateVars.m_p) as { x: bigint; y: bigint; },
            m_points: decodeToJsTypes('map(uint256,tuple)', JSON.parse('[{"name":"x","type":"uint256"},{"name":"y","type":"uint256"}]') as AbiParam[], stateVars.m_points) as Map<bigint, { x: bigint; y: bigint; }>,
            m_point3d: decodeToJsTypes('optional(tuple)', JSON.parse('[{"name":"z","type":"uint256"},{"components":[{"name":"x","type":"uint256"},{"name":"y","type":"uint256"}],"name":"p","type":"tuple"}]') as AbiParam[], stateVars.m_point3d) as Maybe<{ z: bigint; p: { x: bigint; y: bigint; }; }>,
            m_arr: decodeToJsTypes('uint256[]', undefined, stateVars.m_arr) as bigint[],
        };
    }

    static async setABody(
        a: bigint,
    ) {
        const p = stringifyJson({ a });
        return messageBodyForInternalMessage(AbiTester.contractPath, 'setA', p);
    }

    async sendSetA(
        provider: ContractProvider,
        via: Sender,
        value: bigint,
        a: bigint,
        bounce?: Maybe<boolean>,
        sendMode = SendMode.PAY_GAS_SEPARATELY,
    ) {
        const body: Cell = await AbiTester.setABody(a);
        await provider.internal(via, {
            value,
            bounce,
            sendMode,
            body,
        });
    }

    async setABodyExternal(
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
        a: bigint,
    ) {
        const p = stringifyJson({ a });
        const {message, expireAt} = await signedBodyForExternalBody(
            header,
            secretKey,
            this.address,
            AbiTester.contractPath,
            'setA', 
            p
        );
        return { message, expireAt };
    }

    async sendSetAExternal(
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
        a: bigint,
    ) {
        const {message, expireAt} = await this.setABodyExternal(secretKey, header, a);
        await provider.external(message);
        return expireAt;
    }

    static async setAddressBody(
        newAddr: Address | ExternalAddress | null,
    ) {
        const p = stringifyJson({ newAddr });
        return messageBodyForInternalMessage(AbiTester.contractPath, 'setAddress', p);
    }

    async sendSetAddress(
        provider: ContractProvider,
        via: Sender,
        value: bigint,
        newAddr: Address | ExternalAddress | null,
        bounce?: Maybe<boolean>,
        sendMode = SendMode.PAY_GAS_SEPARATELY,
    ) {
        const body: Cell = await AbiTester.setAddressBody(newAddr);
        await provider.internal(via, {
            value,
            bounce,
            sendMode,
            body,
        });
    }

    async setAddressBodyExternal(
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
        newAddr: Address | ExternalAddress | null,
    ) {
        const p = stringifyJson({ newAddr });
        const {message, expireAt} = await signedBodyForExternalBody(
            header,
            secretKey,
            this.address,
            AbiTester.contractPath,
            'setAddress', 
            p
        );
        return { message, expireAt };
    }

    async sendSetAddressExternal(
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
        newAddr: Address | ExternalAddress | null,
    ) {
        const {message, expireAt} = await this.setAddressBodyExternal(secretKey, header, newAddr);
        await provider.external(message);
        return expireAt;
    }

    static async fBody(
        params: {
            a: bigint;
            b: bigint;
            c: boolean;
            d: Map<bigint, Map<bigint, bigint>>;
            e: Address | ExternalAddress | null;
            str: string;
            data: Buffer;
            optCell: Maybe<Cell>;
            p: { x: bigint; y: bigint; };
            points: Map<bigint, { x: bigint; y: bigint; }>;
            point3d: Maybe<{ z: bigint; p: { x: bigint; y: bigint; }; }>;
            arr: bigint[];
        },
    ) {
        const p = stringifyJson(params);
        return messageBodyForInternalMessage(AbiTester.contractPath, 'f', p);
    }

    async sendF(
        provider: ContractProvider,
        via: Sender,
        value: bigint,
        params: {
            a: bigint;
            b: bigint;
            c: boolean;
            d: Map<bigint, Map<bigint, bigint>>;
            e: Address | ExternalAddress | null;
            str: string;
            data: Buffer;
            optCell: Maybe<Cell>;
            p: { x: bigint; y: bigint; };
            points: Map<bigint, { x: bigint; y: bigint; }>;
            point3d: Maybe<{ z: bigint; p: { x: bigint; y: bigint; }; }>;
            arr: bigint[];
        },
        bounce?: Maybe<boolean>,
        sendMode = SendMode.PAY_GAS_SEPARATELY,
    ) {
        const body: Cell = await AbiTester.fBody(params);
        await provider.internal(via, {
            value,
            bounce,
            sendMode,
            body,
        });
    }

    async fBodyExternal(
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
            a: bigint;
            b: bigint;
            c: boolean;
            d: Map<bigint, Map<bigint, bigint>>;
            e: Address | ExternalAddress | null;
            str: string;
            data: Buffer;
            optCell: Maybe<Cell>;
            p: { x: bigint; y: bigint; };
            points: Map<bigint, { x: bigint; y: bigint; }>;
            point3d: Maybe<{ z: bigint; p: { x: bigint; y: bigint; }; }>;
            arr: bigint[];
        },
    ) {
        const p = stringifyJson(params);
        const {message, expireAt} = await signedBodyForExternalBody(
            header,
            secretKey,
            this.address,
            AbiTester.contractPath,
            'f', 
            p
        );
        return { message, expireAt };
    }

    async sendFExternal(
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
            a: bigint;
            b: bigint;
            c: boolean;
            d: Map<bigint, Map<bigint, bigint>>;
            e: Address | ExternalAddress | null;
            str: string;
            data: Buffer;
            optCell: Maybe<Cell>;
            p: { x: bigint; y: bigint; };
            points: Map<bigint, { x: bigint; y: bigint; }>;
            point3d: Maybe<{ z: bigint; p: { x: bigint; y: bigint; }; }>;
            arr: bigint[];
        },
    ) {
        const {message, expireAt} = await this.fBodyExternal(secretKey, header, params);
        await provider.external(message);
        return expireAt;
    }

    async getDeltaA(
        provider: ContractProvider,
        deltaA: bigint,
    ) {
        const args: TupleItem[] = [
            { type: 'int', value: BigInt(deltaA) },
        ];
        const result = await provider.get('getDeltaA', args);
        const { stack } = result;
        return stack.readBigNumber();
    }

    async getSomeInfo(
        provider: ContractProvider,
        params: {
            a: bigint;
            b: bigint;
            c: boolean;
            d: Map<bigint, Map<bigint, bigint>>;
            e: Address | ExternalAddress | null;
            str: string;
            data: Buffer;
            cell: Cell;
            optCell: Maybe<Cell>;
            p: { x: bigint; y: bigint; };
            points: Map<bigint, { x: bigint; y: bigint; }>;
            point3d: Maybe<{ z: bigint; p: { x: bigint; y: bigint; }; }>;
            arr: bigint[];
            p4: { p0: { x: bigint; y: bigint; }; p1: { x: bigint; y: bigint; }; ok: boolean; };
            pointMap: Map<bigint, { x: bigint; y: bigint; }>;
        },
    ) {
        const args: TupleItem[] = [
            { type: 'int', value: BigInt(params.a) },
            { type: 'int', value: BigInt(params.b) },
            { type: 'int', value: params.c ? -1n : 0n },
            { type: 'cell', cell: await encodeCell(`{"name":"d","type":"map(uint256,map(uint256,uint256))"}`, stringifyJson(params.d)) },
            { type: 'slice', cell: beginCell().storeAddress(params.e).endCell() },
            { type: 'cell', cell: await encodeCell(`{"name":"str","type":"string"}`, stringifyJson(params.str)) },
            { type: 'cell', cell: await encodeCell(`{"name":"data","type":"bytes"}`, stringifyJson(params.data)) },
            { type: 'cell', cell: params.cell },
            params.optCell === null || params.optCell === undefined ?
                { type: 'null' } :
                { type: 'cell', cell: params.optCell! },
            { type: 'tuple', items: [
                { type: 'int', value: BigInt(params.p.x) },
                { type: 'int', value: BigInt(params.p.y) },
            ]},
            { type: 'cell', cell: await encodeCell(`{"components":[{"name":"x","type":"uint256"},{"name":"y","type":"uint256"}],"name":"points","type":"map(uint256,tuple)"}`, stringifyJson(params.points)) },
            params.point3d === null || params.point3d === undefined ?
                { type: 'null' } :
                { type: 'tuple', items: [
                    { type: 'int', value: BigInt(params.point3d!.z) },
                    { type: 'tuple', items: [
                        { type: 'int', value: BigInt(params.point3d!.p.x) },
                        { type: 'int', value: BigInt(params.point3d!.p.y) },
                    ]},
                ]},
            {
                 type: 'tuple',
                 items: [
                     { type: 'int', value: BigInt(params.arr.length) },
                     {
                         type: 'cell',
                         cell: await encodeCell(`{"name":"arr","type":"uint256[]"}`, stringifyJson(params.arr)),
                     },
                 ],
             },
            { type: 'tuple', items: [
                { type: 'tuple', items: [
                    { type: 'int', value: BigInt(params.p4.p0.x) },
                    { type: 'int', value: BigInt(params.p4.p0.y) },
                ]},
                { type: 'tuple', items: [
                    { type: 'int', value: BigInt(params.p4.p1.x) },
                    { type: 'int', value: BigInt(params.p4.p1.y) },
                ]},
                { type: 'int', value: params.p4.ok ? -1n : 0n },
            ]},
            { type: 'cell', cell: await encodeCell(`{"components":[{"name":"x","type":"uint256"},{"name":"y","type":"uint256"}],"name":"pointMap","type":"map(uint256,tuple)"}`, stringifyJson(params.pointMap)) },
        ];
        const result = await provider.get('getSomeInfo', args);
        const { stack } = result;
        return {
            a2: stack.readBigNumber(),
            b2: stack.readBigNumber(),
            c2: stack.readBoolean(),
            d2: (await decodeMap(`{"name":"d2","type":"map(uint256,map(uint256,uint256))"}`, stack.readCell())) as Map<bigint, Map<bigint, bigint>>,
            e2: stack.readAddress(),
            str2: (await decodeCell(`{"name":"str2","type":"string"}`, stack.readCell())) as string,
            data2: (await decodeCell(`{"name":"data2","type":"bytes"}`, stack.readCell())) as Buffer,
            cell2: stack.readCell(),
            optCell2: stack.peek().type === 'null' ? null : stack.readCell(),
            p2:  (() => {
                const stack4 = stack.readTuple();
                return {
                    x: stack4.readBigNumber(),
                    y: stack4.readBigNumber(),
                };
            }).apply(this),
            points2: (await decodeMap(`{"components":[{"name":"x","type":"uint256"},{"name":"y","type":"uint256"}],"name":"points2","type":"map(uint256,tuple)"}`, stack.readCell())) as Map<bigint, { x: bigint; y: bigint; }>,
            point3d2: stack.peek().type === 'null' ? null :  (() => {
                const stack4 = stack.readTuple();
                return {
                    z: stack4.readBigNumber(),
                    p:  (() => {
                        const stack6 = stack4.readTuple();
                        return {
                            x: stack6.readBigNumber(),
                            y: stack6.readBigNumber(),
                        };
                    }).apply(this),
                };
            }).apply(this),
            arr2: (await decodeArray(`{"name":"arr2","type":"uint256[]"}`, stack.readTuple())) as bigint[],
            p42:  (() => {
                const stack4 = stack.readTuple();
                return {
                    p0:  (() => {
                        const stack6 = stack4.readTuple();
                        return {
                            x: stack6.readBigNumber(),
                            y: stack6.readBigNumber(),
                        };
                    }).apply(this),
                    p1:  (() => {
                        const stack6 = stack4.readTuple();
                        return {
                            x: stack6.readBigNumber(),
                            y: stack6.readBigNumber(),
                        };
                    }).apply(this),
                    ok: stack4.readBoolean(),
                };
            }).apply(this),
            pointMap2: (await decodeMap(`{"components":[{"name":"x","type":"uint256"},{"name":"y","type":"uint256"}],"name":"pointMap2","type":"map(uint256,tuple)"}`, stack.readCell())) as Map<bigint, { x: bigint; y: bigint; }>,
        };
    }

}
