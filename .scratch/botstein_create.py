import os, json, urllib.request, sys

ENV_PATH = "services/efta-mcp-server/.env"
env = {}
with open(ENV_PATH) as f:
    for line in f:
        line = line.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        k, v = line.split("=", 1)
        env[k.strip()] = v.strip()

SUPABASE_URL = env["SUPABASE_URL"].rstrip("/")
KEY = env["SUPABASE_SERVICE_ROLE_KEY"]

def req(method, path, body=None):
    url = f"{SUPABASE_URL}{path}"
    data = json.dumps(body).encode() if body is not None else None
    r = urllib.request.Request(url, data=data, method=method)
    r.add_header("apikey", KEY)
    r.add_header("Authorization", f"Bearer {KEY}")
    r.add_header("Content-Type", "application/json")
    r.add_header("Prefer", "return=representation")
    with urllib.request.urlopen(r) as resp:
        return json.loads(resp.read())

def get_doc_id(bates):
    res = req("GET", f"/rest/v1/documents?bates_number=eq.{bates}&select=id,bates_number")
    if not res:
        return None
    return res[0]["id"]

def main():
    cmd = sys.argv[1]
    if cmd == "lookup_docs":
        bates_list = sys.argv[2:]
        out = {}
        for b in bates_list:
            out[b] = get_doc_id(b)
        print(json.dumps(out, indent=2))
    elif cmd == "check_entity":
        name = sys.argv[2]
        res = req("GET", f"/rest/v1/entities?name=ilike.*{name}*&select=id,name,tier")
        print(json.dumps(res, indent=2))
    elif cmd == "create_entity":
        payload = json.loads(sys.argv[2])
        res = req("POST", "/rest/v1/entities", payload)
        print(json.dumps(res, indent=2))
    elif cmd == "link_doc":
        entity_id, doc_id, role, excerpt = sys.argv[2], sys.argv[3], sys.argv[4], sys.argv[5]
        payload = {"entity_id": entity_id, "document_id": doc_id, "role_in_document": role, "excerpt": excerpt}
        res = req("POST", "/rest/v1/entity_documents", payload)
        print(json.dumps(res, indent=2))
    else:
        print("unknown cmd")

if __name__ == "__main__":
    main()

def create_from_file(path):
    payload = json.load(open(path))
    res = req("POST", "/rest/v1/entities", payload)
    print(json.dumps(res, indent=2))
