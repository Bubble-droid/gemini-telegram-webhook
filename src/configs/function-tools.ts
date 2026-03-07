import type { GeneralFunctionSchema } from '@llm/types/agent.js';
import type { LoadedMcpServer } from '@llm/types/mcp.js';
import { ALLOWED_REACTIONS } from '@shared/core/constants.js';
import type { JSONSchema } from '@shared/types/schema.js';

type FileSearchStoreType = keyof typeof FileSearchStores;

type FileSearchStoreDisplayName = {
  [K in FileSearchStoreType]: `${K}/${(typeof FileSearchStores)[K][number]}`;
}[FileSearchStoreType];

const FileSearchStores = {
  documents: ['gui-for-cores', 'sing-box', 'mihomo', 'hysteria2', 'anytls'],
  sourcecode: ['plugin-hub'],
} as const;

const getFileSearchStoreDisplayNames = (): FileSearchStoreDisplayName[] => {
  return Object.entries(FileSearchStores).flatMap(([category, items]) =>
    items.map((item) => `${category}/${item}` as FileSearchStoreDisplayName),
  );
};

const SYSTEM_PROMPT_PROPERTY = {
  system_prompt: {
    type: 'string',
    description:
      `System-level instructions for the sub-agent. This defines the sub-agent's role, constraints, tone, and output format.

    **Example Structure:**
    <role>You are a [Sub-Agent Role].</role>
    <constraints>- [Specific constraint, e.g., "Limit results to 10 items"].</constraints>
    <output_format>[Specific output format, e.g., "Markdown list of issue titles and URLs"].</output_format>
    `.trim(),
  } as const satisfies JSONSchema,
};

const OBJECTIVE_PROPERTY = {
  objective: {
    type: 'string',
    description: `The comprehensive task objective for the sub-agent. This MUST clearly articulate:
    1.  **The User's Overall Goal**: What the user ultimately wants to achieve.
    2.  **Current Context**: All relevant information gathered by the main Assistant so far.
    3.  **Specific Questions/Actions for THIS Sub-Agent**: The precise research questions or actions this sub-agent needs to perform, including any necessary parameters (e.g., repository, search terms, pagination).
    4.  **Internal Sub-Agent Workflow**: Instruct the sub-agent to internally Plan, Execute, Validate its findings, and Format its response according to its system_prompt before returning.

    **Example Objective:**
    "User seeks latest SingBox version. Context: macOS. Task: Search GitHub releases for 'sing-box', identify latest stable. Internally: Plan API calls, execute, validate version, format concisely."
    `.trim(),
  } as const satisfies JSONSchema,
};

const BLOCKING_RESPONSE_PROPERTY = {
  blocking: {
    type: 'boolean',
    description:
      'If you can complete the response directly after calling this tool without further explanation, please include this parameter to force the response to end.',
  } as const satisfies JSONSchema,
};

