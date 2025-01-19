import assert from 'node:assert';
import * as fs from 'node:fs';
import * as path from 'path';

import { Writer } from './Writer';
import { type AbiContract, type AbiFunction, type AbiGetter, type AbiParam, isIntegerType } from './contract-abi';

export const autoGenOutputDir = 'auto-gen';

export function genJsWrapper(contract: string) {
    const strAbi = fs.readFileSync(`./${autoGenOutputDir}/${contract}.abi.json`).toString();
    const abi = JSON.parse(strAbi) as AbiContract;
    const tsCode = genJsWrapperImpl(contract, abi);

    try {
        fs.writeFileSync(`${autoGenOutputDir}/${contract}.ts`, tsCode);
    } catch (err) {
        console.error(err);
        throw err;
    }
}

function genJsWrapperImpl(contract: string, abi: AbiContract) {
    const contractName = path.basename(contract, '.sol');
    const w = new Writer();

    writeImport(w);
    w.append();
    w.write(`// **********************************************`);
    w.write(`// This file is auto-generated. Do not modify it.`);
    w.write(`// **********************************************`);
    w.append();
    w.write(`export class ${contractName} implements Contract {`);
    w.inIndent(() => {
        w.write(`static readonly contractPath: string = '${contract}';`);
        w.append();
        w.write(`
            constructor(
                readonly address: Address,
                readonly init?: { code: Cell; data: Cell },
            ) {}
        `);
        w.append();
        writeCreateFromABI(w, abi, contractName);
        w.append();
        const constructor = abi.functions!.find(fun => fun.name === 'constructor');
        if (constructor === undefined) {
            writeSendDeploy(w);
        }
        w.append();
        writeGetStateVariables(w, contractName, abi.fields!);
        w.append();
        for (const fun of abi.functions!) {
            writeInternalBody(w, fun, contractName);
            w.append();
            writeInternalFunction(w, fun, contractName);
            w.append();
            writeExternalBody(w, fun, contractName);
            w.append();
            writeExternalFunction(w, fun, contractName);
            w.append();
        }
        for (const fun of abi.getters!) {
            writeGetter(w, fun);
            w.append();
        }
    });
    w.write(`}`);
    w.append();
    return w.end();
}

function writeImport(w: Writer) {
    w.write(`
        import {
            Address,
            Cell,
            Contract,
            ContractProvider,
            ExternalAddress,
            SendMode,
            Sender,
            TupleItem,
            beginCell,
            contractAddress,
        } from '@ton/core';
        
        import type { Maybe } from '@ton/core/src/utils/maybe';
        
        import {
            buildData,
            decodeArray,
            decodeCell,
            decodeMap,
            decodeStateVariables,
            decodeToJsTypes,
            encodeCell,
            messageBodyForInternalMessage,
            sendInternalMessage,
            signedBodyForExternalBody,
            stringifyJson,
        } from '@solidity-ton/common-utils';
        import type { AbiParam } from '@solidity-ton/common-utils';
    `);
}

function writeCreateFromABI(w: Writer, abi: AbiContract, contractName: string) {
    w.write('static async createFromABI(');
    // Function parameters
    w.inIndent(() => {
        w.write(`params: {`);
        w.inIndent(() => {
            for (const field of abi.data!) {
                w.write(`${field.name}: ${getType(field.type, field.components)};`);
            }
        });
        w.write(`},`);
        w.write(`
            code: Cell,
            workchain = 0,
            pubkey: string | null = null,
        `);
    });
    w.write(') {');
    // Function code
    w.inIndent(() => {
        w.write(`
            const p = stringifyJson(params);
            const data = await buildData(${contractName}.contractPath, pubkey, p);
            const init = { code, data };
            return new ${contractName}(contractAddress(workchain, init), init);
        `);
    });
    w.write('}');
}

function writeGetStateVariables(w: Writer, contractName: string, fields: AbiParam[]) {
    w.write(`async getStateVariables(provider: ContractProvider) {`);
    w.inIndent(() => {
        w.write(`
            const stateVars = await decodeStateVariables(provider, ${contractName}.contractPath);
            return {
        `);
        w.inIndent(() => {
            for (const field of fields) {
                let comp;
                if (field.components) {
                    const compInJson = JSON.stringify(field.components);
                    comp = `JSON.parse('${compInJson}') as AbiParam[]`;
                }
                w.write(
                    `${field.name}: decodeToJsTypes('${field.type}', ${comp}, stateVars.${field.name}) as ${getType(field.type, field.components)},`,
                );
            }
        });
        w.write(`};`);
    });
    w.write(`}`);
}

