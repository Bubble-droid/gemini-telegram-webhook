import { BotConfig, TelegramError, Log } from '@/services';
import { botCommands } from '@/configs';
import type {
  TelegramApiMethod,
  TelegramApiResponse,
  HttpMethod,
  ParseMode,
  File,
  SendMessageParams,
  SendMessageResult,
  EditMessageTextParams,
  EditMessageTextResult,
  DeleteMessageParams,
  DeleteMessageResult,
  SetBotCommandParams,
  SetBotCommandResult,
  GetFileParams,
  GetFileResult,
} from '@/types';
import { markdownToHtml } from '@/utils';

/**
 * @class TelegramBot
 * @description 封装与 Telegram Bot API 的交互逻辑。
 */
export class TelegramBot {
  /**
   * 发送 API 请求的通用方法。
   * @private
   * @param {HttpMethod} httpMethod
   * @param {TelegramApiMethod} apiMethod Telegram Bot API 方法名 (例如 'sendMessage')
   * @param {P} body - 请求体参数
   * @returns {Promise<T>} API 响应对象
   */
  private static async sendRequest<P, T>(httpMethod: HttpMethod, apiMethod: TelegramApiMethod, body: P): Promise<T> {
    const { botApiUrl } = BotConfig.load();
    const url = `${botApiUrl}/${apiMethod}`;
    try {
      const response = await fetch(url, {
        method: String(httpMethod).toUpperCase(),
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(body),
      });

      const parsed = (await response.json()) as TelegramApiResponse<T>;

      if (!parsed.ok) {
        const desc = parsed.description;
        const errCode = `API_FAILED_${String(apiMethod).toUpperCase()}_${response.status}`;
        Log.error(`Telegram API request failed for ${apiMethod}`, {
          apiMethod,
          requestBody: body,
          statusCode: response.status,
          responseBody: parsed,
          customError: new TelegramError(`Telegram API error: ${desc}`, errCode),
        });
        throw new TelegramError(`Telegram API error: ${desc}`, errCode);
      }

      // 分开处理网络层面的错误，逻辑更清晰
      if (!response.ok) {
        const desc = `HTTP request failed with status: ${response.status}`;
        const errCode = `HTTP_ERROR_${response.status}`;
        Log.error(`Telegram API request failed for ${apiMethod}`, {
          apiMethod,
          requestBody: body,
          statusCode: response.status,
          responseBody: parsed,
          customError: new TelegramError(desc, errCode),
        });
        throw new TelegramError(desc, errCode);
      }

      // 只有当 parsed.ok 和 response.ok 都为 true 时，才认为请求成功
      return parsed.result;
    } catch (error: unknown) {
      // 捕获 fetch 本身的网络错误或其他意外异常
      if (error instanceof TelegramError) {
        // 如果是已经处理过的 TelegramError，直接重新抛出
        throw error;
      }
      Log.error(`Error sending request to ${apiMethod}`, {
        apiMethod,
        requestBody: body,
        err: error as Error,
        customError: new TelegramError(
          `Network error sending request to ${apiMethod}: ${error instanceof Error ? error.message : String(error)}`,
          'NETWORK_ERROR',
        ),
      });
      // 抛出统一的 TelegramError 类型
      throw new TelegramError(
        `Network error sending request to ${apiMethod}: ${error instanceof Error ? error.message : String(error)}`,
        'NETWORK_ERROR',
      );
    }
  }

  /**
   * 向指定聊天发送文本消息。
   * @param {number} chatId - 接收消息的聊天 ID。
   * @param {string} text - 要发送的文本内容。
   * @param {number} [replyToMessageId] - 可选参数：如果此消息是对特定消息的回复，则指定被回复消息的 ID。
   * @returns {Promise<{ ok: boolean; messageId?: number }>} 消息发送成功返回 `true`，否则返回 `false`。
   */
  public static async sendMessage(
    chatId: number,
    text: string,
    parseMode?: ParseMode,
    replyToMessageId?: number,
    isFormat: boolean = true,
  ): Promise<{ ok: boolean; messageId?: number; error?: TelegramError }> {
    const payload: SendMessageParams = {
      chat_id: chatId,
      text: isFormat ? markdownToHtml(text) : text,
      parse_mode: parseMode,
      link_preview_options: {
        is_disabled: true,
      }, // 更现代的写法
      reply_parameters: replyToMessageId
        ? {
            message_id: replyToMessageId,
            allow_sending_without_reply: true,
          }
        : undefined,
    };
    try {
      const result = await TelegramBot.sendRequest<SendMessageParams, SendMessageResult>('POST', 'sendMessage', payload);
      Log.info('Telegram message sent successfully.', {
        chatId,
        messageId: result.message_id,
      });
      return {
        ok: true,
        messageId: result.message_id,
      };
    } catch (error: unknown) {
      Log.error('Error sending Telegram message', {
        err: error as Error,
        chatId,
        text: text.substring(0, 100) + '...',
      });
      return {
        ok: false,
        error: error as TelegramError,
      };
    }
  }

