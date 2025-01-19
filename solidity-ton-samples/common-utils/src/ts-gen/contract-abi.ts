export type AbiParam = {
    name: string;
    type: string;
    components?: AbiParam[];
    init?: boolean;
};

export type AbiEvent = {
    name: string;
    inputs: AbiParam[];
    id?: string | null;
};

export type AbiFunction = {
    name: string;
    inputs: AbiParam[];
    outputs: AbiParam[];
    id?: string | null;
};

export type AbiGetter = {
    name: string;
    inputs: AbiParam[];
    outputs: AbiParam[];
};

export type AbiContract = {
    'ABI version'?: number;
    abi_version?: number;
    version?: string | null;
    header?: string[];
    functions?: AbiFunction[];
    getters?: AbiGetter[];
    events?: AbiEvent[];
    fields?: AbiParam[];
    data?: AbiParam[];
};

export function isIntegerType(type: string) {
    return (
        (type.startsWith('int') ||
            type.startsWith('uint') ||
            type.startsWith('varint') ||
            type.startsWith('varuint')) &&
        !type.endsWith('[]')
    );
}
