/*
 * Copyright (C) 2019-2025 EverX. All Rights Reserved.
 *
 * Licensed under the  terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License.
 *
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the  GNU General Public License for more details at: https://www.gnu.org/licenses/gpl-3.0.html
 */

#include <boost/algorithm/string.hpp>

#include <libsolutil/picosha2.h>
#include <libsolidity/ast/TypeProvider.h>
#include <libsolidity/analysis/TypeChecker.h>

#include <libsolidity/codegen/TVMABI.hpp>
#include <libsolidity/codegen/TVMPusher.hpp>
#include <libsolidity/codegen/TVM.hpp>
#include <libsolidity/codegen/TVMConstants.hpp>
#include <libsolidity/codegen/TVMContractCompiler.hpp>

using namespace solidity::frontend;
using namespace std;
using namespace solidity::util;
using namespace solidity::langutil;

Json::Value TVMABI::generateFunctionIdsJson(
	ContractDefinition const& contract,
	PragmaDirectiveHelper const& pragmaHelper
) {
	TVMCompilerContext ctx{&contract, pragmaHelper};
	StackPusher pusher{&ctx};
	std::vector<const FunctionDefinition *> publicFunctions = TVMABI::publicFunctions(contract);
	std::map<std::string, uint32_t> func2id;
	for (FunctionDefinition const* func : publicFunctions) {
		uint32_t functionID = ChainDataEncoder::calculateFunctionIDWithReason(
			func,
			ReasonOfOutboundMessage::RemoteCallInternal
		);
		const std::string name = TVMCompilerContext::getFunctionExternalName(func);
		func2id[name] = functionID;
	}
	if (func2id.count("constructor") == 0 && ctx.storageLayout().hasConstructor())
		func2id["constructor"] = ChainDataEncoder::calculateConstructorFunctionID();

	Json::Value root(Json::objectValue);
	for (const auto&[func, functionID] : func2id) {
		std::stringstream ss;
		ss << "0x" << std::hex << std::setfill('0') << std::setw(8) << functionID;
		root[func] = ss.str();
	}
	return root;
}

Json::Value
TVMABI::generatePrivateFunctionIdsJson(
	ContractDefinition const& contract,
	std::vector<ASTPointer<SourceUnit>> const& _sourceUnits,
	PragmaDirectiveHelper const& pragmaHelper
) {
	if (!contract.canBeDeployed()) {
		fatal_error(contract.name() + " is not deployable. Can't print private function IDs.");
	}
	Json::Value ids{Json::arrayValue};
	Pointer<Contract> codeContract = TVMContractCompiler::generateContractCode(&contract, _sourceUnits, pragmaHelper);
	for (Pointer<Function> const& fun : codeContract->functions()) {
		FunctionDefinition const* def = fun->functionDefinition();
		if (fun->type() == Function::FunctionType::Fragment && fun->functionId()) {
			Json::Value func{Json::objectValue};
			func["scope"] = def->isFree() ? "" : def->annotation().contract->name();
			func["sign"] = def->externalSignature();
			func["id"] = fun->functionId().value();
			ids.append(func);
		}
	}
	return ids;
}

Json::Value TVMABI::generateABIJson(
	ContractDefinition const *contract,
	std::vector<ASTPointer<SourceUnit>> const& _sourceUnits,
	std::vector<PragmaDirective const *> const &pragmaDirectives
) {
	PragmaDirectiveHelper pdh{pragmaDirectives};
	TVMCompilerContext ctx{contract, pdh};

	Json::Value root(Json::objectValue);
	root["ABI version"] = 2;
	root["version"] = "2.7";

	// header
	{
		Json::Value header(Json::arrayValue);

		// NOTE: order is important
		if (auto msgHeaders = contract->externalMsgHeaders()) {
			if (msgHeaders->hasPubkey()) header.append("pubkey");
			if (msgHeaders->hasTime())   header.append("time");
			if (msgHeaders->hasExpire()) header.append("expire");
        }

		root["header"] = header;
	}

	// functions
	{
		std::set<std::string> used;
		Json::Value functions(Json::arrayValue);
		const std::vector<const FunctionDefinition *> publicFunctions = TVMABI::publicFunctions(*contract);
		for (FunctionDefinition const* f : publicFunctions) {
			auto funcName = TVMCompilerContext::getFunctionExternalName(f);
			if (used.count(funcName))
				continue;
			used.insert(funcName);
			functions.append(toJson(funcName, convertArray(f->parameters()), convertArray(f->returnParameters()), f));
		}

		if (used.count("constructor") == 0 && ctx.storageLayout().hasConstructor()) {
			functions.append(toJson("constructor", {}, {}, nullptr));
		}

		root["functions"] = functions;
	}

	// events
	{
		std::vector<const EventDefinition *> events {};
		for (const auto &_event : contract->definedInterfaceEvents())
			events.push_back(_event);
		for (std::shared_ptr<SourceUnit> const& source: _sourceUnits)
			for (ASTPointer<ASTNode> const &node: source->nodes()) {
				if (auto eventDefinition = dynamic_cast<EventDefinition const *>(node.get()))
					events.push_back(eventDefinition);
				if (auto lib = dynamic_cast<ContractDefinition const *>(node.get()))
					if (lib->isLibrary())
						for (const auto &event : lib->definedInterfaceEvents())
							events.push_back(event);
			}

		Json::Value eventAbi(Json::arrayValue);
		std::set<std::string> usedEvents;
		for (const auto &e: events) {
			string name = eventName(e);
			{
				const std::string fullName = eventName(e) + " " + e->functionType(true)->externalSignature();
				solAssert(usedEvents.count(fullName) == 0, "Event is duplicated: " + fullName);
				usedEvents.insert(fullName);
			}
			Json::Value cur;
			cur["name"] = name;
			cur["inputs"] = encodeParams(convertArray(e->parameters()));
			eventAbi.append(cur);
		}
		root["events"] = eventAbi;
	}

	// fields
	{
		Json::Value fields(Json::arrayValue);
		std::vector<std::pair<std::string, std::string>> offset;

		if (ctx.storageLayout().storePubkeyInC4())
			offset.emplace_back("_pubkey", "fixedbytes32");

		if (ctx.storageLayout().storeTimestampInC4())
			offset.emplace_back("_timestamp", "uint64");

		if (ctx.storageLayout().hasConstructor())
			offset.emplace_back("_constructorFlag", "bool");

		for (const auto& [name, type] : offset) {
			Json::Value field(Json::objectValue);
			field["name"] = name;
			field["type"] = type;
			field["init"] = name == "_pubkey";
			fields.append(field);
		}

		std::vector<VariableDeclaration const *> stateVars = ctx.storageLayout().usualAndUnpackedStateVariables();
		std::set<std::string> usedNames;
		std::vector<std::tuple<std::string, Type const*, bool>> namesTypes;
		for (VariableDeclaration const * var : stateVars | boost::adaptors::reversed) {
			std::string name = var->name();
			if (usedNames.count(name) != 0)
				name = var->annotation().contract->name() + "$" + var->name();
			solAssert(usedNames.count(name) == 0, "");
			usedNames.insert(name);
			namesTypes.emplace_back(name, var->type(), var->isStatic());
		}
		std::reverse(namesTypes.begin(), namesTypes.end());

		for (auto const&[name, type, isStatic] : namesTypes) {
			Json::Value cur = setupNameTypeComponents(name, type);
			cur["init"] = isStatic;
			fields.append(cur);
		}
		root["fields"] = fields;
	}

	// getters
	{
		Json::Value functions(Json::arrayValue);
		std::set<std::string> used;
		auto getters = TVMABI::getters(*contract);
		for (FunctionDefinition const* f : getters) {
			auto funcName = TVMCompilerContext::getFunctionExternalName(f);
			solAssert(used.count(funcName) == 0, "");
			used.insert(funcName);
			functions.append(toJson(funcName, convertArray(f->parameters()), convertArray(f->returnParameters()), f));
		}
		root["getters"] = functions;
	}

	return root;
}

