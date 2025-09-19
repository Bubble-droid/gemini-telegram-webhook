import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

import { faqData } from '@/configs/faq_data';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const outputPath = path.resolve(__dirname, '../resources/faq_data.json');
const jsonString = JSON.stringify(faqData, null, 2);
const outputDir = path.dirname(outputPath);
if (!fs.existsSync(outputDir)) {
  fs.mkdirSync(outputDir, { recursive: true });
}
fs.writeFileSync(outputPath, jsonString, 'utf-8');
console.log(`✅ JSON file generated successfully at: ${outputPath}`);
