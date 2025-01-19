import type { NetworkProvider } from '@ton/blueprint';
import { Address } from '@ton/core';

import { stringifyJson } from '@solidity-ton/common-utils';

import { Minter } from '../auto-gen/Minter';

export async function run(provider: NetworkProvider, args: string[]) {
    const ui = provider.ui();

    const minterAddress = Address.parse(args.length > 1 ? args[0]! : await ui.input('Input minter address:'));

    const minter = provider.open(new Minter(minterAddress));
    const info = await minter.get_jetton_data();
    ui.write(JSON.stringify(JSON.parse(stringifyJson(info)), null, 4));
}
