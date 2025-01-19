import type { NetworkProvider } from '@ton/blueprint';
import { Address, toNano } from '@ton/core';

import { compileSolidityAndGenTS, randomKeyPair } from '@solidity-ton/common-utils';

import { Counter } from '../auto-gen/Counter';

export async function run(provider: NetworkProvider) {
    const ui = provider.ui();

    const userQty = BigInt(await ui.input('Input user count:'));
    const allowedUsers: any = {};
    for (let i = 0; i < userQty; ++i) {
        const userAddress = Address.parse(await ui.input('Input user address:'));
        allowedUsers[userAddress.toRawString()] = true;
    }

    const code = await compileSolidityAndGenTS('Counter');
    const keyPair = await randomKeyPair();
    const params = {
        _pubkey: keyPair.publicKey,
        isAllowed: allowedUsers,
    };

    const counter = provider.open(await Counter.createFromABI(params, code));

    await counter.sendDeploy(provider.sender(), toNano('0.05'));

    await provider.waitForDeploy(counter.address);
    ui.write(`Contract secret key: ${keyPair.secretKey.toString('hex')}`);
    ui.write(`You can view it at https://testnet.tonviewer.com/${counter.address}`);
    ui.write('Deployed successfully!');

    // run methods on `counter`

    // Get state all contract state variables
    const vars = await counter.getStateVariables();
    console.log('State variables: ', vars);
}