void TVMABI::generateABI(
	ContractDefinition const *contract,
	std::vector<ASTPointer<SourceUnit>> const& _sourceUnits,
	std::vector<PragmaDirective const *> const &pragmaDirectives,
	ostream *out
) {
	Json::Value root = generateABIJson(contract, _sourceUnits, pragmaDirectives);

//	Json::StreamWriterBuilder builder;
//	const std::string json_file = Json::writeString(builder, root);
//	*out << json_file << std::endl;


	*out << "{\n";
	*out << "\t" << R"("ABI version": )" << root["ABI version"].asString() << ",\n";
	if (root.isMember("version")) {
		*out << "\t" << R"("version": )" << root["version"] << ",\n";
	}

	if (root.isMember("version")) {
		*out << "\t" << R"("header": [)";
		for (unsigned i = 0; i < root["header"].size(); ++i) {
			*out << root["header"][i];
			if (i + 1 != root["header"].size()) {
				*out << ", ";
			}
		}
		*out << "],\n";
	}

	*out << "\t" << R"("functions": [)" << "\n";
	print(root["functions"], out);
	*out << "\t" << "],\n";

	*out << "\t" << R"("getters": [)" << "\n";
	print(root["getters"], out);
	*out << "\t" << "],\n";

	*out << "\t" << R"("events": [)" << "\n";
	print(root["events"], out);
	*out << "\t" << "],\n";

	*out << "\t" << R"("fields": [)" << "\n";
	printData(root["fields"], out);
	*out << "\t" << "]\n";

	*out << "}" << endl;
}

std::vector<const FunctionDefinition *> TVMABI::publicFunctions(ContractDefinition const& contract) {
	std::vector<const FunctionDefinition *> publicFunctions;
	if (auto main_constr = contract.constructor(); main_constr != nullptr)
		publicFunctions.push_back(contract.constructor());

	for (auto c : contract.annotation().linearizedBaseContracts) {
		for (const auto &_function : c->definedFunctions()) {
			if (!_function->isConstructor() &&
				_function->isPublic() &&
				!_function->isReceive() &&
				!_function->isFallback() &&
				!_function->isOnBounce() &&
				!_function->isOnTickTock() &&
				_function->visibility() != Visibility::Getter
			)
				publicFunctions.push_back(_function);
		}
	}
	return publicFunctions;
}

std::vector<const FunctionDefinition *> TVMABI::getters(ContractDefinition const& contract) {
	std::vector<const FunctionDefinition *> getters;
	for (auto c : contract.annotation().linearizedBaseContracts) {
		for (const auto &_function : c->definedFunctions()) {
			if (!_function->isConstructor() &&
				_function->visibility() == Visibility::Getter)
				getters.push_back(_function);
		}
	}
	return getters;
}

void TVMABI::printData(const Json::Value &json, std::ostream* out) {
	for (unsigned f = 0; f < json.size(); ++f) {
		const auto &element = json[f];
		*out << "\t\t";

		Json::StreamWriterBuilder builder;
		builder["indentation"] = "";
		std::unique_ptr<Json::StreamWriter> writer(builder.newStreamWriter());
		writer->write(element, out);

		if (f + 1 != json.size())
			*out << ",";
		*out << std::endl;
	}
}

void TVMABI::print(const Json::Value &json, ostream *out) {
	for (unsigned f = 0; f < json.size(); ++f) {
		const auto& function = json[f];
		*out << "\t\t{\n";

		*out << "\t\t\t" << R"("name": )" << function["name"] << ",\n";

		if (function.isMember("id")) {
			*out << "\t\t\t" << R"("id": )" << function["id"] << ",\n";
		}

		*out << "\t\t\t" << R"("inputs": [)" << "\n";
		for (unsigned i = 0; i < function["inputs"].size(); ++i) {
			const auto& input = function["inputs"][i];
			Json::StreamWriterBuilder builder;
			builder["indentation"] = "";
			std::unique_ptr<Json::StreamWriter> writer(builder.newStreamWriter());
			*out << "\t\t\t\t";
			writer->write(input, out);
			if (i + 1 == function["inputs"].size()) {
				*out << "\n";
			} else {
				*out << ",\n";
			}
		}
		*out << "\t\t\t" << "]" << ",\n";

		*out << "\t\t\t" << R"("outputs": [)" << "\n";
		for (unsigned o = 0; o < function["outputs"].size(); ++o) {
			const auto& output = function["outputs"][o];
			Json::StreamWriterBuilder builder;
			builder["indentation"] = "";
			std::unique_ptr<Json::StreamWriter> writer(builder.newStreamWriter());
			*out << "\t\t\t\t";
			writer->write(output, out);
			if (o + 1 == function["outputs"].size()) {
				*out << "\n";
			} else {
				*out << ",\n";
			}
		}
		*out << "\t\t\t" << "]" << "\n";

		if (f + 1 == json.size())
			*out << "\t\t}\n";
		else
			*out << "\t\t},\n";
	}
}

Json::Value TVMABI::toJson(
	const string &fname,
	const std::vector<VariableDeclaration const*> &params,
	const std::vector<VariableDeclaration const*> &retParams,
	FunctionDefinition const* funcDef
) {
	Json::Value function;
	Json::Value inputs = encodeParams(params);
	if (funcDef != nullptr && funcDef->isResponsible()) {
		Json::Value json(Json::objectValue);
		json["name"] = "answerId";
		json["type"] = "uint32";
		inputs.insert(0, json);
	}
	Json::Value outputs = encodeParams(retParams);
	function["name"] = fname;
	if (funcDef && funcDef->functionID().has_value()) {
		std::ostringstream oss;
		oss << "0x" << std::hex << std::uppercase << funcDef->functionID().value();
		function["id"] = oss.str();
	}
	function["inputs"] = inputs;
	function["outputs"] = outputs;
	return function;
}

