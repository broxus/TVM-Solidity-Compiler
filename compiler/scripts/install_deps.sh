#!/usr/bin/env sh

#------------------------------------------------------------------------------
# Shell script for installing pre-requisite packages for solidity on a
# variety of Linux and other UNIX-derived platforms.
#
# This is an "infrastucture-as-code" alternative to the manual build
# instructions pages which we previously maintained at:
# https://docs.soliditylang.org/en/latest/installing-solidity.html
#
# The aim of this script is to simplify things down to the following basic
# flow for all supported operating systems:
#
# - git clone --recursive
# - ./scripts/install_deps.sh
# - cmake && make
#
# TODO - There is no support here yet for cross-builds in any form, only
# native builds.  Expanding the functionality here to cover the mobile,
# wearable and SBC platforms covered by doublethink and EthEmbedded would
# also bring in support for Android, iOS, watchOS, tvOS, Tizen, Sailfish,
# Maemo, MeeGo and Yocto.
#
# The documentation for solidity is hosted at:
#
# https://docs.soliditylang.org
#
# ------------------------------------------------------------------------------
# This file is part of solidity.
#
# solidity is free software: you can redistribute it and/or modify
# it under the terms of the GNU General Public License as published by
# the Free Software Foundation, either version 3 of the License, or
# (at your option) any later version.
#
# solidity is distributed in the hope that it will be useful,
# but WITHOUT ANY WARRANTY; without even the implied warranty of
# MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
# GNU General Public License for more details.
#
# You should have received a copy of the GNU General Public License
# along with solidity.  If not, see <http://www.gnu.org/licenses/>
#
# (c) 2016 solidity contributors.
#------------------------------------------------------------------------------

set -e

SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" &> /dev/null && pwd )"
# Check for 'uname' and abort if it is not available.
uname -v > /dev/null 2>&1 || { echo >&2 "ERROR - solidity requires 'uname' to identify the platform."; exit 1; }

# See http://unix.stackexchange.com/questions/92199/how-can-i-reliably-get-the-operating-systems-name
detect_linux_distro() {
    if [ "$(command -v lsb_release)" ]; then
        DISTRO=$(lsb_release -is)
    elif [ -f /etc/os-release ]; then
        # extract 'foo' from NAME=foo, only on the line with NAME=foo
        DISTRO=$(sed -n -e 's/^NAME="\?\([^"]*\)"\?$/\1/p' /etc/os-release)
    elif [ -f /etc/centos-release ]; then
        DISTRO=CentOS
    else
        DISTRO=''
    fi
    echo "$DISTRO"
}

case $(uname -s) in

#------------------------------------------------------------------------------
# macOS
#------------------------------------------------------------------------------

    Darwin)
        brew install ccache
        bash "$SCRIPT_DIR/install_boost_macos.sh"


        # Check for Homebrew install and abort if it is not installed.
        brew -v > /dev/null 2>&1 || { echo >&2 "ERROR - solidity requires a Homebrew install.  See https://brew.sh."; exit 1; }
        # don't install cmake; brew ships bleeding edge cmake for fun(no)
        brew install curl
        ;;

#------------------------------------------------------------------------------
# FreeBSD
#------------------------------------------------------------------------------

    FreeBSD)
        echo "Installing solidity dependencies on FreeBSD."
        echo "ERROR - 'install_deps.sh' doesn't have FreeBSD support yet."
        echo "Please let us know if you see this error message, and we can work out what is missing."
        echo "Drop us a message at https://gitter.im/ethereum/solidity-dev."
        exit 1
        ;;

#------------------------------------------------------------------------------
# Linux
#------------------------------------------------------------------------------

    Linux)
        case $(detect_linux_distro) in

#------------------------------------------------------------------------------
# Arch Linux
#------------------------------------------------------------------------------

            Arch*|ManjaroLinux)
                #Arch
                echo "Installing solidity dependencies on Arch Linux."

                # All our dependencies can be found in the Arch Linux official repositories.
                # See https://wiki.archlinux.org/index.php/Official_repositories
                sudo pacman -Syu \
                    base-devel \
                    boost \
                    cmake \
                    ccache \
                    git
                ;;

#------------------------------------------------------------------------------
# Alpine Linux
#------------------------------------------------------------------------------

            "Alpine Linux")
                #Alpine
                echo "Installing solidity dependencies on Alpine Linux."

                # All our dependencies can be found in the Alpine Linux official repositories.
                # See https://pkgs.alpinelinux.org/

                apk update
                apk add boost-dev boost-static build-base cmake ccache git

                ;;

#------------------------------------------------------------------------------
# Debian
#------------------------------------------------------------------------------

            Debian*)
                #Debian
                . /etc/os-release

                # Install "normal packages"
                sudo apt-get -y update
                sudo apt-get -y install \
                    build-essential \
                    cmake \
                    g++ \
                    gcc \
                    git \
                    libboost-all-dev \
                    unzip \
                    curl \
                    libclang-dev \
                    ccache

                ;;

