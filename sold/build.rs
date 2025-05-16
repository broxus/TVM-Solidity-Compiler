/*
 * Copyright (C) 2019-2023 EverX. All Rights Reserved.
 *
 * Licensed under the SOFTWARE EVALUATION License (the "License"); you may not use
 * this file except in compliance with the License.
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the  GNU General Public License for more details at: https://www.gnu.org/licenses/gpl-3.0.html
 */

use std::env;
use std::fs;
use std::path::{Path, PathBuf};

fn get_absolute_path<P: AsRef<Path>>(path: P) -> Result<PathBuf, std::io::Error> {
    let path_buf = PathBuf::from(path.as_ref());
    let abs_path = fs::canonicalize(&path_buf)?;
    let path_str = abs_path.to_string_lossy();
    if cfg!(windows)
        && path_str.starts_with(r"\\?\")
        && !path.as_ref().to_string_lossy().starts_with(r"\\?\")
    {
        Ok(PathBuf::from(
            path_str.get(4..).expect("Invalid canonical path format"),
        ))
    } else {
        Ok(abs_path)
    }
}

fn find_boost_lib_name(prefix: &str, boost_lib_dir: &Path) -> Result<String, String> {
    for entry in fs::read_dir(boost_lib_dir)
        .map_err(|e| format!("Failed to read Boost lib dir {:?}: {}", boost_lib_dir, e))?
    {
        let entry = entry.map_err(|e| format!("Failed to read entry in Boost lib dir: {}", e))?;
        let file_name = entry.file_name();
        let file_name_str = file_name.to_string_lossy();

        if file_name_str.starts_with(prefix) && file_name_str.ends_with(".lib") {
            return Ok(file_name_str
                .get(..file_name_str.len() - 4)
                .expect("Filename slicing failed")
                .to_string());
        }
    }
    Err(format!(
        "Could not find Boost library starting with '{}' in {:?}",
        prefix, boost_lib_dir
    ))
}

// To debug this use command:
// cargo build -vv
fn main() {
    let manifest_dir =
        PathBuf::from(env::var("CARGO_MANIFEST_DIR").expect("CARGO_MANIFEST_DIR not set"));
    let compiler_dir = manifest_dir.join("../compiler");

    println!("cargo:rerun-if-changed={}", compiler_dir.display());
    println!("cargo:rerun-if-changed=build.rs");

    let mut config = cmake::Config::new(&compiler_dir);

    config
        .define("WITH_TESTS", "OFF")
        .define("SOLC_LINK_STATIC", "OFF")
        .define("SOLC_STATIC_STDLIBS", "OFF");

    if cfg!(target_os = "windows") {
        let boost_root_dir = compiler_dir.join("deps/boost");
        let absolute_boost_root =
            get_absolute_path(&boost_root_dir).expect("Failed to get absolute path for Boost root");
        config.define("BOOST_ROOT", absolute_boost_root);
        config.define("PEDANTIC", "OFF");
        // Explicitly request the static multithreaded runtime library.
        // Uses CMake generator expression to select MT for Release and MTd for Debug.
        config.define(
            "CMAKE_MSVC_RUNTIME_LIBRARY",
            "MultiThreaded$<$<CONFIG:Debug>:Debug>",
        );
    }

    let dst = config.build();

    println!(
        "cargo:rustc-link-search=native={}",
        dst.join("lib").display()
    );

    for lib in ["solc", "solidity", "langutil", "solutil", "jsoncpp"] {
        println!("cargo:rustc-link-lib=static={}", lib);
    }

    if cfg!(target_os = "windows") {
        let boost_lib_dir = compiler_dir.join("deps/boost/lib");
        let absolute_boost_lib_dir =
            get_absolute_path(&boost_lib_dir).expect("Failed to get absolute path for Boost lib");
        println!(
            "cargo:rustc-link-search=native={}",
            absolute_boost_lib_dir.display()
        );
        let boost_fs_lib = find_boost_lib_name("libboost_filesystem", &absolute_boost_lib_dir)
            .expect("Failed to find boost_filesystem lib name");
        println!("cargo:rustc-link-lib=static={}", boost_fs_lib);
    } else {
        if cfg!(target_os = "macos") {
            let mut boost_lib_path_found = false;
            if let Ok(boost_root_env) = env::var("BOOST_ROOT") {
                let boost_lib_dir = PathBuf::from(&boost_root_env).join("lib");
                if boost_lib_dir.exists() {
                    println!("cargo:rustc-link-search=native={}", boost_lib_dir.display());
                    println!(
                        "build.rs: Added BOOST_ROOT/lib to link search path: {}",
                        boost_lib_dir.display()
                    );
                    boost_lib_path_found = true;
                } else {
                    println!("build.rs: BOOST_ROOT environment variable was set to '{}', but '{}' does not exist.", boost_root_env, boost_lib_dir.display());
                }
            }

            if !boost_lib_path_found {
                // Fallback to Homebrew if BOOST_ROOT didn't yield a valid path
                println!("build.rs: BOOST_ROOT not found or invalid, falling back to Homebrew paths for Boost.");
                match env::var("HOMEBREW_PREFIX") {
                    Ok(brew_prefix) => {
                        println!("cargo:rustc-link-search=native={}/lib", brew_prefix);
                    }
                    Err(_) => {
                        println!("cargo:rustc-link-search=native=/opt/homebrew/lib");
                        println!("cargo:rustc-link-search=native=/usr/local/lib");
                    }
                }
            }
        } else if cfg!(target_os = "freebsd") {
            println!("cargo:rustc-link-search=native=/usr/local/lib");
        } else if cfg!(target_os = "linux") {
            println!("cargo:rustc-link-search=native=/usr/lib/x86_64-linux-gnu");
            println!("cargo:rustc-link-search=native=/usr/lib64");
            println!("cargo:rustc-link-search=native=/usr/lib");
        }
        println!("cargo:rustc-link-search=native=/usr/local/lib");

        if cfg!(target_os = "freebsd") {
            println!("cargo:rustc-link-lib=boost_filesystem");
        } else {
            println!("cargo:rustc-link-lib=static=boost_filesystem");
        }
    }

    if cfg!(target_os = "macos") || cfg!(target_os = "freebsd") {
        println!("cargo:rustc-link-lib=c++");
    } else if cfg!(target_os = "linux") {
        println!("cargo:rustc-link-lib=stdc++");
    }
}
