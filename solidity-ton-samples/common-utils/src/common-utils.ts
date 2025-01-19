import { sleep } from '@ton/blueprint';
import type { UIProvider } from '@ton/blueprint/dist/ui/UIProvider';
import {
    Address,
    beginCell,
    Cell,
    ContractProvider,
    ExternalAddress,
    loadMessage,
    Sender,
    SendMode,
    TupleReader,
} from '@ton/core';
import type { ContractState } from '@ton/core/src/contract/ContractState';
import type { Maybe } from '@ton/core/src/utils/maybe';
import { mnemonicNew, mnemonicToPrivateKey } from '@ton/crypto';
import type { Blockchain } from '@ton/sandbox';
import type { SmartContract } from '@ton/sandbox/dist/blockchain/SmartContract';
import type { TonClient } from '@ton/ton';
import * as fs from 'fs';
import assert from 'node:assert';
import { spawnSync } from 'node:child_process';
import * as path from 'path';
import { v4 as uuidv4 } from 'uuid';

import { type AbiParam, isIntegerType } from './ts-gen/contract-abi';
import { autoGenOutputDir, genJsWrapper } from './ts-gen/wrapper-gen';

const platforms = {
    isWin32: process.platform === 'win32',
    isLinux: process.platform === 'linux',
    isDarwin: process.platform === 'darwin',
};

export async function runCommand(file: string, args: string[]) {
    const { stdout, stderr, status } = spawnSync(file, args);
    if (stderr.toString().length > 0 || status !== 0) {
        console.log(`${file} ${args.join(' ')}`, '\n');
        const out = stdout.toString();
        try {
            const js = JSON.parse(out);
            if (js.Error === undefined) console.log('stdout: ', out);
            else console.log('stdout: ', js.Error);
        } catch (SyntaxError) {
            console.log('stdout: ', out);
        }
        console.log('stderr: ', stderr.toString());
    }
    if (status !== 0) {
        console.error('Exit code: ', status);
        throw new Error('');
    }
    return { stdout: stdout.toString() };
}

function getFilePath(envName: string, defaultFilePath: string) {
    let filePath = process.env[envName];
    if (filePath === undefined) {
        filePath = defaultFilePath;
    }
    filePath = path.normalize(filePath);
    if (!fs.existsSync(filePath)) {
        const baseName = path.basename(filePath);
        throw new Error(
            `Can't find file "${baseName}". Put it to ./bin directory or set env variable "${envName}" to define a path to the file." `,
        );
    }
    return filePath;
}

function getCompilerAndCli() {
    const suffix = platforms.isWin32 ? '.exe' : '';
    const SOLC_PATH = getFilePath('SOLC_PATH', `../bin/solc${suffix}`);
    const ASM_PATH = getFilePath('ASM_PATH', `../bin/asm${suffix}`);
    const STDLIB_PATH = getFilePath('STDLIB_PATH', '../bin/stdlib_sol.tvm');
    const EVER_CLI = getFilePath('EVER_CLI', `../bin/ever-cli${suffix}`);
    return { SOLC_PATH, ASM_PATH, STDLIB_PATH, EVER_CLI };
}

function getBocFile(contract: string) {
    const path = `./temp/${contract}.boc`;
    ensurePathToFileExists(path);
    return path;
}

export async function compileAll(contracts: string[]) {
    for (const contract of contracts) {
        await compileSolidityAndGenTS(contract);
    }
}

export async function compileSolidityAndGenTS(contract: string) {
    const { SOLC_PATH, ASM_PATH, STDLIB_PATH } = getCompilerAndCli();

    const contractPath = path.normalize(path.resolve('contracts', `${contract}.sol`));
    const outputDir = path.dirname(contractPath);
    await runCommand(SOLC_PATH, [
        contractPath,
        '--output-dir',
        outputDir,
        '--base-path=./contracts',
        '--tvm-version',
        'ton',
    ]);
    const bocFile = getBocFile(contract);
    const codeFile = `./contracts/${contract}.code`;
    await runCommand(ASM_PATH, [STDLIB_PATH, '--boc', bocFile, codeFile]);
    fs.unlinkSync('output.debug.json');
    fs.renameSync(`./contracts/${contract}.code`, `./temp/${contract}.code`);
    const abiJsPath = `./${autoGenOutputDir}/${contract}.abi.json`;
    ensurePathToFileExists(abiJsPath);
    fs.renameSync(`./contracts/${contract}.abi.json`, abiJsPath);

    const stateInitBoc = fs.readFileSync(bocFile, { encoding: 'base64' });
    const stateInit = Cell.fromBase64(stateInitBoc);
    // return only code of the contract
    const code = stateInit.refs[0]!;

    genJsWrapper(contract);

    return code;
}

