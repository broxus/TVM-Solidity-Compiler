import { Address, Cell, ExternalAddress, toNano } from '@ton/core';
import type { KeyPair } from '@ton/crypto';
import { Blockchain, SandboxContract, TreasuryContract } from '@ton/sandbox';

import { compileSolidityAndGenTS, noneAddress, randomKeyPair } from '@solidity-ton/common-utils';

import { AbiTester } from '../auto-gen/AbiTester';

describe('Counter', () => {
    let blockchain: Blockchain;
    let code: Cell;
    let abiTester: SandboxContract<AbiTester>;
    let user: SandboxContract<TreasuryContract>;
    let keyPair: KeyPair;

    beforeAll(async () => {
        code = await compileSolidityAndGenTS('AbiTester');
    });

    beforeEach(async () => {
        blockchain = await Blockchain.create();
        // blockchain.verbosity.vmLogs = 'vm_logs_full';
        user = await blockchain.treasury('user0');
        keyPair = await randomKeyPair();
        abiTester = blockchain.openContract(
            await AbiTester.createFromABI(
                {
                    _pubkey: keyPair.publicKey,
                },
                code,
            ),
        );
        const result = await abiTester.sendDeploy(user.getSender(), toNano('0.5'));
        expect(result.transactions).toHaveTransaction({
            from: user.address,
            to: abiTester.address,
            success: true,
            deploy: true,
        });
    });

    it('should deploy', async () => {
        // the check is done inside beforeEach
        // blockchain and counter are ready to use
    });

    it('should run address', async () => {
        let a = await abiTester.getDeltaA(-2n);
        expect(a).toEqual(-2n);

        await abiTester.sendSetA(user.getSender(), toNano('1'), 5n);
        a = await abiTester.getDeltaA(-2n);
        expect(a).toEqual(3n);
    });

    it('should run address', async () => {
        for (const a of [new ExternalAddress(16n, 5), noneAddress(), null]) {
            await abiTester.sendSetAddress(user.getSender(), toNano('0.05'), a);
            const stateVars = await abiTester.getStateVariables();

            if (a === null) expect(stateVars.m_e).toBeNull();
            else if (stateVars.m_e === null) expect(a.toString()).toEqual(noneAddress().toString());
            else expect(stateVars.m_e.toString()).toEqual(a.toString());
        }
    });

    it('should run contract', async () => {
        const now = Date.now();
        await abiTester.sendSetAExternal(
            keyPair.secretKey,
            {
                time: now, // in ms
                lifetime: 60, // 1 min
            },
            12n,
        );
        const stateVars = await abiTester.getStateVariables();
        expect(stateVars._timestamp).toEqual(BigInt(now));

        const result = await abiTester.sendF(user.getSender(), toNano('0.05'), {
            a: 12n,
            b: -1n,
            c: true,
            d: new Map([[12n, new Map([[13n, 14n]])]]),
            e: Address.parse('0:0000000000000000000000000000000000000000000000000000000000000000'),
            str: 'Hello, the contract!',
            data: Buffer.from('beadcafe', 'hex'),
            optCell: Cell.EMPTY,
            p: {
                x: 12n,
                y: 13n,
            },
            points: new Map([[1n, { x: 12n, y: 13n }]]),
            point3d: {
                z: 4n,
                p: {
                    x: 5n,
                    y: 6n,
                },
            },
            arr: [12n, 13n],
        });
        expect(result.transactions).toHaveTransaction({
            from: user.address,
            to: abiTester.address,
            success: true,
        });

        {
            const res = await abiTester.getSomeInfo({
                a: -3n,
                b: 12n,
                c: true,
                e: Address.parse('0:cafe000000000000000000000000000000000000000000000deaf00000000000'),
                d: new Map([[12n, new Map([[13n, 14n]])]]),
                cell: Cell.EMPTY,
                data: Buffer.from('beadcafe', 'hex'),
                optCell: Cell.EMPTY,
                str: 'world!',
                p: { x: 12n, y: 13n },
                points: new Map([[1n, { x: 12n, y: 13n }]]),
                point3d: {
                    z: 4n,
                    p: { x: 5n, y: 6n },
                },
                arr: [12n, 13n, 115792089237316195423570985008687907853269984665640564039457584007913129639935n],
                p4: { ok: true, p0: { x: 5n, y: 6n }, p1: { x: 50n, y: 60n } },
                pointMap: new Map([[12n, { x: 100n, y: 200n }]]),
            });
            expect(res.a2).toEqual(7n);
            expect(res.b2).toEqual(12n);
            expect(res.c2).toEqual(true);
            expect(res.e2).toEqualAddress(
                Address.parse('0:cafe000000000000000000000000000000000000000000000deaf00000000000'),
            );
            expect(res.d2.get(12n)!.get(13n)).toEqual(14n);
            expect(res.cell2).toEqualCell(Cell.EMPTY);
            expect(res.data2.toString('hex')).toEqual('beadcafe');
            expect(res.optCell2).toEqualCell(Cell.EMPTY);
            expect(res.str2).toEqual('Hello, world!');
            expect(res.p2).toEqual({ x: 12n, y: 13n });
            expect(res.point3d2).toEqual({
                z: 4n,
                p: { x: 5n, y: 6n },
            });
            expect(res.arr2).toEqual([
                12n,
                13n,
                115792089237316195423570985008687907853269984665640564039457584007913129639935n,
            ]);
            expect(res.p42).toEqual({ ok: true, p0: { x: 5n, y: 6n }, p1: { x: 50n, y: 60n } });
            expect(res.pointMap2.get(12n)).toEqual({ x: 100n, y: 200n });
        }

        {
            const stateVars = await abiTester.getStateVariables();
            expect(stateVars.m_a).toEqual(12n);
            expect(stateVars.m_b).toEqual(-1n);
            expect(stateVars.m_c).toEqual(true);
            expect(stateVars.m_d).toEqual(new Map([[12n, new Map([[13n, 14n]])]]));
            expect(stateVars.m_e).toEqualAddress(
                Address.parse('0:0000000000000000000000000000000000000000000000000000000000000000'),
            );
            expect(stateVars.m_str).toEqual('Hello, the contract!');
            expect(stateVars.m_data).toEqual(Buffer.from('beadcafe', 'hex'));
            expect(stateVars.m_optCell).toEqualCell(Cell.EMPTY);
            expect(stateVars.m_p).toEqual({ x: 12n, y: 13n });
            expect(stateVars.m_points).toEqual(new Map([[1n, { x: 12n, y: 13n }]]));
            expect(stateVars.m_point3d).toEqual({ z: 4n, p: { x: 5n, y: 6n } });
            expect(stateVars.m_arr).toEqual([12n, 13n]);
        }
    });
});