#------------------------------------------------------------------------------
# Fedora
#------------------------------------------------------------------------------

            Fedora)
                #Fedora
                echo "Installing solidity dependencies on Fedora."

                # Install "normal packages"
                # See https://fedoraproject.org/wiki/Package_management_system.
                dnf install \
                    autoconf \
                    automake \
                    boost-devel \
                    boost-static \
                    cmake \
                    gcc \
                    gcc-c++ \
                    git \
                    libtool \
                    curl \
                    ccache

                ;;

#------------------------------------------------------------------------------
# Gentoo Linux
#------------------------------------------------------------------------------

            "Gentoo")
                #Gentoo
                echo "Installing solidity dependencies on Gentoo Linux."

                # All dependencies can be found in portage.
                # See https://pkgs.alpinelinux.org/

                sudo USE="static-libs" emerge  dev-libs/boost
                sudo emerge dev-util/cmake sys-devel/gcc net-misc/curl dev-util/boost-build dev-util/ccache

                ;;

#------------------------------------------------------------------------------
# OpenSUSE
#------------------------------------------------------------------------------

            "openSUSE project")
                #openSUSE
                echo "Installing solidity dependencies on openSUSE."
                echo "ERROR - 'install_deps.sh' doesn't have openSUSE support yet."
                echo "See https://docs.soliditylang.org/en/latest/installing-solidity.html for manual instructions."
                echo "If you would like to get 'install_deps.sh' working for openSUSE, that would be fantastic."
                echo "See https://github.com/ethereum/webthree-umbrella/issues/552."
                exit 1
                ;;
#------------------------------------------------------------------------------
# Ubuntu
#
#------------------------------------------------------------------------------

            Ubuntu|LinuxMint)
                #LinuxMint is a distro on top of Ubuntu.
                #Ubuntu

                sudo apt-get -y update
                sudo apt-get -y install \
                    build-essential \
                    cmake \
                    git \
                    libboost-all-dev \
                    curl \
                    libclang-dev
                ;;

#------------------------------------------------------------------------------
# CentOS
# CentOS needs some more testing. This is the general idea of packages
# needed, but some tweaking/improvements can definitely happen
#------------------------------------------------------------------------------
            CentOS*)
                echo "Attention: CentOS 7 is currently not supported!";
                read -p "This script will heavily modify your system in order to allow for compilation of Solidity. Are you sure? [Y/N]" -n 1 -r
                if [[ $REPLY =~ ^[Yy]$ ]]; then
                    # Make Sure we have the EPEL repos
                    sudo yum -y install epel-release
                    # Get g++ 4.8
                    sudo rpm --import http://linuxsoft.cern.ch/cern/slc6X/i386/RPM-GPG-KEY-cern
                    wget -O /etc/yum.repos.d/slc6-devtoolset.repo http://linuxsoft.cern.ch/cern/devtoolset/slc6-devtoolset.repo
                    sudo yum -y install devtoolset-2-gcc devtoolset-2-gcc-c++ devtoolset-2-binutils

                    # Enable the devtoolset2 usage so global gcc/g++ become the 4.8 one.
                    # As per https://gist.github.com/stephenturner/e3bc5cfacc2dc67eca8b, what you should do afterwards is
                    # to add this line:
                    # source /opt/rh/devtoolset-2/enable
                    # to your bashrc so that this happens automatically at login
                    scl enable devtoolset-2 bash

                    # Get cmake
                    sudo yum -y remove cmake
                    sudo yum -y install cmake3
                    sudo ln -s /usr/bin/cmake3 /usr/bin/cmake

                    # Get latest boost thanks to this guy: http://vicendominguez.blogspot.de/2014/04/boost-c-library-rpm-packages-for-centos.html
                    sudo yum -y remove boost-devel
                    sudo wget https://bintray.com/vicendominguez/CentOS6/rpm -O /etc/yum.repos.d/bintray-vicendominguez-CentOS6.repo
                    sudo yum install boost-devel
                    sudo yum install curl
                else
                    echo "Aborted CentOS Solidity Dependency Installation";
                    exit 1
                fi

                ;;




            *)

#------------------------------------------------------------------------------
# Other (unknown) Linux
# Major and medium distros which we are missing would include Mint, CentOS,
# RHEL, Raspbian, Cygwin, OpenWrt, gNewSense, Trisquel and SteamOS.
#------------------------------------------------------------------------------

                #other Linux
                echo "ERROR - Unsupported or unidentified Linux distro."
                echo "See https://docs.soliditylang.org/en/latest/installing-solidity.html for manual instructions."
                echo "If you would like to get your distro working, that would be fantastic."
                echo "Drop us a message at https://gitter.im/ethereum/solidity-dev."
                exit 1
                ;;
        esac
        ;;

#------------------------------------------------------------------------------
# Other platform (not Linux, FreeBSD or macOS).
# Not sure what might end up here?
# Maybe OpenBSD, NetBSD, AIX, Solaris, HP-UX?
#------------------------------------------------------------------------------

    *)
        #other
        echo "ERROR - Unsupported or unidentified operating system."
        echo "See https://docs.soliditylang.org/en/latest/installing-solidity.html for manual instructions."
        echo "If you would like to get your operating system working, that would be fantastic."
        echo "Drop us a message at https://gitter.im/ethereum/solidity-dev."
        ;;
esac
