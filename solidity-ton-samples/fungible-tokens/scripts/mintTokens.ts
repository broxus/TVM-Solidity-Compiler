import type { NetworkProvider } from '@ton/blueprint';
import { Address, toNano } from '@ton/core';

import { promptAmount } from '@solidity-ton/common-utils';

import { Minter } from '../auto-gen/Minter';
import { makeTransferMessage, parseJettonContent } from '../src/JettonUtils';

export async function run(provider: NetworkProvider) {
    const ui = provider.ui();

    const minterAddress = Address.parse(await ui.input('Input minter address:'));
    const minter = provider.open(new Minter(minterAddress));
    const { _content } = await minter.get_jetton_data();
    const contentJS = parseJettonContent(_content);
    const decimals = parseInt(contentJS.decimals!, 10);

    const userAddress = Address.parse(await ui.input('Input user address:'));
    const tokenAmount = await promptAmount('Enter jetton amount to mint', decimals, ui);

    await minter.sendMintTokens(provider.sender(), toNano('1'), {
        queryId: 0n,
        to: userAddress,
        tonAmount: toNano('0.05'),
        masterMsg: makeTransferMessage({
            queryId: 123456n,
            jettonAmount: tokenAmount,
            from: null,
            response: provider.sender().address!,
            forwardTonAmount: toNano('0.005'),
            customPayload: null,
        }),
    });
}
