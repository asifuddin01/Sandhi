import { z } from "zod";

// Zod compiles object parsers with `new Function`, which the Content Security
// Policy forbids; even its caught probe is reported as a violation. The setting
// is read when a schema is built, so schema modules import `z` from here.
z.config({ jitless: true });

export { z };
