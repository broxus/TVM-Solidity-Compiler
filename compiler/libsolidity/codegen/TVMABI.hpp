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
/**
 * ABI generator and parser
 */

#pragma once

#include <variant>

#include <libsolidity/codegen/TVMCommons.hpp>

namespace solidity::frontend {

class StackPusher;

class TVMABI {
public:
	static Json::Value generateFunctionIdsJson(
		ContractDefinition const& contract,
		PragmaDirectiveHelper const& pragmaHelper
	);
	static Json::Value generatePrivateFunctionIdsJson(
			ContractDefinition const& contract,
			const std::vector<ASTPointer<SourceUnit>>& _sourceUnits,
			PragmaDirectiveHelper const& pragmaHelper
	);
	static void generateABI(ContractDefinition const* contract,
							std::vector<ASTPointer<SourceUnit>> const& _sourceUnits,
							std::vector<PragmaDirective const *> const& pragmaDirectives, std::ostream* out = &std::cout);
	static Json::Value generateABIJson(ContractDefinition const* contract,
							std::vector<ASTPointer<SourceUnit>> const& _sourceUnits,
							std::vector<PragmaDirective const *> const& pragmaDirectives);
private:
	static std::vector<const FunctionDefinition *> publicFunctions(ContractDefinition const& contract);
	static std::vector<const FunctionDefinition *> getters(ContractDefinition const& contract);
	static void printData(const Json::Value& json, std::ostream* out);
	static void print(const Json::Value& json, std::ostream* out);
	static Json::Value toJson(
		const std::string& fname,
		const std::vector<VariableDeclaration const*> &params,
		const std::vector<VariableDeclaration const*> &retParams,
		FunctionDefinition const* funcDef = nullptr
	);
	static Json::Value encodeParams(const std::vector<VariableDeclaration const*> &params);
public:
	static Json::Value setupNameTypeComponents(const std::string& name, const Type* type);
private:
	static Json::Value setupStructComponents(const StructType* type);
	static Json::Value setupTupleComponents(const TupleType* type);
};

class AbiPosition: boost::noncopyable {
public:
	virtual ~AbiPosition() = default;
	virtual bool skipType(Type const* type) = 0;
	static void unroll(std::vector<Type const*>& types, Type const* type);
};

class AbiV2Position: public AbiPosition {
public:
	AbiV2Position(int _bitOffset, int _refOffset, const std::vector<Type const *>& _types);
	bool skipType(Type const* type) override;
	int countOfCreatedBuilders() const;
	void skipTypes(std::vector<Type const *> const & _types);

	bool getDoLoadNextCell(int index) const { return m_doLoadNextCell.at(index); }
	Type const* getType(int index) const { return m_types.at(index); }
	int size() const { return m_doLoadNextCell.size(); }
	int currentIndex() const { return m_curTypeIndex; }

private:
	int m_curTypeIndex{};
	std::vector<Type const*> m_types;
	// Do we load next cell before decoding current type?
	std::vector<bool> m_doLoadNextCell;
	int m_countOfCreatedBuilders{};
};

class AbiPositionFromOneSlice: public AbiPosition {
public:
	bool skipType(Type const* /*type*/) override {
		return false;
	}
};

class ChainDataDecoder: boost::noncopyable {
public:
	explicit ChainDataDecoder(StackPusher *pusher);

private:
	int offsetExternalFunction(bool hasCallback) const;
	static int offsetInternalFunction(bool hasCallback);

public:
	void decodePublicFunctionParameters(const std::vector<Type const*>& types, bool isResponsible, bool isInternal) const;
	enum class DecodeType {
		ONLY_EXT_MSG,
		ONLY_INT_MSG,
		BOTH
	};
	static DecodeType getDecodeType(FunctionDefinition const*);
	void decodeFunctionParameters(const std::vector<Type const*>& types, bool isResponsible, DecodeType decodeType) const;
	void decodeData(int offset, int usedRefs, const std::vector<Type const*>& types, bool withENDS) const;
	void decodeParameters(const std::vector<Type const*>& types, AbiPosition& position) const;
	void decodeParametersQ(const std::vector<Type const*>& types, AbiPosition& position) const;

private:
	void loadNextSlice() const;
public:
	void decodeParameter(Type const* type, AbiPosition* position,
		bool isFirstCall = true,
		bool loadForFirstCallIfNeeded = true) const;
private:
	void decodeParameterQ(Type const* type, AbiPosition* position, int ind) const;

private:
	StackPusher *pusher{};
};




enum class ReasonOfOutboundMessage {
	EmitEventExternal,
	FunctionReturnExternal,
	RemoteCallInternal
};

class ChainDataEncoder: boost::noncopyable {
public:
	explicit ChainDataEncoder(StackPusher *pusher): pusher{pusher} {}
	void createDefaultConstructorMsgBodyAndAppendToBuilder(int bitSizeBuilder) const;
	void createDefaultConstructorMessage2() const;

