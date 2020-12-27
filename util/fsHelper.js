const fs = require('fs');
const { mapToObj } = require('./objectHelper');

module.exports = {
	writeJSON,
	getFPath,
	createDir,
	getJSONData,
};

/**
 * Asyonchronously get data from a json file.
 * @param {string} path Path to `json` file.
 * @param {?string | string[]} keys List of Object keys as String or as Array of string-formatted keys with specified `seperator`. Defaults to null, meaning the Object root.
 * @param {string} seperator Symbol/String, by which to seperate the list of keys by, if they are in string format. Defaults to `,`
 */
function getJSONData(path = '', keys = null, seperator = ',') {
	return getObjVal(JSON.parse(fs.readFileSync(path)), keys, null, seperator, true);
}

/**
 * Synchronously write a JSON-File at given location relative to Root Directory.
 *
 * @param {Array | Object | Map | Set} data JS Object/Array, that can be parsed to a JSON Object/Array.
 * @param {?string} [fname=''] Filename of created File. Defaults to an empty string.
 * @param {?string} [path='./'] Path to directory to store the File in. Defaults to root directory `'./'`
 * @param {boolean} [replace=true] Indicates whether an already existing file with the same name should be replaced or not. Defaults to `true`.
 * @param {?string[]} [params=null] Further strings, that should be appended to the Filename (e.g. Date, etc.) to differentiate from other files with the same `fname`.
 */
function writeJSON(data, fname = '', path = './', replace = true, params = null) {
	let filepath = getFPath(fname, path, replace, params, 'json');
	if (data instanceof Map) data = mapToObj(data);
	else if (data instanceof Set) data = Array.from(data);
	fs.writeFileSync(filepath, JSON.stringify(data, null, '\t'));
}

/**
 * Creates a valid Filepath and returns it. This functions doesn't create a File. This function is meant as a Helper for functions like `writeFile`.
 * @param {?string} fname Filename
 * @param {?string} [path=''] Path to store file, relative to Root Directory
 * @param {boolean} [replace=true] Indicates whether an already existing file with the same name should be replaced or not
 * @param {?string[]} [params=[]] Further strings, that should be appended to the Filename (e.g.Date, etc.) to differentiate from other files with the same `fname`.
 * @param {string} [type='json'] Type extension of File.
 * @returns {string} Absolute Filepath
 */
function getFPath(fname, path = './', replace = true, params = null, type = 'json') {
	function pathNameHelper(arr) {
		path = '';
		for (let i = 0; i < arr.length; i++) {
			if (i < fname.length - 1) path += arr[i] + '/';
			else fname = arr[i];
		}
	}

	if (path === null) pathNameHelper(fname.split('/'));
	else if (fname === null) pathNameHelper(path.split('/'));

	// If Path === '', path = './'; else if path ends with '/', path = path; else path = path + '/'
	path = `${path === '' ? './' : path.split('')[path.length - 1] === '/' ? path : path + '/'}`;

	if (params !== null) {
		for (let i = 0, len = params.length; i < len; i++) {
			fname += `_${params[i]}`;
		}
	}
	if (fname === '') fname = 'untitled';

	let i = 1,
		filename = fname;
	if (type.split('')[0] !== '.') type = '.' + type;
	while (!replace && fs.existsSync(path + filename + type)) {
		filename = fname + `_${i}`;
		i++;
	}
	filename += `${type}`;
	return path + filename;
}

/**
 * Synchronously checks if specified directories exists already and if not, creates it.
 * @param {string} dirPath Path to Directory. If the string includes several directories, seperated by `/`, each of the specified directories will be created.
 */
function createDir(dirPath) {
	const dirs = dirPath.split('/');
	let dir;
	if (dirs[0] === '.') dir = '.';
	else {
		dir = '/' + dirs[0];
		if (!fs.existsSync(dir)) {
			fs.mkdirSync(dir);
		}
	}
	for (let i = 1; i < dirs.length; i++) {
		dir += '/' + dirs[i];
		if (!fs.existsSync(dir)) {
			fs.mkdirSync(dir);
		}
	}
}
