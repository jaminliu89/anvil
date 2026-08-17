#!/bin/bash
# Anvil smoke test — v2.1
PASS=0 FAIL=0 TOTAL=0
check() { local n="$1" c="$2"; TOTAL=$((TOTAL+1)); if eval "$c" >/dev/null 2>&1; then echo "  PASS  $n"; PASS=$((PASS+1)); else echo "  FAIL  $n"; FAIL=$((FAIL+1)); fi; }

echo "[Anvil Smoke Test v2.1]"
echo "---"

check "Bridge health :18443" "curl -s http://127.0.0.1:18443/health | grep -q 'ok.*true'"
check "Bridge search" "curl -s -X POST http://127.0.0.1:18443/search -H 'Content-Type: application/json' -d '{\"query\":\"test\",\"count\":1}' | grep -q 'results'"
check "Bridge targets" "curl -s http://127.0.0.1:18443/models | grep -q 'targets'"
check "Inference :18080" "curl -s -o /dev/null -w '%{http_code}' http://127.0.0.1:18080/models 2>/dev/null | grep -q 200"
check "Dock API :8710" "curl -s -o /dev/null -w '%{http_code}' http://127.0.0.1:8710/ 2>/dev/null | grep -qE '200|302|404'"

# TypeScript (slow, real check)
cd /private/tmp/anvil || exit 1
TOTAL=$((TOTAL+1))
if npx vue-tsc -b --noEmit >/dev/null 2>&1; then echo "  PASS  TypeScript"; PASS=$((PASS+1)); else echo "  FAIL  TypeScript"; FAIL=$((FAIL+1)); fi

# Build
TOTAL=$((TOTAL+1))
if npm run build >/dev/null 2>&1; then echo "  PASS  Build"; PASS=$((PASS+1)); else echo "  FAIL  Build"; FAIL=$((FAIL+1)); fi

echo "---"
echo "Results: $PASS/$TOTAL passed, $FAIL failed"
[ $FAIL -gt 0 ] && exit 1 || exit 0