const WEB_RESEARCH_TOOL = {
  name: 'web_research',
  description: `
Executes a Google Search to discover relevant URLs and then proactively retrieves and processes the full textual content of promising web pages (HTTP/HTTPS).
This tool provides **current events, real-time data, external documentation, and broad internet knowledge.**

**Usage Strategy:**
-   **Comprehensive Web Inquiry**: Use this tool for any task requiring information from the broader internet, combining both discovery and content extraction.
-   **Autonomous Context Expansion**: If the conversation context, user input, or prior research reveals a need for external web content, use this tool immediately to search and fetch.
-   **Verification**: Use to verify uncertain or generalized information by checking primary web sources.
`.trim(),
  parametersJsonSchema: {
    type: 'object',
    properties: {
      ...SYSTEM_PROMPT_PROPERTY,
      ...OBJECTIVE_PROPERTY,
      search_config: {
        type: 'object',
        description:
          'Optional configuration for the web search, such as restricting results to specific domains or languages.',
        properties: {
          time_range_filter: {
            type: 'object',
            description: `
Filter search results to a specific time range. If set a start time, they must set an end time (and vice versa).
Represents a time interval, encoded as a Timestamp start (inclusive) and a Timestamp end (exclusive).
The start must be less than or equal to the end. When the start equals the end, the interval is empty (matches no time). When both start and end are unspecified, the interval matches any time.
`.trim(),
            properties: {
              start_time: {
                type: 'string',
                description: `
Optional. Inclusive start of the interval.
If specified, a Timestamp matching this interval will have to be the same or after the start.
Uses RFC 3339, where generated output will always be Z-normalized and use 0, 3, 6 or 9 fractional digits. Offsets other than "Z" are also accepted. Examples: "2014-10-02T15:01:23Z", "2014-10-02T15:01:23.045123456Z" or "2014-10-02T15:01:23+05:30".
`,
              },
              end_time: {
                type: 'string',
                description: `
Optional. Exclusive end of the interval.
If specified, a Timestamp matching this interval will have to be before the end.
Uses RFC 3339, where generated output will always be Z-normalized and use 0, 3, 6 or 9 fractional digits. Offsets other than "Z" are also accepted. Examples: "2014-10-02T15:01:23Z", "2014-10-02T15:01:23.045123456Z" or "2014-10-02T15:01:23+05:30".
`,
              },
            },
            required: ['start_time', 'end_time'],
            additionalProperties: false,
          },
        },
        required: ['time_range_filter'],
        additionalProperties: false,
      },
    },
    required: ['objective'],
  },
} as const satisfies GeneralFunctionSchema;

const DELEGATE_AGENT_TOOL = (mcpServers: LoadedMcpServer[]) =>
  ({
    name: 'delegate_to_agent',
    description: `
Delegates tasks to specialized Model Context Protocol (MCP) servers, which act as dedicated sub-agents for specific external data sources or APIs.

**[CRITICAL CONSTRAINT: TOKEN SAFETY & PAGINATION]**
When delegating tasks that involve lists (e.g., fetching data from a custom API), you **MUST** explicitly instruct the sub-agent (via \`system_prompt\` or \`objective\`) to:
1.  **Strictly Limit Response Size**: ALWAYS set \`per_page\`, \`limit\`, or \`max_results\` to conservative values (recommended: **10-20 items** max).
2.  **Paginate, Don't Dump**: NEVER attempt to fetch an entire dataset in a single turn. Instruct the agent to fetch Page 1, analyze it, and *only then* fetch Page 2 if necessary.
3.  **Avoid Token Overflow**: Massive JSON responses will crash the conversation. Prioritize filtering (e.g., by status or date) over fetching all data.

Available agents:
${mcpServers.map(({ name, description }) => `- **${name}**: ${description}`).join('\n')}
`.trim(),
    parametersJsonSchema: {
      type: 'object',
      properties: {
        ...SYSTEM_PROMPT_PROPERTY,
        ...OBJECTIVE_PROPERTY,
        agent_name: {
          type: 'string',
          description:
            'The unique identifier of the specialized sub-agent (MCP server) to handle the task. Must be one of the available agents listed in the description.',
        },
      },
      required: ['agent_name', 'objective'],
      additionalProperties: false,
    },
  }) as const satisfies GeneralFunctionSchema;

