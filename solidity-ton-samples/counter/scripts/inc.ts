import { NetworkProvider, sleep } from '@ton/blueprint';
import { Address, toNano } from '@ton/core';

import { Counter } from '../auto-gen/Counter';

export async function run(provider: NetworkProvider, args: string[]) {
    const ui = provider.ui();

    const counterAddress = Address.parse(args.length > 1 ? args[0]! : await ui.input('Input counter address:'));

    const counter = provider.open(new Counter(counterAddress));

    const oldValue = await counter.getCount(provider.sender().address!);

    await counter.sendInc(provider.sender(), toNano(0.5));

    for (;;) {
        const newValue = await counter.getCount(provider.sender().address!);
        if (newValue !== oldValue) {
            ui.write(`oldValue, newValue: ${oldValue} ${newValue}`);
            ui.write('Value is successfully increased!');
            break;
        }
        await sleep(1_000);
    }
}
