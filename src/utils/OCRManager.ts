// src/utils/recognizer.ts

import { AppError } from '@/services';
import { logger } from '@/services/LoggerService';
import { sleep } from '@/utils';
import type { Blob } from '@google/genai';
import { createScheduler, createWorker, type Scheduler } from 'tesseract.js';

// --- 配置常量 ---
// 并行 Worker 数量 (建议设置为 CPU 核心数的一半或更少，OCR 非常吃 CPU)
const WORKER_COUNT = 2;
// 单个 Scheduler 最大处理任务数 (达到此数后将触发重置)
const MAX_JOBS_BEFORE_ROTATION = 200;
// 语言配置
const LANGUAGES = ['eng', 'chi_sim', 'chi_tra'];

/**
 * 内部状态包装器，用于追踪 Scheduler 的负载和生命周期
 */
interface SchedulerWrapper {
  instance: Scheduler;
  jobCount: number; // 累计接收的任务数
  activeJobs: number; // 当前正在执行的任务数
  id: string; // 用于日志调试
}

class OCRManager {
  private currentWrapper: SchedulerWrapper | null = null;
  private isRotating: boolean = false; // 轮换锁
  private cachePath: string;

  constructor() {
    this.cachePath = '/data/.cache';
    // 初始化第一个调度器 (不等待，让其在后台就绪)
    this.rotateScheduler(true).catch((err) => {
      logger.fatal('OCR 服务启动失败', err);
    });
  }

  /**
   * 创建一个新的 Scheduler 并填充 Worker
   */
  private async createFreshScheduler(id: string): Promise<Scheduler> {
    logger.info(`[OCR-${id}] 正在初始化新的调度器 (Workers: ${WORKER_COUNT})...`);

    const scheduler = createScheduler();

    // 并行创建所有 Worker
    const workerPromises = Array(WORKER_COUNT)
      .fill(0)
      .map(async (_, index) => {
        const worker = await createWorker(LANGUAGES, 1, {
          cachePath: this.cachePath,
          gzip: true,
          logger: (m) => logger.debug('[OCR-Worker]', { msg: m }),
          errorHandler: (err) => logger.error(`[OCR-${id}-Worker${index}] 错误`, { err }),
        });
        scheduler.addWorker(worker);
      });

    await Promise.all(workerPromises);
    logger.info(`[OCR-${id}] 调度器准备就绪`);
    return scheduler;
  }

  /**
   * 执行调度器轮换 (热更新)
   * @param isFirstRun 是否为首次启动
   */
  private async rotateScheduler(isFirstRun: boolean = false): Promise<void> {
    if (this.isRotating && !isFirstRun) return;
    this.isRotating = true;

    const newId = Date.now().toString().slice(-5);

    try {
      // 1. 创建新的调度器 (耗时操作)
      const newScheduler = await this.createFreshScheduler(newId);

      // 2. 暂存旧的调度器 wrapper
      const oldWrapper = this.currentWrapper;

      // 3. 切换指针：新的请求将立即流向新调度器
      this.currentWrapper = {
        instance: newScheduler,
        jobCount: 0,
        activeJobs: 0,
        id: newId,
      };

      logger.info(`[OCR] 调度器已切换至 [${newId}]`);

      // 4. 优雅关闭旧调度器 (如果有)
      if (oldWrapper) {
        this.gracefulShutdown(oldWrapper);
      }
    } catch (err) {
      logger.error('OCR 调度器轮换失败', { err });
    } finally {
      this.isRotating = false;
    }
  }

  /**
   * 优雅关闭旧调度器：等待其当前任务清零后再销毁
   */
  private async gracefulShutdown(wrapper: SchedulerWrapper) {
    logger.info(`[OCR-${wrapper.id}] 进入退休模式，等待 ${wrapper.activeJobs} 个任务结束...`);

    // 轮询检查 activeJobs 是否归零
    // Tesseract scheduler 没有直接的 "drain" 事件，只能手动检查
    const checkInterval = setInterval(async () => {
      if (wrapper.activeJobs <= 0) {
        clearInterval(checkInterval);
        try {
          // terminate() 会同时销毁内部的所有 workers
          await wrapper.instance.terminate();
          logger.info(`[OCR-${wrapper.id}] 已安全销毁`);
        } catch (err) {
          logger.error(`[OCR-${wrapper.id}] 销毁时出错`, { err });
        }
      }
    }, 1000); // 每秒检查一次
  }

  /**
   * 公共入口：处理图片
   */
  public async handle(fileData: Blob): Promise<string | null> {
    // 确保服务已初始化
    if (!this.currentWrapper) {
      // 极罕见情况：服务刚启动且初始化极慢
      logger.warn('OCR 服务正在初始化，请稍候...');
      // 简单的阻塞等待 (实际场景建议配合 p-retry)
      await sleep(2_000);
      if (!this.currentWrapper) throw new AppError('OCR Service Unavailable');
    }

    const wrapper = this.currentWrapper;

    // 1. 增加计数
    wrapper.jobCount++;
    wrapper.activeJobs++;

    // 2. 检查是否需要触发轮换 (异步触发，不阻塞当前请求)
    if (wrapper.jobCount >= MAX_JOBS_BEFORE_ROTATION && !this.isRotating) {
      logger.info(`[OCR-${wrapper.id}] 达到任务阈值 (${wrapper.jobCount}), 触发轮换...`);
      this.rotateScheduler(); // 不 await，后台执行
    }

    try {
      const { data, mimeType } = fileData;

      // 3. 提交任务给 Tesseract Scheduler
      // addJob 会自动寻找空闲的 Worker 执行
      const result = await wrapper.instance.addJob('recognize', `data:${mimeType};base64,${data}`);

      return result.data.text.trim();
    } catch (err) {
      logger.error(`[OCR-${wrapper.id}] 识别失败`, { err });
      return null;
    } finally {
      // 4. 任务完成，减少活跃计数
      wrapper.activeJobs--;
    }
  }

  /**
   * 应用退出时清理
   */
  public async destroy(): Promise<void> {
    if (this.currentWrapper) {
      await this.currentWrapper.instance.terminate();
      logger.info('[OCR] 调度器已销毁');
    }
  }
}

export const recognize = new OCRManager();
