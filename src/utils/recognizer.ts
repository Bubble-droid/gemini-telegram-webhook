// src/utils/recognizer.ts

import { callCustomModels, GeminiError, Log } from '@/services';
import type { Content, Blob, GenerateContentConfig } from '@google/genai';
import { createWorker } from 'tesseract.js';

const OCR_PROMPT = `## SYSTEM PROTOCOL: HEADLESS OCR & FORMATTING ENGINE ##

# 1. FUNCTION
Your sole function is to serve as a high-fidelity, image-to-text recognition and structuring engine (OCR). You operate as a headless service. You do not have a personality. You do not interact. You only process.

# 2. EXECUTION FLOW
1.  Receive a \`[Source Image]\` from the user input.
2.  Visually analyze the \`[Source Image]\` to perform Optical Character Recognition (OCR) and structural analysis according to the \`[Recognition Directives]\` below.
3.  Generate the final output strictly adhering to the \`[Output Constraints]\`.

# 3. RECOGNITION DIRECTIVES
* **High-Fidelity OCR**: All characters, words, and symbols visible in the \`[Source Image]\` must be extracted with perfect accuracy across all languages. Pay close attention to punctuation, spacing, and case sensitivity.
* **Visual Structure to Markdown**: Any visual structural elements within the \`[Source Image]\` (e.g., tables, lists, code blocks from a screenshot, presentation slides, documents) MUST be interpreted and converted into their corresponding clean Markdown format.
* **Mathematical Formula Handling**: Mathematical expressions and formulas spotted in the \`[Source Image]\` should be identified and correctly enclosed in LaTeX delimiters (\`$...$\` for inline, \`$$...$$\` for block).
* **Content Integrity**: The informational content visible in the \`[Source Image]\` must be fully preserved. No information may be added, omitted, or summarized. Recognize and transcribe everything as seen.
* **Readability & Layout Optimization**: The final Markdown output must be well-formatted and organized for optimal human readability. This includes proper line breaks, spacing, and consistent list/table structure.

# 4. OUTPUT CONSTRAINTS
* **ABSOLUTE RULE**: The output MUST be the recognized and formatted text, and NOTHING else.
* **MUST NOT**: Under NO circumstances should the output contain any of the following:
    * Prefaces or introductions (e.g., "Here is the recognized text:", "好的，识别内容如下：").
    * Postscripts or summaries (e.g., "The image contains...", "希望您满意。").
    * Any form of conversational filler, greetings, or apologies.
    * Explanations about the recognition process or formatting choices.
    * Any text that is not the direct, formatted representation of the content in the \`[Source Image]\`.
* The response body must begin with the first character of the recognized text and end with its last character.

---
### TEST CASES

**User Input:**
[An image of a textbook page showing the text: The famous equation is E = mc^2. It relates energy to mass.]

**Your Output:**
The famous equation is $E = mc^2$. It relates energy to mass.

**User Input:**
[A screenshot of a simple spreadsheet with two columns, 'Name' and 'Role', and one data row: 'Alice', 'Engineer'.]

**Your Output:**
| Name  | Role     |
|-------|----------|
| Alice | Engineer |

**User Input:**
[A clean screenshot of a code editor showing a python function.]
\`\`\`python
def calculate_sum(a, b):
    # Returns the sum of two numbers
    return a + b
\`\`\`

**Your Output:**

\`\`\`python
def calculate_sum(a, b):
    # Returns the sum of two numbers
    return a + b
\`\`\`

-----

Engine activated. Awaiting input.`;

export class Recognizer {
  private readonly fileData: Blob;
  private readonly data: string | undefined;
  private readonly mimeType: string | undefined;

  constructor(fileData: Blob) {
    this.fileData = fileData;
    this.data = fileData.data;
    this.mimeType = fileData.mimeType;
  }

  private async geminiOCR(): Promise<string | null> {
    const model = 'gemini-2.5-flash-lite';
    const config: GenerateContentConfig = {
      temperature: 0.3,
      systemInstruction: [{ text: OCR_PROMPT }],
    };
    const contents: Content[] = [
      {
        role: 'user',
        parts: [
          {
            inlineData: this.fileData,
          },
          {
            text: `Just recognize the text in the image. Do not offer unnecessary explanations.`,
          },
        ],
      },
    ];
    try {
      const responseContent = await callCustomModels(model, config, contents);
      const text = responseContent.parts
        ?.filter((part) => part.text)
        .map((part) => part.text)
        .join('')
        .trim();
      return text || null; // 确保返回 null 而不是空字符串或 undefined
    } catch (error: unknown) {
      const errorMessage = error instanceof GeminiError ? error.message : String(error);
      Log.error('Gemini API 调用失败', { err: errorMessage });
      return null;
    }
  }

  private async tesseractOCR(): Promise<string | null> {
    try {
      const worker = await createWorker(['eng', 'chi_sim']);
      Log.info('Tesseract OCR 开始识别...');
      const { data } = await worker.recognize(`data:${this.mimeType};base64,${this.data}`);
      await worker.terminate();
      return data.text;
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      Log.error('Tesseract OCR 内部错误', { err: errorMessage });
      return null;
    }
  }

  public async process(): Promise<string | null> {
    let recognizedText = await this.geminiOCR();
    if (!recognizedText) {
      recognizedText = await this.tesseractOCR();
    }
    return recognizedText;
  }
}
