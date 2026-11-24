/**
 * CJK 相关字符的匹配范围
 *
 * - `\p{Unified_Ideograph}`：CJK 统一表意文字（含扩展区，覆盖范围视运行时 Unicode 数据而定）
 * - U+1100–U+11FF：韩文 Jamo（韩文音节 U+AC00–D7AF 不在此列，保持按词渲染）
 * - U+2000–U+2BFF：通用标点、箭头、数学符号、带圈字符、几何图形等
 * - U+2E00–U+33FF：补充标点、CJK 部首与标点、假名、注音、韩文兼容 Jamo、带圈 CJK 等
 * - U+F900–U+FAFF：CJK 兼容表意文字
 * - U+FE30–U+FE4F：CJK 兼容形式
 * - U+FF00–U+FFEF：半角及全角形式（含全角标点与半角片假名）
 *
 * 不包含天城文（U+0900–U+097F）等印度系文字、泰文、藏文、缅甸文等非 CJK 文字区间，
 * 也不包含 U+2C00–U+2DFF 的格拉哥里文、拉丁扩展 C、科普特文、提非纳文、
 * 埃塞俄比亚文扩展、西里尔扩展 A 等文字区，避免它们被误判为 CJK 后
 * 按 UTF-16 代码单元拆分，破坏组合字符的字形塑形。
 *
 * 为兼容旧行为，U+2000–U+2BFF 的通用标点、箭头、几何图形等符号仍视为 CJK，
 * 使「你好★」这类含装饰符号的词仍可逐字拆分。
 */
const CJK_CHAR_RE =
	/^[\p{Unified_Ideograph}\u1100-\u11FF\u2000-\u2BFF\u2E00-\u33FF\uF900-\uFAFF\uFE30-\uFE4F\uFF00-\uFFEF]+$/u;

/**
 * 判断字符串是否全部由 CJK 相关字符组成
 * @param char 待判断的字符串
 * @returns 是否全部为 CJK 相关字符
 */
export const isCJK = (char: string): boolean => CJK_CHAR_RE.test(char);
