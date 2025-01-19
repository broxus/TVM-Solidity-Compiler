import { compileAll } from '@solidity-ton/common-utils';

const contracts = ['AbiTester', 'dex/MyDex'];

compileAll(contracts);
