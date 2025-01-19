import type { NetworkProvider } from '@ton/blueprint';
import { Address, toNano } from '@ton/core';

import { Minter } from '../auto-gen/Minter';

export async function run(provider: NetworkProvider, args: string[]) {
    const ui = provider.ui();

    const minterAddress = Address.parse(args.length > 1 ? args[0]! : await ui.input('Input minter address:'));
    const newAdmin = Address.parse(args.length > 2 ? args[1]! : await ui.input('Input new admin address:'));

    const minter = provider.open(new Minter(minterAddress));
    await minter.sendSetAdmin(provider.sender(), toNano('0.05'), {
        queryId: 0n,
        newAdmin,
    });
}
