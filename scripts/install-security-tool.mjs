import { installScanner } from './lib/install-scanner.mjs';
import { vulnerabilityScanner } from './lib/container-security.mjs';
console.log(await installScanner(vulnerabilityScanner));
