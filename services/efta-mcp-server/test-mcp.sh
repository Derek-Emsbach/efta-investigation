#!/bin/bash
# EFTA MCP Server — Claude.ai Connector Diagnostic
# Run this against your deployed server to verify it will work with Claude.ai
#
# Usage: ./test-mcp.sh https://mcp.cyclops-digital.com

SERVER_URL="${1:-http://localhost:3001}"
PASS=0
FAIL=0

echo "🔍 Testing MCP server at: $SERVER_URL"
echo "================================================"
echo ""

# Test 1: Health check
echo "1️⃣  GET /health"
HEALTH=$(curl -s -w "\n%{http_code}" "$SERVER_URL/health" 2>&1)
HEALTH_CODE=$(echo "$HEALTH" | tail -1)
HEALTH_BODY=$(echo "$HEALTH" | head -1)
if [ "$HEALTH_CODE" = "200" ]; then
  echo "   ✅ 200 OK — $HEALTH_BODY"
  ((PASS++))
else
  echo "   ❌ Expected 200, got $HEALTH_CODE"
  ((FAIL++))
fi
echo ""

# Test 2: GET /mcp should return 405
echo "2️⃣  GET /mcp (should be 405 Method Not Allowed)"
GET_CODE=$(curl -s -o /dev/null -w "%{http_code}" -X GET "$SERVER_URL/mcp" 2>&1)
if [ "$GET_CODE" = "405" ]; then
  echo "   ✅ 405 Method Not Allowed — correct!"
  ((PASS++))
else
  echo "   ❌ Expected 405, got $GET_CODE — Claude will think the server is broken"
  ((FAIL++))
fi
echo ""

# Test 3: DELETE /mcp should return 405
echo "3️⃣  DELETE /mcp (should be 405 Method Not Allowed)"
DEL_CODE=$(curl -s -o /dev/null -w "%{http_code}" -X DELETE "$SERVER_URL/mcp" 2>&1)
if [ "$DEL_CODE" = "405" ]; then
  echo "   ✅ 405 Method Not Allowed — correct!"
  ((PASS++))
else
  echo "   ❌ Expected 405, got $DEL_CODE"
  ((FAIL++))
fi
echo ""

# Test 4: POST /mcp with initialize (the critical test)
echo "4️⃣  POST /mcp — initialize handshake"
INIT_RESPONSE=$(curl -s -w "\n---HTTP_CODE:%{http_code}" \
  -X POST "$SERVER_URL/mcp" \
  -H "Content-Type: application/json" \
  -H "Accept: application/json, text/event-stream" \
  -d '{
    "jsonrpc": "2.0",
    "id": 1,
    "method": "initialize",
    "params": {
      "protocolVersion": "2025-06-18",
      "capabilities": {},
      "clientInfo": {
        "name": "diagnostic-test",
        "version": "1.0.0"
      }
    }
  }' 2>&1)

INIT_CODE=$(echo "$INIT_RESPONSE" | grep "---HTTP_CODE:" | sed 's/---HTTP_CODE://')
INIT_BODY=$(echo "$INIT_RESPONSE" | grep -v "---HTTP_CODE:")

if [ "$INIT_CODE" = "200" ]; then
  echo "   ✅ 200 OK — server accepted initialize"
  echo "   Response: $(echo "$INIT_BODY" | head -c 200)"
  ((PASS++))
else
  echo "   ❌ Expected 200, got $INIT_CODE"
  echo "   Response: $INIT_BODY"
  ((FAIL++))
fi
echo ""

# Test 5: POST /mcp with tools/list (after successful init)
echo "5️⃣  POST /mcp — tools/list"
TOOLS_RESPONSE=$(curl -s -w "\n---HTTP_CODE:%{http_code}" \
  -X POST "$SERVER_URL/mcp" \
  -H "Content-Type: application/json" \
  -H "Accept: application/json, text/event-stream" \
  -d '{
    "jsonrpc": "2.0",
    "id": 2,
    "method": "tools/list",
    "params": {}
  }' 2>&1)

TOOLS_CODE=$(echo "$TOOLS_RESPONSE" | grep "---HTTP_CODE:" | sed 's/---HTTP_CODE://')
TOOLS_BODY=$(echo "$TOOLS_RESPONSE" | grep -v "---HTTP_CODE:")

if [ "$TOOLS_CODE" = "200" ]; then
  # Count tools
  TOOL_COUNT=$(echo "$TOOLS_BODY" | python3 -c "import sys,json; d=json.load(sys.stdin); print(len(d.get('result',{}).get('tools',[])))" 2>/dev/null || echo "?")
  echo "   ✅ 200 OK — $TOOL_COUNT tools available"
  ((PASS++))
else
  echo "   ❌ Expected 200, got $TOOLS_CODE"
  echo "   Response: $TOOLS_BODY"
  ((FAIL++))
fi
echo ""

# Test 6: No session header required (stateless)
echo "6️⃣  POST /mcp — no Mcp-Session-Id header (stateless check)"
STATELESS_CODE=$(curl -s -o /dev/null -w "%{http_code}" \
  -X POST "$SERVER_URL/mcp" \
  -H "Content-Type: application/json" \
  -H "Accept: application/json, text/event-stream" \
  -d '{"jsonrpc":"2.0","id":1,"method":"initialize","params":{"protocolVersion":"2025-06-18","capabilities":{},"clientInfo":{"name":"test","version":"1.0.0"}}}' 2>&1)

if [ "$STATELESS_CODE" = "200" ]; then
  echo "   ✅ 200 OK — server works without session ID (stateless confirmed)"
  ((PASS++))
else
  echo "   ❌ Expected 200, got $STATELESS_CODE — server may be requiring sessions"
  ((FAIL++))
fi
echo ""

# Summary
echo "================================================"
echo "Results: $PASS passed, $FAIL failed"
echo ""
if [ "$FAIL" -eq 0 ]; then
  echo "🎉 All tests passed! Server should work with Claude.ai."
  echo ""
  echo "Next steps:"
  echo "  1. Go to Claude.ai → Settings → Connectors"
  echo "  2. Click 'Add custom connector'"
  echo "  3. Enter URL: $SERVER_URL/mcp"
  echo "  4. Click 'Add'"
else
  echo "⚠️  Some tests failed. Fix the issues above before adding to Claude.ai."
fi