Json::Value TVMABI::encodeParams(const std::vector<VariableDeclaration const*> &params) {
	Json::Value result(Json::arrayValue);
	size_t idx = 0;
	for (const auto& variable: params) {
		string name = variable->name();
		if (name.empty()) name = "value" + toString(idx);
		Json::Value json = setupNameTypeComponents(name, getType(variable));
		result.append(json);
		idx++;
	}
	return result;
}

Json::Value TVMABI::setupNameTypeComponents(const string &name, const Type *type) {
	Json::Value json(Json::objectValue);
	json["name"] = name;
	std::string typeName;
	std::optional<Json::Value> components;

	TypeChecker typeChecker{*GlobalParams::g_errorReporter};
	SourceLocation tmpLoc;
	std::set<StructDefinition const*> tmpSet;
	if (
		to<StructType>(type) == nullptr &&
		typeChecker.isBadAbiType(tmpLoc, type, tmpLoc, tmpSet, false))
	{
		switch (type->category()) {
			case Type::Category::Mapping:
				typeName = "optional(cell)";
				break;
			case Type::Category::Function:
				typeName = "uint32";
				break;
			case Type::Category::FixedPoint: {
				TypeInfo ti{type};
				typeName = (ti.isSigned ? "int" : "uint") + toString(ti.numBits);
				break;
			}
			case Type::Category::Array: {
				typeName = "tuple";
				Json::Value comp(Json::arrayValue);
				{
					Json::Value obj(Json::objectValue);
					obj["name"] = name + "_length";
					obj["type"] = "uint32";
					comp.append(obj);
				}
				{
					Json::Value obj(Json::objectValue);
					obj["name"] = name + "_dict";
					obj["type"] = "optional(cell)";
					comp.append(obj);
				}
				components = comp;
				break;
			}
			default:
				solUnimplemented("TODO: support for " + type->toString());
		}
	} else {
		const Type::Category category = type->category();
		TypeInfo ti(type);
		if (category == Type::Category::Address || category == Type::Category::Contract)
			typeName = "address";
		else if (category == Type::Category::AddressStd)
			typeName = "address_std";
		else if (category == Type::Category::VarInteger) {
			auto varint = to<VarIntegerType>(type);
			typeName = varint->toString(false);
		} else if (auto* fixedBytesType = to<FixedBytesType>(type))
			typeName = "fixedbytes" + toString(fixedBytesType->numBytes());
		else if (ti.isNumeric) {
			if (to<BoolType>(type)) {
				typeName = "bool";
			} else if (ti.isSigned) {
				typeName = "int" + toString(ti.numBits);
			} else {
				typeName = "uint" + toString(ti.numBits);
			}
		} else if (auto arrayType = to<ArrayType>(type)) {
			Type const *arrayBaseType = arrayType->baseType();
			if (arrayType->isByteArrayOrString()) {
				if (arrayType->isString()) {
					typeName = "string";
				} else {
					typeName = "bytes";
				}
			} else {
				Json::Value obj = setupNameTypeComponents("arrayBaseType", arrayBaseType);
				typeName = obj["type"].asString() + "[]";
				if (obj.isMember("components")) {
					components = obj["components"];
				}
			}
		} else if (auto st = to<StructType>(type)) {
			typeName = "tuple";
			components = setupStructComponents(st);
		} else if (category == Type::Category::TvmCell) {
			typeName = "cell";
		} else if (category == Type::Category::Mapping) {
			auto mapping = to<MappingType>(type);
			std::string key;
			std::string value;
			{
				Json::Value obj = setupNameTypeComponents("keyType", mapping->keyType());
				key = obj["type"].asString();
				solAssert(!obj.isMember("components"), "");
			}
			{
				Json::Value obj = setupNameTypeComponents("valueType", mapping->valueType());
				value = obj["type"].asString();
				if (obj.isMember("components")) {
					components = obj["components"];
				}
			}
			typeName = "map(" + key + "," + value + ")";
		} else if (auto opt = to<OptionalType>(type)) {
			if (auto tt = to<TupleType>(opt->valueType())) {
				typeName = "optional(tuple)";
				components = setupTupleComponents(tt);
			} else {
				Json::Value obj = setupNameTypeComponents("valueType", opt->valueType());
				typeName = "optional(" + obj["type"].asString() + ")";
				if (obj.isMember("components")) {
					components = obj["components"];
				}
			}
		} else if (auto userDefType = to<UserDefinedValueType>(type)) {
			Json::Value obj = setupNameTypeComponents("", &userDefType->underlyingType());
			typeName = obj["type"].asString();
		} else {
			solUnimplemented("");
		}
	}

	solAssert(!typeName.empty(), "");
	json["type"] = typeName;
	if (components.has_value()) {
		json["components"] = components.value();
	}

	return json;
}

Json::Value TVMABI::setupStructComponents(const StructType *type) {
	Json::Value components(Json::arrayValue);
	const StructDefinition& structDefinition = type->structDefinition();
	const auto& members = structDefinition.members();
	for (const auto & member : members) {
		components.append(setupNameTypeComponents(member->name(), getType(member.get())));
	}
	return components;
}

Json::Value TVMABI::setupTupleComponents(const TupleType* type) {
	Json::Value components(Json::arrayValue);
	int i = 0;
	for (Type const* c : type->components()) {
		std::string name = "value" + toString(i++);
		components.append(setupNameTypeComponents(name, c));
	}
	return components;
}

void AbiPosition::unroll(std::vector<Type const*>& types, Type const* type) {
	if (type->category() == Type::Category::Struct) {
		auto members = to<StructType>(type)->structDefinition().members();
		for (const auto &m : members) {
			unroll(types, m->type());
		}
	} else if (type->category() == Type::Category::UserDefinedValueType) {
		auto userDefType = to<UserDefinedValueType>(type);
		unroll(types, &userDefType->underlyingType());
	} else {
		types.emplace_back(type);
	}
}