const VIDEO_TOOLS = [
  {
    name: 'analyze_youtube_video',
    description: `
If the user provides a link to a full YouTube video, this tool can be used to analyze it.
Processes YouTube videos directly via multimodal vision capabilities (no text transcripts).
Use this tool to "watch" a video and extract visual details, audio nuances, and temporal events that text-only tools miss.

**Capabilities:**
1. **Visual Reasoning**: Can describe actions, objects, and scene changes (e.g., "Describe the chart shown at 02:15").
2. **Audio-Visual Synthesis**: Combines spoken words with on-screen context (e.g., "What did the speaker say while holding the red prototype?").
3. **Temporal Precision**: Can locate specific events using MM:SS timestamps.

**Usage Strategy:**
- **Summarization**: "Summarize the key takeaways and create a quiz."
- **Deep Dive**: "Explain the technical demo shown between 05:00 and 07:00."
- **Fact Extraction**: "List all the books mentioned in the video with their authors."
`.trim(),
    parametersJsonSchema: {
      type: 'object',
      properties: {
        ...SYSTEM_PROMPT_PROPERTY,
        ...OBJECTIVE_PROPERTY,
        video_url: {
          type: 'string',
          description: 'The full, public YouTube URL. Private or unlisted videos are NOT supported.',
        },
      },
      required: ['video_url', 'objective'],
    },
  },
] as const satisfies GeneralFunctionSchema[];

/**
 * Orchestrates parallel, multi-dimensional research by delegating specific tasks to a team of expert sub-agents.
 * This tool ensures comprehensive and efficient information gathering from various sources simultaneously.
 */
const DEEP_RESEARCH_TOOL = {
  name: 'deep_research',
  description: `
Orchestrates parallel, multi-dimensional research by delegating specific tasks to a team of expert sub-agents.
This tool ensures comprehensive and efficient information gathering from various sources simultaneously.

**Usage Strategy:**
1.  **Concurrent Delegation**: For any complex research task, invoke this tool to dispatch tailored objectives to multiple specialized sub-agents (RAG, GitHub, Context7, Web) concurrently.
2.  **Expert Specialization**: Each sub-agent (rag_agent, github_agent, context7_agent, web_agent) is an expert in its domain. Assign objectives that leverage their unique strengths.
3.  **Synthesis**: The main Assistant will analyze and synthesize the results from all experts to formulate a comprehensive and accurate final response, applying the "Corroborated Truth" protocol.
`.trim(),
  parametersJsonSchema: {
    type: 'object',
    properties: {
      rag_agent: {
        type: 'object',
        description: `
**Expert: Static RAG Knowledge Base Analyst**
Specialized in performing high-speed semantic search within internal, static RAG file stores.
Provides **structured, highly relevant internal documentation, configuration details, and known solutions.**
**Characteristics**: High hit rate, high retrieval efficiency, but knowledge may be outdated.
`.trim(),
        properties: {
          ...SYSTEM_PROMPT_PROPERTY,
          ...OBJECTIVE_PROPERTY,
          file_search_stores: {
            type: 'array',
            description:
              'The specific internal knowledge bases to search against. Select ALL stores that might contain relevant info.',
            items: {
              type: 'string',
              format: 'enum',
              enum: getFileSearchStoreDisplayNames(),
            },
            minItems: 2,
          },
        },
        required: ['objective', 'file_search_stores'],
        additionalProperties: false,
      },
      github_agent: {
        type: 'object',
        description: `
**Expert: GitHub Code & Issue Analyst**
Specialized in searching GitHub repositories, issues, code, and releases.
Provides the **latest factual information, real-time code changes, and community discussions.**
**Characteristics**: Ensures latest facts, but with a potentially lower hit rate and efficiency due to dynamic codebases.
**Capabilities**: Repository & Code Interaction, Issue & Pull Request Management, CI/CD & Workflow Automation, Code Security & Analysis, Collaboration & Project Management.
`.trim(),
        properties: {
          ...SYSTEM_PROMPT_PROPERTY,
          ...OBJECTIVE_PROPERTY,
        },
        required: ['objective'],
        additionalProperties: false,
      },
      context7_agent: {
        type: 'object',
        description: `
**Expert: Context7 Cached Knowledge Specialist**
Specialized in retrieving **up-to-date, version-specific documentation and code examples** for software libraries, frameworks, or APIs from Context7's cached knowledge base.
**Characteristics**: Medium hit rate, medium retrieval efficiency, provides modern code/API information.
**Capabilities**: Library Identification, Documentation Retrieval (with version specificity).
`.trim(),
        properties: {
          ...SYSTEM_PROMPT_PROPERTY,
          ...OBJECTIVE_PROPERTY,
        },
        required: ['objective'],
        additionalProperties: false,
      },
      web_agent: {
        type: 'object',
        description: `
**Expert: Real-time Web Information Gatherer**
Specialized in executing broad Google Searches and fetching full web page content to retrieve **current events, real-time data, or broad internet knowledge.**
**Characteristics**: Broad discovery, real-time data, but often unstructured and potentially noisy.
**Capabilities**: Google Search, Web Page Content Retrieval.
`.trim(),
        properties: WEB_RESEARCH_TOOL.parametersJsonSchema.properties,
        required: ['objective'],
        additionalProperties: false,
      },
    },
    required: ['rag_agent', 'github_agent', 'context7_agent', 'web_agent'],
    additionalProperties: false,
  },
} as const satisfies GeneralFunctionSchema;

