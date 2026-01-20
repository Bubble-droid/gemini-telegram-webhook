import { chatContext, config, logger } from '@/services';
import { geminiApi } from '@/services/apis';
import type { ChitChatState, Recordable } from '@/types';
import type { ResponseContext } from '@/utils';
import { formatTime, handleMediaFiles, hasImage, MsgPTTL, promptStore } from '@/utils';
import { toHtml } from '@/utils/markdown';
import type { Content, Part } from '@google/genai';
import type { Chat, Message, MessageOrigin, User } from 'grammy/types';

// 绝对沉默期：上次回复后，至少要累积这么多“注意力分”才开始从 0 计算概率
// 相当于人类说完话后的“贤者时间”
const MIN_ATTENTION_SCORE = 2;

// 必发期：如果注意力分累积到这个值，概率强制为 100%
// 相当于“实在忍不住了”
const MAX_ATTENTION_SCORE = 15;

const HISTORY_LIMIT = 16;

/**
 * 格式化用户身份信息 (包含 ID 以区分同名用户)
 * 格式: "Name (@username) [ID: 123456]"
 */
const formatUserIdentity = (user?: User): string => {
  if (!user) return 'Unknown User [ID: N/A]';

  const nameParts = [user.first_name, user.last_name].filter(Boolean).join(' ');
  const usernamePart = user.username ? `(@${user.username})` : '';

  // 关键：带上 ID，防止 LLM 混淆
  return `${nameParts} ${usernamePart} [UID: ${user.id}]`.trim().replace(/\s+/g, ' ');
};

/**
 * 格式化群组/聊天信息
 * 格式: "Group Title [CID: -100xxx]"
 */
const formatChatIdentity = (chat: Chat): string => {
  const title = chat.title ?? chat.username ?? 'Private Chat';
  return `${title} [CID: ${chat.id}] (${chat.type})`;
};

/**
 * 格式化转发来源
 */
const formatForwardOrigin = (origin?: MessageOrigin): string => {
  if (!origin) return '';

  let source = 'Unknown';
  if (origin.type === 'user') source = formatUserIdentity(origin.sender_user);
  if (origin.type === 'channel') source = `${origin.chat.title} [ID: ${origin.chat.id}]`;
  if (origin.type === 'hidden_user') source = `${origin.sender_user_name} (Hidden)`;
  if (origin.type === 'chat') source = formatChatIdentity(origin.sender_chat);

  return `⏩ Forwarded from: ${source} | Time: ${origin.date ? formatTime(origin.date * 1000) : 'N/A'}`;
};

/**
 * 将 MessageContext 转换为包含丰富元数据的 Markdown
 * 结构：
 * [Chat Info]
 * [Reply Context] (Optional)
 * [Current Message Metadata]
 * [Content]
 */
const formatContextToMarkdown = (ctx: Message): string => {
  const parts: string[] = [];

  // --- 1. 全局环境信息 (Global Context) ---
  // 让 LLM 知道它在哪里说话
  parts.push(`🌍 **Context**: ${formatChatIdentity(ctx.chat)}`);

  // --- 2. 处理回复链 (Reply Context) ---
  if (ctx.reply_to_message) {
    const r = ctx.reply_to_message;
    const replyMeta = `↩️ **Replying to Msg #${r.message_id}**`;
    const replyUser = `👤 ${formatUserIdentity(r.from)}`;
    const replyTime = `🕒 ${r.date ? formatTime(r.date * 1000) : 'N/A'}`;

    // 处理引用内容
    let replyContent = r.text ?? r.caption ?? '[Media/File]';
    // 如果是引用了特定片段
    if (r.quote?.text) {
      replyContent = `❝ Quoted: "${r.quote.text}"\n    -- Full Context: ${replyContent}`;
    }

    // 处理转发信息
    const forwardInfo = r.forward_origin ? `\n    ${formatForwardOrigin(r.forward_origin)}` : '';

    parts.push('---'); // 分割线
    parts.push(`${replyMeta} | ${replyTime}`);
    parts.push(`${replyUser}${forwardInfo}`);
    // 使用引用块格式化内容
    parts.push(`> ${replyContent.replace(/\n/g, '\n> ')}`);
  }

  // --- 3. 当前消息元数据 (Current Message Metadata) ---
  parts.push('---'); // 分割线

  // 核心元数据行
  const msgMeta = `📩 **Current Msg #${ctx.message_id}**`;
  const userMeta = `👤 **Sender**: ${formatUserIdentity(ctx.from)}`;
  const timeMeta = `🕒 ${ctx.date ? formatTime(ctx.date * 1000) : 'N/A'}`;

  parts.push(`${msgMeta} | ${timeMeta}`);
  parts.push(userMeta);

  // --- 4. 转发来源 (如果当前消息是转发的) ---
  if (ctx.forward_origin) {
    parts.push(formatForwardOrigin(ctx.forward_origin));
  }

  // --- 5. 当前引用 (如果用户引用了某句话) ---
  if (ctx.quote?.text) {
    parts.push(`\n> ❝ Quoted: ${ctx.quote.text.replace(/\n/g, '\n> ')}`);
  }

  // --- 6. 消息正文 (Content) ---
  // 留空一行，开始正文
  parts.push(`\n${ctx.text ?? ctx.caption ?? '[Media/File]'}`);

  return parts.join('\n');
};

