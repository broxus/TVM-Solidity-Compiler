import { type Address, beginCell, type Cell, Dictionary, type DictionaryValue, type ExternalAddress } from '@ton/core';
// eslint-disable-next-line camelcase
import { sha256_sync } from '@ton/crypto';

import '@ton/test-utils';

const snakeString: DictionaryValue<string> = {
    serialize(src, builder) {
        builder.storeStringRefTail(`\x00${src}`);
    },
    parse(src) {
        const outStr = src.loadStringTail();
        if (outStr.charCodeAt(0) !== 0) {
            throw new Error('No snake prefix');
        }
        return outStr.substring(1);
    },
};

export const defaultJettonKeys = [
    'uri',
    'name',
    'description',
    'image',
    'image_data',
    'symbol',
    'decimals',
    'amount_style',
];

export function parseJettonContent(content: Cell) {
    const slice = content.beginParse();
    slice.loadUint(8);
    const contentMap: { [key: string]: string } = {};
    const dict = slice.loadDict(Dictionary.Keys.Buffer(32), snakeString);
    for (const key of defaultJettonKeys) {
        const value = dict.get(sha256_sync(key));
        if (value !== undefined) contentMap[key] = value;
    }
    return contentMap;
}

export function makeTransferMessage(opts: {
    queryId: bigint;
    jettonAmount: bigint;
    from: Address | null;
    response: Address | null;
    forwardTonAmount: bigint;
    customPayload: Cell | null;
}) {
    const builder = beginCell()
        .storeUint(opts.queryId, 64)
        .storeCoins(opts.jettonAmount)
        .storeAddress(opts.from)
        .storeAddress(opts.response)
        .storeCoins(opts.forwardTonAmount)
        .storeMaybeRef(opts.customPayload);

    return builder.endCell();
}

export function makeJettonContent(opts: {
    name: string;
    description: string;
    symbol: string;
    decimals: string;
    image: string;
}) {
    const dict = Dictionary.empty(Dictionary.Keys.Buffer(32), snakeString);
    dict.set(sha256_sync('name'), opts.name);
    dict.set(sha256_sync('description'), opts.description);
    dict.set(sha256_sync('symbol'), opts.symbol);
    dict.set(sha256_sync('decimals'), opts.decimals.toString());
    dict.set(sha256_sync('image'), opts.image);

    return beginCell().storeUint(0, 8).storeDict(dict).endCell();
}