/**
 * Tools for performing computations or logic execution.
 */
const COMPUTATION_TOOLS = [
  {
    name: 'code_execution',
    description: `
Provides a Python execution environment for mathematical calculations, data analysis, string manipulation, algorithmic logic, **and can perform web searches if required by its objective.**

**Usage Strategy:**
- **Be Proactive**: Do NOT wait for the user to ask "can you calculate this?". If a user's request involves ANY math, complex logic, data parsing, or requires up-to-date information that can be found via web search, you MUST use this tool immediately to ensure accuracy.
- **Verification**: Never rely on your internal training data for calculations (e.g., Fibonacci numbers, date differences, complex JSON parsing). Always execute code to verify.
- **Web-Enhanced Logic**: If a calculation or data task requires external, real-time data (e.g., "current stock price", "latest API endpoint"), include instructions in the objective for the code execution environment to use web search to fetch that data before performing computations.

**Collaborative Strategy:**
- **Data Pipeline**: If you acquire raw data (e.g., CSV, JSON formats) from external URLs, research tasks, or user inputs, use this tool to parse, filter, and analyze that data programmatically.
`.trim(),
    parametersJsonSchema: {
      type: 'object',
      properties: {
        ...SYSTEM_PROMPT_PROPERTY,
        ...OBJECTIVE_PROPERTY,
      },
      required: ['objective'],
    },
  },
] as const satisfies GeneralFunctionSchema[];

const SEEK_CLARIFICATION_TOOL = {
  name: 'seek_clarification',
  description: `
Proactively requests further information or verification from the user to resolve ambiguity, gather diagnostic details, or confirm factual discrepancies. When this tool is called, you **MUST immediately pause your response** and await user input.

**Usage Strategy:**
- **Ambiguity Resolution**: Use when the user's request is vague or lacks critical details required to proceed (e.g., "My software isn't working").
- **Diagnostic Information**: Employ to gather necessary diagnostic data for problem-solving (e.g., specific error messages, versions, operating systems).
- **Factual Discrepancy Verification**: Trigger when internal research or knowledge contradicts the user's initial statement, requiring confirmation before continuing (e.g., verifying a product name or version).
- **Guided Input**: Provide a list of predefined, **comprehensive response scenarios for the user** to select from or use as a guide for their reply. Each answer **MUST provide a combined response to the full scope of the multi-part \`question\`**, phrased in the first-person perspective (e.g., '我使用的是 X 客户端，操作系统是 Y，遇到了 Z 问题').

**Call Flow**:
1.  Identify the need for clarification or verification.
2.  Formulate a precise 'question'.
3.  Craft a list of concise, pure-text 'answers' that represent complete, user-perspective response scenarios.
4.  Call this tool and then stop processing, awaiting the user's reply.

**Constraint**: Each item in 'answers' MUST be a single, short sentence and contain NO MARKDOWN, NO FURTHER QUESTIONS, just direct user statements in the first-person, providing a combined response.
`.trim(),
  parametersJsonSchema: {
    type: 'object',
    properties: {
      ...BLOCKING_RESPONSE_PROPERTY,
      question: {
        type: 'string',
        description: 'All relevant issues that need to be clarified by the user.',
        minLength: 10,
        maxLength: 2000,
      },
      answers: {
        type: 'array',
        description:
          'A list of predefined, concise, pure-text comprehensive user response options for the user to select from or use as a guide. Each answer MUST be in the first-person perspective and provide a combined response to the full scope of the multi-part question (e.g., "我使用的是 GUI.for.SingBox 客户端，操作系统是 Windows，启动时没有反应。"). NO MARKDOWN, NO FURTHER QUESTIONS, single concise combined statement per item.',
        items: {
          type: 'string',
          description:
            'A single, concise, pure-text hypothetical combined response option from the user\'s first-person perspective, addressing all parts of the question (e.g., "我是用的是 GUI.for.SingBox，操作系统是 Windows，并且没有看到任何错误提示"). NO MARKDOWN, NO LENGTHY TEXT, NO QUESTIONS.',
        },
        minItems: 2,
        maxItems: 10,
      },
    },
    required: ['question', 'answers'],
    additionalProperties: false,
  },
} as const satisfies GeneralFunctionSchema;