  /**
   * 编辑已发送的文本消息。
   * @param {number} chatId - 聊天 ID。
   * @param {number} messageId - 要编辑的消息 ID。
   * @param {string} text - 新的文本内容。
   * @returns {Promise<{ ok: boolean; messageId?: number }>} 消息编辑成功返回 `true`，否则返回 `false`。
   */
  public static async editMessageText(
    chatId: number | string,
    messageId: number,
    text: string,
    parseMode?: ParseMode,
    isFormat: boolean = true,
  ): Promise<{ ok: boolean; messageId?: number; error?: TelegramError }> {
    const payload: EditMessageTextParams = {
      chat_id: chatId,
      message_id: messageId,
      text: isFormat ? markdownToHtml(text) : text,
      parse_mode: parseMode,
      link_preview_options: {
        is_disabled: true,
      },
    };
    try {
      const result = await TelegramBot.sendRequest<EditMessageTextParams, EditMessageTextResult>('POST', 'editMessageText', payload);
      Log.info('Telegram message edited successfully.', {
        chatId,
        messageId: result.message_id,
      });
      return { ok: true, messageId: result.message_id };
    } catch (error: unknown) {
      Log.error('Error editing Telegram message', {
        err: error as Error,
        chatId,
        messageId,
        text: text.substring(0, 100) + '...',
      });
      return { ok: false, error: error as TelegramError };
    }
  }

  /**
   * 删除指定聊天中的消息。
   * @param {number} chatId - 聊天ID。
   * @param {number} messageId - 消息ID。
   * @returns {Promise<{ ok: boolean }>} 成功返回 `{ ok: true }`，失败返回 `{ ok: false }`。
   */
  public static async deleteMessage(chatId: number | string, messageId: number): Promise<{ ok: boolean; error?: TelegramError }> {
    const payload: DeleteMessageParams = {
      chat_id: chatId,
      message_id: messageId,
    };
    try {
      await TelegramBot.sendRequest<DeleteMessageParams, DeleteMessageResult>('POST', 'deleteMessage', payload);
      Log.info('Telegram message deleted successfully.', { chatId, messageId });
      return { ok: true };
    } catch (error: unknown) {
      Log.error('Error deleting Telegram message', {
        err: error as Error,
        chatId,
        messageId,
      });
      return { ok: false, error: error as TelegramError };
    }
  }

  /**
   * 设置 Bot 命令列表。
   * @param {number} chatId - 聊天 ID，用于指定命令范围。
   * @returns {Promise<{ ok: boolean }>} 成功返回 `{ ok: true }`，否则返回 `{ ok: false }`。
   */
  public static async setBotCommands(chatId: number | string, userId: number): Promise<{ ok: boolean; error?: TelegramError }> {
    const payload: SetBotCommandParams = {
      commands: botCommands.map((command) => ({
        command: command.name,
        description: command.description,
      })),
      scope: {
        type: 'chat_member',
        chat_id: chatId,
        user_id: userId,
      },
    };
    try {
      await TelegramBot.sendRequest<SetBotCommandParams, SetBotCommandResult>('POST', 'setMyCommands', payload);
      Log.info('Bot commands set successfully.', { chatId });
      return { ok: true };
    } catch (error: unknown) {
      Log.error('Error setting bot commands', { err: error as Error, chatId });
      return { ok: false, error: error as TelegramError };
    }
  }

  /**
   * 获取文件信息，包括文件路径。
   * @param {string} fileId - 文件的唯一 ID。
   * @returns {Promise<File| undefined>} 文件信息对象，如果获取失败则返回 `undefined`。
   */
  public static async getFile(fileId: string): Promise<{ ok: boolean; data: File } | { ok: false; error: TelegramError }> {
    Log.info(`Getting file info for file_id: ${fileId}`);
    try {
      const result = await TelegramBot.sendRequest<GetFileParams, GetFileResult>('POST', 'getFile', {
        file_id: fileId,
      });
      return { ok: true, data: result };
    } catch (error: unknown) {
      Log.error(`Error in getFile for file_id ${fileId}`, {
        err: error as Error,
        fileId,
      });
      return { ok: false, error: error as TelegramError };
    }
  }
}
