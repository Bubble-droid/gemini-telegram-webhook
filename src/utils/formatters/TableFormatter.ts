// src/utils/formatters/TableFormatter.ts

/**
 * 专门用于解析、清理和格式化 Markdown 表格的工具类。
 * 最终优化版：能够正确处理中英文混合对齐，并生成具有完整边框和统一、
 * 简洁分隔符的“盒子绘图”效果文本表格。
 */
class TableFormatter {
  private rows: string[][] = [];
  private columnWidths: number[] = [];
  private readonly MIN_COLUMN_WIDTH = 3; // 至少能容纳 ' x '

  /**
   * 计算字符串的视觉显示宽度。
   * 全角字符计为2，半角字符计为1。
   * @param str - 需要计算宽度的字符串。
   * @returns 字符串的视觉宽度。
   */
  private getDisplayLength(str: string): number {
    if (!str) return 0;

    let visualWidth = 0;
    for (let i = 0; i < str.length; i++) {
      visualWidth += str.charCodeAt(i) > 255 ? 2 : 1;
    }
    return visualWidth;
  }

  /**
   * 格式化一个完整的 Markdown 表格字符串。
   * @param tableString - 未经格式化的 Markdown 表格文本。
   * @returns 格式化后的 Markdown 表格文本。
   */
  public format(tableString: string): string {
    const lines = tableString
      .trim()
      .split('\n')
      .filter((line) => line.trim().startsWith('|'));

    if (lines.length < 2) {
      return tableString;
    }

    this.parseRows(lines);
    if (this.rows.length === 0 || this.rows[0].length === 0) {
      return tableString;
    }

    this.calculateColumnWidths();
    return this.buildFormattedTable();
  }

  /**
   * 解析表格的表头和表体行。
   */
  private parseRows(lines: string[]): void {
    const dataLines = [lines[0], ...lines.slice(2)];
    this.rows = dataLines.map((line) =>
      line
        .replace(/^\||\|$/g, '')
        .split('|')
        .map((cell) => cell.trim().replace(/`/g, '')),
    );
  }

  /**
   * 根据视觉宽度计算每一列所需的最大宽度（包含两侧各一个的内边距空格）。
   */
  private calculateColumnWidths(): void {
    const columnCount = this.rows[0]?.length || 0;
    this.columnWidths = Array(columnCount).fill(this.MIN_COLUMN_WIDTH);

    for (const row of this.rows) {
      const validColumnCount = Math.min(columnCount, row.length);
      for (let i = 0; i < validColumnCount; i++) {
        // 单元格内容宽度 + 2个单位的内边距 (左右各一)
        const requiredWidth = this.getDisplayLength(row[i] || '') + 2;
        this.columnWidths[i] = Math.max(this.columnWidths[i], requiredWidth);
      }
    }
  }

  /**
   * 构建表格的顶部或底部边框行 (例如: +------------------+----------+)。
   * @returns 边框字符串。
   */
  private buildBorderLine(): string {
    const segments = this.columnWidths.map((width) => '-'.repeat(width));
    return `+${segments.join('+')}+`;
  }

  /**
   * [已重构] 构建完整的、具有统一简洁分隔符的表格。
   * @returns 格式化后的表格字符串。
   */
  private buildFormattedTable(): string {
    const formattedLines: string[] = [];
    const borderLine = this.buildBorderLine();

    // [修改] 创建统一的分隔线 (例如: |------------------|----------|)
    // 此分隔线将用于表头之后和所有数据行之间
    const separatorSegments = this.columnWidths.map((width) => '-'.repeat(width));
    const separatorLine = `|${separatorSegments.join('|')}|`;

    // 1. 添加顶部边框
    formattedLines.push(borderLine);

    // 2. 添加表头
    formattedLines.push(this.buildRow(this.rows[0]));

    // 3. 添加统一的分隔线
    formattedLines.push(separatorLine);

    // 4. 添加表体
    for (let i = 1; i < this.rows.length; i++) {
      formattedLines.push(this.buildRow(this.rows[i]));
      // 在行之间添加统一的分隔线（除了最后一行之后）
      if (i < this.rows.length - 1) {
        formattedLines.push(separatorLine);
      }
    }

    // 5. 添加底部边框
    formattedLines.push(borderLine);

    return formattedLines.join('\n');
  }

  /**
   * 构建单行格式化的表格行，确保单元格内容居中并包含一个空格的内边距。
   * @param rowData - 当前行的数据数组。
   * @returns 格式化后的单行字符串 (例如: |  cell 1  |  cell 2  |)。
   */
  private buildRow(rowData: string[]): string {
    const cells = rowData.map((cell, i) => {
      if (i >= this.columnWidths.length) return '';

      const targetWidth = this.columnWidths[i];
      const cellDisplayLength = this.getDisplayLength(cell);

      // 总内边距 = 目标宽度 - 内容宽度
      const paddingTotal = targetWidth - cellDisplayLength;
      const paddingLeft = Math.floor(paddingTotal / 2);
      const paddingRight = Math.ceil(paddingTotal / 2);

      return `${' '.repeat(paddingLeft)}${cell}${' '.repeat(paddingRight)}`;
    });

    return `|${cells.join('|')}|`;
  }
}

export const tableFormatter: TableFormatter = new TableFormatter();
