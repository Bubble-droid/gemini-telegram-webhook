// src/types/tool_executors.d.ts

import type { ToolExecutors } from '@/services';
import type {
  GitHubBranch,
  GitHubCommitDetails,
  GitHubCommitSearchItem,
  GitHubContentItem,
  GitHubIssueComment,
  GitHubIssueSearchItem,
  GitHubRelease,
  GitHubTreeItem,
} from './github';

export interface ToolExecArgs {
  chatId: number;
  userMessageId: number;
  currentApiKey: string;
  keyword: string;
  owner: string;
  repo: string;
  path?: string;
  branch?: string;
  state?: string;
  per_page?: number;
  page?: number;
  commit_sha?: string;
  issue_number?: number;
  release_id?: number;
  tag_name?: string;
  filePaths: string[];
  prompt?: string;
}

/**
 * 工具执行的通用响应结构。
 * @template T - 成功时返回的数据类型。
 */
export type ToolExecResponse<T> = ToolExecSuccess<T> | ToolExecError;

interface ToolExecSuccess<T> {
  success: true;
  data: T;
}

interface ToolExecError {
  success: false;
  error: string;
}
/**
 * searchFilesInRepo 工具的返回数据结构。
 */
export interface SearchFilesInRepoResult {
  foundFiles: string[];
}

/**
 * searchCommitsInRepo 工具的返回数据结构。
 */
export interface SearchCommitsInRepoResult {
  commits: Array<
    Pick<GitHubCommitSearchItem, 'sha'> & {
      message: string;
      author: string;
      date: string;
      url: string;
      repository_full_name: string;
    }
  >;
  total_count: number;
}

/**
 * searchIssuesInRepo 工具的返回数据结构。
 */
export interface SearchIssuesInRepoResult {
  issues: Array<
    Pick<GitHubIssueSearchItem, 'id' | 'number' | 'html_url' | 'title' | 'state' | 'comments' | 'body'> & {
      created_at: string;
      updated_at: string;
      author_login: string;
      labels: string[];
    }
  >;
  total_count: number;
}

/**
 * listRepoTree 工具的返回数据结构。
 */
export interface ListRepoTreeResult {
  fileList: Array<
    Pick<GitHubTreeItem, 'path' | 'type'> & {
      name: string;
    }
  >;
}

/**
 * listDirContents 工具的返回数据结构。
 */
export interface ListDirContentsResult {
  fileList: Array<Pick<GitHubContentItem, 'name' | 'path' | 'type'>>;
}

/**
 * listRepoCommits 工具的返回数据结构。
 */
export interface ListRepoCommitsResult {
  commits: Array<
    Pick<GitHubCommitDetails, 'sha'> & {
      message: string;
      author: string;
      date: string;
      url: string;
    }
  >;
}

/**
 * listRepoReleases 工具的返回数据结构。
 */
export interface ListRepoReleasesResult {
  releases: Array<
    Pick<GitHubRelease, 'id' | 'tag_name' | 'name' | 'body' | 'html_url' | 'prerelease' | 'draft' | 'published_at'> & {
      author_login: string;
      author_type: string;
    }
  >;
}

/**
 * listRepoBranches 工具的返回数据结构。
 */
export interface ListRepoBranchesResult {
  branches: Array<
    Pick<GitHubBranch, 'name' | 'protected'> & {
      commit_sha: string;
      commit_url: string;
    }
  >;
}

/**
 * getFileContents 工具的返回数据结构。
 */
export interface GetFileContentsResult {
  files: Array<{
    path: string;
    content?: Array<{ text: string }>;
    error?: string;
    identifier: string;
  }>;
}

/**
 * getCommitDetails 工具的返回数据结构。
 */
export interface GetCommitDetailsResult {
  commitDetails: Pick<GitHubCommitDetails, 'sha' | 'html_url' | 'stats' | 'files'> & {
    author: {
      name: string;
      email: string;
      date: string;
    };
    message: string;
  };
}

/**
 * getIssueComments 工具的返回数据结构。
 */
export interface GetIssueCommentsResult {
  comments: Array<
    Pick<GitHubIssueComment, 'id' | 'html_url' | 'created_at' | 'updated_at' | 'body'> & {
      user_login: string;
    }
  >;
}

/**
 * getReleaseDetails 工具的返回数据结构。
 */
export interface GetReleaseDetailsResult {
  releaseDetails: Pick<GitHubRelease, 'id' | 'tag_name' | 'name' | 'body' | 'html_url' | 'prerelease' | 'draft' | 'assets' | 'published_at'> & {
    author_login: string;
  };
}

/**
 * getCurrentTime 工具的返回数据结构。
 */
export interface GetCurrentTimeResult {
  currentTime: string;
}

export type SendPhotoMessageResult = string;
export type SendVoiceMessageResult = string;

export interface ToolExecutorsType {
  searchFilesInRepo: (args: ToolExecArgs) => Promise<ToolExecResponse<SearchFilesInRepoResult>>;
  searchCommitsInRepo: (args: ToolExecArgs) => Promise<ToolExecResponse<SearchCommitsInRepoResult>>;
  searchIssuesInRepo: (args: ToolExecArgs) => Promise<ToolExecResponse<SearchIssuesInRepoResult>>;
  listRepoTree: (args: ToolExecArgs) => Promise<ToolExecResponse<ListRepoTreeResult>>;
  listDirContents: (args: ToolExecArgs) => Promise<ToolExecResponse<ListDirContentsResult>>;
  listRepoCommits: (args: ToolExecArgs) => Promise<ToolExecResponse<ListRepoCommitsResult>>;
  listRepoReleases: (args: ToolExecArgs) => Promise<ToolExecResponse<ListRepoReleasesResult>>;
  listRepoBranches: (args: ToolExecArgs) => Promise<ToolExecResponse<ListRepoBranchesResult>>;
  getFileContents: (args: ToolExecArgs) => Promise<ToolExecResponse<GetFileContentsResult>>;
  getIssueComments: (args: ToolExecArgs) => Promise<ToolExecResponse<GetIssueCommentsResult>>;
  getReleaseDetails: (args: ToolExecArgs) => Promise<ToolExecResponse<GetReleaseDetailsResult>>;
  getCommitDetails: (args: ToolExecArgs) => Promise<ToolExecResponse<GetCommitDetailsResult>>;
  getCurrentTime: () => ToolExecResponse<GetCurrentTimeResult>;
  generateImage: (args: ToolExecArgs) => Promise<ToolExecResponse<SendPhotoMessageResult>>;
  generateSpeech: (args: ToolExecArgs) => Promise<ToolExecResponse<SendVoiceMessageResult>>;
}

export type ToolName = keyof typeof ToolExecutors;