function writeSendDeploy(w: Writer) {
    w.write(`
        async sendDeploy(provider: ContractProvider, via: Sender, value: bigint) {
            await provider.internal(via, {
                value,
                sendMode: SendMode.PAY_GAS_SEPARATELY,
            });
        }
    `);
}

function writeParams(w: Writer, params: AbiParam[]) {
    if (params.length === 1) {
        for (const param of params) {
            w.write(`${param.name}: ${getType(param.type, param.components)},`);
        }
    } else if (params.length > 1) {
        w.write('params: {');
        w.inIndent(() => {
            for (const param of params) {
                w.write(`${param.name}: ${getType(param.type, param.components)};`);
            }
        });
        w.write('},');
    }
}

function getBodyName(name: string) {
    return `${name}Body`;
}

function writeInternalBody(w: Writer, fun: AbiFunction, contractName: string) {
    const { name } = fun;
    w.write(`static async ${getBodyName(name)}(`);
    w.inIndent(() => {
        writeParams(w, fun.inputs);
    });
    w.write(`) {`);
    w.inIndent(() => {
        if (fun.inputs.length === 0)
            w.write(`const p = '{}';`);
        else if (fun.inputs.length === 1)
            w.write(`const p = stringifyJson({ ${fun.inputs[0]!.name} });`);
        else
            w.write(`const p = stringifyJson(params);`);
        w.write(`return messageBodyForInternalMessage(${contractName}.contractPath, '${fun.name}', p);`);
    });
    w.write(`}`);
}

function writeInternalFunction(w: Writer, fun: AbiFunction, contractName: string) {
    const { name } = fun;
    if (name.startsWith('send')) {
        w.write(`async ${name}(`);
    } else {
        w.write(`async send${name.slice(0, 1).toUpperCase()}${name.slice(1)}(`);
    }
    w.inIndent(() => {
        w.write(`
            provider: ContractProvider,
            via: Sender,
            value: bigint,
        `);
        writeParams(w, fun.inputs);
        const s = 'bounce?: Maybe<boolean';
        w.write(`${s}>,`);
        w.write(`sendMode = SendMode.PAY_GAS_SEPARATELY,`);
    });
    w.write(`) {`);
    w.inIndent(() => {
        const makeBodyName = getBodyName(name);
        let params;
        if (fun.inputs.length === 0)
            params = '';
        else if (fun.inputs.length === 1)
            params = fun.inputs[0]!.name;
        else
            params = 'params';
        w.write(`const body: Cell = await ${contractName}.${makeBodyName}(${params});`);
        w.write(`
            await provider.internal(via, {
                value,
                bounce,
                sendMode,
                body,
            });
        `);
    });
    w.write(`}`);
}

function externalBody(name: string) {
    return `${name}BodyExternal`
}

function writeExtHeader(w: Writer) {
    // TODO read expire from config
    w.write(`
        header: {
            /**
             * Current time in milliseconds elapsed since the UNIX epoch in milliseconds
             */
            time: number;
            /**
             * Lifetime of the message in seconds
             */
            lifetime?: number;
        },
    `);
}

function writeExternalBody(w: Writer, fun: AbiFunction, contractName: string) {
    const name = externalBody(fun.name);
    w.write(`async ${name}(`);
    w.inIndent(() => {
        w.write(`secretKey: Buffer,`);
        writeExtHeader(w);
        writeParams(w, fun.inputs);
    });
    w.write(`) {`);
    w.inIndent(() => {
        if (fun.inputs.length === 0)
            w.write(`const p = '{}';`);
        else if (fun.inputs.length === 1)
            w.write(`const p = stringifyJson({ ${fun.inputs[0]!.name} });`);
        else
            w.write(`const p = stringifyJson(params);`);
        // TODO delete address
        w.write(`
            const {message, expireAt} = await signedBodyForExternalBody(
                header,
                secretKey,
                this.address,
                ${contractName}.contractPath,
                '${fun.name}', 
                p
            );`,
        );
        w.write(`return { message, expireAt };`);
    });
    w.write(`}`);
}

