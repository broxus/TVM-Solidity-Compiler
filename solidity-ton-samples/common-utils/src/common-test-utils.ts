import '@ton/test-utils';
import type { Address, Transaction } from '@ton/core';
import type { BlockchainTransaction } from '@ton/sandbox';

export function checkCallingChain(txs: BlockchainTransaction[], addr: Address[]) {
    for (let i = 0; i + 1 < addr.length; ++i) {
        expect(txs).toHaveTransaction({
            from: addr[i]!,
            to: addr[i + 1]!,
            success: true,
            inMessageBounced: false,
        });
    }
}

export function computedGeneric<T extends Transaction>(transaction: T) {
    if (transaction.description.type !== 'generic') throw new Error('Expected generic transaction action');
    if (transaction.description.computePhase.type !== 'vm') throw new Error('Compute phase expected');
    return transaction.description.computePhase;
}

export function storageGeneric<T extends Transaction>(transaction: T) {
    if (transaction.description.type !== 'generic') throw new Error('Expected generic transaction action');
    return transaction.description.storagePhase;
}