AbiV2Position::AbiV2Position(int _bitOffset, int _refOffset, const std::vector<Type const *>& _types) {
	for (const auto & type : _types) {
		unroll(m_types, type);
	}

	int bits = _bitOffset;
	int refs = _refOffset;
	int n = m_types.size();
	m_doLoadNextCell = std::vector<bool>(n);
	std::vector<int> sufBits(n + 1);
	std::vector<int> sufRefs(n + 1);
	for (int i = n - 1; 0 <= i; --i) {
		ABITypeSize size{m_types.at(i)};
		sufBits[i] = sufBits[i + 1] + size.maxBits;
		sufRefs[i] = sufRefs[i + 1] + size.maxRefs;
	}
	m_countOfCreatedBuilders = 0;
	for (int i = 0; i < n; ++i) {
		ABITypeSize size{m_types.at(i)};
		if (bits + sufBits[i] <= TvmConst::CellBitLength && refs + sufRefs[i] <= 4) {
			m_doLoadNextCell[i] = false;
			bits += size.maxBits;
			refs += size.maxRefs;
			solAssert(bits <= TvmConst::CellBitLength && refs <= 4, "");
		} else {
			bits += size.maxBits;
			refs += size.maxRefs;
			if (bits > TvmConst::CellBitLength || refs >= 4) {
				m_doLoadNextCell[i] = true;
				bits = size.maxBits;
				refs = size.maxRefs;
				++m_countOfCreatedBuilders;
			}
			solAssert(bits <= TvmConst::CellBitLength && refs <= 3, "");
		}
	}
}

bool AbiV2Position::skipType(Type const *type) {
	int i = m_curTypeIndex;
	++m_curTypeIndex;
	solAssert(type->toString() == m_types.at(i)->toString(), "");
	return m_doLoadNextCell.at(i);
}

int AbiV2Position::countOfCreatedBuilders() const {
	return m_countOfCreatedBuilders;
}

void AbiV2Position::skipTypes(std::vector<Type const *> const & _types) {
	for (auto const& type : _types) {
		std::vector<Type const*> curTypes;
		unroll(curTypes, type);
		for (const auto & curType : curTypes) {
			skipType(curType);
		}
	}
}

ChainDataDecoder::ChainDataDecoder(StackPusher *pusher) :
		pusher{pusher} {

}

int ChainDataDecoder::offsetExternalFunction(bool isResponsible) const {
	// external inbound message
	int maxUsed = TvmConst::Abi::MaxOptionalSignLength +
				  (pusher->ctx().getContract()->externalMsgHeaders()->hasPubkey()? 1 + 256 : 0) +
				  (pusher->ctx().getContract()->externalMsgHeaders()->hasTime()? 64 : 0) +
				  (pusher->ctx().getContract()->externalMsgHeaders()->hasExpire()? 32 : 0) +
				  32 + // functionID
				  (isResponsible ? 32 : 0); // callback function
	return maxUsed;
}

int ChainDataDecoder::offsetInternalFunction(bool isResponsible) {
	return 32 + (isResponsible ? 32 : 0);
}

void ChainDataDecoder::decodePublicFunctionParameters(
	const std::vector<Type const*>& types,
	bool isResponsible,
	bool isInternal
) const {
	if (isInternal) {
		AbiV2Position position{offsetInternalFunction(isResponsible), 0, types};
		decodeParameters(types, position);
	} else {
		AbiV2Position position{offsetExternalFunction(isResponsible), 0, types};
		decodeParameters(types, position);
	}
	*pusher << "ENDS";
}

ChainDataDecoder::DecodeType ChainDataDecoder::getDecodeType(FunctionDefinition const* function) {
	if (function->isExternalMsg() && function->isInternalMsg())
		return DecodeType::BOTH;
	if (function->isExternalMsg())
		return DecodeType::ONLY_EXT_MSG;
	return DecodeType::ONLY_INT_MSG;
}

void ChainDataDecoder::decodeFunctionParameters(const std::vector<Type const*>& types, bool isResponsible, DecodeType decodeType) const {
	switch (decodeType) {
	case DecodeType::ONLY_EXT_MSG:
		decodePublicFunctionParameters(types, isResponsible, false);
		break;
	case DecodeType::ONLY_INT_MSG:
		decodePublicFunctionParameters(types, isResponsible, true);
		break;
	case DecodeType::BOTH:
		pusher->startOpaque();
		pusher->pushS(1);
		pusher->fixStack(-1); // fix stack

		pusher->startContinuation();
		decodePublicFunctionParameters(types, isResponsible, false);
		pusher->endContinuation();

		pusher->startContinuation();
		decodePublicFunctionParameters(types, isResponsible, true);
		pusher->endContinuation();

		pusher->ifElse();
		pusher->endOpaque(1, types.size());
		break;
	}
}

void ChainDataDecoder::decodeData(int offset, int usedRefs, const std::vector<Type const*>& types, bool withENDS) const {
	AbiV2Position position{offset, usedRefs, types};
	decodeParameters(types, position);
	if (!withENDS)
		*pusher << "ENDS";
}

void ChainDataDecoder::decodeParameters(
	const std::vector<Type const*>& types,
	AbiPosition& position
) const {
	// slice is on stack
	solAssert(pusher->stackSize() >= 1, "");

	for (const auto & type : types) {
		auto savedStackSize = pusher->stackSize();
		decodeParameter(type, &position);
		pusher->ensureSize(savedStackSize + 1, "decodeParameter-2");
	}

	if (!pusher->hasLock())
		solAssert(static_cast<int>(types.size()) <= pusher->stackSize(), "");
}

void ChainDataDecoder::decodeParametersQ(
	const std::vector<Type const*>& types,
	AbiPosition& position
) const {
	pusher->startContinuation();
	pusher->startOpaque();
	int ind = 0;
	for (const auto & type : types) {
		decodeParameterQ(type, &position, ind);
		++ind;
	}
	{
		int n = types.size();
		pusher->blockSwap(n, 1);
		if (n == 1) {
			if (optValueAsTuple(types.at(0))) {
				pusher->makeTuple(1);
			}
		} else {
			pusher->makeTuple(n);
		}
		pusher->blockSwap(1, 1);
	}
	pusher->endOpaque(1, 2);
	pusher->pushContAndCallX(1, 2, false);
}

void ChainDataDecoder::loadNextSlice() const{
	*pusher << "LDREF";
	*pusher << "ENDS"; // only ENDS
	*pusher << "CTOS";
}