function writeExternalFunction(w: Writer, fun: AbiFunction, contractName: string) {
    const { name } = fun;
    if (name.startsWith('send')) {
        w.write(`async ${name}External(`);
    } else {
        w.write(`async send${name.slice(0, 1).toUpperCase()}${name.slice(1)}External(`);
    }
    w.inIndent(() => {
        w.write(`
            provider: ContractProvider,
            secretKey: Buffer,
        `);
        writeExtHeader(w);
        writeParams(w, fun.inputs);
    });
    w.write(`) {`);
    w.inIndent(() => {
        const nameBody = externalBody(fun.name);
        let params;
        if (fun.inputs.length === 0)
            params = '';
        else if (fun.inputs.length === 1)
            params = `, ${fun.inputs[0]!.name}`;
        else
            params = ', params';
        w.write(
            `const {message, expireAt} = await this.${nameBody}(secretKey, header${params});`,
        );
        w.write(`await provider.external(message);`);
        w.write(`return expireAt;`);
    });
    w.write(`}`);
}

function writeGetter(w: Writer, fun: AbiGetter) {
    const { name } = fun;
    if (name.startsWith('get')) w.write(`async ${name}(`);
    else w.write(`async get${name.slice(0, 1).toUpperCase()}${name.slice(1)}(`);
    w.inIndent(() => {
        w.write(`provider: ContractProvider,`);
        writeParams(w, fun.inputs);
    });
    w.write(`) {`);
    w.inIndent(() => {
        w.write(`const args: TupleItem[] = [`);
        w.inIndent(() => {
            for (const param of fun.inputs) {
                writeParamInTuple(w, param, fun.inputs.length > 1);
            }
        });
        w.write(`];`);
        w.write(`
            const result = await provider.get('${name}', args);
            const { stack } = result;
        `);

        if (fun.outputs.length === 1) {
            readParamFromTuple(w, 'stack', `return `, ';', fun.outputs[0]!);
        } else if (fun.outputs.length > 1) {
            w.write(`return {`);
            w.inIndent(() => {
                for (const retParam of fun.outputs) {
                    readParamFromTuple(w, 'stack', `${retParam.name}: `, ',', retParam);
                }
            });
            w.write('};');
        }
    });
    w.write(`}`);
}

function readParamFromTuple(w: Writer, stackName: string, prefix: string, suffix: string, param: AbiParam) {
    const { type } = param;
    if (type.endsWith('[]')) {
        const jsAbi = JSON.stringify(param);
        w.write(
            `${prefix}(await decodeArray(\`${jsAbi}\`, ${stackName}.readTuple())) as ${getType(param.type, param.components)}${suffix}`,
        );
    } else if (isIntegerType(type)) {
        // uintN / intN / varint / varuint
        w.write(`${prefix}${stackName}.readBigNumber()${suffix}`);
    } else if (type === 'bool') {
        w.write(`${prefix}${stackName}.readBoolean()${suffix}`);
    } else if (type.startsWith('address')) {
        w.write(`${prefix}${stackName}.readAddress()${suffix}`);
    } else if (type === 'cell') {
        w.write(`${prefix}${stackName}.readCell()${suffix}`);
    } else if (type.startsWith('map(')) {
        const jsAbi = JSON.stringify(param);
        w.write(
            `${prefix}(await decodeMap(\`${jsAbi}\`, ${stackName}.readCell())) as ${getType(param.type, param.components)}${suffix}`,
        );
    } else if (type === 'string' || type === 'bytes') {
        const jsAbi = JSON.stringify(param);
        w.write(
            `${prefix}(await decodeCell(\`${jsAbi}\`, ${stackName}.readCell())) as ${getType(param.type, param.components)}${suffix}`,
        );
    } else if (type.startsWith('optional(')) {
        const undelyingParam = param;
        undelyingParam.type = type.slice(9, -1);
        undelyingParam.name = `${param.name}!`;

        readParamFromTuple(
            w,
            stackName,
            `${prefix}${stackName}.peek().type === 'null' ? null : `,
            suffix,
            undelyingParam,
        );
    } else if (type === 'tuple') {
        w.write(`${prefix} (() => {`);
        w.inIndent(() => {
            const newStackName = `stack${w.depth()}`;
            w.write(`const ${newStackName} = ${stackName}.readTuple();`);
            w.write(`return {`);
            w.inIndent(() => {
                for (const comp of param.components!) {
                    readParamFromTuple(w, newStackName, `${comp.name}: `, ',', comp);
                }
            });
            w.write(`};`);
        });
        w.write(`}).apply(this)${suffix}`);
    } else {
        throw Error(`Unknown type: ${type}`);
    }
}