/**
 * Tools for user interaction and file delivery.
 */
const INTERACTIVE_TOOLS = [
  {
    name: 'reply_file',
    description: `
Generates and sends a downloadable file artifact to the user. This is the **REQUIRED** method for delivering any content that is primarily intended for local storage, execution, or detailed review as a file.

**Usage Strategy:**
1. **Chat Hygiene**: You MUST use this tool proactively to prevent "Wall of Text" syndrome. Do NOT flood the chat interface with massive amounts of text.
2. **Specific Scope**: This tool applies to **code, configuration files, raw data, detailed technical reports, or extensive markdown documents** that are better consumed as a downloadable file for local access, execution, or storage.
3. **Threshold**: As a rule of thumb, use this tool for any content exceeding **50 lines** or approximately **1000 characters** that fits the 'downloadable artifact' criteria.
4. **Exclusions**: Do NOT use this tool for narrative articles, blog posts, tutorials, or documentation primarily intended for web-based reading. For such content, consider web publishing tools.
5. **Proactive Decision**: Do not wait for the user to ask "can you send this as a file?". If the response is a long code block, configuration, or data, deliver it as a file immediately.

**Supported Formats:**
- **Code/Config**: .ts, .js, .py, .json, .yaml, .conf
- **Data**: .csv, .log
- **Documentation (for local use/storage)**: .md, .txt, .pdf (text-based)
`.trim(),
    parametersJsonSchema: {
      type: 'object',
      properties: {
        ...BLOCKING_RESPONSE_PROPERTY,
        message_id: {
          type: 'number',
          description: 'The numeric ID of the user message that this file is responding to.',
        },
        content: {
          type: 'string',
          description:
            'The complete raw content of the response (article, code, data, etc.). Do NOT include markdown code blocks or any other escaping; provide the exact literal content of the file.',
        },
        name: {
          type: 'string',
          description:
            'The descriptive filename including the appropriate extension (e.g., "detailed_analysis.md", "optimized_script.py", "market_report.txt").',
        },
        type: {
          type: 'string',
          description:
            'The standard IANA Media Type (MIME type) (e.g., "text/markdown", "application/json", "text/plain").',
        },
        describe: {
          type: 'string',
          description: 'Brief description of the file.',
        },
      },
      required: ['message_id', 'content', 'name', 'type'],
    },
  },
  {
    name: 'react',
    description: `
Applies an expressive emoji reaction to a specific message to enhance conversational engagement.

**Usage Strategy:**
- **Autonomy**: You must evaluate the emotional context of the user's message. Is it funny? Impressive? Confusing? Worthy of celebration?
- **Variety**: Use the FULL range of allowed emojis to match the specific nuance. Don't default to just '👍'.
- **Constraint**: Strict Rate Limit: Maximum 1 reaction per turn. Do NOT react to every single message; reserve it for significant moments.

**Scenarios example:**
- **Resolved/Success**: \`👍\`, \`👌\`
- **Looking into it**: \`👀\`, \`👨‍💻\`
- **Funny/Witty**: \`🤣\`, \`😁\`
- **Great/Impressive**: \`🔥\`, \`👏\`, \`🏆\`
- **Confused/Ambiguous**: \`🤔\`, \`🤨\`
- **Love/Thanks**: \`🥰\`, \`🙏\`
`.trim(),
    parametersJsonSchema: {
      type: 'object',
      properties: {
        ...BLOCKING_RESPONSE_PROPERTY,
        message_id: {
          type: 'number',
          description: 'The numeric identifier of the specific user message you are reacting to.',
        },
        reaction: {
          type: 'string',
          format: 'enum',
          enum: ALLOWED_REACTIONS,
          description: `The specific emoji to apply. Select the most appropriate emotion from the allowed list.`,
        },
      },
      required: ['message_id', 'reaction'],
      additionalProperties: false,
    },
  },
  {
    name: 'publish_post',
    description: `
Publishes a long-form article, document, or tutorial as a web-based post. This tool is designed for content that is best consumed as a shareable web article rather than a downloadable file.

**Usage Strategy:**
- **Primary Use**: Use this tool for generating and publishing human-readable, narrative text, explanations, and descriptive content such as articles, blog posts, tutorials, or comprehensive documentation that benefits from a web format for easy sharing and viewing.
- **Content Restriction**: Content **MUST NOT** include lengthy code blocks or configuration files. This tool is for narrative and explanatory text only.
- **Differentiate from File Delivery**: Do NOT use this for content types primarily intended for local storage, execution, or file-based sharing, such as code snippets, raw data, or very large, complex markdown documents meant for local editing.
- **Content Format**: The content provided MUST be in standard Markdown format.
- **Proactive Decision**: If the generated content is an article, tutorial, or similar long-form narrative text, proactively publish it rather than waiting for user instruction.

**Supported Content Examples:**
- **Articles**: Blog posts, analyses, reports (when suitable for web publication, without code/config).
- **Tutorials**: Step-by-step guides, how-to's (focus on explanation, not code dump).
- **Documentation**: Explanations, overviews designed for web readership.
`.trim(),
    parametersJsonSchema: {
      type: 'object',
      properties: {
        title: {
          type: 'string',
          description: 'The title of the web page (1-256 characters).',
          minLength: 1,
          maxLength: 256,
        },
        content: {
          type: 'string',
          description: 'The complete raw content of the post in standard Markdown format.',
        },
      },
      required: ['title', 'content'],
      additionalProperties: false,
    },
  },
] as const satisfies GeneralFunctionSchema[];

