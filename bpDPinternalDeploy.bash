#!/bin/bash

case "$0" in
	/*)
		BASEZ="$0"
		;;
	*)
		BASEZ="${PWD}/$0"
		;;
esac
BASEPATH="$(dirname "${BASEZ}")"

case "$(uname -n)" in
	montblanc)
		BLUEPRINT_DATAPORTAL_CONFIG="${BASEPATH}"/blueprint-dev-internal-montblanc-config.json
		;;
	*)
		BLUEPRINT_DATAPORTAL_CONFIG="${BASEPATH}"/blueprint-dev-internal-config.json
		;;
esac
export BLUEPRINT_DATAPORTAL_CONFIG

PATH="$(gem env gemdir)/bin:${PATH}"
export PATH

PATH="${BASEPATH}/node_modules/.bin:${PATH}"
export PATH

command=build
if [ $# -gt 0 ] ; then
	command="$1"
fi

grunt "$command"