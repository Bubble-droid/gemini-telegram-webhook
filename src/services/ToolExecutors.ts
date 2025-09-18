// src/configs/tool_executors.ts

import {
  GeminiError,
  Log,
  makeInlineKeyboard,
  simplifyGeminiApiResponse,
  bot,
  GEMINI_SAFETY_SETTINGS,
  rotateGeminiApiKey,
  simplifyGeminiApiContents,
} from '@/services';
import type { ReplyMarkup } from '@/types';
import type * as Github from '@/types/github';
import type * as Tool from '@/types/tool_executors';
import { convertPcmToMp3, formatTime, makeGitHubApiRequest, makeRawFileRequest, scheduleDeletion } from '@/utils';
import { GoogleGenAI, type Content, type GenerateContentConfig } from '@google/genai';

export const ToolExecutors: Tool.ToolExecutorsType = {
  /**
   * 执行 searchFilesInRepo 工具
   * 通过关键词在指定 GitHub 仓库中搜索文件内容。
   *
   * @param {ToolExecArgs} args - 工具调用时传递的参数对象，例如 { keyword: 'resolve', owner: 'SagerNet', repo: 'sing-box', path: 'assets/', branch: 'main' }。
   * @returns {Promise<>} 工具执行结果对象。
   */
  searchFilesInRepo: async (args: Tool.ToolExecArgs): Promise<Tool.ToolExecResponse<Tool.SearchFilesInRepoResult>> => {
    Log.info('执行工具: searchFilesInRepo, 参数:', { args });
    const { keyword, owner, repo, branch = 'main' } = args;
    const urlPath: string = `search/code`;
    const queryParams: string = `q=${encodeURIComponent(keyword)}+repo:${owner}/${repo}+in:file`;
    const result = await makeGitHubApiRequest<Github.GitHubSearchResult<Github.GitHubCodeSearchItem>>({
      method: 'GET',
      urlPath,
      queryParams,
    });
    if (result.success) {
      const foundFiles: string[] = result.data.items.map((item) => `${item.repository.full_name}/refs/heads/${branch}/${item.path}`);
      Log.info(`searchFilesInRepo 工具执行完毕，找到 ${foundFiles.length} 个文件。`);
      return { success: true, data: { foundFiles } };
    } else {
      return result;
    }
  },

  /**
   * 新增工具: searchCommitsInRepo
   * 通过关键词在指定 GitHub 仓库内搜索提交记录。
   *
   * @param {ToolExecArgs} args - 工具调用时传递的参数对象，例如 { keyword: 'fix', owner: 'SagerNet', repo: 'sing-box', branch: 'main', author: 'user', per_page: 10 }。
   * @returns {Promise<>} 工具执行结果对象。
   */
  searchCommitsInRepo: async (args: Tool.ToolExecArgs): Promise<Tool.ToolExecResponse<Tool.SearchCommitsInRepoResult>> => {
    Log.info('执行工具: searchCommitsInRepo, 参数:', { args });
    const { keyword, owner, repo } = args;
    const urlPath: string = `search/commits`;
    const queryParams: string = `q=${encodeURIComponent(keyword)}+repo:${owner}/${repo}`;
    const result = await makeGitHubApiRequest<Github.GitHubSearchResult<Github.GitHubCommitSearchItem>>({
      method: 'GET',
      urlPath,
      queryParams,
    });
    if (result.success) {
      const commits: Tool.SearchCommitsInRepoResult['commits'] = result.data.items.map((item) => ({
        sha: item.sha,
        message: item.commit.message,
        author: item.commit.author.name,
        date: item.commit.author.date,
        url: item.html_url,
        repository_full_name: item.repository?.full_name,
      }));
      Log.info(`searchCommitsInRepo 工具执行完毕，找到 ${commits.length} 条提交记录，总数 ${result.data.total_count}。`);
      return { success: true, data: { commits, total_count: result.data.total_count } };
    } else {
      return result;
    }
  },

  /**
   * 执行 searchIssuesInRepo 工具
   * 通过关键词在指定 GitHub 仓库中搜索 Issue。
   *
   * @param {ToolExecArgs} args - 工具调用时传递的参数对象，例如 { keyword: 'tun error', owner: 'SagerNet', repo: 'sing-box', state: 'all' }。
   * @returns {Promise<>} 工具执行结果对象。
   */
  searchIssuesInRepo: async (args: Tool.ToolExecArgs): Promise<Tool.ToolExecResponse<Tool.SearchIssuesInRepoResult>> => {
    Log.info('执行工具: searchIssuesInRepo, 参数:', { args });
    const { keyword, owner, repo, state = 'open' } = args;
    const urlPath = `search/issues`;
    const queryParams = `q=${encodeURIComponent(keyword)}+repo:${owner}/${repo}+state:${state}+is:issue`;
    const result = await makeGitHubApiRequest<Github.GitHubSearchResult<Github.GitHubIssueSearchItem>>({
      method: 'GET',
      urlPath,
      queryParams,
    });
    if (result.success) {
      const issues: Tool.SearchIssuesInRepoResult['issues'] = result.data.items.map((item) => ({
        id: item.id,
        number: item.number,
        html_url: item.html_url,
        title: item.title,
        state: item.state,
        created_at: item.created_at,
        updated_at: item.updated_at,
        comments: item.comments,
        author_login: item.user?.login || '未知', // 使用可选链操作符
        labels: item.labels?.map((label) => label.name) || [], // 使用可选链操作符
        body: item.body,
      }));
      Log.info(`searchIssuesInRepo 工具执行完毕，找到 ${issues.length} 个 Issue，总数 ${result.data.total_count}。`);
      return { success: true, data: { issues, total_count: result.data.total_count } };
    } else {
      return result;
    }
  },

  /**
   * 新增工具: searchReposInGlobal
   * 通过关键词在整个 GitHub 平台搜索仓库。
   *
   * @param {ToolExecArgs} args - 工具调用时传递的参数对象
   * @returns {Promise<>} 工具执行结果对象。
   */
  searchReposInGlobal: async (args: Tool.ToolExecArgs): Promise<Tool.ToolExecResponse<Tool.SearchReposInGlobalResult>> => {
    Log.info('执行工具: searchReposInGlobal, 参数:', { args });
    const { keyword, qualifier } = args;
    const urlPath: string = `search/repositories`;
    const queryParams: string = `q=${encodeURIComponent(keyword)}+in:${qualifier}`;
    const result = await makeGitHubApiRequest<Github.GitHubSearchResult<Github.GitHubRepository>>({
      method: 'GET',
      urlPath,
      queryParams,
    });
    if (result.success) {
      const repositories: Tool.SearchReposInGlobalResult['repositories'] = result.data.items.map((item) => ({
        id: item.id,
        name: item.name,
        full_name: item.full_name,
        private: item.private,
        owner_login: item.owner.login,
        html_url: item.html_url,
        description: item.description,
        fork: item.fork,
        stargazers_count: item.stargazers_count,
        language: item.language,
        forks_count: item.forks_count,
        open_issues_count: item.open_issues_count,
        default_branch: item.default_branch,
        updated_at: item.updated_at,
      }));
      Log.info(`searchReposInGlobal 工具执行完毕，找到 ${repositories.length} 个仓库，总数 ${result.data.total_count}。`);
      return { success: true, data: { repositories, total_count: result.data.total_count } };
    } else {
      return result;
    }
  },

  /**
   * 新增工具: searchIssuesInGlobal
   * 通过关键词在整个 GitHub 平台搜索 Issue。
   *
   * @param {ToolExecArgs} args - 工具调用时传递的参数对象
   * @returns {Promise<>} 工具执行结果对象。
   */
  searchIssuesInGlobal: async (args: Tool.ToolExecArgs): Promise<Tool.ToolExecResponse<Tool.SearchIssuesInGlobalResult>> => {
    Log.info('执行工具: searchIssuesInGlobal, 参数:', { args });
    const { keyword, state = 'open' } = args;
    const urlPath = `search/issues`;
    const queryParams = `q=${encodeURIComponent(keyword)}+state:${state}+is:issue`;
    const result = await makeGitHubApiRequest<Github.GitHubSearchResult<Github.GitHubIssueSearchItem>>({
      method: 'GET',
      urlPath,
      queryParams,
    });
    if (result.success) {
      const issues: Tool.SearchIssuesInGlobalResult['issues'] = result.data.items.map((item) => ({
        id: item.id,
        number: item.number,
        html_url: item.html_url,
        repository_url: item.repository_url,
        title: item.title,
        state: item.state,
        created_at: item.created_at,
        updated_at: item.updated_at,
        author_login: item.user?.login || '未知',
        body: item.body,
      }));
      Log.info(`searchIssuesInGlobal 工具执行完毕，找到 ${issues.length} 个 Issue，总数 ${result.data.total_count}。`);
      return { success: true, data: { issues, total_count: result.data.total_count } };
    } else {
      return result;
    }
  },

  /**
   * 执行 listRepoTree 工具
   * 获取指定 GitHub 仓库的完整文件树（递归）。
   *
   * @param {ToolExecArgs} args - 工具调用时传递的参数对象，例如 { owner: 'SagerNet', repo: 'sing-box', branch: 'dev-next' }。
   * @returns {Promise<>} 工具执行结果对象。
   */
  listRepoTree: async (args: Tool.ToolExecArgs): Promise<Tool.ToolExecResponse<Tool.ListRepoTreeResult>> => {
    Log.info('执行工具: listRepoTree, 参数:', { args });
    const { owner, repo, branch = 'main' } = args;
    const branchUrlPath = `repos/${owner}/${repo}/branches/${branch}`;
    const branchResult = await makeGitHubApiRequest<Github.GitHubBranch>({
      method: 'GET',
      urlPath: branchUrlPath,
    });
    if (!branchResult.success) {
      return branchResult;
    }
    const treeSha = branchResult.data.commit.sha;
    Log.info(`获取到分支 ${branch} 的 tree SHA: ${treeSha}`);
    const treeUrlPath = `repos/${owner}/${repo}/git/trees/${treeSha}`;
    const queryParams = `recursive=1`;
    const treeResult = await makeGitHubApiRequest<Github.GitHubTreeResponse>({
      method: 'GET',
      urlPath: treeUrlPath,
      queryParams,
    });
    if (treeResult.success) {
      // 过滤掉可能存在的 null 或 undefined item.path，并确保 name 不为空
      const fileList: Tool.ListRepoTreeResult['fileList'] = treeResult.data.tree
        .filter((item) => item.path) // 过滤掉 path 为空的项
        .map((item) => ({
          name: item.path.split('/').pop() || '', // 确保 name 不为空字符串
          path: `${owner}/${repo}/refs/heads/${branch}/${item.path}`, // 构建完整的 GitHub 路径
          type: item.type === 'blob' ? 'file' : 'tree',
        }));
      Log.info(`listRepoTree 工具执行完毕，找到 ${fileList.length} 个文件/目录。`);
      return { success: true, data: { fileList } };
    } else {
      return treeResult;
    }
  },

  /**
   * 执行 listDirContents 工具
   * 列出指定 GitHub 仓库路径下的文件和目录内容。
   *
   * @param {ToolExecArgs} args - 工具调用时传递的参数对象，例如 { owner: 'SagerNet', repo: 'sing-box', path: 'docs/', branch: 'dev-next' }。
   * @returns {Promise<>} 工具执行结果对象。
   */
  listDirContents: async (args: Tool.ToolExecArgs): Promise<Tool.ToolExecResponse<Tool.ListDirContentsResult>> => {
    Log.info('执行工具: listDirContents, 参数:', { args });
    const { owner, repo, path = '', branch = 'main' } = args;

    // 确保 path 不以斜杠开头，如果 path 为空则不需要处理
    const cleanedPath = path.startsWith('/') ? path.substring(1) : path;
    const urlPath = `repos/${owner}/${repo}/contents/${cleanedPath}`;
    const queryParams = `ref=${branch}`;
    const result = await makeGitHubApiRequest<Array<Github.GitHubContentItem>>({
      method: 'GET',
      urlPath,
      queryParams,
    });
    if (result.success) {
      const fileList: Tool.ListDirContentsResult['fileList'] = result.data.map((item) => ({
        name: item.name,
        path: `${owner}/${repo}/refs/heads/${branch}/${item.path}`, // 构建完整的文档路径
        type: item.type,
      }));
      Log.info(`listDirContents 工具执行完毕，找到 ${fileList.length} 个文件/目录。`);
      return { success: true, data: { fileList } };
    } else {
      return result;
    }
  },

  /**
   * 执行 listRepoCommits 工具
   * 获取指定 GitHub 仓库的提交记录列表。
   *
   * @param {ToolExecArgs} args - 工具调用时传递的参数对象，例如 { owner: 'SagerNet', repo: 'sing-box', branch: 'dev-next', path: 'docs/', per_page: 50, page: 1 }。
   * @returns {Promise<>} 工具执行结果对象。
   */
  listRepoCommits: async (args: Tool.ToolExecArgs): Promise<Tool.ToolExecResponse<Tool.ListRepoCommitsResult>> => {
    Log.info('执行工具: listRepoCommits, 参数:', { args });
    const { owner, repo, per_page = 20, page = 1 } = args;
    const urlPath = `repos/${owner}/${repo}/commits`;
    const queryParams = `per_page=${per_page}&page=${page}`;
    const result = await makeGitHubApiRequest<Array<Github.GitHubCommitDetails>>({
      method: 'GET',
      urlPath,
      queryParams,
    });
    if (result.success) {
      const commits: Tool.ListRepoCommitsResult['commits'] = result.data.map((item) => ({
        sha: item.sha,
        message: item.commit.message,
        author: item.commit.author.name,
        date: item.commit.author.date,
        url: item.html_url,
      }));
      Log.info(`listRepoCommits 工具执行完毕，找到 ${commits.length} 条提交记录。`);
      return { success: true, data: { commits } };
    } else {
      return result;
    }
  },

  /**
   * 执行 listRepoReleases 工具
   * 获取指定 GitHub 仓库的发布版本列表。
   *
   * @param {ToolExecArgs} args - 工具调用时传递的参数对象，例如 { owner: 'SagerNet', repo: 'sing-box', per_page: 10, page: 1 }。
   * @returns {Promise<>} 工具执行结果对象。
   */
  listRepoReleases: async (args: Tool.ToolExecArgs): Promise<Tool.ToolExecResponse<Tool.ListRepoReleasesResult>> => {
    Log.info('执行工具: listRepoReleases, 参数:', { args });
    const { owner, repo, per_page = 10, page = 1 } = args;
    const urlPath = `repos/${owner}/${repo}/releases`;
    const queryParams = `per_page=${per_page}&page=${page}`;
    const result = await makeGitHubApiRequest<Array<Github.GitHubRelease>>({
      method: 'GET',
      urlPath,
      queryParams,
    });
    if (result.success) {
      const releases: Tool.ListRepoReleasesResult['releases'] = result.data.map((item) => ({
        id: item.id,
        tag_name: item.tag_name,
        name: item.name,
        body: item.body,
        author_login: item.author.login,
        author_type: item.author.type,
        published_at: item.published_at,
        html_url: item.html_url,
        prerelease: item.prerelease,
        draft: item.draft,
      }));
      Log.info(`listRepoReleases 工具执行完毕，找到 ${releases.length} 个发布版本。`);
      return { success: true, data: { releases } };
    } else {
      return result;
    }
  },

  /**
   * 执行 listRepoBranches 工具
   * 获取指定 GitHub 仓库的所有分支列表。
   *
   * @param {ToolExecArgs} args - 工具调用时传递的参数对象，例如 { owner: 'SagerNet', repo: 'sing-box' }。
   * @returns {Promise<>} 工具执行结果对象。
   */
  listRepoBranches: async (args: Tool.ToolExecArgs): Promise<Tool.ToolExecResponse<Tool.ListRepoBranchesResult>> => {
    Log.info('执行工具: listRepoBranches, 参数:', { args });
    const { owner, repo } = args;
    const urlPath: string = `repos/${owner}/${repo}/branches`;
    const result = await makeGitHubApiRequest<Array<Github.GitHubBranch>>({ method: 'GET', urlPath });
    if (result.success) {
      const branches: Tool.ListRepoBranchesResult['branches'] = result.data.map((item) => ({
        name: item.name,
        commit_sha: item.commit.sha,
        commit_url: item.commit.url,
        protected: item.protected,
      }));
      Log.info(`listRepoBranches 工具执行完毕，找到 ${branches.length} 个分支。`);
      return { success: true, data: { branches } };
    } else {
      return result;
    }
  },

  /**
   * 执行 getFileContents 工具
   * 用于获取 GitHub 仓库中指定文件的原始内容。
   *
   * @param {ToolExecArgs} args - 工具调用时传递的参数对象，例如 { filePaths: ['path1', 'path2'] }。
   * @returns {Promise<>} 工具执行结果对象，包含文件内容或错误信息。
   */
  getFileContents: async (args: Tool.ToolExecArgs): Promise<Tool.ToolExecResponse<Tool.GetFileContentsResult>> => {
    Log.info('执行工具: getFileContents, 参数:', { args });
    const processedFiles: Tool.GetFileContentsResult['files'] = [];
    for (const file of args.filePaths) {
      if (typeof file === 'string') {
        // 从路径中提取 repo/branch/file.ext 作为文档名称的简写
        const fileNameParts = file.split('/');
        // 至少需要 'owner', 'repo', 'refs', 'heads', 'branch', 'path' 这几部分
        const repoName = fileNameParts[1] ?? '未知仓库';
        const branchName = fileNameParts[4] ?? '未知分支';
        const fileName = fileNameParts
          .slice(5)
          .join('_')
          .replace(/\.[^/.]+$/, ''); // 移除文件后缀
        const fileIdentifier = `${repoName}_${branchName}_${fileName}`;
        const result = await makeRawFileRequest(file);

        if (result.success) {
          const assetContent = result.data;
          const MAX_CHUNK_LENGTH = 2048; // 定义每个文本块的最大长度
          const chunkedContent = [];

          for (let i = 0; i < assetContent.length; i += MAX_CHUNK_LENGTH) {
            chunkedContent.push({
              text: assetContent.slice(i, i + MAX_CHUNK_LENGTH),
            });
          }

          processedFiles.push({
            path: file,
            content: chunkedContent,
            identifier: fileIdentifier,
          }); // 明确断言类型
        } else {
          // 单个文件获取失败，但工具整体继续执行，将错误信息放入该文件结果中
          processedFiles.push({
            path: file,
            error: result.error,
            identifier: fileIdentifier,
          }); // 明确断言类型
        }
      } else {
        processedFiles.push({
          path: String(file), // 尝试转换为字符串
          error: '文件路径类型无效，期望字符串。',
          identifier: 'invalid_file_path',
        });
      }
    }
    Log.info(`getFileContents 工具执行完毕，结果数量: ${processedFiles.length}`);
    return { success: true, data: { files: processedFiles } };
  },

  /**
   * 执行 getCommitDetails 工具
   * 获取指定 GitHub 仓库提交的详细信息。
   *
   * @param {ToolExecArgs} args - 工具调用时传递的参数对象，例如 { owner: 'SagerNet', repo: 'sing-box', commit_sha: '2464ced48c504eb0dee616c6d474813621779afc' }。
   * @returns {Promise<>} 工具执行结果对象。
   */
  getCommitDetails: async (args: Tool.ToolExecArgs): Promise<Tool.ToolExecResponse<Tool.GetCommitDetailsResult>> => {
    Log.info('执行工具: getCommitDetails, 参数:', { args });
    const { owner, repo, commit_sha } = args;
    const urlPath = `repos/${owner}/${repo}/commits/${commit_sha}`;
    const result = await makeGitHubApiRequest<Github.GitHubCommitDetails>({ method: 'GET', urlPath });
    if (result.success) {
      const data = result.data;
      const commitDetails: Tool.GetCommitDetailsResult['commitDetails'] = {
        sha: data.sha,
        author: {
          name: data.commit.author.name,
          email: data.commit.author.email,
          date: data.commit.author.date,
        },
        message: data.commit.message,
        html_url: data.html_url,
        stats: data.stats,
        files: data.files.map((file) => ({
          filename: file.filename,
          status: file.status,
          additions: file.additions,
          deletions: file.deletions,
          changes: file.changes,
          patch: file.patch,
        })),
      };

      Log.info(`getCommitDetails 工具执行完毕，获取到提交 ${commit_sha} 的关键详细信息。`);
      return { success: true, data: { commitDetails } };
    } else {
      return result;
    }
  },

  /**
   * 执行 getIssueComments 工具
   * 获取指定 GitHub Issue 的评论列表。
   *
   * @param {ToolExecArgs} args - 工具调用时传递的参数对象，例如 { owner: 'SagerNet', repo: 'sing-box', issue_number: 3202, per_page: 30, page: 1 }。
   * @returns {Promise<>} 工具执行结果对象。
   */
  getIssueComments: async (args: Tool.ToolExecArgs): Promise<Tool.ToolExecResponse<Tool.GetIssueCommentsResult>> => {
    Log.info('执行工具: getIssueComments, 参数:', { args });
    const { owner, repo, issue_number } = args;
    const urlPath = `repos/${owner}/${repo}/issues/${issue_number}/comments`;
    const result = await makeGitHubApiRequest<Array<Github.GitHubIssueComment>>({
      method: 'GET',
      urlPath,
    });
    if (result.success) {
      const comments: Tool.GetIssueCommentsResult['comments'] = result.data.map((item) => ({
        id: item.id,
        html_url: item.html_url,
        user_login: item.user?.login || '未知', // 使用可选链操作符
        created_at: item.created_at,
        updated_at: item.updated_at,
        body: item.body,
      }));
      Log.info(`getIssueComments 工具执行完毕，找到 ${comments.length} 条评论。`);
      return { success: true, data: { comments } };
    } else {
      return result;
    }
  },

  /**
   * 执行 getReleaseDetails 工具
   * 获取指定 GitHub 仓库发布版本的详细信息。可以通过 release ID 或 tag 名称查询。
   *
   * @param {ToolExecArgs} args - 工具调用时传递的参数对象，例如 { owner: 'GUI-for-Cores', repo: 'GUI.for.SingBox', release_id: 227541695 } 或 { owner: 'GUI-for-Cores', repo: 'GUI.for.SingBox', tag_name: 'rolling-release-alpha' }。
   * @returns {Promise<>} 工具执行结果对象。
   */
  getReleaseDetails: async (args: Tool.ToolExecArgs): Promise<Tool.ToolExecResponse<Tool.GetReleaseDetailsResult>> => {
    Log.info('执行工具: getReleaseDetails, 参数:', { args });
    const { owner, repo, release_id, tag_name } = args;
    const urlPath = `repos/${owner}/${repo}/releases/${release_id ? release_id : `tags/${tag_name}`}`;
    const releaseResult = await makeGitHubApiRequest<Github.GitHubRelease>({
      method: 'GET',
      urlPath,
    });
    if (!releaseResult.success) {
      return releaseResult; // 直接返回封装的错误
    }
    const releaseData = releaseResult.data;
    const releaseDetails: Tool.GetReleaseDetailsResult['releaseDetails'] = {
      id: releaseData.id,
      tag_name: releaseData.tag_name,
      name: releaseData.name,
      body: releaseData.body,
      author_login: releaseData.author?.login || '未知', // 使用可选链操作符
      published_at: releaseData.published_at,
      html_url: releaseData.html_url,
      prerelease: releaseData.prerelease,
      draft: releaseData.draft,
      assets: releaseData.assets.map((asset) => ({
        id: asset.id,
        name: asset.name,
        browser_download_url: asset.browser_download_url,
        size: asset.size,
        download_count: asset.download_count,
        created_at: asset.created_at,
        updated_at: asset.updated_at,
      })),
    };
    Log.info(`getReleaseDetails 工具执行完毕，获取到发布版本 ${release_id || tag_name} 的详细信息。`);
    return { success: true, data: { releaseDetails } };
  },

  /**
   * 执行 getCurrentTime 工具
   * 获取当前时间。
   *
   * @returns {} 工具执行结果对象，包含 currentTime 字段。
   */
  getCurrentTime: (): Tool.ToolExecResponse<Tool.GetCurrentTimeResult> => {
    Log.info('执行工具: getCurrentTime');
    const currentTime = formatTime(Date.now());
    Log.info('getCurrentTime 工具执行完毕，当前时间:', { currentTime });
    return { success: true, data: { currentTime } };
  },

  generateImage: async (args) => {
    Log.info('执行工具: sendPhotoMessage，参数:', { args });
    const { chatId, userId, userMessageId, prompt } = args;
    const modelName: string = 'gemini-2.0-flash-preview-image-generation';
    const modelConfig: GenerateContentConfig = {
      responseModalities: ['IMAGE', 'TEXT'],
    };
    const contents: Content[] = [
      {
        role: 'user',
        parts: [{ text: prompt }],
      },
    ];
    try {
      const response = await callCustomModels(modelName, modelConfig, contents);
      const resTexts = response.parts?.map((part) => part.text).join('') || '';
      const imageData = response.parts?.find((part) => part.inlineData && part.inlineData.data);
      const base64Data = imageData?.inlineData?.data as string;
      const imageBuffer = Buffer.from(base64Data, 'base64');
      const replyMarkup: ReplyMarkup = {
        inline_keyboard: makeInlineKeyboard(userId),
      };
      const result = await bot.sendPhoto(chatId, imageBuffer, { caption: resTexts, replyToMessageId: userMessageId, replyMarkup });
      if (!result.ok) {
        return { success: false, error: `Error replying image message, ${result.error}` };
      }
      scheduleDeletion(chatId, result.messageId, 24 * 60 * 60 * 1000);
      return { success: true, data: 'Image generate and reply message successfully.' };
    } catch (error: unknown) {
      const errorMessage = error instanceof GeminiError ? error.message : String(error);
      return { success: false, error: errorMessage };
    }
  },

  generateSpeech: async (args) => {
    Log.info('执行工具: sendVoiceMessage，参数:', { args });
    const { chatId, userId, userMessageId, prompt } = args;
    const modelName: string = 'gemini-2.5-flash-preview-tts';
    const modelConfig: GenerateContentConfig = {
      responseModalities: ['AUDIO'],
      speechConfig: { voiceConfig: { prebuiltVoiceConfig: { voiceName: 'Leda' } } },
    };
    const contents: Content[] = [
      {
        role: 'user',
        parts: [{ text: prompt }],
      },
    ];
    try {
      const response = await callCustomModels(modelName, modelConfig, contents);
      const audioData = response.parts?.find((part) => part.inlineData && part.inlineData.data);
      const base64Data = audioData?.inlineData?.data as string;
      const pcmAudioBuffer = Buffer.from(base64Data, 'base64');
      Log.info('开始将 PCM 音频数据转换为 MP3...');
      const mp3AudioBuffer = await convertPcmToMp3(pcmAudioBuffer);
      Log.info('MP3 音频数据转换完成。');
      const replyMarkup: ReplyMarkup = {
        inline_keyboard: makeInlineKeyboard(userId),
      };
      const result = await bot.sendVoice(chatId, mp3AudioBuffer, { replyToMessageId: userMessageId, replyMarkup });
      if (!result.ok) {
        return { success: false, error: `Error replying speech message, ${result.error}` };
      }
      scheduleDeletion(chatId, result.messageId, 24 * 60 * 60 * 1000);
      return { success: true, data: 'Speech generate and reply message successfully.' };
    } catch (error: unknown) {
      const errorMessage = error instanceof GeminiError ? error.message : String(error);
      return { success: false, error: errorMessage };
    }
  },
};

export const callCustomModels = async (model: string, modelConfig: GenerateContentConfig, contents: Content[]): Promise<Content> => {
  const newApiKey = await rotateGeminiApiKey();
  const ai = new GoogleGenAI({ apiKey: newApiKey });
  const config: GenerateContentConfig = {
    ...modelConfig,
    safetySettings: GEMINI_SAFETY_SETTINGS,
  };
  Log.info('发送 Gemini API 请求...');
  Log.info('当前发送的 contents:', { contents: simplifyGeminiApiContents(contents) });
  const response = await ai.models.generateContent({ model, contents, config });
  Log.info(`Gemini API 响应: `, {
    response: simplifyGeminiApiResponse(response),
  });
  const candidate = response.candidates?.[0];
  if (!candidate || !candidate.content || !candidate.content.parts) {
    throw new GeminiError('Gemini API 返回结果不包含有效的内容', 'INVALID_RESPONSE');
  }
  return candidate.content;
};
