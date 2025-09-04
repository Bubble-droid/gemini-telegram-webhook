/// <reference path="../../src/types/http_client.d.ts" />

const run = async (params, message) => {
  if (!params) {
    throw '缺少有效的参数';
  }
  const [owner, repo] = params.split('/');

  const url = `https://api.github.com/repos/${owner}/${repo}/releases`;

  const res = await Http.get(url, {
    headers: {
      'Content-type': 'application/vnd.github.v3+json',
    },
    queryParams: {
      per_page: 1,
      page: 1,
    },
    responseType: 'json',
    timeout: 30_000,
  });

  if (res.ok) {
    const releases = res.data.map((item) => ({
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
    return `${owner}/${repo} 仓库的最新发行版信息如下：\n\n${JSON.stringify(releases[0], null, 2)}`;
  } else {
    throw `Http Request Error\nHttp Status: ${res.status}\n${res.statusText}`;
  }
};