export async function buildData(contract: string, mnemonics: string | null, params: string) {
    const { EVER_CLI } = getCompilerAndCli();
    const bocFile = getBocFile(contract);
    const newBocFile = getRandPath();
    fs.copyFileSync(bocFile, newBocFile);
    let args = [
        '-j',
        'genaddr',
        newBocFile,
        '--abi',
        `${autoGenOutputDir}/${contract}.abi.json`,
        '--save',
        '--wc',
        '0',
        '--data',
        params
    ];
    if (mnemonics !== null) {
        args.push('--setkey', mnemonics);
    }
    await runCommand(EVER_CLI, args);
    const stateInitBoc = fs.readFileSync(newBocFile, { encoding: 'base64' });
    const stateInit = Cell.fromBase64(stateInitBoc);
    fs.unlinkSync(newBocFile);
    // return only data of the contract
    return stateInit.refs[1]!;
}

export async function encodeCell(abi: string, param: string) {
    const { EVER_CLI } = getCompilerAndCli();
    const { stdout } = await runCommand(EVER_CLI, ['-j', 'encode', '--abi', abi, param]);
    const obj = JSON.parse(stdout);
    const cellInBase64 = obj.cell_in_base64 as string;
    return Cell.fromBase64(cellInBase64);
}

export function decodeToJsTypes(type: string, components: AbiParam[] | undefined, obj: any): any {
    if (type.endsWith('[]')) {
        const itemType = type.slice(0, -2);
        const arr = [];
        for (const item of obj) {
            arr.push(decodeToJsTypes(itemType, components, item));
        }
        return arr as any;
    }
    if (type.startsWith('optional(')) {
        if (obj === null) {
            return null;
        }
        const undelyingParam = type.slice(9, -1);
        return decodeToJsTypes(undelyingParam, components, obj);
    }
    if (isIntegerType(type)) {
        return BigInt(obj);
    }
    if (type === 'bool' || type === 'string') {
        return obj;
    }
    if (type === 'cell') {
        return Cell.fromBase64(obj);
    }
    if (type === 'bytes' || type.startsWith('fixedbytes')) {
        return Buffer.from(obj, 'hex');
    }
    if (type === 'address') {
        let str = obj as string;
        if (str === '') {
            return null;
        }
        if (str.startsWith(':')) {
            str = str.slice(1);
            const hasPad = str.endsWith('_');
            if (hasPad) {
                str = str.slice(0, -1);
            }
            let value = BigInt(`0x${str}`);
            let bits = 4 * str.length;
            if (hasPad) {
                while (value > 0n && value % 2n === 0n) {
                    value /= 2n;
                    bits -= 1;
                }
                if (value % 2n === 1n) {
                    value /= 2n;
                    bits -= 1;
                }
            }
            return new ExternalAddress(value, bits);
        }
        return Address.parse(obj);
    }
    if (type === 'address_std') {
        return Address.parse(obj);
    }
    if (type === 'tuple') {
        const newObj: any = {};
        for (const comp of components!) {
            const { name } = comp;
            newObj[name] = decodeToJsTypes(comp.type, comp.components, obj[name]);
        }
        return newObj;
    }
    if (type.startsWith('map(')) {
        const keyCommaValue = type.slice(4, -1);
        const commaIndex = keyCommaValue.indexOf(',');
        assert(commaIndex !== -1);

        const keyType = keyCommaValue.slice(0, commaIndex);
        const valueType = keyCommaValue.slice(commaIndex + 1);
        const newMap = new Map();
        for (const [key, value] of Object.entries(obj)) {
            newMap.set(decodeToJsTypes(keyType, components, key), decodeToJsTypes(valueType, components, value));
        }
        return newMap;
    }
    throw new Error(`Unsupperted type: ${type}.`);
}