/**
 * @description 闲聊处理器，负责在非命令、非 FAQ 匹配的情况下，
 *              以回合制触发机制与用户进行自然语言对话。
 *              采用 Map 实现的 Chat ID 粒度状态管理，以支持单例复用。
 */
export class ChitChatHandler {
  private readonly chitChatModel = 'gemma-3-27b-it';
  private locks = new Map<number, Promise<void>>();

  /**
   * 处理消息组
   * 现在的入口方法，确保只处理一次
   */
  public handle(ctx: ResponseContext): Promise<boolean> {
    return this.runSequential(ctx.chat.id, () => {
      return this.handleMessage(ctx);
    });
  }

  /**
   * 获取或初始化聊天状态
   */
  private getChatState(chatId: number): ChitChatState {
    const savedState = chatContext.getChitChatState(chatId);

    if (savedState) {
      return savedState;
    }

    // 初始化新状态
    const newState: ChitChatState = {
      maxScore: MAX_ATTENTION_SCORE, // 这里的 targetTurn 仅作为一种上限参考，实际逻辑动态计算
      currentScore: 0, // 这里存储的是“累积注意力分数 (Attention Score)”
      context: [],
    };

    // 立即持久化初始状态
    chatContext.saveChitChatState(chatId, newState);
    logger.debug(`[ChitChat] Initialized new state for chat ${chatId}`, { currentScore: newState.currentScore });

    return newState;
  }

  /**
   * 保存状态到 DB 的辅助方法
   */
  private saveState(chatId: number, state: ChitChatState): void {
    chatContext.saveChitChatState(chatId, state);
  }

  /**
   * 记录用户消息并裁剪历史记录，确保不会超出上限。
   */
  private recordMessage(state: ChitChatState, content: Content): void {
    if (state.context.length > HISTORY_LIMIT) {
      state.context.shift();
    }
    state.context.push(content);
  }

  /**
   * 调用 Gemini 服务生成响应。
   */
  private async getGeminiResponse(state: ChitChatState): Promise<string | null> {
    const systemPrompt = promptStore.format('chit-chat', {
      selfId: String(config.botId),
      selfName: config.botName,
      currentTime: formatTime(Date.now()),
    });

    // 构造调用 Gemini 的完整历史记录 (包含系统指令)
    const fullContents: Content[] = [
      {
        role: 'user',
        parts: [{ text: systemPrompt }],
      },
      ...state.context,
    ];

    try {
      const response = await geminiApi.generate(fullContents, {
        genModel: this.chitChatModel,
        genConfig: {
          temperature: 1.0,
        },
      });

      if (/silence/gi.test(response.text ?? '')) {
        logger.info(`[ChitChatHandler] Model keep silence.`);
        return null;
      }

      if (response.candidates?.[0]?.content) this.recordMessage(state, response.candidates[0].content);

      return response.text ?? null;
    } catch (err) {
      logger.error('[ChitChatHandler] Gemini API failed', { err });
      return null;
    }
  }

  /**
   * 串行执行器 (Mutex Pattern)
   * 确保同一个 ChatID 的请求严格排队执行，防止竞态条件。
   * 同时包含内存自动清理机制。
   */
  private runSequential<T>(chatId: number, task: () => Promise<T>): Promise<T> {
    // 1. 获取当前队列的尾部（如果不存在，则为一个已完成的 Promise）
    const previousPromise = this.locks.get(chatId) ?? Promise.resolve();

    // 2. 构建当前任务的执行 Promise
    // 无论前一个任务是成功还是失败，都要执行当前任务
    // 注意：这里不需要 catch previousPromise，因为我们在步骤 3 中保证了存储在 Map 里的 Promise 永远是 Resolved 状态
    const currentResultPromise = previousPromise.then(() => {
      logger.trace(`[ChitChat] Task started after queue wait`, { chatId });
      return task();
    });

    // 3. 构建用于维护队列的 "Safe Promise"
    // 这个 Promise 永远不会 Reject，确保队列中的下一个任务总能被调度
    const safeQueuePromise = currentResultPromise
      .catch((err: unknown) => {
        // 记录日志，但不抛出，防止打断后续的任务链
        logger.error(`[ChitChat] Task failed in queue for chat ${chatId}`, { err });
      })
      .then(() => {
        //
      })
      .finally(() => {
        // 4. [内存优化] 自动垃圾回收
        // 检查 Map 中存储的是否还是当前的这个 Promise
        // 如果是，说明在当前任务执行期间没有新任务进来，队列空了，可以安全删除 Key
        if (this.locks.get(chatId) === safeQueuePromise) {
          this.locks.delete(chatId);
          logger.debug(`[ChitChat] Queue cleared for ${chatId}`); // 可选调试日志
        }
      });

    // 5. 更新队列尾部
    this.locks.set(chatId, safeQueuePromise);

    // 6. 返回包含真实结果（可能 Reject）的 Promise 给调用者
    return currentResultPromise;
  }

