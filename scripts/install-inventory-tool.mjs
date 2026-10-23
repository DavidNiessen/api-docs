import { installScanner } from './lib/install-scanner.mjs';
import { scanner } from './lib/container-inventory.mjs';
console.log(await installScanner(scanner));