export async function decodeCell(abi: string, cell: Cell) {
    const { EVER_CLI } = getCompilerAndCli();
    const cellInBase64 = cell.toBoc().toString('base64');
    const { stdout } = await runCommand(EVER_CLI, ['-j', 'decode', 'abi-param', '--abi', abi, cellInBase64]);
    const obj = JSON.parse(stdout);

    const jsAbi = JSON.parse(abi) as AbiParam;
    const { name } = jsAbi;
    return obj[name];
}

export async function decodeMap(abi: string, cell: Cell) {
    const result = await decodeCell(abi, cell);
    const jsAbi = JSON.parse(abi) as AbiParam;
    return decodeToJsTypes(jsAbi.type, jsAbi.components, result);
}

export async function decodeArray(abi: string, tuple: TupleReader) {
    const length = tuple.readBigNumber();
    const cell = tuple.readCell();
    const array = beginCell().storeUint(length, 32).storeRef(cell).endCell();
    const obj = await decodeCell(abi, array);
    const jsAbi = JSON.parse(abi) as AbiParam;
    return decodeToJsTypes(jsAbi.type, jsAbi.components, obj);
}

async function callDecodeStateVariables(contract: string, bocPath: string) {
    const { EVER_CLI } = getCompilerAndCli();
    const { stdout } = await runCommand(EVER_CLI, [
        '-j',
        'decode',
        'account',
        'data',
        '--abi',
        `${autoGenOutputDir}/${contract}.abi.json`,
        '--tvc',
        bocPath,
    ]);
    return JSON.parse(stdout);
}

export async function decodeStateVariables(provider: ContractProvider, contract: string) {
    const bocPath = await saveStateToFile(await provider.getState());
    const result = await callDecodeStateVariables(contract, bocPath);
    fs.unlinkSync(bocPath);
    return result;
}

function getRandPath() {
    const p = path.normalize(`./temp/states/${uuidv4()}.boc`);
    ensurePathToFileExists(p);
    return p;
}

async function saveStateToFile(contractState: ContractState) {
    if (contractState.state.type !== 'active') {
        throw Error(' Contract is not active.');
    }
    const stateInit = createStateInit(
        cellFromBuffer(contractState.state.code!),
        cellFromBuffer(contractState.state.data!),
    );
    const stateInitBoc = stateInit.toBoc();
    const bocPath = getRandPath();
    writeToFile(bocPath, stateInitBoc);
    return bocPath;
}

export async function messageBodyForInternalMessage(contract: string, functionName: string, params: string) {
    const { EVER_CLI } = getCompilerAndCli();
    const { stdout } = await runCommand(EVER_CLI, [
        '-j',
        'body',
        '--abi',
        `${autoGenOutputDir}/${contract}.abi.json`,
        functionName,
        params,
    ]);
    const res = JSON.parse(stdout.toString());
    return Cell.fromBase64(res.Message);
}

export async function signedBodyForExternalBody(
    header: {
        time: number;
        lifetime?: number;
    },
    secretKey: Buffer,
    address: Address,
    contract: string,
    method: string,
    params: string,
) {
    const { EVER_CLI } = getCompilerAndCli();
    const args = [
        '-j',
        'message',
        '--sign',
        `${secretKey.toString('hex')}`,
        '--abi',
        `${autoGenOutputDir}/${contract}.abi.json`,
        '--time',
        header.time.toString(),
    ];
    if (header.lifetime !== undefined) {
        args.push('--lifetime', header.lifetime.toString());
    }
    args.push(address.toRawString(), method, params);
    const { stdout } = await runCommand(EVER_CLI, args);
    const jsOutput = JSON.parse(stdout);
    const messageInfo = JSON.parse(Buffer.from(jsOutput.Message, 'hex').toString());
    const base64Message = messageInfo.msg.message;
    const decodedMessage = loadMessage(Cell.fromBase64(base64Message).asSlice());
    return {
        message: decodedMessage.body,
        expireAt: messageInfo.msg.expire as number,
    };
}