  /**
   * 计算单条消息的“注意力权重”
   * 模拟人类：图片、长文字更容易吸引注意力；短语则容易被忽略
   */
  private calculateMessageWeight(message: Message): number {
    // 1. 图片消息：信息密度大，权重高
    if (hasImage(message)) return 2.5;

    const text = message.text ?? message.caption ?? '';

    const len = [...text].length;

    // 3. 极短文本 (语气词)：权重极低
    if (len <= 4) return 0.5;

    // 4. 短文本：标准权重
    if (len <= 15) return 1.0;

    // 5. 中长文本：权重稍高
    if (len <= 50) return 2.0;

    // 6. 长篇大论：权重封顶
    return 2.5;
  }

  private isShouldReply(state: ChitChatState, logContext: Recordable): boolean {
    // 逻辑：如果分数 < 最小阈值，必定不回。
    //      如果分数 > 最大阈值，必定回。
    //      中间区间：计算概率 p，随机触发。

    const { currentScore } = state;
    let shouldReply = false;

    if (currentScore < MIN_ATTENTION_SCORE) {
      // 还没引起足够注意，忽略
      logger.trace(
        `[ChitChat] Score accumulating: ${currentScore.toFixed(2)} (Min: ${MIN_ATTENTION_SCORE})`,
        logContext,
      );
      shouldReply = false;
    } else if (currentScore >= MAX_ATTENTION_SCORE) {
      // 忍不住了，必回
      logger.info(`[ChitChat] Max score reached. Triggering reply.`, logContext);
      shouldReply = true;
    } else {
      // 概率判定区间：使用平方函数模拟“越往后越想回”的心理
      // Normalized Position (0 ~ 1)
      const position = (currentScore - MIN_ATTENTION_SCORE) / (MAX_ATTENTION_SCORE - MIN_ATTENTION_SCORE);

      // 概率曲线：P = position ^ 2
      // 举例：进度 20% -> 几率 4%；进度 50% -> 几率 25%；进度 80% -> 几率 64%
      // 这种曲线会让 Bot 倾向于在话题进行了一段时间后介入，而不是刚过阈值就介入
      const probability = Math.pow(position, 2);

      const roll = Math.random();
      const hit = roll < probability;

      if (hit) {
        logger.debug(`[ChitChat] Dice rolled success: ${roll.toFixed(2)} < ${probability.toFixed(2)}`, logContext);
        shouldReply = true;
      } else {
        logger.debug(`[ChitChat] Dice rolled pass: ${roll.toFixed(2)} >= ${probability.toFixed(2)}`, logContext);
        shouldReply = false;
      }
    }

    return shouldReply;
  }

  /**
   * 提取原本的 handle 逻辑到单独的私有方法
   */
  private async handleMessage(ctx: ResponseContext): Promise<boolean> {
    const state = this.getChatState(ctx.chat.id);

    let shouldSave = true;

    const messageParts: Part[] = [];

    const mediaParts = await handleMediaFiles(ctx.messages, hasImage);

    const rawTexts = ctx.messages.map((m) => ctx.getText(m)).filter((t) => t.length > 0);

    if (mediaParts.length === 0 && rawTexts.length === 0) {
      logger.trace(`[ChitChat] No message content.`, { chatId: ctx.chat.id });
      return false;
    }

    messageParts.push(...mediaParts);

    const contextMarkdown = ctx.messages.map(formatContextToMarkdown).join('\n\n---\n\n');

    messageParts.push({ text: contextMarkdown });

    const messageContent: Content = {
      role: 'user',
      parts: messageParts,
    };

    this.recordMessage(state, messageContent);

    // 3. 计算注意力分
    const weight = ctx.messages.map((m) => this.calculateMessageWeight(m)).reduce((a, b) => a + b, 0);

    state.currentScore += weight;

    const logContext = { chatId: ctx.chat.id, currentScore: state.currentScore, maxScore: state.maxScore };

    try {
      // 判定是否触发回复
      if (!this.isShouldReply(state, logContext)) {
        return false;
      }

      const responseText = await this.getGeminiResponse(state);

      if (!responseText) {
        state.currentScore = state.currentScore / 2;
        logger.warn('闲聊处理器未能生成回复，重置回合目标。', logContext);
        return false;
      }

      state.currentScore = 0;

      logger.info(`[ChitChat] Replying.`, logContext);

      await ctx.send(toHtml(responseText), {
        opts: {
          parse_mode: 'HTML',
          deleteAfterMs: MsgPTTL['1d'],
        },
        isReply: false,
      });

      return true;
    } catch (err) {
      logger.error('[ChitChatHandler] Error in handle loop', { err });
      shouldSave = false;
      return false;
    } finally {
      // 5. 统一保存状态 (Write-Back)
      if (shouldSave) {
        this.saveState(ctx.chat.id, state);
      }
    }
  }
}
