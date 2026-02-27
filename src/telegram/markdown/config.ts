export const REGEX_CODE_BLOCK =
  /^[ \t]*(?<delimiter>`{3,6})(?<language>\w*)[ \t]*\n?(?<content>[\s\S]+?)\n?[ \t]*\k<delimiter>/my;
