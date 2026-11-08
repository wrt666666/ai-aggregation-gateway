/**
 * State Store: In-memory Circular Audit Log Buffer & Video Async Task State Machine
 */

import type { AuditLogEntry, MetricsSummary, VideoTaskItem } from '../types/schema.js';

export class StateStore {
  private readonly maxLogs: number;
  private logs: AuditLogEntry[] = [];
  private videoTasks: Map<string, VideoTaskItem> = new Map();

  // Pre-cached video sample URLs for variety
  private readonly sampleVideos: string[] = [
    'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/BigBuckBunny.mp4',
    'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ElephantsDream.mp4',
    'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerBlazes.mp4',
    'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/TearsOfSteel.mp4',
  ];

  constructor(maxLogs = 200) {
    this.maxLogs = maxLogs;
  }

  /**
   * Append a new audit log entry into the FIFO circular buffer (max 200 items)
   */
  public appendLog(entry: AuditLogEntry): void {
    this.logs.unshift(entry);
    if (this.logs.length > this.maxLogs) {
      this.logs.length = this.maxLogs;
    }
  }

  /**
   * Get audit logs, newest first
   */
  public getLogs(limit = 50): AuditLogEntry[] {
    return this.logs.slice(0, Math.min(limit, this.logs.length));
  }

  /**
   * Calculate aggregated metrics from the stored audit logs
   */
  public getMetrics(): MetricsSummary {
    const totalRequests = this.logs.length;
    let totalSuccess = 0;
    let totalFailed = 0;
    let totalPromptTokens = 0;
    let totalCompletionTokens = 0;
    let totalTokens = 0;
    let totalDurationMs = 0;

    for (const log of this.logs) {
      if (log.status === 'success') {
        totalSuccess++;
      } else {
        totalFailed++;
      }
      totalPromptTokens += log.promptTokens || 0;
      totalCompletionTokens += log.completionTokens || 0;
      totalTokens += log.totalTokens || 0;
      totalDurationMs += log.durationMs || 0;
    }

    const averageDurationMs = totalRequests > 0 ? Math.round(totalDurationMs / totalRequests) : 0;

    return {
      totalRequests,
      totalSuccess,
      totalFailed,
      totalPromptTokens,
      totalCompletionTokens,
      totalTokens,
      averageDurationMs,
    };
  }

  /**
   * Create an asynchronous video generation task and start simulated progress pipeline
   */
  public createVideoTask(model: string, prompt: string): VideoTaskItem {
    const now = Date.now();
    const taskId = `vid_${now}_${Math.random().toString(36).substring(2, 8)}`;
    const randomVideoUrl = this.sampleVideos[Math.floor(Math.random() * this.sampleVideos.length)];

    const task: VideoTaskItem = {
      id: taskId,
      model: model || 'sora-1.0',
      prompt,
      status: 'pending',
      progress: 5,
      createdAt: now,
      updatedAt: now,
    };

    this.videoTasks.set(taskId, task);

    // Asynchronous state transition simulation
    const step1 = setTimeout(() => {
      const current = this.videoTasks.get(taskId);
      if (current && current.status !== 'failed') {
        current.status = 'processing';
        current.progress = 35;
        current.updatedAt = Date.now();
      }
    }, 2000);
    step1.unref?.();

    const step2 = setTimeout(() => {
      const current = this.videoTasks.get(taskId);
      if (current && current.status !== 'failed') {
        current.status = 'processing';
        current.progress = 75;
        current.updatedAt = Date.now();
      }
    }, 4500);
    step2.unref?.();

    const step3 = setTimeout(() => {
      const current = this.videoTasks.get(taskId);
      if (current && current.status !== 'failed') {
        current.status = 'succeeded';
        current.progress = 100;
        current.videoUrl = randomVideoUrl;
        current.updatedAt = Date.now();
      }
    }, 7000);
    step3.unref?.();

    return task;
  }

  /**
   * Get single video task by ID
   */
  public getVideoTask(id: string): VideoTaskItem | undefined {
    return this.videoTasks.get(id);
  }

  /**
   * List all video generation tasks, newest first
   */
  public listVideoTasks(): VideoTaskItem[] {
    return Array.from(this.videoTasks.values()).sort((a, b) => b.createdAt - a.createdAt);
  }
}

export const stateStore = new StateStore(200);