void ChainDataDecoder::decodeParameter(Type const* type, AbiPosition* position,
	bool isFirstCall, bool loadForFirstCallIfNeeded
) const {
	const Type::Category category = type->category();
	if (auto structType = to<StructType>(type)) {
		ast_vec<VariableDeclaration> const& members = structType->structDefinition().members();
		for (const ASTPointer<VariableDeclaration> &m : members) {
			decodeParameter(m->type(), position, isFirstCall, loadForFirstCallIfNeeded);
			isFirstCall = false;
		}
		// members... slice
		const int memberQty = members.size();
		pusher->blockSwap(memberQty, 1); // slice members...
		pusher->makeTuple(memberQty); // slice struct
		pusher->exchange(1); // ... struct slice
	} else if (isIntegralType(type)) {
		TypeInfo ti{type};
		solAssert(ti.isNumeric, "");
		bool doLoadNextCell = position->skipType(type);
		if (doLoadNextCell && ((isFirstCall && loadForFirstCallIfNeeded) || !isFirstCall))
			loadNextSlice();
		pusher->load(type, false);
		if (auto enumType = to<EnumType>(type)) {
			pusher->pushS(1);
			pusher->pushInt(enumType->enumDefinition().members().size());
			*pusher << "GEQ";
			pusher->_throw("THROWIF " + toString(TvmConst::RuntimeException::WrongValueOfEnum));
		}
	} else if (
		to<TvmCellType>(type) ||
		to<ArrayType>(type) ||
		to<MappingType>(type) ||
		to<OptionalType>(type) ||
		to<FunctionType>(type) ||
		to<VarIntegerType>(type) ||
		category == Type::Category::Address ||
		category == Type::Category::Contract ||
		category == Type::Category::AddressStd
	) {
		bool doLoadNextCell = position->skipType(type);
		if (doLoadNextCell && ((isFirstCall && loadForFirstCallIfNeeded) || !isFirstCall))
			loadNextSlice();
		pusher->load(type, false);
	} else if (auto userDefType = to<UserDefinedValueType>(type)) {
		decodeParameter(&userDefType->underlyingType(), position, isFirstCall, loadForFirstCallIfNeeded);
	} else {
		solUnimplemented("Unsupported parameter type for decoding: " + type->toString());
	}
}

void ChainDataDecoder::decodeParameterQ(Type const* type, AbiPosition* position, int ind) const {
	const Type::Category category = type->category();
	if (/*auto structType =*/ to<StructType>(type)) {
		solUnimplemented("TODO");
	} else if (
		isIntegralType(type) ||
		to<TvmCellType>(type) ||
		to<ArrayType>(type) ||
		to<MappingType>(type) ||
		(category == Type::Category::Address || category == Type::Category::AddressStd || category == Type::Category::Contract)
	) {
		bool doLoadNextCell = position->skipType(type);
		if (doLoadNextCell)
			loadNextSlice();
		pusher->loadQ(type);
	} else {
		solUnimplemented("Unsupported parameter type for decoding: " + type->toString());
	}

	pusher->startContinuation();
	if (ind > 0) {
		pusher->dropUnder(ind, 1);
	}
	pusher->pushNull();
	pusher->blockSwap(1, 1);
	pusher->endContinuation();

	pusher->ifNotJmp();

	if (auto enumType = to<EnumType>(type)) {
		// val slice -1
		pusher->pushS(1);
		pusher->pushInt(enumType->enumDefinition().members().size());
		*pusher << "GEQ";
		pusher->_throw("THROWIF " + toString(TvmConst::RuntimeException::WrongValueOfEnum));
	}
}

void ChainDataEncoder::createDefaultConstructorMsgBodyAndAppendToBuilder(const int bitSizeBuilder) const {
	uint32_t funcID = calculateConstructorFunctionID();
	std::stringstream ss;
	ss << "x" << std::hex << std::setfill('0') << std::setw(8) << funcID;

	if (bitSizeBuilder < (1023 - 32 - 1)) {
		pusher->stzeroes(1);
		*pusher << "STSLICECONST " + ss.str();
	} else {
		pusher->stones(1);
		*pusher << "NEWC";
		*pusher << "STSLICECONST " + ss.str();
		*pusher << "STBREFR";
	}
}

void ChainDataEncoder::createDefaultConstructorMessage2() const {
	uint32_t funcID = calculateConstructorFunctionID();
	std::stringstream ss;
	ss << "x" << std::hex << std::setfill('0') << std::setw(8) << funcID;
	*pusher << "STSLICECONST " + ss.str();
}

uint32_t ChainDataEncoder::calculateConstructorFunctionID() {
	std::vector<VariableDeclaration const*> vect;
	return calculateFunctionID("constructor", {}, &vect) & 0x7FFFFFFFu;
}

std::pair<uint32_t, bool> ChainDataEncoder::calculateFunctionID(const CallableDeclaration *declaration) {
	auto functionDefinition = to<FunctionDefinition>(declaration);
	if (functionDefinition != nullptr && functionDefinition->functionID().has_value()) {
		return {functionDefinition->functionID().value(), true};
	}

	std::string name;
	if (functionDefinition != nullptr && functionDefinition->isConstructor())
		name = "constructor";
	else
		name = declaration->name();

	std::vector<VariableDeclaration const*> tmpRet;
	std::vector<VariableDeclaration const*>* ret = nullptr;
	if (declaration->returnParameterList()) {
		tmpRet = convertArray(declaration->returnParameters());
		ret = &tmpRet;
	}

	std::vector<Type const*> inputTypes = getTypesFromVarDecls(declaration->parameters());
	if (functionDefinition->isResponsible()) {
		inputTypes.insert(inputTypes.begin(), TypeProvider::uint(32));
	}
	uint32_t id = calculateFunctionID(
			name,
			inputTypes,
			ret
	);
	return {id, false};
}

uint32_t ChainDataEncoder::toHash256(std::string const& str) {
	bytes hash = picosha2::hash256(bytes(str.begin(), str.end()));
	uint32_t funcID = 0;
	for (size_t i = 0; i < 4; i++) {
		funcID <<= 8u;
		funcID += hash[i];
	}
	return funcID;
}

uint32_t ChainDataEncoder::calculateFunctionID(
		const std::string& name,
		const std::vector<Type const*>& inputs,
		const std::vector<VariableDeclaration const*> * outputs
) {
	std::stringstream ss;
	ss << name << "(";
	bool comma = false;
	for (const auto& type : inputs) {
		std::string typestr = toStringForCalcFuncID(type);
		solAssert(!typestr.empty(), "Wrong type in remote function params.");
		if (comma)
			ss << ",";
		ss << typestr;
		comma = true;
	}
	ss << ")";
	comma = false;
	if (outputs) {
		ss << "(";
		for (const auto& output : *outputs) {
			std::string typestr = toStringForCalcFuncID(output->type());
			solAssert(!typestr.empty(), "Wrong type in remote function params.");
			if (comma)
				ss << ",";
			ss << typestr;
			comma = true;
		}
		ss << ")";
	}
	ss << "v2";

	return toHash256(ss.str());
}

uint32_t ChainDataEncoder::calculateFunctionIDWithReason(
		const CallableDeclaration *funcDef,
		const ReasonOfOutboundMessage &reason,
		bool isLib
) {
	std::vector<VariableDeclaration const*> outputs;
	std::vector<VariableDeclaration const*>* retParams = nullptr;
	if (funcDef->returnParameterList()) {
		outputs = convertArray(funcDef->returnParameters());
		retParams = &outputs;
	}
	std::optional<uint32_t> functionId;
	std::string name = funcDef->name();
	if (auto f = to<FunctionDefinition>(funcDef)) {
		functionId = f->functionID();
		if (f->isConstructor()) {
			name = "constructor";
		}
	}

	bool isResponsible{};
	if (auto fd = to<FunctionDefinition>(funcDef)) {
		isResponsible = fd->isResponsible();
	}

	std::vector<Type const*> input = getTypesFromVarDecls(funcDef->parameters());
	if (isLib) {
		input.erase(input.begin(), input.begin() + 1);
	}

	return calculateFunctionIDWithReason(name, input, retParams, reason, functionId, isResponsible);
}

