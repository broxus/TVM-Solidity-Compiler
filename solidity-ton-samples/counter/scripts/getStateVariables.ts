import type { NetworkProvider } from '@ton/blueprint';
import { Address } from '@ton/core';

import { Counter } from '../auto-gen/Counter';

export async function run(provider: NetworkProvider, args: string[]) {
    const ui = provider.ui();

    const counterAddress = Address.parse(args.length > 0 ? args[0]! : await ui.input('Input counter address:'));

    const counter = provider.open(new Counter(counterAddress));

    const vars = await counter.getStateVariables();
    console.log('State variables: ', vars);
}
