// src/types/tool_executors.d.ts

import type * as Github from '@/types/github';

export interface ToolExecArgs {
  chatId: number;
  userId: number;
  userMessageId: number;
  keyword: string;
  qualifier: string;
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
    Pick<Github.GitHubCommitSearchItem, 'sha'> & {
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
    Pick<Github.GitHubIssueSearchItem, 'id' | 'number' | 'html_url' | 'title' | 'state' | 'comments' | 'body'> & {
      created_at: string;
      updated_at: string;
      author_login: string;
      labels: string[];
    }
  >;
  total_count: number;
}

/**
 * searchReposInGlobal 工具的返回数据结构。
 */
export interface SearchReposInGlobalResult {
  repositories: Array<
    Pick<Github.GitHubRepository, 'full_name' | 'html_url' | 'description' | 'stargazers_count' | 'forks_count' | 'updated_at' | 'language'>
  >;
  total_count: number;
}

/**
 * searchIssuesInGlobal 工具的返回数据结构。
 */
export interface SearchIssuesInGlobalResult {
  issues: Array<
    Pick<Github.GitHubIssueSearchItem, 'id' | 'number' | 'html_url' | 'repository_url' | 'title' | 'state' | 'created_at' | 'updated_at' | 'body'> & {
      author_login: string;
    }
  >;
  total_count: number;
}

/**
 * listRepoTree 工具的返回数据结构。
 */
export interface ListRepoTreeResult {
  fileList: Array<
    Pick<Github.GitHubTreeItem, 'path' | 'type'> & {
      name: string;
    }
  >;
}

/**
 * listDirContents 工具的返回数据结构。
 */
export interface ListDirContentsResult {
  fileList: Array<Pick<Github.GitHubContentItem, 'name' | 'path' | 'type'>>;
}

/**
 * listRepoCommits 工具的返回数据结构。
 */
export interface ListRepoCommitsResult {
  commits: Array<
    Pick<Github.GitHubCommitDetails, 'sha'> & {
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
    Pick<Github.GitHubRelease, 'id' | 'tag_name' | 'name' | 'body' | 'html_url' | 'prerelease' | 'draft' | 'published_at'> & {
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
    Pick<Github.GitHubBranch, 'name' | 'protected'> & {
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
  commitDetails: Pick<Github.GitHubCommitDetails, 'sha' | 'html_url' | 'stats' | 'files'> & {
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
    Pick<Github.GitHubIssueComment, 'id' | 'html_url' | 'created_at' | 'updated_at' | 'body'> & {
      user_login: string;
    }
  >;
}

/**
 * getReleaseDetails 工具的返回数据结构。
 */
export interface GetReleaseDetailsResult {
  releaseDetails: Pick<
    Github.GitHubRelease,
    'id' | 'tag_name' | 'name' | 'body' | 'html_url' | 'prerelease' | 'draft' | 'assets' | 'published_at'
  > & {
    author_login: string;
  };
}

/**
 * getCurrentTime 工具的返回数据结构。
 */
export interface GetCurrentTimeResult {
  currentTime: string;
}

export type GenerateImageResult = string;
export type GenerateSpeechResult = string;

export interface ToolExecutorsType {
  searchFilesInRepo: (args: ToolExecArgs) => Promise<ToolExecResponse<SearchFilesInRepoResult>>;
  searchCommitsInRepo: (args: ToolExecArgs) => Promise<ToolExecResponse<SearchCommitsInRepoResult>>;
  searchIssuesInRepo: (args: ToolExecArgs) => Promise<ToolExecResponse<SearchIssuesInRepoResult>>;
  searchReposInGlobal: (args: ToolExecArgs) => Promise<ToolExecResponse<SearchReposInGlobalResult>>;
  searchIssuesInGlobal: (args: ToolExecArgs) => Promise<ToolExecResponse<SearchIssuesInGlobalResult>>;
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
  generateImage: (args: ToolExecArgs) => Promise<ToolExecResponse<GenerateImageResult>>;
  generateSpeech: (args: ToolExecArgs) => Promise<ToolExecResponse<GenerateSpeechResult>>;
}

export type ToolName = keyof ToolExecutorsType;