uint32_t ChainDataEncoder::calculateFunctionIDWithReason(
		const std::string& name,
		std::vector<Type const*> inputs,
		const std::vector<VariableDeclaration const*> *outputs,
		const ReasonOfOutboundMessage &reason,
		std::optional<uint32_t> functionId,
		const bool isResponsible
) {
	if (isResponsible) {
		inputs.insert(inputs.begin(), TypeProvider::uint(32));
	}
	bool isManuallyOverridden = functionId.has_value();
	uint32_t funcID{};
	if (isManuallyOverridden) {
		funcID = functionId.value();
	} else {
		funcID = calculateFunctionID(name, inputs, outputs);
		switch (reason) {
			case ReasonOfOutboundMessage::FunctionReturnExternal:
				funcID |= 0x80000000;
				break;
			case ReasonOfOutboundMessage::EmitEventExternal:
			case ReasonOfOutboundMessage::RemoteCallInternal:
				funcID &= 0x7FFFFFFFu;
				break;
		}
	}
	return funcID;
}

// reversedArgs==False ? arg[0], arg[1], ..., arg[n-1], msgBuilder
// reversedArgs==True  ? arg[n-1], ..., arg[1], arg[0], msgBuilder
// Target: create and append to msgBuilder the message body
void ChainDataEncoder::createMsgBodyAndAppendToBuilder(
		const std::vector<VariableDeclaration const*> &params,
		const std::variant<uint32_t, std::function<void()>>& functionId,
		const std::optional<uint32_t>& callbackFunctionId,
		const int bitSizeBuilder,
		const bool reversedArgs
) const {

	const int saveStackSize = pusher->stackSize();

	std::vector<Type const*> types = getParams(params).first;
	const int callbackLength = callbackFunctionId.has_value() ? 32 : 0;
	std::unique_ptr<AbiV2Position> position = std::make_unique<AbiV2Position>(bitSizeBuilder + 32 + callbackLength, 0, types);
	const bool doAppend = position->countOfCreatedBuilders() == 0;
	doAppend ? pusher->stzeroes(1) : pusher->stones(1);
	if (params.size() >= 2 && !reversedArgs) {
		pusher->reverse(params.size(), 1);
	}
	if (!doAppend) {
		position = std::make_unique<AbiV2Position>(32 + callbackLength, 0, types);
		pusher->blockSwap(params.size(), 1); // msgBuilder, arg[n-1], ..., arg[1], arg[0]
		*pusher << "NEWC"; // msgBuilder, arg[n-1], ..., arg[1], arg[0], builder
	}

	// arg[n-1], ..., arg[1], arg[0], msgBuilder
	createMsgBody(params, functionId, callbackFunctionId, *position);

	if (!doAppend) {
		// msgBuilder, builder
		*pusher << "STBREFR";
	}

	if (!pusher->hasLock())
	solAssert(saveStackSize == static_cast<int>(pusher->stackSize() + params.size()), "");

}

// arg[n-1], ..., arg[1], arg[0], msgBuilder
void ChainDataEncoder::createMsgBody(
	const std::vector<VariableDeclaration const*> &params,
	const std::variant<uint32_t, std::function<void()>>& functionId,
	const std::optional<uint32_t>& callbackFunctionId,
	AbiV2Position &position
) const {
	auto [types, nodes] = getParams(params);

	if (functionId.index() == 0) {
		std::stringstream ss;
		ss << "x" << std::hex << std::setfill('0') << std::setw(8) << std::get<0>(functionId);
		*pusher << "STSLICECONST " + ss.str();
	} else {
		std::get<1>(functionId)();
		*pusher << "STUR 32";
	}

	if (callbackFunctionId.has_value()) {
		std::stringstream ss;
		ss << "x" << std::hex << std::setfill('0') << std::setw(8) << callbackFunctionId.value();
		*pusher << "STSLICECONST " + ss.str();
	}

	encodeParameters(types, position, false);
}

// arg[n-1], ..., arg[1], arg[0], builder
// Target: create and append to `builder` the args
void ChainDataEncoder::encodeParameters(
	const std::vector<Type const *> & _types,
	AbiV2Position &position,
	bool hasUnpackedStateVars
) const {
	// builder must be located on the top of stack
	int builderQty = 1;
	std::vector<Type const *> typesOnStack{_types.rbegin(), _types.rend()};
	while (!typesOnStack.empty()) {
		const int argQty = typesOnStack.size() + (hasUnpackedStateVars ? 1 : 0);
		Type const* type = typesOnStack.back();
		typesOnStack.pop_back();
		if (auto structType = to<StructType>(type)) {
			std::vector<ASTPointer<VariableDeclaration>> const& members = structType->structDefinition().members();
			// struct builder
			pusher->exchange(1); // builder struct
			pusher->untuple(members.size()); // builder, m0, m1, ..., m[len(n)-1]
			pusher->reverse(members.size() + 1, 0); // m[len(n)-1], ..., m1, m0, builder
			for (const ASTPointer<VariableDeclaration>& m : members | boost::adaptors::reversed) {
				typesOnStack.push_back(m->type());
			}
		} else if (auto userDefType = to<UserDefinedValueType>(type)) {
			typesOnStack.push_back(&userDefType->underlyingType());
		} else {
			bool doLoadNextCell = position.skipType(type);
			if (doLoadNextCell) {
				// arg[n-1], ..., arg[1], arg[0], builder
				pusher->blockSwap(argQty, 1);
				*pusher << "NEWC";
				++builderQty;
			}
			pusher->store(type);
		}
	}

	if (hasUnpackedStateVars)
		*pusher << "STSLICE";

	for (int i = 0; i + 1 < builderQty; ++i)
		*pusher << "STBREFR";
}

std::string ChainDataEncoder::toStringForCalcFuncID(Type const * type) {
	if (auto optType = to<OptionalType>(type)) {
		return "optional(" + toStringForCalcFuncID(optType->valueType()) + ")";
	} else if (auto tupleType = to<TupleType>(type)) {
		std::string ret = "(";
		for (size_t i = 0; i < tupleType->components().size(); i++) {
			if (i != 0) ret += ",";
			ret += toStringForCalcFuncID(tupleType->components().at(i));
		}
		ret += ")";
		return ret;
	} else if (auto structType = to<StructType>(type)) {
		std::string ret = "(";
		for (size_t i = 0; i < structType->structDefinition().members().size(); i++) {
			if (i != 0) ret += ",";
			ret += toStringForCalcFuncID(structType->structDefinition().members()[i]->type());
		}
		ret += ")";
		return ret;
	} else if (auto arrayType = to<ArrayType>(type)) {
		if (!arrayType->isByteArrayOrString())
			return toStringForCalcFuncID(arrayType->baseType()) + "[]";
	} else if (auto mapping = to<MappingType>(type)) {
		return "map(" + toStringForCalcFuncID(mapping->keyType()) + "," +
			   toStringForCalcFuncID(mapping->valueType()) + ")";
	}

	Json::Value obj = TVMABI::setupNameTypeComponents("some", type);
	solAssert(!obj.isMember("components"), "");
	std::string typeName = obj["type"].asString();
	return typeName;
}