/**
 * Tools for store management.
 */
const STORE_TOOLS = [
  {
    name: 'save_memory',
    description: `
Persists information to your long-term memory for future conversations.

**Usage Strategy:**
- **Be Proactive**: Do NOT wait for the user to say "remember this".
- **Evaluate Importance**: If the user mentions a specific preference (e.g., "I always use Port 8080"), a setup detail ("My server is Ubuntu 22.04"), or a personal fact, you MUST decide if this is worth remembering.
- **Criteria**: If knowing this fact later will save the user from repeating themselves, SAVE IT.
- **Constraints**: Do not save transient info (e.g., "I'm eating lunch now") or context that is only relevant to the current session.
`.trim(),
    parametersJsonSchema: {
      type: 'object',
      properties: {
        user_id: {
          type: 'number',
          description:
            'The owner of this memory, if this parameter is not provided, this memory will be saved as group memory.',
        },
        fact: {
          type: 'string',
          description:
            'A concise, standalone statement of fact. (e.g., "User prefers SingBox config in JSON format", "User environment is MacOS").',
        },
      },
      required: ['fact'],
    },
  },
] as const satisfies GeneralFunctionSchema[];

/**
 * Tools for multimodal content generation and visual reasoning.
 */
/* const IMAGE_TOOLS = [
  {
    name: 'generate_image',
    description: `
Delegates image generation and visual reasoning to multimodal engine.
This tool is designed for professional asset production, utilizing advanced "Thinking" to follow complex, multi-turn instructions and render high-fidelity text.

**Capabilities:**
1. **Visual Logic & CoT**: Can visualize complex processes (e.g., "Photosynthesis as a recipe", "Algorithm flowcharts", "Mind maps").
2. **Search-Grounded Visuals**: If you possess web search capabilities, use them to gather real-time data (weather, sports scores, market trends) and then use this tool to generate accurate infographics or charts.
3. **Sequential Storytelling**: Capable of creating comic panels, storyboards, or multi-step visual guides with character consistency.
4. **Professional Assets**: High-end product mockups, 4K resolution textures, and stylized icons/stickers.

**Usage Strategy:**
- **BE PROACTIVE**: Do NOT wait for a user to ask for an image. If a response involves a complex "How-to", a technical workflow, or a data-heavy comparison, you MUST use this tool to provide a supporting visual infographic.
- **Narrative Prompts**: Do not just list keywords. Describe the scene, lighting, camera angle, and mood in a narrative paragraph to maximize the sub-agent's reasoning performance.
- **Multimodal Iteration**: If a generated image needs adjustment, use this tool again, providing the original context and specific modification instructions.

**Effective Scenarios:**
- "Convert this text-based tutorial into a 4th-grader-friendly infographic."
- "Generate a visual comparison chart of these three server architectures."
- "Create a professional magazine-style product mockup for this configuration."
`.trim(),
    parametersJsonSchema: {
      type: 'object',
      properties: {
        ...BLOCKING_RESPONSE_PROPERTY,
        message_id: {
          type: 'number',
          description: 'The numeric ID of the user message that this image is responding to.',
        },
        prompt: {
          type: 'string',
          description: `
The comprehensive, narrative description of the image to be generated.
**Formula**: [Shot Type/Camera Angle] of [Subject] [Action/Expression], set in [Environment] with [Lighting/Atmosphere].
(e.g., "A photorealistic wide-angle shot of a futuristic data center with neon blue cooling pipes, soft ambient lighting, 4K resolution.")
`.trim(),
        },
        image_config: {
          type: 'object',
          properties: {
            aspect_ratio: {
              type: 'string',
              description: 'The target aspect ratio for the visual asset.',
              format: 'enum',
              enum: ['1:1', '2:3', '3:2', '3:4', '4:3', '4:5', '5:4', '9:16', '16:9', '21:9'],
            },
            image_size: {
              type: 'string',
              description: 'The desired resolution. Higher resolutions (2K/4K) require more reasoning time.',
              format: 'enum',
              enum: ['1K', '2K', '4K'],
            },
          },
          required: ['aspect_ratio', 'image_size'],
          additionalProperties: false,
        },
      },
      required: ['prompt'],
      additionalProperties: false,
    },
  },
] as const satisfies GeneralFunctionSchema[]; */

export const RESEARCH_BOT_TOOLS = (mcpServers: LoadedMcpServer[]) =>
  [DEEP_RESEARCH_TOOL, ...CHAT_BOT_TOOLS(mcpServers), SEEK_CLARIFICATION_TOOL] satisfies GeneralFunctionSchema[];

export const CHAT_BOT_TOOLS = (mcpServers: LoadedMcpServer[]) =>
  [
    WEB_RESEARCH_TOOL,
    DELEGATE_AGENT_TOOL(mcpServers),
    ...VIDEO_TOOLS,
    ...COMPUTATION_TOOLS,
    ...INTERACTIVE_TOOLS,
    ...STORE_TOOLS,
  ] satisfies GeneralFunctionSchema[];
