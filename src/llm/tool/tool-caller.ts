import { longTermMemory } from '@data/long-term-memory.js';
import { FunctionCallingConfigMode, type Content } from '@google/genai';
import type { InlineKeyboardButton } from '@grammyjs/types';
import type { GeminiAgent } from '@llm/agent/gemini-agent.js';
import type { OpenAiAgent } from '@llm/agent/openai-agent.js';
import { mergeSystemPrompt } from '@llm/lib/helper.js';
import type { McpClient } from '@llm/mcp/mcp-client.js';
import type { StandardizedFunctionResponse } from '@llm/types/agent.js';
import type { InferToolArgs, ToolCallerInjectedDeps, ToolCallers } from '@llm/types/tool.js';
import { logger } from '@shared/core/logger.js';
import { markdownToMarkdownV2, markdownToMarkdownV2Chunks } from '@shared/markdown/telegram-converter.js';
import { addCitations } from '@shared/utils/citation-generate.js';
import { makeFile, ms } from '@shared/utils/helpers.js';

interface ToolCallerDeps {
  geminiApiAgent: GeminiAgent;
  geminiCliAgent: GeminiAgent;
  gemmaAgent: GeminiAgent;
  openAiAgent: OpenAiAgent;
  mcpClient: McpClient;
}

export const createToolCaller = (deps: ToolCallerDeps): ToolCallerInjectedDeps => {
  const { geminiApiAgent, mcpClient } = deps;
  return (ctx, updateStatus) => {
    const fileSearch = async (
      args: InferToolArgs<'deep_research'>['rag_agent'],
    ): Promise<StandardizedFunctionResponse> => {
      const { objective, file_search_stores, system_prompt } = args;
      if (file_search_stores.length === 0) {
        logger.warn(`No file search stores provided.`);
        return { response: { error: 'No file search stores provided.' } };
      }
      if (
        file_search_stores.includes('documents/gui-for-cores') &&
        !file_search_stores.includes('sourcecode/plugin-hub')
      ) {
        file_search_stores.push('sourcecode/plugin-hub');
      }
      const contents: Content[] = [{ role: 'user', parts: [{ text: objective }] }];
      const result = await geminiApiAgent.run(contents, {
        updateStatus,
        generateConfig: {
          temperature: 0.7,
          systemInstruction: [{ text: mergeSystemPrompt(system_prompt) }],
          tools: [{ fileSearch: { fileSearchStoreNames: file_search_stores } }],
        },
      });
      return {
        response: {
          output: JSON.stringify({
            queryResults: addCitations(result),
            groundingMetadata: result.candidates?.[0]?.groundingMetadata,
          }),
        },
      };
    };

    const webResearch = async (args: InferToolArgs<'web_research'>): Promise<StandardizedFunctionResponse> => {
      const { objective, system_prompt } = args;
      const contents: Content[] = [{ role: 'user', parts: [{ text: objective }] }];
      const result = await geminiApiAgent.run(contents, {
        updateStatus,
        generateConfig: {
          temperature: 0.7,
          systemInstruction: [{ text: mergeSystemPrompt(system_prompt) }],
          tools: [{ googleSearch: {} }, { urlContext: {} }],
        },
      });
      return {
        response: {
          output: JSON.stringify({
            researchResults: addCitations(result),
            groundingMetadata: result.candidates?.[0]?.groundingMetadata,
          }),
        },
      };
    };

    const delegateToAgent = async (args: InferToolArgs<'delegate_to_agent'>): Promise<StandardizedFunctionResponse> => {
      const { agent_name, objective, system_prompt } = args;
      const contents: Content[] = [{ role: 'user', parts: [{ text: objective }] }];
      const result = await geminiApiAgent.run(contents, {
        updateStatus,
        callTool: (name, args) => {
          return mcpClient.callTool(name, args);
        },
        generateConfig: {
          temperature: 0.4,
          systemInstruction: [{ text: mergeSystemPrompt(system_prompt) }],
          tools: [{ functionDeclarations: mcpClient.getTools(agent_name.toLowerCase()) }],
          toolConfig: { functionCallingConfig: { mode: FunctionCallingConfigMode.AUTO } },
        },
      });
      return { response: { output: result.text! } };
    };

    const toolCallers: ToolCallers = {
      deep_research: async (args) => {
        const agentNames = Object.keys(args);
        if (agentNames.length === 0) return { response: { error: 'No arguments provided.' } };

        const statusRegistry = new Map(
          agentNames.map((name) => [
            name,
            { objective: args[name as keyof typeof args].objective.slice(0, 200), symbol: '' },
          ]),
        );

        const refreshUI = async () => {
          const content = [...statusRegistry.entries()]
            .map(([name, info]) => `🤖 Sub-Agent: ${name} ${info.symbol}\n👨‍💻 Task: ${info.objective}...`)
            .join('\n\n');
          await updateStatus?.(`<research>\n${content}\n</research>`);
        };

        await refreshUI();
        const allTasks = agentNames.map(
          async (name): Promise<{ agent_name: string; result?: StandardizedFunctionResponse; error?: string }> => {
            let result: StandardizedFunctionResponse | undefined;
            let symbol = '❌';

            try {
              switch (name) {
                case 'rag_agent':
                  result = await fileSearch(args[name]);
                  break;
                case 'web_agent':
                  result = await webResearch(args[name]);
                  break;
                case 'github_agent':
                  result = await delegateToAgent({ agent_name: 'github', ...args[name] });
                  break;
                case 'context7_agent':
                  result = await delegateToAgent({ agent_name: 'context7', ...args[name] });
                  break;
                default:
                  symbol = '[UNSUPPORTED]';
                  statusRegistry.get(name)!.symbol = symbol;
                  await refreshUI();
                  return { agent_name: name, error: `Unknown agent: ${name}` };
              }

              if (result.response.output) symbol = '✅';
            } catch (_err) {
              // Keep symbol as '❌'
            }
            statusRegistry.get(name)!.symbol = symbol;
            await refreshUI();

            return result?.response.output
              ? { agent_name: name, result }
              : { agent_name: name, error: `Agent ${name} failed or returned no output` };
          },
        );

        const allResults = await Promise.all(allTasks);
        return { response: { output: allResults } };
      },

      web_research: webResearch,

      delegate_to_agent: delegateToAgent,

      analyze_youtube_video: async (args) => {
        const { objective, video_url, system_prompt } = args;
        const contents: Content[] = [
          {
            role: 'user',
            parts: [
              {
                fileData: {
                  fileUri: video_url,
                },
              },
              { text: objective },
            ],
          },
        ];
        const result = await geminiApiAgent.run(contents, {
          updateStatus,
          generateConfig: {
            temperature: 0.7,
            systemInstruction: [{ text: mergeSystemPrompt(system_prompt) }],
            tools: [{ googleSearch: {} }],
          },
        });
        return { response: { output: result.text! } };
      },

      code_execution: async (args) => {
        const { objective, system_prompt } = args;
        const contents: Content[] = [{ role: 'user', parts: [{ text: objective }] }];
        const result = await geminiApiAgent.run(contents, {
          updateStatus,
          generateConfig: {
            temperature: 0,
            systemInstruction: [{ text: mergeSystemPrompt(system_prompt) }],
            tools: [{ codeExecution: {} }, { googleSearch: {} }],
          },
        });
        return { response: { output: addCitations(result) } };
      },

      reply_file: async (args) => {
        const { message_id, content, name, type, describe } = args;
        const file = makeFile(content, name, type);
        const result = await ctx.replyWithDocument(file, {
          ...(describe && { caption: markdownToMarkdownV2Chunks(describe)[0] }),
          parse_mode: 'MarkdownV2',
          deleteAfterMs: ms['1d'],
          replyToMessageId: message_id,
        });
        return { response: { output: JSON.stringify(result) } };
      },

      publish_post: async (args) => {
        const { title, content } = args;
        const page = await ctx.api.publishTelegraphPost(title, content);
        return { response: { output: JSON.stringify(page) } };
      },

      react: async (args) => {
        const { message_id, reaction } = args;
        const result = await ctx.react(reaction, message_id);
        return { response: { output: JSON.stringify(result) } };
      },

      seek_clarification: async (args) => {
        const { question, answers } = args;
        const InlineKeyboardButtons: InlineKeyboardButton[][] = [
          answers.map((_a, i): InlineKeyboardButton => {
            return {
              text: String(i + 1),
              callback_data: `answer_${ctx.user.id}_${i}`,
            };
          }),
        ];

        const candidate = answers.map((a, i) => `${i + 1}. ${a}`).join('\n');
        const text = `${question}\n\n<select>\n${candidate}\n</select>`;
        const result = await ctx.reply(markdownToMarkdownV2(text), {
          replyToMessageId: ctx.message?.message_id,
          reply_markup: { inline_keyboard: InlineKeyboardButtons },
          parse_mode: 'MarkdownV2',
          deleteAfterMs: ms['1d'],
        });
        return { response: { output: JSON.stringify(result) } };
      },

      save_memory: (args) => {
        const { user_id, fact } = args;
        return { response: { output: longTermMemory.addMemory(user_id ?? ctx.chat.id, fact) } };
      },

      /*  generate_image: async (args) => {
      const { message_id, prompt, aspect_ratio, image_size, system_prompt } = args;
      const model = multimodalModelRotator.next();
      const contents: Content[] = [
        {
          role: 'user',
          parts: [{ text: prompt }],
        },
      ];
      const result = await geminiCliAgent.run(contents, {
        updateStatus,
        generateConfig: {
          temperature: 0.7,
          systemInstruction: [{ text: mergeSystemPrompt(system_prompt) }],
          responseModalities: ['TEXT', 'IMAGE'],
          imageConfig: {
            aspectRatio: aspect_ratio,
            ...(model.startsWith('gemini-3') && image_size && { imageSize: image_size }),
          },
          ...(model.startsWith('gemini-3') && { tools: [{ googleSearch: {} }] }),
        },
        generateModel: 'gemini-2.5-flash-image',
      });
      const imageData = result.candidates?.[0]?.content?.parts?.find((p) => p.inlineData?.data);
      if (!imageData) {
        return { response: { error: 'Failed to generate image, missing valid image data.' } };
      }
      const buffer = Buffer.from(imageData.inlineData!.data!, 'base64');
      const photo = makeFile(buffer, `generated-by-${model}.png`, imageData.inlineData?.mimeType ?? 'image/png');
      const res = await ctx.api.sendPhoto(ctx.chat.id, photo, {
        deleteAfterMs: ms['1d'],
        replyToMessageId: message_id,
      });
      if (!res.ok) {
        return { response: { error: `Failed to send image. ${res.error}` } };
      }
      return {
        response: { output: 'Image generated successfully.', ...(result.text && { result: result.text }) },
        parts: [imageData],
      };
    }, */
    };

    return toolCallers;
  };
};