UnpackedCoderDecoder::UnpackedCoderDecoder(
	StackPusher& pusher,
	int _offset,
	int _usedRefs,
	int _varOffset,
	std::vector<Type const*> const& _varTypes,
	std::vector<bool> const& _varNeeded
) :
	pusher{pusher},
	offset{_offset},
	usedRefs{_usedRefs},
	varOffset{_varOffset},
	varTypes{_varTypes},
	varNeeded{_varNeeded}
{
	std::unique_ptr<AbiV2Position> position = createPosition();

	neededVars = 0;
	types.reserve(position->size());
	varIndex = std::vector<int>(position->size(), -1);
	to = std::vector<int>(position->size(), -1);
	isNeededType = std::vector<bool> (position->size(), false);
	startIndexType = -1;
	lastIndexType = -1;
	for (int i = 0; i < static_cast<int>(varTypes.size()); ++i) {
		int startSize = types.size();
		if (i == varOffset) {
			startIndexType = startSize;
		}
		AbiPosition::unroll(types, varTypes.at(i));
		if (varNeeded.at(i)) {
			++neededVars;
			for (int j = startSize; j < static_cast<int>(types.size()); ++j) {
				lastIndexType = j;
				isNeededType[j] = true;
				varIndex[j] = i;
			}
		}
	}

	for (int i = lastIndexType; i >= 0; --i) {
		if (i == lastIndexType ||
			position->getDoLoadNextCell(i + 1) ||
			isNeededType[i] != isNeededType.at(i + 1)
		) {
			to[i] = i + 1;
		} else {
			// The next type is not in the new cell
			to[i] = to[i + 1];
		}

	}
}

std::unique_ptr<AbiV2Position> UnpackedCoderDecoder::createPosition() const {
	auto position = std::make_unique<AbiV2Position>(offset, usedRefs, varTypes);
	position->skipTypes(std::vector<Type const *>{varTypes.begin(), varTypes.begin() + varOffset});
	return position;
}

void UnpackedCoderDecoder::unpackedData() {
	// slice is on stack
	const int startStackSize = pusher.stackSize();
	solAssert(startStackSize >= 1, "");

	std::unique_ptr<AbiV2Position> position = createPosition();

	if (position->getDoLoadNextCell(startIndexType)) {
		pusher << "LDREFRTOS";
		pusher.dropUnder(1, 1);
	}
	for (int i = startIndexType; i <= lastIndexType; ) {
		if (int varInd = varIndex.at(i);
			varInd != -1 && varNeeded.at(varInd)
		) {
			int nextI = i + 1;
			while (nextI <= lastIndexType && varIndex.at(nextI) == varInd) {
				++nextI;
			}

			ChainDataDecoder decoder{&pusher};
			decoder.decodeParameter(varTypes.at(varInd), position.get(), true, false);

			if (nextI <= lastIndexType && position->getDoLoadNextCell(nextI)) {
				pusher << "LDREFRTOS";
				pusher.dropUnder(1, 1);
			}

			i = nextI;
		} else {
			skipTypesAndLoadCellIfNeeded(i, position);
			i = to.at(i);
		}
	}
	pusher.drop();

	pusher.getStack().ensureSize(startStackSize - 1 + neededVars);
}