	// returns pair (functionID, is_manually_overridden)
	static uint32_t calculateConstructorFunctionID();
	static std::pair<uint32_t, bool> calculateFunctionID(const CallableDeclaration *declaration);
	static uint32_t toHash256(std::string const& str);
	static uint32_t calculateFunctionID(
		const std::string& name,
		const std::vector<Type const*>& inputs,
		const std::vector<VariableDeclaration const*> *outputs
	);
	static uint32_t calculateFunctionIDWithReason(const CallableDeclaration *funcDef, const ReasonOfOutboundMessage &reason, bool isLib = false);
	static uint32_t calculateFunctionIDWithReason(
		const std::string& name,
		std::vector<Type const*> inputs,
		const std::vector<VariableDeclaration const*> *outputs,
		const ReasonOfOutboundMessage &reason,
		std::optional<uint32_t> functionId,
		bool isResponsible
	);

	void createMsgBodyAndAppendToBuilder(
		const std::vector<VariableDeclaration const*> &params,
		const std::variant<uint32_t, std::function<void()>>& functionId,
		const std::optional<uint32_t>& callbackFunctionId,
		int bitSizeBuilder,
		bool reversedArgs = false
	) const;

	void createMsgBody(
		const std::vector<VariableDeclaration const*> &params,
		const std::variant<uint32_t, std::function<void()>>& functionId,
		const std::optional<uint32_t>& callbackFunctionId,
		AbiV2Position &position
	) const;

	void encodeParameters(
		const std::vector<Type const*>& types,
		AbiV2Position& position,
		bool hasUnpackedStateVars
	) const;

private:
	static std::string toStringForCalcFuncID(Type const * type);

private:
	StackPusher *pusher{};
};

class UnpackedCoderDecoder: boost::noncopyable {
public:
	explicit UnpackedCoderDecoder(
		StackPusher& pusher,
		int _offset,
		int _usedRefs,
		int _varOffset,
		std::vector<Type const*> const& _varTypes,
		std::vector<bool> const& _varNeeded
	);
	void unpackedData();

	void packData(std::map<int, std::function<void()>> const& varIndexToPush);

private:
	struct TypeSize {
		int bits;
		int refs;
	};
	std::optional<TypeSize> isFixedSize(int i, int j) const;
	std::optional<int> getFixedRef(int i, int j) const;
	std::unique_ptr<AbiV2Position> createPosition() const;
	void skipTypes(int beginIndex, int endIndex, std::unique_ptr<AbiV2Position>& position) const;
	void skipTypesAndLoadCellIfNeeded(int index, std::unique_ptr<AbiV2Position>& position) const;

private:
	StackPusher& pusher;
	int const offset;
	int const usedRefs;
	int const varOffset;
	std::vector<Type const*> const& varTypes;
	std::vector<bool> const& varNeeded;

	static constexpr int INF = 1e9;
	int neededVars = 0;
	std::vector<Type const*> types;
	std::vector<int> varIndex;
	std::vector<int> to;
	std::vector<bool> isNeededType;

	int startIndexType = -1;
	int lastIndexType = -1;
};

}	// solidity::frontend
