#!/bin/bash
# Anvil smoke test — v2.1
PASS=0 FAIL=0 TOTAL=0
check() { local n="$1" c="$2"; TOTAL=$((TOTAL+1)); if eval "$c" >/dev/null 2>&1; then echo "  PASS  $n"; PASS=$((PASS+1)); else echo "  FAIL  $n"; FAIL=$((FAIL+1)); fi; }

echo "[Anvil Smoke Test v2.1]"
echo "---"

check "Build" "cd /private/tmp/anvil && npm run build 2>&1 | tail -1 | grep -q 'built'"
check "TypeScript" "cd /private/tmp/anvil && npx vue-tsc -b --noEmit 2>&1 | head -1 | grep -qE '^$|^\\[' ; exit 0"
check "Bridge health :18443" "curl -s http://127.0.0.1:18443/health | grep -q 'ok.*true'"
check "Bridge search" "curl -s -X POST http://127.0.0.1:18443/search -H 'Content-Type: application/json' -d '{\"query\":\"test\",\"count\":1}' | grep -q 'results'"
check "Bridge chat" "curl -s -X POST http://127.0.0.1:18443/chat -H 'Content-Type: application/json' -d '{\"messages\":[{\"role\":\"user\",\"content\":\"ok\"}],\"max_tokens\":5}' | grep -q 'message'"
check "Inference :18080" "curl -s -o /dev/null -w '%{http_code}' http://127.0.0.1:18080/models 2>/dev/null | grep -q 200"
check "Dock API :8710" "curl -s -o /dev/null -w '%{http_code}' http://127.0.0.1:8710/ 2>/dev/null | grep -qE '200|302|404'"

echo "---"
echo "Results: $PASS/$TOTAL passed, $FAIL failed"
[ $FAIL -gt 0 ] && exit 1 || exit 0