void UnpackedCoderDecoder::packData(std::map<int, std::function<void()>> const& varIndexToPush) {
	// unpack data
	const int startStackSize = pusher.stackSize();
	std::unique_ptr<AbiV2Position> position = createPosition();
	std::vector<Type const*> typesOnStack;

	if (position->getDoLoadNextCell(startIndexType)) {
		pusher << "LDREFRTOS";
		pusher.dropUnder(1, 1);
	}
	for (int i = startIndexType; i <= lastIndexType; ) {
		if (const int varInd = varIndex.at(i);
			varInd != -1 && varNeeded.at(varInd)
		) {
			int nextI = i + 1;
			while (nextI <= lastIndexType && isNeededType.at(nextI))
				++nextI;

			if (i + 1 == nextI && (nextI > lastIndexType || !position->getDoLoadNextCell(nextI))) {
				pusher.load(types.at(i), false);
				int curVarInd = varIndex.at(i);
				varIndexToPush.at(curVarInd)();
				pusher.popS(2);
				typesOnStack.emplace_back(varTypes.at(curVarInd));
			} else {
				for (int j = i; j < nextI; ) {
					int toJ = to.at(j);
					skipTypesAndLoadCellIfNeeded(j, position);
					j = toJ;
				}

				int varQty = 0;
				for (int j = i; j < nextI; ++j) {
					if (j == i || varIndex.at(j - 1) != varIndex.at(j)) {
						int curVarInd = varIndex.at(j);
						varIndexToPush.at(curVarInd)();
						typesOnStack.emplace_back(varTypes.at(curVarInd));
						++varQty;
					}
				}
				pusher.blockSwap(1, varQty);
			}
			i = nextI;
		} else {
			int nextI = to.at(i);
			if (position->getDoLoadNextCell(nextI)) {
				auto refs = getFixedRef(i, nextI);
				if (refs.has_value() && refs.value() == 0) {
					pusher << "LDREFRTOS";
				} else {
					pusher.pushS(0);
					pusher << "SBITREFS";
					pusher << "DEC";
					pusher << "SPLIT";
					pusher << "LDREFRTOS";
					pusher.dropUnder(1, 1);
				}
				typesOnStack.emplace_back(TypeProvider::tvmslice());
				for (int j = i; j < nextI; ++j)
					position->skipTypes({types.at(j)});
			} else {
				for (int j = i; j < nextI; ) {
					ABITypeSize typeSize{types.at(j)};
					if (typeSize.fixedSize) {
						int k = j;
						while (k < nextI && ABITypeSize{types.at(k)}.fixedSize) {
							position->skipTypes({types.at(k)});
							++k;
						}
						const auto size = isFixedSize(j, k);
						pusher.pushInt(size->bits);
						pusher.pushInt(size->refs);
						pusher << "SPLIT";
						typesOnStack.emplace_back(TypeProvider::tvmslice());
						j = k;
					} else {
						position->skipTypes({types.at(j)});
						pusher.load(types[j], false);
						typesOnStack.emplace_back(types.at(j));
						++j;
					}
				}
			}
			i = nextI;
		}
	}

	{
		int stackDelta = pusher.stackSize() - startStackSize;
		pusher.reverse(stackDelta + 1, 0);
		std::reverse(typesOnStack.begin(), typesOnStack.end());
	}

	auto popTopType = [&](Type const* type) {
		solAssert(!typesOnStack.empty());
		solAssert(*type == *typesOnStack.back());
		typesOnStack.pop_back();
	};

	// pack data
	pusher << "NEWC";
	int builderQty = 1;

	for (int i = startIndexType; i <= lastIndexType; ) {
		int varInd = varIndex.at(i);

		if (varInd != -1 && varNeeded.at(varInd)) {
			int nextI = i + 1;
			while (nextI <= lastIndexType && varIndex.at(nextI) == varInd)
				++nextI;

			for (int j = i; j < nextI; ++j) {
				if (position->getDoLoadNextCell(j)) {
					// b0 b1 b2 ... data... builder
					int stackDelta = pusher.stackSize() - startStackSize - builderQty + 1;
					pusher.blockSwap(stackDelta, 1);
					pusher << "NEWC";
					++builderQty;
				}

				if (*types.at(j) != *typesOnStack.back()) {
					auto currentType = typesOnStack.back();
					typesOnStack.pop_back();

					auto structType = ::to<StructType>(currentType);
					solAssert(structType);
					std::vector<ASTPointer<VariableDeclaration>> const& members = structType->structDefinition().members();

					// struct builder
					pusher.exchange(1); // builder struct
					pusher.untuple(members.size()); // builder, m0, m1, ..., m[len(n)-1]
					pusher.reverse(members.size() + 1, 0); // m[len(n)-1], ..., m1, m0, builder

					for (const ASTPointer<VariableDeclaration>& m : members | boost::adaptors::reversed)
						typesOnStack.push_back(m->type());
				}

				pusher.store(types.at(j));
				popTopType(types.at(j));
			}

			i = nextI;
		} else {
			int nextI = to.at(i);

			if (position->getDoLoadNextCell(i) && position->getDoLoadNextCell(nextI)) {
				// b0 b1 b2 ... data... builder
				int stackDelta = pusher.stackSize() - startStackSize - builderQty + 1;
				pusher.blockSwap(stackDelta, 1);
				pusher << "NEWC";
				++builderQty;

				pusher << "STSLICE";
				popTopType(TypeProvider::tvmslice());
			} else if (!position->getDoLoadNextCell(i) && position->getDoLoadNextCell(nextI)) {
				pusher << "STSLICE";
				popTopType(TypeProvider::tvmslice());
			} else {
				if (position->getDoLoadNextCell(i)) {
					// b0 b1 b2 ... data... builder
					int stackDelta = pusher.stackSize() - startStackSize - builderQty + 1;
					pusher.blockSwap(stackDelta, 1);
					pusher << "NEWC";
					++builderQty;
				}

				for (int j = i; j < nextI; ) {
					ABITypeSize typeSize{types.at(j)};
					if (typeSize.fixedSize) {
						int k = j;
						while (k < nextI && ABITypeSize{types.at(k)}.fixedSize) {
							++k;
						}
						pusher << "STSLICE";
						popTopType(TypeProvider::tvmslice());
						j = k;
					} else {
						pusher.store(types[j]);
						popTopType(types.at(j));
						++j;
					}
				}
			}

			i = nextI;
		}
	}
	pusher << "STSLICE"; // store tail

	for (int i = 0; i + 1 < builderQty; ++i) {
		pusher << "STBREFR";
	}

	pusher << "ENDC";
	pusher << "CTOS";

	solAssert(startStackSize == pusher.stackSize(), "startStackSize == pusher.stackSize()");
}

std::optional<UnpackedCoderDecoder::TypeSize> UnpackedCoderDecoder::isFixedSize(int i, int j) const {
	solAssert(i < j);
	int bits = 0;
	int refs = 0;
	for (int k = i; k < j; ++k) {
		ABITypeSize typeSize{types.at(k)};
		if (!typeSize.fixedSize)
			return {};
		bits += typeSize.maxBits;
		refs += typeSize.maxRefs;
	}
	return TypeSize{bits, refs};
}

std::optional<int> UnpackedCoderDecoder::getFixedRef(int i, int j) const {
	solAssert(i < j);
	int refs = 0;
	for (int k = i; k < j; ++k) {
		ABITypeSize typeSize{types.at(k)};
		if (!typeSize.fixedRefs)
			return {};
		refs += typeSize.maxRefs;
	}
	return refs;
}

void UnpackedCoderDecoder::skipTypes(int beginIndex, int endIndex, std::unique_ptr<AbiV2Position>& position) const {
	int dropQty = 0;
	for (int i = beginIndex; i < endIndex; ) {
		ABITypeSize typeSize{types.at(i)};
		if (typeSize.fixedSize) {
			int j = i;
			while (j < endIndex && ABITypeSize{types.at(j)}.fixedSize) {
				position->skipTypes({types.at(j)});
				++j;
			}
			const auto size = isFixedSize(i, j);
			pusher.pushInt(size->bits);
			pusher.pushInt(size->refs);
			pusher << "SSKIPFIRST";
			i = j;
		} else {
			position->skipTypes({types.at(i)});
			pusher.load(types[i], false);
			++dropQty;
			++i;
		}
	}
	pusher.dropUnder(dropQty, 1);
}

void UnpackedCoderDecoder::skipTypesAndLoadCellIfNeeded(int index, std::unique_ptr<AbiV2Position>& position) const {
	const int nextIndex = to.at(index);
	if (nextIndex <= lastIndexType && position->getDoLoadNextCell(nextIndex)) {
		const auto refs = getFixedRef(index, nextIndex);
		if (refs.has_value()) {
			pusher << "PLDREFIDX " + toString(refs.value());
			pusher << "CTOS";
			for (int k = index; k < nextIndex; ++k)
				position->skipTypes({types.at(k)});
		} else if (index + 1 == nextIndex) {
			skipTypes(index, nextIndex, position);
			pusher << "PLDREFIDX 0";
			pusher << "CTOS";
		} else {
			// pusher.pushS(0);
			// pusher << "SREFS";
			// pusher << "DEC";
			// pusher << "PLDREFVAR";
			// pusher << "CTOS";

			pusher.pushInt(0);
			pusher.pushInt(1);
			pusher << "SCUTLAST";
			pusher << "LDREFRTOS";
			pusher.dropUnder(1, 1);
			for (int k = index; k < nextIndex; ++k)
				position->skipTypes({types.at(k)});
		}
	} else {
		skipTypes(index, nextIndex, position);
	}
}