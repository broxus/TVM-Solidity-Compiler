import type { NetworkProvider } from '@ton/blueprint';
import { Address, toNano } from '@ton/core';

import { promptAmount } from '@solidity-ton/common-utils';

import { Minter } from '../auto-gen/Minter';
import { parseJettonContent } from '../src/JettonUtils';
import { WalletWrapper as Wallet } from '../wrappers/WalletWrapper';

export async function run(provider: NetworkProvider) {
    const ui = provider.ui();

    const minterAddress = Address.parse(await ui.input('Input minter address:'));
    const beneficiaryAddress = Address.parse(await ui.input('Input beneficiary address:'));

    const minter = provider.open(new Minter(minterAddress));
    const { _content } = await minter.get_jetton_data();
    const contentJS = parseJettonContent(_content);
    const decimals = parseInt(contentJS.decimals!, 10);

    const tokenAmount = await promptAmount('Enter jetton amount to mint', decimals, ui);

    const userJettonAddress = await minter.get_wallet_address(provider.sender().address!);
    const wallet = provider.open(new Wallet(userJettonAddress));
    await wallet.sendJettons(provider.sender(), toNano('0.05'), {
        queryId: 123456n,
        jettonAmount: tokenAmount,
        toOwner: beneficiaryAddress,
        response: provider.sender().address!,
        customPayload: null,
        forwardTonAmount: toNano('0.01'),
        forwardPayload: null,
    });
}
