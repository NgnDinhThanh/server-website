import ejs from 'ejs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const viewsDir = __dirname.endsWith(`${path.sep}dist${path.sep}utils`) ||
    __dirname.endsWith('/dist/utils')
    ? path.resolve(__dirname, '../../src/views')
    : path.resolve(__dirname, '../views');
export function renderEmailTemplate(templateName, data) {
    return ejs.renderFile(path.join(viewsDir, 'emails', `${templateName}.ejs`), data);
}
