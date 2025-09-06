**GUI.for.Cores 常见问题与解决方案 (FAQ)**

**⚙️ 常规与界面**

**Q: 软件开机自启动不生效？**
A: 请检查程序所在的完整路径，确保其中不包含中文、空格或特殊字符。

**Q: 滚动发行插件无法更新到新版本？**
A:
1.  首先，请在 **插件中心** 检查并更新 `滚动发行` 插件本身至最新版本。
2.  如果问题依旧，请尝试删除程序目录下的 `data/rolling-release` 文件夹后重试。

**Q: 滚动发行提示无法跨大版本升级？**
A: 滚动发行仅在当前最新的大版本内工作。当客户端发布新的大版本后，你需要前往 **设置 -> 关于** 页面，手动检查并更新主程序。

**Q: 首页为什么只显示 4 个配置项？**
A: 这是程序设计。你可以在 **配置** 页面通过拖拽来调整配置文件的显示顺序。

**🌐 网络与订阅**

**Q: 更新时提示 "403 API rate limit exceeded" 错误？**
A:
1.  请前往你的 GitHub 开发者设置，生成一个新的 Personal Access Token (PAT)。
2.  将获取的 Token 填入客户端的 **设置 -> 通用 -> 向 REST API 进行身份验证** 输入框中。

**Q: 订阅没有流量信息，或更新时提示 "Not a valid subscription data"？**
A:
1.  在 **订阅 -> 编辑** 中，为目标订阅添加请求头 `User-Agent: Clash.Meta`。
2.  同时，请确保你当前的网络环境可以正常访问该订阅链接。

**Q: 在有多网卡的设备上（如同时连接Wi-Fi和网线），启动后网络异常？**
A:
1.  前往 **配置设置 -> 路由设置 -> 通用**。
2.  禁用 **自动检测出站接口** 选项。
3.  在下方的出站接口名称列表中，手动选择你当前用于上网的那个物理网卡。

**🔌 配置与导入**

**Q: 如何导入并使用自己的完整配置文件（本地或远程）？**
A: 客户端不直接支持导入，但可通过以下方式实现：
*   **GUI.for.Clash**: 在添加订阅时，启用 **使用订阅内的策略组和分流规则** 选项。
*   **GUI.for.SingBox**: 通过配置脚本实现。请进入 **配置设置 -> 混入和脚本 -> 脚本操作**，添加对应脚本：

    **导入本地文件 (请将 `PATH/TO/config.json` 替换为你的实际文件路径)**
    ```javascript
    const onGenerate = async (config) => {
      const { experimental } = config;
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
      _config.experimental = {
        ..._config.experimental,
        external_controller: experimental.external_controller,
        secret: experimental.secret,
      };
      // 返回修改后的配置
      return _config;
    };
    ```

    **导入远程 URL (请将 URL 替换为你的配置文件地址)**
    ```javascript
    const onGenerate = async (config) => {
      const { experimental } = config;
      // 从远程 URL 读取并解析 sing-box 配置
      // 此方法需要远程订阅或者配置文件支持 sing-box 的原生格式
      const configFileUrl = 'https://example.com/config.json';
      const { status, headers, body } = await Plugins.HttpGet(configFileUrl, {
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
      _config.experimental = {
        ..._config.experimental,
        external_controller: experimental.external_controller,
        secret: experimental.secret,
      };
      // 返回修改后的配置
      return _config;
    };
    ```

**🐞 内核错误**

**Q: 报错 `"start service: initialize cache-file: timeout"`？**
A: 原因是 sing-box 进程未能正常退出。请打开任务管理器（或活动监视器），手动结束所有名为 `sing-box` 的进程，然后重启内核。

**Q: 报错 `"detour to an empty direct outbound makes no sense"`？**
A: 这是新版 sing-box 的规则。
1.  前往 **配置设置 -> DNS 设置 -> 服务器**。
2.  找到“出站”标签为 `直连` 的服务器，点击 **编辑**。
3.  点击出站标签旁边的 **x** 按钮将其清空（留空默认即为直连）。

**Q: 报错 `"create service: initialize outbound[*]: missing tags"`？**
A: 原因是某个出站分组内为空。请前往 **配置设置 -> 出站设置**，找到左侧有红色感叹号的出站分组，点击 **编辑** 并确保其至少包含一个订阅或有效节点。

**🛡️ TUN 模式专项**

**Q: TUN 模式提示无权限，启动失败？**
A:
*   **Windows**: 前往 **设置 -> 通用**，勾选 **以管理员身份运行**，然后重启客户端。
*   **macOS/Linux**: 前往 **设置 -> 内核** 页面，点击授权按钮为内核程序授权。

**Q: Linux 点击授权按钮没反应？**
A: Linux 上的授权操作依赖 `pkexec` 命令，请确保你的系统已安装提供此命令的软件包。

**Q: TUN 模式启动后无法上网？**
A: 请按以下顺序排查：
1.  **更换TUN堆栈**: 在软件设置中尝试更换 **TUN 堆栈模式** (例如 GVisor, System)。
2.  **检查防火墙**: 检查 Windows 防火墙设置，确保 GUI 客户端及其内核程序（如 `sing-box.exe`）未被阻止。
3.  **处理IPv6问题**: 如果你的网络环境不支持 IPv6，请进行以下调整：
    *   前往 **配置设置 -> 入站设置**，编辑 `tun-in`，在 **IPv4 和 IPv6 前缀** 中删除 IPv6 地址 (`ffff::1/126`)，并启用 **严格路由**。
    *   前往 **配置设置 -> DNS 设置 -> 通用**，将 **解析策略** 设为 `只使用 IPv4`。

**Q: TUN 模式下出现 SSL 证书错误？**
A: 请尝试将你操作系统的 DNS 服务器地址修改为公共 DNS，例如 `8.8.8.8` 或 `1.1.1.1`。

**Q: macOS 系统启用 TUN 模式后无法上网？**
A: 原因是 sing-box 在 macOS 上不劫持发往局域网的 DNS 请求。请将你 Mac 的系统 DNS 修改为任意公共 DNS 服务器（如 `8.8.8.8`）。
