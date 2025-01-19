import type { Address, Cell, ContractProvider } from '@ton/core';

import { Wallet } from '../auto-gen/Wallet';

export class WalletWrapper extends Wallet {
    constructor(
        readonly address: Address,
        readonly init?: { code: Cell; data: Cell },
    ) {
        super(address, init);
    }

    async getJettonBalance(provider: ContractProvider) {
        const state = await provider.getState();
        if (state.state.type !== 'active') {
            return 0n;
        }
        const res = await this.get_wallet_data(provider);
        return res._balance;
    }
}
