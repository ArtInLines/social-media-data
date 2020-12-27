const stringHelper = require('./stringHelper');
module.exports = { getObjVal, addArrToMap, mapToObj, transformMap, addObjArrToObj, getObjSize, stringifyObj };

/**
 * Get (and if wanted change) value of Object at position, specified by the `keys`parameter. Omit `val` or emit null, if you don't want to change any values.
 *
 * @param {Object} obj Object to get/change children from
 * @param {(?string|string[])} [keys=[]] List of Keys to get from root `obj` to wanted value. Several keys can be emitted as `string`, if keys are seperated by specified `seperator`.
 * @param {*} [val=null] Value to change specified Object-Key to. If `null`, no values will be changed. Defaults to `null`.
 * @param {string} [seperator=,] Specified seperator of string keys, if several keys are to be emitted in a single `string`. Defaults to `,`.
 * @param {Boolean} [returnObj=false] If set to true, will return the inputted object when keys are an unexpected value instead of `undefined`. Defaults to `false`.
 * @returns {(object|Array|undefined)} Returns value specified by `keys`, which is the changed value if `val` wasn't equal `null`. Returns `undefined` as Error and `Array` when several OBjects through this way of object and keys were found - meaning if there was an Array inside the obj-key-path. (See entities-objects for example).
 */
function getObjVal(obj, keys = [], val = null, seperator = ',', returnObj = false) {
	if (typeof keys === 'string') keys = keys.split(seperator);
	else if (!Array.isArray(keys)) {
		if (returnObj) return obj;
		else return undefined;
	}
	for (let i = 0, len = keys.length; i < len; i++) {
		/* console.log({ obj, keys, i }); */
		if (Array.isArray(obj)) {
			let objs = [],
				tempKeys = keys.slice(i);
			for (let j = 0; j < obj.length; j++) {
				objs.push(getObjVal(obj[i], tempKeys, val, seperator));
			}
			return objs;
		}

		if (obj === undefined || obj === null) return undefined;

		if (obj instanceof Map) {
			obj = obj.get(keys[i]);
			continue;
		}

		if (val !== null && i === len - 1) obj[keys[i]] = val;

		obj = obj[keys[i]];
	}
	return obj;
}

/**
 * Stringifies a JS Object/Array/Map/Set and returns it.
 * @param {Object | Array | Map | Set} obj Any JS Object, Array or even Set or Map
 * @param {Boolean} addComma Indicates whether or not a comma should be added to the stringified Object
 * @param {Boolean} beautify Indicates whether to beautify the string (adding tabs and newlines). Defaults to `true`.
 */
function stringifyObj(obj = {}, addComma = true, beautify = true) {
	let stringifiedObj;
	if (beautify) stringifiedObj = JSON.stringify(obj, null, '\t');
	else stringifiedObj = JSON.stringify(obj);
	if (addComma) stringifiedObj = stringHelper.replaceAt(stringifiedObj, -1, '},');
	return stringifiedObj;
}

/**
 * Adds the values of an Array to a Map and returns said Map.
 *
 * @param {Map} map Map to add values of the specified Array to.
 * @param {Array} arr Array to add values of to the specified Map.
 * @param {*} keys List of keys to get key from friendsList's element from. If `keys` is `null`, the element of the Array is set both as key and value of the Map. Defaults to `null`.
 */
function addArrToMap(map, arr, keys = null) {
	for (let i = 0; i < arr.length; i++) {
		let key = arr[i];
		if (keys !== null && typeof key === 'object') key = getObjVal(arr[i], keys);
		if (map.has(key)) continue;
		map.set(key, arr[i]);
	}
	return map;
}

/**
 * Creates and returns either a new Object or Array with the Data of the inputted Map. Creates an Array, if the values of the Map are identical with its keys and creates an Object otherwise.
 * @param {Map} map
 */
function transformMap(map) {
	console.assert(map instanceof Map, "Inputted map is not a Map and thus can't be transformed into an Object");
	for (let [key, val] of map) {
		if (key === val) return Array.from(map);
		else return mapToObj(map);
		// Returns inside for-Loop, because the for-loop only exists to get the first key-value-pair of the Map.
	}
}

/**
 * Creates and returns a new Object with the Data of the inputted Map.
 * @param {Map} map Map, that is to be transformed into an Object
 */
function mapToObj(map) {
	const obj = new Object();
	map.forEach((val, key) => {
		if (val instanceof Map) {
			val = transformMap(val);
		}
		obj[key] = val;
	});
	return obj;
}

/**
 *
 * @param {Array} arr Array of Objects.
 * @param {Object|Map} Obj Object to add Objects of Array to. Object may be a Map too.
 * @param {?string|string[]} [keys=null] Unless Array contains only string elements, keys must never be `null`. Defaults to `null`
 * @param {string} [seperator=','] String by which to split List of keys if `keys` is a string. Defaults to `,`. Generally not needed.
 * @returns Returns an Array of the keys of the newly added key value pairs of `Obj`.
 */
function addObjArrToObj(arr, Obj, keys = null, seperator = ',') {
	let returnArr = [];
	for (let i = 0; i < arr.length; i++) {
		let key = getObjVal(arr[i], keys, null, seperator);
		if (key === undefined) key = arr[i];
		if (Obj instanceof Map) Obj.set(key, arr[i]);
		else Obj[key] = arr[i];
		returnArr.push(key);
	}
	return returnArr;
}

function getObjSize(obj) {
	return obj.keys().length;
}
