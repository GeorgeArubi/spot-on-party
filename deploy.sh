#!/bin/bash

SOURCEPATH="$(dirname "$0")"
DEPLOYPATH="/tmp/deploy_$(date +%Y.%m.%d-%H.%M.%S)"

mkdir "$DEPLOYPATH" &&
	cp "${SOURCEPATH}"/sopbase-py/*.{yaml,py} "${DEPLOYPATH}" &&
	mkdir "${DEPLOYPATH}/sencha-sop" &&
	(cd "${SOURCEPATH}"/sencha-sop/ && sencha app build testing) &&
	cp -r "${SOURCEPATH}"/sencha-sop/build/testing/* "${DEPLOYPATH}/sencha-sop" &&
	appcfg.py --email 'claude.claude.nl@gmail.com' update "${DEPLOYPATH}"
