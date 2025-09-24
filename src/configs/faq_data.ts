// src/configs/faq_data.ts

import type { FaqItem } from '@/types';

/**
 * @const faqData
 * @description 存储所有 FAQ 问答对及其匹配的正则表达式模式。
 *              规则的顺序至关重要：越具体的规则应越靠前，越通用的规则应越靠后。
 */
export const faqData: FaqItem[] = [
  // ⚙️ B.2.1 常规与界面 (General & UI)
  {
    keywordGroups: [
      ['(开机)?自启(动)?', '([不没无]法?|不能)生效|(启动)?失败|没用|不行|搞不定|起不来|没效果'],
      ['autostart|boot start', 'fail|not working|doesn.?t work|no effect'],
      ['(launch|start) on (startup|boot)', 'fail|not working|issue|problem'],
    ],
    answer: `**Q: 自启动不生效？**

A: 请按以下顺序排查：
1. **路径检查**：确保程序可执行文件所在的完整路径中，不包含中文、空格或特殊字符。
2. **安全软件拦截**：检查您的安全软件（如杀毒软件、系统管家）是否有拦截或阻止本程序添加开机启动项的行为。
3. **管理员权限 (Windows)**：前往 **设置 -> 通用**，启用 **以管理员身份运行** 并重启客户端。`,
  },
  {
    keywordGroups: [
      ['滚动(发行)?', '更新|升级|update|upgrade', '([不没无]法?|不能)了?|失败|不动|卡住|报错|出问题'],
      // --- 新增英文关键词 ---
      ['rolling(-?release)?', 'update|upgrade', 'fail|stuck|error|issue|problem'],
    ],
    excludeKeywords: [
      ['内核', '(启|运)动|打不开|崩了|挂了'], // 排除描述更新后内核问题的场景
      ['core', 'start|launch|run', 'fail|crash'],
    ],
    answer: `**Q: 滚动发行无法更新？**

A:
1. 首先，在 **插件中心** 检查并更新 **滚动发行** 插件本身至最新版本。
2. 如果问题依旧，请尝试删除程序目录下的 \`data/rolling-release\` 文件夹后重试。`,
  },
  {
    keywordGroups: [
      ['(跨|升)大版本', '提示|报错|[不没无]法?|不能'],
      ['major version', 'upgrade', 'error|fail|can.?t'],
    ],
    answer: `**Q: 滚动发行提示无法跨大版本升级？**

A: 滚动发行插件仅在当前最新的大版本内工作。当发布新的大版本后，您需要前往 **设置 -> 关于** 页面，手动检查并更新 GUI 客户端主程序。`,
  },
  {
    keywordGroups: [
      ['首页|主页|面板', '只(有)?(显示)?(4|四)个|太少|没了|不见了'],
      ['dashboard|home page', 'only (shows? )?4|empty|gone|missing'],
    ],
    answer: `**Q: 首页只显示 4 个配置项？**

A: 这是程序设计。您可以在 **配置** 页面通过拖拽来调整配置文件的显示顺序。`,
  },
  {
    keywordGroups: [
      ['怎么|如何|咋', '更换|修改|换|改|自定义', '(托盘)?图标'],
      ['tray icon', 'change|replace|customize'],
    ],
    answer: `**Q: 如何更换托盘图标？**

A:
1. 前往 **设置 -> 打开应用程序文件夹**。
2. 替换或修改 \`data/.cache/icons\` 目录下的图标文件。`,
  },
  {
    keywordGroups: [
      ['linux', '字体|文字', '偏高|位置[不无]对|偏移|错位'],
      ['linux', 'font|text', 'position|offset|too high|misaligned'],
    ],
    answer: `**Q: Linux 桌面系统上 GUI 文字位置偏高？**

A: 尝试安装 \`Noto-Sans-CJK\` 和 \`Microsoft-YaHei\` 字体后重启系统（此方法不保证在所有环境下都有效）。`,
  },

  // 🌐 B.2.2 网络与订阅 (Network & Subscription)
  {
    keywordGroups: [['403'], ['rate limit exceeded'], ['(github|api).*(限制|rate limit)'], ['超出', '速(率)?', '限制']],
    answer: `**Q: GitHub API 速率限制 (403 rate limit exceeded)？**

A:
1. 访问您的 GitHub 开发者设置，生成一个新的 Personal Access Token (PAT)。
2. 在客户端的 **设置 -> 通用** 中，将获取的 Token 填入 **向 REST API 进行身份验证** 一栏。`,
  },
  {
    keywordGroups: [
      // 场景一：更新失败或无信息 (陈述句)
      ['订阅', '[没无](有)?|(不|没)显示|看不到', '流量(信息)?|用量|已用|上传|下载'],
      ['订阅', '(无法|不能|没法)更新|更新.*(不了|失败)'],

      // 场景二：节点不完整或缺少
      ['节点|订阅', '不全|不完整|少(了)?|缺少|数量不对|没有了'],
      ['订阅', '只有|只显示|只包含', '(vmess|ss|trojan|旧|老)?节点'],
      ['订阅', '没有|不显示|缺少', '(hysteria|vless|tuic|anytls|hysteria2|新)?节点'],

      // 场景三：与其他客户端对比
      ['为啥|为什么', 'verge|nekobox|clashx|其他客户端', '有|正常|显示|全', '(我|这里|这个|gui).*(不全|没有|少)'],

      // 英文关键词
      ['subscription', 'no traffic (info)?|not a valid|fail(ed)? to update'],
      ['subscription', '(nodes?|proxies) (incomplete|missing)|not all nodes shown'],
      ['(it )?works in (verge|nekobox)', 'but not here'],
    ],
    excludeKeywords: [['tun']],
    answer: `**Q: 订阅更新失败、无流量信息或节点不完整/缺少？**

A: 请严格按以下步骤操作：

1.  **GUI.for.SingBox 必须执行此步骤**
    前往 **插件中心**，安装 **节点转换** 插件。

2.  **所有用户均需执行以下步骤**
    *   前往 **订阅** 页面，找到目标订阅，点击其右上角的 **...** -> **编辑**。
    *   在弹出窗口中，点击 **更多** 以展开高级选项。
    *   向下滚动找到 **请求头**，点击 **+** 添加一项，并填写：
        *   左侧 (Key): \`User-Agent\`
        *   右侧 (Value): \`Clash.Meta\`
    *   点击 **保存**，然后返回订阅页面更新该订阅即可。

*   **通用检查**: 最后，确保当前网络环境，可以正常访问该订阅链接。`,
  },
  {
    keywordGroups: [
      ['多(个)?网卡', '网络.*(异常|问题|用不了)|(连|上)不了网|断流'],
      ['wifi|无线|有线|网线', '(一起|同时)用', '([不没无]法?|不能)上网'],
      ['multiple network cards?', 'issue|problem'],
      // --- 新增英文关键词 ---
      ['multiple network (interfaces?|cards?)', '(internet|network) issue|problem|connection lost'],
    ],
    answer: `**Q: 多网卡设备网络异常？**

A:
1. 前往 **配置设置 -> 路由设置 -> 通用**。
2. 禁用 **自动检测出站接口** 选项。
3. 在下方的出站接口名称列表中，手动选择正确的物理网卡作为出站接口。`,
  },

  // ⚙️ B.2.3 配置与导入 (Configuration & Import)
  {
    keywordGroups: [
      ['导入|添加|载入|放进去|(使)?用|应用|加载', '(自定义|自己|完整|(手)?(写|搓)(好)?|本地|订阅|远程).*配置(文件)?'],

      ['import', 'custom config|full config|apply|load'],
      ['how to', 'import|load|use|apply', '(my|a) (custom|full|own) config(uration)?'],
    ],
    answer: `**Q: 如何导入/使用自己编写的完整配置文件？**

A: GUI.for.Cores 本身不直接支持导入完整的配置文件，这么设计是为了维持 GUI 操作的稳定性和一致性。但您可以通过以下特定功能，间接实现加载自定义配置的目的：

*   **GUI.for.Clash**: 在添加订阅时，将您的完整配置文件托管在一个可访问的 URL 上（或存放在本地文件中），然后像添加普通订阅一样添加它。关键在于，必须启用 **“使用订阅内的策略组和分流规则”** 选项。这样，客户端会优先采用您文件中的 \`proxies\`, \`proxy-groups\`, 和 \`rules\` 部分。

*   **GUI.for.SingBox**: 使用 **配置脚本** 功能。这是一个高级功能，允许您通过编写 JavaScript 代码来动态修改生成的 sing-box 配置。您可以将完整配置文件通过脚本注入到最终配置中。
    1.  首先需要新建一个配置，右键点击该配置，选择 **混入和脚本**，弹出的窗口中点击 **脚本操作**。
    2.  将以下脚本代码 **复制并粘贴** 到脚本编辑框中，将其中的变量值修改为正确的文件路径或 URL。
        *   **导入本地文件**:
\`\`\`javascript
const onGenerate = async (config) => {
  const { experimental: { clash_api } } = config;
  // 将 'PATH/TO/config.json' 替换为实际的本地文件路径
  // 从本地文件中读取并解析 sing-box 配置
  const configFilePath = 'PATH/TO/config.json';
  const fileData = await Plugins.ReadFile(configFilePath, {
    Mode: 'Text',
  });
  const _config = JSON.parse(fileData);
  // 对配置做出修改
  _config.inbounds.forEach((v) => {
    if (v.tag === 'tun-in') {
      v.auto_redirect = true;
      v.route_exclude_address_set = 'geoip-cn';
    }
  });
  // 自定义配置修改...
  // 确保 Clash API 与 GUI 配置保持一致
  _config.experimental.clash_api = {
    ..._config.experimental.clash_api,
    external_controller: clash_api.external_controller,
    secret: clash_api.secret,
  };
  // 返回修改后的配置
  return _config;
};
\`\`\`
        *   **导入远程文件**:
\`\`\`javascript
const onGenerate = async (config) => {
  const { experimental: { clash_api } } = config;
  // 将 URL 替换为实际的远程配置文件地址
  // 从远程 URL 读取并解析 sing-box 配置
  // 此方法需要远程订阅或者配置文件支持 sing-box 的原生格式
  const configFileUrl = 'https://example.com/config.json';
  const { body } = await Plugins.HttpGet(configFileUrl, {
    'User-Agent': 'sing-box',
  });
  const _config = JSON.parse(body);
  // 对配置做出修改
  _config.inbounds.forEach((v) => {
    if (v.tag === 'tun-in') {
      v.auto_redirect = true;
      v.route_exclude_address_set = 'geoip-cn';
    }
  });
  // 自定义配置修改...
  // 确保 Clash API 与 GUI 配置保持一致
  _config.experimental.clash_api = {
    ..._config.experimental.clash_api,
    external_controller: clash_api.external_controller,
    secret: clash_api.secret,
  };
  // 返回修改后的配置
  return _config;
};
\`\`\``,
  },
  {
    keywordGroups: [
      ['怎么|如何|咋', '导入|添加|加入|粘贴|使用', '(单个)?节点|vmess|ss|vless|trojan'],
      ['import', 'single node|vmess|paste'],
      // --- 新增英文关键词 ---
      ['(how to)?', '(quick)?(import|add|paste)', '(single)?.*node|(share)?.*link'],
    ],
    answer: `**Q: 如何导入单个节点链接 (如 vmess://)？**

A:
1. 在 **插件中心** 安装并运行 **节点转换** 插件。
2. 在插件界面粘贴节点链接，选择配置格式，然后复制转换后的节点配置内容。
3. 将复制的内容添加至 **手动管理订阅**。
4. 在 **配置设置** 的 **出站分组** 或 **代理组** 中引用该节点。`,
  },

  // 🕹️ B.2.3.1 活动连接规则 (Active Connection Rules)
  {
    keywordGroups: [
      // 场景一：直接提问“为什么不生效”
      ['活动连接|概览|连接面板', '右键|添加|设置', '直连|代理|拦截', '[不没无]生效|没(有)?(效果|反应)|不起作用|没用'],
      // 场景二：询问“如何使其生效”
      ['活动连接|概览', '(右键|添加)的?(规则)?', '怎么|如何|咋', '(让.*)?(生效|启用|起作用|应用)'],
      // 场景三：询问规则存储位置或如何编辑 (有上下文)
      ['活动连接|概览', '(添加|设置)的?(规则)?', '在(哪|哪里)|如何|怎么', '看|查看|找到|编辑|修改|删除|移除'],
      // 新增场景四：询问规则文件位置 (无上下文)
      ['添加(到)?', '直连|代理|拦截', '(哪个|什么|哪里).*(规则)?文件'],
      // 场景五：直接提到规则集文件名
      ['(direct|proxy|reject)(\\.(yaml|json))?', '怎么用|如何生效|不起作用'],
      // 场景六：更口语化的组合
      ['右键|点(了)?', '添加|设置', '直连|代理|拦截', '然后呢|下一步|怎么用'],
    ],
    answer: `**Q: 在活动连接中右键添加的规则不生效？**

A: 通过 **概览 -> 活动连接** 面板右键添加的规则，本质上是向本地的三个特定规则集文件（\`direct.xxx\`, \`proxy.xxx\`, \`reject.xxx\`）追加条目。您需要手动在配置中引用这些规则集，才能让这些规则真正生效。

操作步骤如下：

**第一步：添加到规则集页面**

1.  前往 **插件中心**，安装并运行 **一键添加规则集** 插件。
2.  在弹出的窗口中，确保至少选中了 \`direct\`, \`reject\`, \`proxy\` 这三个规则集，然后点击确定。

**第二步：在配置中引用规则集**

您需要为每个配置方案单独进行设置：

*   **对于 GUI.for.SingBox:**
    1.  在 **配置** 页面，右键点击目标配置，选择 **路由设置**。
    2.  进入 **规则集** 标签页，点击 **添加**。
        *   **类型**: 选择 \`本地\`。
        *   **规则集**: 分别选择 \`direct\`, \`proxy\`, \`reject\` 添加三次。
    3.  进入 **规则** 标签页，点击 **添加**。
        *   **规则类型**: 选择 \`规则集\`。
        *   **规则集**: 选择您刚刚添加的规则集（例如 \`direct\`）。
        *   **出站标签**: 选择对应的出站（例如 \`direct\` 规则集对应 \`direct\` 出站）。
        *   重复此操作，为 \`proxy\` 和 \`reject\` 也创建规则。

*   **对于 GUI.for.Clash:**
    1.  在 **配置** 页面，右键点击目标配置，选择 **规则设置**。
    2.  点击 **添加**。
        *   **类型**: 选择 \`RULE-SET\`。
        *   **规则集类型**: 选择 \`本地\`。
        *   **规则集**: 选择对应的文件（例如 \`direct.yaml\`）。
        *   **代理**: 选择对应的策略组（例如 \`DIRECT\`）。
        *   重复此操作，为 \`proxy.yaml\` 和 \`reject.yaml\` 也创建规则。

**重要提示**：规则的顺序至关重要。请将您手动添加的这些规则集规则，放置在路由规则列表的**靠前位置**，以确保它们能被优先匹配。`,
  },

  // 🐞 B.2.4 内核错误 (Core Errors)
  {
    keywordGroups: [
      // 场景一：直接匹配错误日志
      ['cache.*(file)?', 'timeout'],
      // 场景二：中文描述
      ['缓存|cache', '(文件|file)?', '超时|timeout'],
      ['启动|initialize', '内核|服务|service', '卡住|超时|timeout', '缓存|cache'],
    ],
    answer: `**Q: 报错 "initialize cache-file: timeout" 或内核启动卡在缓存？**

A:
*   **原因**: sing-box 内核在启动时需要读写缓存文件（\`cache.db\`），此报错意味着该文件被另一个进程锁定或占用，导致新进程在规定时间内无法访问，最终超时失败。这通常是由于旧的内核进程未能正常退出所致。
*   **解决方案**:
    1.  **彻底关闭相关进程**: 打开您操作系统的任务/进程管理工具：
        *   **Windows**: 任务管理器 (Task Manager)
        *   **macOS**: 活动监视器 (Activity Monitor)
        *   **Linux**: 系统监视器或使用 \`kill\` 命令
    2.  **手动结束进程**: 在进程列表中，找到并手动结束所有名为 \`sing-box\` 的进程。
    3.  **重启内核**: 返回客户端，重新启动内核。此操作应能顺利完成。
*   **如果问题频繁出现**: 请前往 **软件设置 -> 通用**，找到并启用 **退出程序时同时关闭内核** 选项。这能确保每次退出程序时都不会留下残留的内核进程，从而避免缓存文件被持续占用。`,
  },
  {
    keywordGroups: [
      // 场景一：直接匹配错误日志
      ['detour', 'empty', 'direct'],
      ['detour to an empty direct outbound'],
      // 场景二：中文描述
      ['DNS|域名服务器', '出站|outbound', '直连|direct', '报错|出错|不行'],
    ],
    answer: `**Q: 报错 "detour to an empty direct outbound makes no sense"？**

A:
*   **原因**: 出于规范性考虑，新版本的 sing-box 内核不再允许将 DNS 服务器的“出站 (detour)”选项显式地设置为 \`direct\` 类型。
*   **解决方案**: 将该选项清空即可，内核会默认采用直连。
    1.  前往 **配置设置 -> DNS 设置 -> 服务器**。
    2.  找到“出站”为 \`直连 (direct)\` 的 DNS 服务器，点击其右侧的 **编辑** 按钮。
    3.  在弹出的编辑窗口中，点击出站标签 **旁边的 “x” 按钮** 将其清空。
    4.  保存设置。清空后，该 DNS 请求会默认直连发出，且符合内核新的配置规范。`,
  },
  {
    keywordGroups: [
      // 场景一：直接匹配错误日志
      ['missing', 'tags'],
      // 场景二：中文描述
      ['缺少|missing', '标签|tags'],
      ['出站|outbound|分组', '没有|缺少|空', '节点|订阅|tags|标签'],
    ],
    answer: `**Q: 报错 "create service: initialize outbound[*]: missing tags"？**

A:
*   **原因**: 某个出站分组（Proxy Group）内是空的，没有任何可用的节点或指向其他有效的分组。**每个出站分组必须至少包含一个可用的出站目标。**
*   **解决方案**:
    1.  前往 **配置设置 -> 出站设置 (Outbounds)**。
    2.  在左侧列表中，找到有 **感叹号 (!)** 标记的出站分组。
    3.  点击 **编辑** 该分组，并确保其“引用出站 & 引用订阅”部分中至少选择了一个有效的订阅、单个节点或其他分组。`,
  },
  {
    keywordGroups: [
      // 场景一：直接匹配错误日志
      ['max.*early.*data', 'unknown.*(field)?'],
      // 场景二：简化匹配
      ['max_early_data', '报错|错误|error'],
      // 场景三：中文描述
      ['订阅', '(更新|使用)后', '报错|提示', 'max_early_data'],
    ],
    answer: `**Q: 报错 "unknown field 'max_early_data'" 或相关类型错误？**

A:
*   **原因**: 部分订阅源提供的节点信息中，\`max_early_data\` 字段的值**不是规范的数字类型**（例如，错误地设置为了字符串 "" 或布尔值 false），导致内核解析配置时因类型不匹配而失败。
*   **解决方案**: 使用 **订阅脚本** 功能，在客户端接收到订阅内容后，自动修正这个错误。
    1.  在 **订阅** 页面，右键点击出错的订阅，选择 **脚本**。
    2.  将以下脚本代码 **完整复制并粘贴** 到脚本编辑框中：
\`\`\`javascript
const onSubscribe = async (proxies, subscription) => {
  // 遍历从订阅中获取的每一个代理节点
  proxies.forEach((p) => {
    // 检查节点是否存在 'transport' 属性，并且其中包含 'max_early_data' 字段
    if (p.transport && 'max_early_data' in p.transport) {
      const earlyData = p.transport.max_early_data;

      // 如果 'max_early_data' 的值不是一个有效的数字 (例如是字符串、布尔值等)
      if (typeof earlyData !== 'number' || isNaN(earlyData)) {
         // 则从配置中删除这个不规范的字段，避免内核报错
         delete p.transport.max_early_data;
      }
    }
  });

  // 返回修正后的代理列表和原始订阅信息
  return { proxies, subscription };
}
\`\`\`
    3.  点击 **保存**，然后 **更新该订阅**。问题应得到解决。`,
  },
  {
    keywordGroups: [
      // 场景一：直接粘贴错误信息
      ['unknown.*(field|key|option|parameter)'],
      // 场景二：中文描述错误
      ['报错|提示', '未知|不存在|不认识|无效', '字段|选项|参数|配置项'],
      ['字段|选项|参数|配置项', '不存在|找不到|未定义|不认识|是啥|什么意思'],
    ],
    answer: `**Q: 报错 "unknown field" / 提示未知字段？**

A: 这个错误通常意味着您在配置文件中使用了当前内核不认识的配置项。

**原因分析**:
*   **拼写错误或字段已弃用**: 您可能手误拼错了字段名称，或者该字段在您当前的内核版本中已被重命名或移除。
*   **版本不兼容**: 您使用的配置字段可能只在较新的内核版本中才被支持，而您当前的内核版本过旧。
*   **配置格式错误**: 该字段的值类型或结构不正确（例如，期望填入一个字符串，却提供了一个列表），导致内核无法正确解析。

**解决方案**:
请按照以下步骤排查：

1.  **核对官方文档**: 前往您所使用内核（sing-box 或 mihomo）的官方文档，仔细核对该字段的：
    *   **准确名称**: 确保字段名拼写无误。
    *   **支持版本**: 确认您当前的内核版本是否支持该字段。
    *   **正确用法**: 检查该字段期望的值类型和配置结构。

2.  **执行标准更新流程**: 为确保您使用的是最新环境，请依次执行：
    *   前往 **设置 -> 关于**，更新 GUI 客户端。
    *   前往 **插件中心**，更新并运行 **滚动发行** 插件。
    *   前往 **设置 -> 内核**，更新内核至最新版本。

3.  **修正配置**: 根据文档核对的结果，修正您配置中的错误字段或其值，然后重启内核。`,
  },

  // 🍏 B.2.6 macOS 专项 (macOS Specifics)
  {
    keywordGroups: [
      // 场景一：直接描述错误信息
      ['(提示|报错)?', '已损坏', '无法打开|打不开', '(移到|扔到|丢到)?废纸篓'],
      ['mac', '(无法|不能)验证开发者|来自身份不明的开发者|未识别的开发者'],
      ['mac', '将对(您的)?电脑造成(伤害|损坏)|恶意软件'],

      // 场景二：通用描述无法打开的问题
      [
        'mac|苹果',
        '(软件|客户端|程序|app|应用)?',
        '(启动|运行)不(了|起来)|打不开|无法打开|启动不了|无法启动|没反应|无响应|闪退|点不开|运行不了|无法运行|白屏|一直(转圈)?加载',
      ],
      ['mac', '(下载|安装)了?', '打不开|用不了|没反应'],

      // 这个模式不要求必须有“软件”等主语
      ['mac(系统|系统的)?', '(怎么|咋|为啥|就是)?(打不开|无法打开|启动不了|用不了|没反应)', '(求助|指导|怎么办|哪位|大(侠|佬|哥)?)?'],

      // 场景三：询问解决方案中的关键词
      ['mac', '任何来源', '没有|找不到|怎么开|如何启用'],
      ['mac', 'xattr|quarantine|隔离', '移除|删除|命令'],
      ['mac', '怎么|如何', '签名|codesign'],

      // 英文场景
      ['mac', 'app|application|program', '(can.?t|won.?t) open|damaged|not working|crash(es)?'],
      ['mac', 'developer cannot be verified|unidentified developer'],
      ['mac', 'is damaged and can.?t be opened'],
      ['mac', 'move to (trash|bin)'],
    ],
    excludeKeywords: [['tun'], ['网']],
    answer: `**Q: macOS 提示“已损坏”、“无法验证开发者”或“将对电脑造成伤害”，导致程序无法打开？打开显示白屏、一直加载无法进入软件主界面？**

A: 这是 macOS 的安全机制 (Gatekeeper) 导致的，属于正常现象。请严格按照以下步骤操作即可解决，通常只需要完成前两步。

**常规解决方案 (95% 的问题可解决)**

**第一步：移除应用的安全隔离属性**

打开 “终端” (Terminal) 应用程序，复制并粘贴以下命令，然后按回车执行。

\`\`\`bash
# -d 参数表示移除属性，-r 表示递归处理整个 .app 包
sudo xattr -dr com.apple.quarantine
\`\`\`
**重要提示**：在上面的命令最后（\`quarantine\` 后面）**需要加一个空格**，然后从 “访达” (Finder) 的 “应用程序” 文件夹中，**将无法打开的客户端程序图标拖拽到终端窗口中**，它会自动填充正确的路径。最终命令看起来像这样：
\`sudo xattr -dr com.apple.quarantine /Applications/GUI.for.SingBox.app\`

执行时会提示您输入电脑的开机密码（输入时密码不可见），输入后按回车即可。

**第二步：在系统设置中允许应用运行**

1.  前往 **系统设置 -> 隐私与安全性**。
2.  向下滑动到 “安全性” 部分。
3.  您会看到一条提示 “已阻止使用‘您的应用名’，因为其来自不明开发者。”，点击右侧的 **“仍要打开”** 按钮，并根据提示输入密码。

完成以上两步后，再次尝试打开客户端程序。

**进阶解决方案 (如果问题依旧)**

**方案 A：开启“任何来源”选项**

如果 “隐私与安全性” 中没有出现 “仍要打开” 的按钮，可以先在终端执行以下命令来显示 “任何来源” 选项：

\`\`\`bash
sudo spctl --master-disable
\`\`\`
执行后，回到 **系统设置 -> 隐私与安全性**，勾选 “允许从以下位置下载的 App” 下的 **“任何来源”** 选项。

**方案 B：覆盖恶意软件保护 (针对“将对电脑造成伤害”提示)**

1.  在 “访达” 的 “应用程序” 文件夹中，右键点击客户端图标，选择 **“显示简介”**。
2.  在弹出的窗口中，勾选 **“覆盖恶意软件保护”** 复选框。

**方案 C：对应用进行强制重签名 (终极方案)**

如果以上方法均无效，可能是应用签名问题。请在终端执行以下命令：

\`\`\`bash
# 前提是需要已安装 Xcode Command Line Tools
codesign --force --deep --sign -
\`\`\`
同样的，在命令末尾（\`-\` 后面）**加一个空格**，然后将应用图标拖入终端窗口来填充路径。如果提示需要安装命令行工具，请同意安装后再执行此命令。`,
  },

  // 🛡️ B.2.5 TUN 模式专项 (TUN Mode Specifics)
  {
    keywordGroups: [
      // 规则 A: 精准匹配 “TUN + 启动失败 + 权限问题”
      ['tun(模式)?', '(启动|开启|打开)失败', '权限|permission'],

      // 规则 B: 精准匹配 “TUN + 缺少权限”
      ['tun(模式)?', '([没无]|缺少)权限|permission denied'],

      // 规则 C: 精准匹配 “Linux + 如何 + 授权/给权限”
      ['linux|内核', '怎么|如何|咋', '(给|授(予)?)?(特)?权|提权|管理员'],

      ['linux', '怎么|如何|咋', '启用|开启|打开', 'tun'],

      // 英文规则
      ['tun( mode)?', 'permission|privilege|admin rights|sudo|root'],
    ],
    excludeKeywords: [['file not found']],
    answer: `**Q: TUN 模式无权限导致启动失败？**

A:
*   **Windows**: 前往 **设置 -> 通用**，启用 **以管理员身份运行** 并重启客户端。
*   **macOS/Linux**: 前往 **设置 -> 内核** 页面，点击 **授予特权** 按钮为内核授权。`,
  },
  {
    keywordGroups: [
      ['linux', '授权', '[没无]反应|点不了|点了没用|按了没反应|无效'],
      ['(授(予)?|给)(特)?权', '没(有)?(效果|反应)|点(了)?没用|无效'],
      // --- 新增英文关键词 ---
      ['linux', 'authorize button', 'doesn.?t work|no response|nothing happens'],
    ],
    answer: `**Q: Linux 点击授权按钮没反应？**

A: Linux 上的授权操作依赖 \`pkexec\` 命令，需确保已安装提供此命令的软件包。`,
  },
  {
    keywordGroups: [
      ['tun', 'configure', 'cannot', 'find', 'file'],

      ['tun', 'configure', '找不到', '文件'],
    ],
    answer: `**Q: 报错 "configure tun interface: The system cannot find the file specified."？**

A:
*   **原因**: sing-box 无法创建 TUN 虚拟网卡。
*   **解决方案**:
    1. 检查 **入站设置** -> \`tun-in\` 的 **TUN 网卡名称** 是否为空，尝试填入任意名称（如 \`sing-box-tun\`）。
    2. 确保没有其他应用（如其他代理软件、VPN）占用了 TUN 服务。
    3. 前往 **配置设置 -> 入站设置** -> \`tun-in\`，尝试修改 **IP 地址前缀** 为一个冷门的私有网段，以避免与当前局域网或其他网络接口产生冲突。`,
  },
  {
    keywordGroups: [
      // 通用关键词
      ['tun', '[没无]反应|([没无不]法?|不能|连不上|上不了|没).*网(络)?|断网'],
      ['tun', '系统代理', '才|必须|要开|依赖|同时'],
      ['tun', '断网|网络(异常|问题|断了)'],
      ['tun', '(一开|打开|启用).*(就)?', '没网|断网|上不了网'],
      ['tun', '打不开|无法访问', '网站|网页|github|google'],
      ['mac', '启动|运行|开', '内核|tun', '没网|断网|上不了网'],
      ['tun', '(只|仅)能.*(tg|电报|telegram)', '(网页|网站|浏览器).*(打不开|没反应|用不了)'],
      ['tun', '(不能?|无法)?访问|访问不了', '网络|网页|网站'],
      // 英文关键词
      ['tun', '(no|lost) (internet|connection)|can.?t connect|not working'],
      ['mac', 'tun', '(no|lost) (internet|connection)|can.?t connect|not working'],
      ['enable tun', 'lose internet|no network'],
      ['tun', '(only|just) (tg|telegram) works', '(browser|website)s? (doesn.?t|not) work'],
    ],
    excludeKeywords: [
      // 注意：这里不再排除 macos
      ['permission denied'], // 排除权限问题
      ['file not found'], // 排除文件找不到问题
      ['(ssl|证书).*(错误|error)'], // 排除 SSL 证书问题
    ],
    answer: `**Q: TUN 模式启动后无法上网？**

A: 请按以下顺序排查，方案覆盖 Windows, macOS 及 Linux：
*   **方案 A (通用): 更换 TUN 堆栈模式**
    在软件设置中尝试更换 **TUN 堆栈模式** (如 GVisor, System)。

*   **方案 B (macOS 特定): 修改系统 DNS**
    *   **原因**: sing-box 在 macOS 上不劫持发往局域网的 DNS 请求。
    *   **解决方案**: 将您 Mac 的系统 DNS 修改为任意公共 DNS 服务器（例如 \`8.8.8.8\`）。

*   **方案 C (Windows 特定): 检查防火墙**
    检查 Windows 防火墙设置，确保 GUI 客户端及其内核程序未被阻止。

*   **方案 D (通用 / IPv6 问题): 调整 IPv6 设置**
    如果您的网络不支持 IPv6，请进行以下调整：
    1.  **配置设置 -> 入站设置** -> \`tun-in\` -> 删除 IPv6 地址前缀，并启用 **严格路由**。
    2.  **配置设置 -> DNS 设置 -> 通用** -> 将 **解析策略** 设为 \`只使用 IPv4\`。

*   **方案 E (通用 / IP 冲突): 修改 IP 地址前缀**
    前往 **配置设置 -> 入站设置** -> \`tun-in\`，尝试修改 **IP 地址前缀** 为一个冷门的私有网段，以避免与当前局域网或其他网络接口产生冲突。`,
  },
  {
    keywordGroups: [
      ['tun(模式)?', '(ssl|证书).*(错误|error)'],
      // --- 新增英文关键词 ---
      ['tun( mode)?', 'ssl|certificate', 'error|issue|problem'],
    ],
    answer: `**Q: TUN 模式下出现 SSL 证书错误？**

A: 尝试将您操作系统的 DNS 服务器地址修改为公共 DNS，例如 \`8.8.8.8\` 或 \`1.1.1.1\`。`,
  },

  // 📚 其他 (通用规则放在最后)
  {
    keywordGroups: [
      ['怎么|如何|咋', '看|查看|打开|在哪', '(gui)?.*(控制台|日志)'],
      ['log', 'where|how to view|find'],
    ],
    answer: `**Q: 如何查看 GUI 日志？**

A: 按 \`Ctrl + Shift + F12\` 打开开发者工具控制台即可查看，主要记录 GUI 自身运行信息。`,
  },
  {
    keywordGroups: [
      ['怎么|如何|咋', '启用|开启|打开', '滚动(发行)?'],
      ['how to', 'enable', 'rolling(-release)?'],
    ],
    answer: `**Q: 怎么启用滚动发行？**

A:
1. 在 **通用设置** 中确保 **启用滚动发行** 已启用。
2. 在 **插件中心** 安装并运行 \`滚动发行\` 插件。
3. 定期在 **插件中心** 更新 \`滚动发行\` 插件。`,
  },
  {
    // 智能通用故障排查指南 (兜底规则)
    keywordGroups: [
      // 模式 1.1 (精确匹配): 【操作后】-> [否定状态] AND [具体行为/对象]
      [
        // 操作事件
        '(?:今天|刚刚)?(?:更新|升级|重启|安装|设置).*?(?:后|以后|完了)',
        // 否定状态
        '不(?:能|[动了开起来上])?|[无没]法|失败|报错|出?问题|异常|故障|闪退|死机|卡(?:住|了)?|(?:挂|崩|坏|寄)了|没反应',
        // 具体行为/对象
        '启动|运行|上网|打开|用|访问|连接|网(?:络)?|应用|程序|系统|软件|网页|网站',
      ],

      // 模式 1 (模糊匹配): 【操作后】-> [突发性负面结果]
      [
        // 操作事件 (同上)
        '(?:今天|刚刚)?(?:更新|升级|重启|安装|设置).*?(?:后|以后|完了)',
        // 问题描述
        '(?:突然|就)?(?:(?:不能|[无没]法)(?:启动|运行|上网|打开|用|访问|连接)|(?:启动|运行|用|上网|连接|访问)不(?:了|动|起来|上)|打不开(?:网站|网页)?|没(?:有)?网(?:络)?|闪退|死机|卡(?:住|了)|(?:挂|崩|坏|寄)了|没反应|失败|出问题|报错)',
      ],

      // 模式二：[主体] -> [负面结果]
      ['内核|程序|软件|客户端', '(无法|不能|没法)?.*(启动|运行)|(启动|运行).*(不了|不起来|失败|没反应)|启动失败'],
      ['内核|程序|软件|客户端', '(启动|运行|开)了?(之后|以后)?', '(就)?(没网|断网|上不了网)'],
      // 新增：匹配更模糊的 “好像...有问题”
      ['内核|程序|软件|客户端', '(好像|似乎|是不是|是啥|有啥|有点|什么).*(问题|毛病)(了)?'],

      // 模式三：【增强】超模糊的“突然不能用”问题
      ['突然|忽然|一下|怎么就|莫名', '不(能)?用(了)?|用不(了|动)|坏了|不行了|没反应了|连不上|没网了|无法连接'],
      ['(昨天|之前|本来|原来)(好好的|能用|正常)', '(今天|现在|突然|怎么)(不行了|用不了|坏了)'],
      ['啥也没干|没动过', '用不了|坏了|不行了'],

      // 模式四：“为啥/怎么”疑问句式
      ['为啥|怎么|咋', '(突然|一下|忽然)?(不能?用(了)?|用不(了|动)|坏了|不行了|没反应了|连不上|没网了|无法连接)'],
      // 新 new: 匹配更通用的求助，如 “这种怎么解决”
      ['这(个|种)|我这(个)?', '(怎么|咋)(解决|处理|弄)'],

      // 新增模式五：【排查后依旧无效】
      ['重装|重新安装|删(除|了)重?装|卸载重装', '(还是|依然|照样)?(不行|没用|用不了|连不上|老样子|一个样)'],
      ['((试|搞|弄)了)?((好)?几天|半天)', '(还是|依然)?(不行|没用|不会)'],

      // 英文模式
      ['app|client|core|program', '(won.?t|doesn.?t|can.?t) (start|launch|run)|failed to (start|launch|run)'],
      ['(after|when) i (start|launch|run|update)', '(no|lost) internet|connection lost'],
      ['(why)? it suddenly stopped working', '(help)?'],
      ['it was working (fine|yesterday)', '(but )?now it doesn.?t'],
      ['it just broke|doesn.?t work anymore'],
      ['reinstall(ed)?|tried everything', 'still not working'],
    ],
    excludeKeywords: [
      ['tun'],
      ['订阅|subscription'],
      ['节点|node'],
      ['截图|图片|视频|screenshot|image'],
      ['代码|堆栈|code|stack ?trace'],
      ['[a-zA-Z]:\\\\[^\\s]*|[a-zA-Z/]+/[^\\s]*\\.[a-zA-Z]{2,}:\\d+'],
      ['\\b(fail(ed)?|exception|panic|fatal|timeout|denied|invalid|refused|unauthorized|missing|unexpected|error)\\b'],
      ['异常|超时|拒绝|权限|找不到|无效|错误码|未授权|缺少|意外的|报错'],
      ['日志|log', '错误|error|提示|显示|说'],
    ],
    answer: `**Q: 程序无法启动或运行异常的通用排查指南**

你可能遇到了程序启动或运行问题，但未提供具体的错误信息。请首先尝试以下通用的解决方案，它们能解决大部分常见的故障。

**第一步：执行标准更新与检查流程**

请严格按照以下顺序，确保您的软件环境是最新且配置正确的：

1.  **更新主程序**: 前往 **软件设置 -> 关于** 页面，检测并更新 GUI 客户端至最新版本。
2.  **启用滚动发行**: 前往 **软件设置 -> 通用** 页面，确保 **启用滚动发行** 选项已启用。
3.  **更新滚动发行**: 前往 **插件中心**，安装或更新 **滚动发行** 插件至最新版本，并运行。
4.  **更新内核**: 前往 **软件设置 -> 内核** 页面，检测并更新内核至最新版本。

完成以上所有步骤后，请**重启内核**并检查问题是否解决。

**第二步：常见故障快速修复**

如果问题依旧，请尝试以下方案：

*   **结束残留进程**: 打开系统的任务管理器（或活动监视器），手动结束所有名为 \`sing-box\` 或 \`mihomo\` 的进程，然后重启内核。
*   **检查管理员权限**:
    *   **Windows**: 前往 **设置 -> 通用**，启用 **以管理员身份运行** 并重启客户端。
    *   **macOS/Linux**: 前往 **设置 -> 内核** 页面，点击 **授予特权** 按钮为内核授权。

**第三步：TUN 模式无法上网专项排查**

如果您的问题与 **TUN 模式** 相关（例如，开启后无法上网），请仔细遵循以下步骤：

*   **方案 A (通用): 更换 TUN 堆栈模式**
    在软件设置中尝试更换 **TUN 堆栈模式** (如 GVisor, System)。

*   **方案 B (macOS 特定): 修改系统 DNS**
    *   **原因**: sing-box 在 macOS 上不劫持发往局域网的 DNS 请求。
    *   **解决方案**: 将您 Mac 的系统 DNS 修改为任意公共 DNS 服务器（例如 \`8.8.8.8\`）。

*   **方案 C (Windows 特定): 检查防火墙**
    检查 Windows 防火墙设置，确保 GUI 客户端及其内核程序未被阻止。

*   **方案 D (通用 / IPv6 问题): 调整 IPv6 设置**
    如果您的网络不支持 IPv6，请进行以下调整：
    1.  **配置设置 -> 入站设置** -> \`tun-in\` -> 删除 IPv6 地址前缀，并启用 **严格路由**。
    2.  **配置设置 -> DNS 设置 -> 通用** -> 将 **解析策略** 设为 \`只使用 IPv4\`。

*   **方案 E (通用 / IP 冲突): 修改 IP 地址前缀**
    前往 **配置设置 -> 入站设置** -> \`tun-in\`，尝试修改 **IP 地址前缀** 为一个冷门的私有网段，以避免与当前局域网或其他网络接口产生冲突。

**最终步骤：如果问题仍未解决**

如果您已尝试上述所有方案但问题依旧，为了得到有效的帮助，请整理并提供以下内容：

**1. 环境与上下文信息**
*   **操作系统**: (例如: Windows 11 23H2, macOS Sonoma 14.5)
*   **GUI 客户端类型**: (GUI.for.Clash 或 GUI.for.SingBox)
*   **内核版本**:
*   **滚动发行版本**:
*   **代理模式**: (例如: TUN 模式, 系统代理模式等)

**2. 问题描述与证据**
*   **实际症状**: (程序实际表现出了什么问题？请客观描述现象。)
*   **复现步骤**: (您在问题出现前，具体执行了哪些操作？)

**3. 错误日志与截图**
*   请提供相关的**完整日志**、详细错误输出信息，或关键界面的**清晰截图/视频**。
`,
  },
];
