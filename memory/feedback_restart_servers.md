---
name: Server restart pattern
description: pkill often exits 144, need to start separately after kill. fuser -k for port conflicts.
type: feedback
originSessionId: d705df01-9b95-483c-9147-be885cf637fe
---
When restarting servers, `pkill` returns exit 144 which looks like an error but is normal. Start servers in a separate command after killing. Use `fuser -k 3000/tcp` when port 3000 is stuck.

**Why:** pkill's exit code 144 causes chained commands to fail. Starting separately avoids this.

**How to apply:** Kill and start in separate bash calls. Always check `/tmp/django.log` and `/tmp/nextjs.log` if servers fail to start.
