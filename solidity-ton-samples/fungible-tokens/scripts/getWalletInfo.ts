import type { NetworkProvider } from '@ton/blueprint';
import { Address } from '@ton/core';

import { Minter } from '../auto-gen/Minter';
import { WalletWrapper as Wallet } from '../wrappers/WalletWrapper';

export async function run(provider: NetworkProvider, args: string[]) {
    const ui = provider.ui();

    const minterAddress = Address.parse(args.length > 1 ? args[0]! : await ui.input('Input minter address:'));
    const userAddress = Address.parse(args.length > 2 ? args[1]! : await ui.input('Input user address:'));

    const minter = provider.open(new Minter(minterAddress));
    const userJettonAddress = await minter.get_wallet_address(userAddress);

    const wallet = provider.open(new Wallet(userJettonAddress));
    const balance = await wallet.getJettonBalance();
    ui.write(`Jetton balance: ${balance}`);
}
