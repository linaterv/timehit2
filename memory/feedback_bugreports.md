---
name: Bug report file naming
description: When fixing a bug from bug-reports/, rename the file to prefix with "fixed-"
type: feedback
originSessionId: d705df01-9b95-483c-9147-be885cf637fe
---
When a bug from the `bug-reports/` directory is fixed, rename the file to add `fixed-` prefix to the filename.

**Why:** User tracks fixed vs open bugs by filename convention in the bug-reports directory.

**How to apply:** After fixing a bug, `mv bug-reports/<filename>.md bug-reports/fixed-<filename>.md`.
