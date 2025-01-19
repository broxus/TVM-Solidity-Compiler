import type { UIProvider } from '@ton/blueprint';

function getMultiplier(decimals: number): bigint {
    let x = 1n;
    for (let i = 0; i < decimals; ++i) {
        x *= 10n;
    }
    return x;
}

export function toUnits(src: string | bigint, decimals: number): bigint {
    const MULTIPLIER = getMultiplier(decimals);

    if (typeof src === 'bigint') {
        return src * MULTIPLIER;
    }
    // Check sign
    let neg = false;
    while (src.startsWith('-')) {
        neg = !neg;
        // eslint-disable-next-line no-param-reassign
        src = src.slice(1);
    }

    // Split string
    if (src === '.') {
        throw Error('Invalid number');
    }
    const parts = src.split('.');
    if (parts.length > 2) {
        throw Error('Invalid number');
    }

    // Prepare parts
    let whole = parts[0];
    let frac = parts[1];
    if (!whole) {
        whole = '0';
    }
    if (!frac) {
        frac = '0';
    }
    if (frac.length > decimals) {
        throw Error('Invalid number');
    }
    while (frac.length < decimals) {
        frac += '0';
    }

    // Convert
    let r = BigInt(whole) * MULTIPLIER + BigInt(frac);
    if (neg) {
        r = -r;
    }
    return r;
}
export const promptAmount = async (prompt: string, decimals: number, provider: UIProvider) => {
    let resAmount: bigint;
    do {
        const inputAmount = await provider.input(prompt);
        try {
            resAmount = toUnits(inputAmount, decimals);

            if (resAmount <= 0) {
                throw new Error('Please enter positive number');
            }

            return resAmount;
        } catch (e: any) {
            provider.write(e.message);
        }
        // eslint-disable-next-line no-constant-condition
    } while (true);
};
