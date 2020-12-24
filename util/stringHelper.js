module.exports = { replaceAt };

/**
 * Replace character at specified index of string.
 * @param {string} string String to replace character at
 * @param {number} [index=-1] Index in string, of the character, that you wish to replace. Negative numbers are allowed. Defaults to `-1`.
 * @param {string} [replacement=''] Character(s) to replace character at index with. If omitted or inputted as empty string, the character at the specified index is simply removed from the string. Defaults to an empty string
 * @param {number} [replaceAmount=1] The amount of characters you want to replace from `index` on. Defaults to `1`. Setting this to `0` might lead to unexpected outcome.
 */
function replaceAt(string, index = -1, replacement = '', replaceAmount = 1) {
	if (index < 0) index = string.length + index; // + because index must be negative already, if index < 0;
	return string.substr(0, index) + replacement + string.substr(index + replaceAmount);
}