export function stringifyJson(x: any) {
    (Cell as any).prototype.toJSON = function () {
        return this.toBoc().toString('base64');
    };
    (Address as any).prototype.toJSON = function () {
        return this.toRawString();
    };
    (ExternalAddress as any).prototype.toJSON = function () {
        if (this.value === 0n && this.bits === 0) {
            return '';
        }
        const builder = beginCell().storeUint(this.value, this.bits).endCell();
        const hexString = builder.bits.toString();
        return `:${hexString}`;
    };
    (Buffer as any).prototype.toJSON = function () {
        return this.toString('hex');
    };
    (Map as any).prototype.toJSON = function () {
        const object = {};
        for (const [key, value] of this) {
            if (key instanceof Address)
                // @ts-ignore
                object[key.toRawString()] = value;
            // @ts-ignore
            else object[key] = value;
        }
        return object;
    };
    return JSON.stringify(x, (_key, value) => {
        const valueType = typeof value;
        if (valueType === 'bigint') return value.toString();
        return value;
    });
}

export function cellFromBuffer(src: Buffer): Cell {
    const parsed = Cell.fromBoc(src);
    if (parsed.length !== 1) {
        throw new Error('Deserialized more than one cell');
    }
    return parsed[0]!;
}

export function createStateInit(code: Cell, data: Cell): Cell {
    return beginCell()
        .storeUint(0, 2) // split_depth:(Maybe (## 5)) special:(Maybe TickTock)
        .storeMaybeRef(code) // code:(Maybe ^Cell)
        .storeMaybeRef(data) // data:(Maybe ^Cell)
        .storeDict(null) // library:(HashmapE 256 SimpleLib)
        .endCell();
}

function ensureDirectoryExists(directory: string) {
    if (fs.existsSync(directory)) {
        return;
    }
    fs.mkdirSync(directory, { recursive: true });
}

function ensurePathToFileExists(filePath: string) {
    const dirname = path.dirname(filePath);
    ensureDirectoryExists(dirname);
}

export function writeToFile(path: string, buffer: Buffer) {
    ensurePathToFileExists(path);
    fs.writeFileSync(path, buffer);
}

export async function sendInternalMessage(
    provider: ContractProvider,
    via: Sender,
    contract: string,
    functionName: string,
    params: string,
    value: bigint | string,
    bounce?: Maybe<boolean>,
    sendMode = SendMode.PAY_GAS_SEPARATELY,
) {
    const body: Cell = await messageBodyForInternalMessage(contract, functionName, params);
    await provider.internal(via, {
        value,
        bounce,
        sendMode,
        body,
    });
}

export async function randomKeyPair() {
    const mnemonics = await mnemonicNew();
    return mnemonicToPrivateKey(mnemonics);
}

export async function getContractBalance(blockchain: Blockchain, address: Address) {
    const sc: SmartContract = await blockchain.getContract(address);
    return sc.balance;
}

export function noneAddress() {
    // addr_none https://github.com/ton-blockchain/ton/blob/master/crypto/block/block.tlb#L100
    return new ExternalAddress(0n, 0);
}

export async function sendExternalMessage(
    sendMessage: () => Promise<number>,
    getContractTimestamp: () => Promise<bigint>,
    tonClient: TonClient,
    ui: UIProvider
) {
    for (;;) {
        const oldTimestamp = await getContractTimestamp();
        const expireAt =  await sendMessage();
        console.log('Message will expire at (seconds): ', expireAt);
        for (;;) {
            const blockchainTime = (
                await tonClient.getContractState(
                    Address.parse('-1:5555555555555555555555555555555555555555555555555555555555555555'),
                )
            ).timestampt;
            console.log('blockchain time: ', blockchainTime);
            await sleep(1_000);
            const newTime = await getContractTimestamp();
            console.log('newTime        : ', newTime);
            console.log('oldTimestamp   : ', oldTimestamp);
            if (newTime !== oldTimestamp) {
                // The time in the contract changes. It means that the message was accepted.
                return;
            }
            if (blockchainTime >= expireAt) {
                ui.write(`The message is expired. Let's create another and send one again.`)
                break;
            }
        }
    }
}
