/*
 * Copyright (C) 2022-2025 EverX. All Rights Reserved.
 *
 * Licensed under the SOFTWARE EVALUATION License (the "License"); you may not use
 * this file except in compliance with the License.
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the  GNU General Public License for more details at: https://www.gnu.org/licenses/gpl-3.0.html
 */

use clap::Parser;
use sold_lib::{run_sold, solidity_version, SoldArgs, ERROR_MSG_NO_OUTPUT, VERSION};

mod libsolc;

fn main() {
    VERSION.set(solidity_version()).unwrap();

    let sold_commands = SoldArgs::parse();
    if let Err(e) = run_sold(sold_commands) {
        eprintln!("{e}");
        if e.to_string() != ERROR_MSG_NO_OUTPUT {
            std::process::exit(1);
        }
    }
}
