import type { NetworkProvider } from '@ton/blueprint';
import { toNano } from '@ton/core';

import { compileSolidityAndGenTS } from '@solidity-ton/common-utils';

import { Minter } from '../auto-gen/Minter';
import { makeJettonContent } from '../src/JettonUtils';

export async function run(provider: NetworkProvider) {
    const ui = provider.ui();

    const minterCode = await compileSolidityAndGenTS('Minter');
    const walletCode = await compileSolidityAndGenTS('Wallet');

    const minter = provider.open(
        await Minter.createFromABI(
            {
                _pubkey: Buffer.alloc(32),
                admin: provider.sender().address!,
                jettonWalletCode: walletCode,
                content: makeJettonContent({
                    name: 'Solidity',
                    symbol: 'SOLC',
                    description: 'TON Solidity coin',
                    image: 'https://upload.wikimedia.org/wikipedia/commons/9/98/Solidity_logo.svg',
                    decimals: '9',
                }),
            },
            minterCode,
        ),
    );

    await minter.sendDeploy(provider.sender(), toNano('0.6'));
    await provider.waitForDeploy(minter.address);
    ui.write(`You can view it at https://testnet.tonviewer.com/${minter.address}`);
}
