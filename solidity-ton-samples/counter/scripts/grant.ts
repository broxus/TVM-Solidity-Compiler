import type { NetworkProvider } from '@ton/blueprint';
import { Address } from '@ton/core';

import type { TonClient } from '@ton/ton';

import { sendExternalMessage } from '@solidity-ton/common-utils';

import { Counter } from '../auto-gen/Counter';

import { run as runGetStateVars } from './getStateVariables';

export async function run(provider: NetworkProvider, args: string[]) {
    const ui = provider.ui();

    const counterAddress = Address.parse(args.length > 0 ? args[0]! : await ui.input('Input counter address:'));
    const secretKey = args.length > 1 ? args[1]! : await ui.input('Input contract secret key:');
    const userAddress = Address.parse(args.length > 2 ? args[2]! : await ui.input('Input user address:'));
    const incValue = BigInt(args.length > 3 ? args[3]! : await ui.input('Input inc value:'));

    const counter = provider.open(new Counter(counterAddress));

    ui.write(`oldValue: ${await counter.getCount(userAddress)}`);
    await runGetStateVars(provider, [counterAddress.toString()]);
    const startTime = Date.now();

    await sendExternalMessage(
        () => {
            return counter.sendGrantExternal(
                Buffer.from(secretKey, 'hex'),
                {
                    time: Date.now(), // in ms
                    lifetime: 60, // 1 min
                },
                {
                    user: userAddress,
                    value: incValue,
                },
            );
        },
        async () => {
            return (await counter.getStateVariables())._timestamp;
        },
        provider.api() as TonClient,
        provider.ui(),
    );

    ui.write(`newValue: ${await counter.getCount(userAddress)}`);
    ui.write(`Finish in ${(Date.now() - startTime) / 1000} seconds.`);
}
