if (EMSCRIPTEN)
	CreateExportedFunctionsForEMSDK(
		ExportedFunctions
		solidity_license
		solidity_version
		solidity_compile
		solidity_alloc
		solidity_free
		solidity_reset
	)
	# Specify which functions to export in soljson.js.
	# Note that additional Emscripten-generated methods needed by solc-js are
	# defined to be exported in cmake/EthCompilerSettings.cmake.
	set(CMAKE_EXE_LINKER_FLAGS "${CMAKE_EXE_LINKER_FLAGS} -s EXPORTED_FUNCTIONS='${ExportedFunctions}'")
	add_executable(soljson libsolc.cpp libsolc.h)
	target_link_libraries(soljson PRIVATE solidity)
else()
	add_library(libsolc libsolc.cpp libsolc.h)
	set_target_properties(libsolc PROPERTIES OUTPUT_NAME solc)
	target_link_libraries(libsolc PRIVATE solidity)

	install(TARGETS libsolc
			EXPORT SolidityTargets
			ARCHIVE DESTINATION lib
			LIBRARY DESTINATION lib
			RUNTIME DESTINATION bin
	)
endif()