function writeParamInTuple(w: Writer, param: AbiParam, moreThanOneParam: boolean) {
    const paramPreffix = moreThanOneParam ? 'params.' : '';
    const { name, type } = param;
    if (type.endsWith('[]')) {
        const jsAbi = JSON.stringify(param);
        w.write(`
            {
                 type: 'tuple',
                 items: [
                     { type: 'int', value: BigInt(${paramPreffix}${param.name}.length) },
                     {
                         type: 'cell',
                         cell: await encodeCell(\`${jsAbi}\`, stringifyJson(${paramPreffix}${param.name})),
                     },
                 ],
             },
        `);
    } else if (type.startsWith('map(') || type === 'string' || type === 'bytes') {
        const jsAbi = JSON.stringify(param);
        w.write(`{ type: 'cell', cell: await encodeCell(\`${jsAbi}\`, stringifyJson(${paramPreffix}${param.name})) },`);
    } else if (isIntegerType(type)) {
        // uintN / intN / varint / varuint
        w.write(`{ type: 'int', value: BigInt(${paramPreffix}${name}) },`);
    } else if (type === 'bool') {
        w.write(`{ type: 'int', value: ${paramPreffix}${name} ? -1n : 0n },`);
    } else if (type.startsWith('address')) {
        w.write(`{ type: 'slice', cell: beginCell().storeAddress(${paramPreffix}${name}).endCell() },`);
    } else if (type === 'cell') {
        w.write(`{ type: 'cell', cell: ${paramPreffix}${name} },`);
    } else if (type.startsWith('optional(')) {
        w.write(`${paramPreffix}${name} === null || ${paramPreffix}${name} === undefined ?`);
        w.inIndent(() => {
            w.write(`{ type: 'null' } :`);
            const undelyingParam = param;
            undelyingParam.type = type.slice(9, -1);
            undelyingParam.name += '!';
            writeParamInTuple(w, undelyingParam, moreThanOneParam);
        });
    } else if (type === 'tuple') {
        w.write(`{ type: 'tuple', items: [`);
        w.inIndent(() => {
            for (const comp of param.components!) {
                comp.name = `${param.name}.${comp.name}`;
                writeParamInTuple(w, comp, moreThanOneParam);
            }
        });
        w.write(`]},`);
    } else {
        throw Error(`Unknown type: ${type}`);
    }
}

function getType(type: string, components?: AbiParam[], isMapKey = false) {
    if (type.endsWith('[]')) {
        const underlyingType = type.slice(0, -2);
        let result: string = getType(underlyingType, components);
        result += '[]';
        return result;
    }
    if (isIntegerType(type)) {
        // uintN / intN / varint / varuint
        return 'bigint';
    }
    if (type === 'bool') {
        return 'boolean';
    }
    if (type === 'address_std') {
        if (isMapKey) return 'Address';
        return 'Address | null';
    }
    if (type === 'address') {
        if (isMapKey) return 'Address';
        return 'Address | ExternalAddress | null';
    }
    if (type === 'cell') {
        return 'Cell';
    }
    if (type.startsWith('map(')) {
        const keyCommaValue = type.slice(4, -1);
        const commaIndex = keyCommaValue.indexOf(',');
        assert(commaIndex !== -1);

        const key = getType(keyCommaValue.slice(0, commaIndex), components, true);
        const value = getType(keyCommaValue.slice(commaIndex + 1), components);
        let result = `Map<`;
        result += key;
        result += ', ';
        result += value;
        result += '>';
        return result;
    }
    if (type === 'string') {
        return 'string';
    }
    if (type === 'bytes' || type.startsWith('fixedbytes')) {
        return 'Buffer';
    }
    if (type.startsWith('optional(')) {
        const underlyingType = type.slice(9, -1);
        let result = `Maybe<`;
        result += getType(underlyingType, components);
        result += '>';
        return result;
    }
    if (type === 'tuple') {
        let result = '{';
        for (const comp of components!) {
            result += ` ${comp.name}: ${getType(comp.type, comp.components)};`;
        }
        result += ' }';
        return result;
    }
    throw Error(`Unimplemented code for type: ${type}`);
}
