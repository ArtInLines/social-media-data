const readline = require('readline');
const { getObjVal } = require('./objectHelper');
const { waitingPercent } = require('./terminal');
const Twitter = require('twitter');
const client = new Twitter({
	// For Authentication
	consumer_key: process.env.API_KEY,
	consumer_secret: process.env.API_SECRET,
	access_token_key: process.env.ACCESS_KEY,
	access_token_secret: process.env.ACCESS_SECRET,
	bearer_token: process.env.BEARER_TOKEN,
});
/** Amount of maximum response objects by Twitter for `cursor` Requests */
const COUNT = 1000;
const { reqNums } = require('./../index');

module.exports = {
	getCursoredList,
	getFullList,
	twitterReq,
	rateLimited,
};

/**
 * Asynchronously makes a request to the Twitter API's Endpoint as per {@param path}
 *
 * Use when API Endpoint returns a cursor to navigate to the next result
 *
 * Only one of the params `userID` and `username` is needed
 *
 * @async
 * @param {string} path Path to API Endpoint as per Twitter API
 * @param {string} key Key to property of response object, that should be saved and returned.
 * @param {?string} [userID=null] Stringified User ID
 * @param {?string} [userName=null] Screen_Name of User
 * @returns {Array} If any data (e.g. data of a User) aren't allowed to be viewd by this program (e.g. cause the User is protected), then instead of the normal return element, this element of the Array will be an object with the property `protected` set to `true`. If the element is already an object with the property, it will get an extra property `protected_1` set to`true`.
 */
async function getCursoredList(path, key, userID = null, userName = null) {
	let params = {
		cursor: -1,
		count: COUNT, // Max: 5000
		stringify_ids: true,
	};
	params = setParamsID(params, userID, userName);
	console.log({ path });

	let arr = [];
	while (String(params.cursor) !== '0') {
		const obj = await twitterReq(path, params, 'cursor');
		params.count = COUNT; // Needs to be updated every iteration, because on request Errors (due to User being protected), params.count gets set to 1
		if (!obj) {
			arr.unshift(false);
			params.cursor--;
		} else {
			arr = arr.concat(obj[key]);
			params.cursor = obj.next_cursor_str;
		}
		if (params.cursor < 0) break;
	}
	return arr;
}

/**
 * Asynchronously makes a request to the Twitter API's Endpoint as per `path`
 *
 * Use when API Endpoint needs to be navigated per max_id
 *
 * Only one of the params `userID` and `username` is needed
 *
 * @param {string} path Path to API Endpoint as per Twitter API
 * @param {?string} userID Stringified User ID
 * @param {?string} screenName Screen_Name of User
 */
async function getFullList(path = '', userID = null, screenName = null) {
	let params = {
		count: 200, // Max: 200
		include_rts: false,
		exclude_replies: true,
		trim_user: true,
	};
	params = setParamsID(params, userID, screenName);
	console.log({ path });

	let arr = await twitterReq(path, params, 'max_id');
	arr = sortHelper(arr, 'id_str');
	params.max_id = getMaxID(arr, 'id_str');
	while (true) {
		let newArr = await twitterReq(path, params, 'max_id');
		if (newArr.length <= 1) break;
		newArr = sortHelper(newArr, 'id_str');
		if (newArr[0].id === params.max_id) {
			newArr.shift();
		} // Searching with max_id includes the earliest tweet whose max_id was being used to search for
		else {
			for (let x = 0; x < newArr.length; x++) {
				if (newArr[x] === params.max_id) {
					newArr.splice(x, 1);
					break;
				}
			}
		}
		arr = arr.concat(newArr);
		// Since searching with max_id, there's no need to sort concated array
		params.max_id = getMaxID(arr, 'id_str');
	}
	return arr;
}

/**
 * Asynchronously makes a Request to Twitter's API. Error Handling is automaticaly called in an error, so there is no need for a `catch`-block.
 *
 * @param {string} path Path to API Endpoint
 * @param {Object} params Parameters to feed into the request to the API
 * @param {String} funcName Differentiates between the different functions, namely `cursor`, `max_id`, `user_id_list` and `single`.
 *
 * @requires `twitter` node-module
 *
 * @returns {Promise<Boolean | Array | Object>} Either returns an Array/Object as expected for the special Twitter request or returns `false` if the information is impossible to get. If an unexpected Error appears, the program will exit with exit code 1.
 */
async function twitterReq(path, params, funcName) {
	return new Promise((resolve, reject) => {
		client.get(path, params, async (err, data, res) => {
			reqNums.all++;
			reqNums.allWithoutRateLimit++;
			if (err) {
				console.log({ path, params, err });
				let errCode = null;
				if (Array.isArray(err) && err[0].hasOwnProperty('code')) errCode = err[0].code;
				resolve(await reqErrHandling(funcName, path, params, res.statusCode, errCode));
			}
			reqNums.resolved++;
			resolve(data);
		});
	});
}

/**
 * Error Handling for Twitter Requests. This function is automatically caled by `twitterReq()` in case of an Error.
 *
 * @param {String} funcName Differentiates between the different functions, namely `cursor`, `max_id`, `user_id_list`, and `single`
 * @param {?String} path Path for the Request to Twitter's API as per the API paths.
 * @param {?Object} params Parameters of the function as used in for example `cursor`.
 * @param {Number} resStatusCode Status Code of the response of Twitter's API. 200-299 are good and will not lead to a rejection in `twitterReq`.
 * @param {?Number} errCode Error Code if there is any, as per `twitterReq`'s return value in a rejection.
 *
 * @returns {Promise<Boolean | Array | Object>} Either returns an Array/Object as expected for the special Twitter request or returns `false` if the information is impossible to get. If an unexpected Error appears, the program will exit with exit code 1.
 */
async function reqErrHandling(funcName = '', path = null, params = null, resStatusCode = 200, errCode = null) {
	switch (errCode) {
		case 88: // "Rate Limit" - general rate Limits take 15 minutes
			await rateLimited();
			reqNums.allWithoutRateLimit--;
			return await twitterReq(path, params);
		case 34: // "Page not found" - only possible if user was deleted while the program was running
			console.log('Error Code 34: "Page not found"');
			process.exit(1);
		// ...
	}

	if (resStatusCode !== 401) return unhandledErr(path, funcName);

	// All these cases are only if Status Code of the response === 401, meaning there was a protected user, causing the error.
	switch (funcName) {
		case 'cursor':
			if (params.count === 1) return false; // Meaning this Request Error happened inside this ErrorHandling function.
			params.count = 1;
			return await twitterReq(path, params, 'cursor');

		case 'max_id':
			return;

		case 'user_id_list':
			const idsArr = params.user_id.split(','),
				len = idsArr.length,
				IDs = new Array(len);
			for (let i = 0; i < len; i++) IDs[i] = await twitterReq('users/lookup', { user_id: idsArr.shift() }, 'single');
			return IDs;

		case 'single':
			return false;
	}
}

function unhandledErr(path, funcName) {
	console.log(`Unhandled Error at twitterReq() at ${funcName} at path ${path}`);
	process.exit(1);
}

/**
 * @async
 * Asynchonously pauses the program when rate limited by the API. Pause time is set to 15 minutes, as it is the default window for many API Endpoints.
 *
 * Is called automatically in `reqErrHandling()`, the Error Handling function of `twitterReq()`.
 */
async function rateLimited() {
	console.log("Rate Limit - don't panic, we can do this... I hope");
	const time = 15 * 60 * 1000;
	const intervalID = waitingPercent(0, waitAnimCB, time, process.hrtime());
	return new Promise((resolve, reject) => {
		setTimeout(() => {
			clearInterval(intervalID);
			readline.clearLine(process.stdout);
			resolve();
		}, time);
		// 15 minutes is default window for rate limits
	});
}

/**
 * Returns a number in percentages, which indicates how much time has been waited of the total already.
 *
 * Use as Callback function for `waitingPercent()`
 * @param {number} total Total amount of ms, that are to be waited
 * @param {*} t Initial result of `process.hrtime()`
 */
function waitAnimCB(total, t) {
	const seconds = process.hrtime(t)[0];
	total /= 1000;
	return Math.floor((seconds / total) * 100);
}

/**
 * Helper function, to emit only user_id or screen_name to Twitter's API
 *
 * @param {Object} params Parameter Object, that will be emitted to Twitter's API
 * @param {?string} userID user_id of specified Twitter User
 * @param {?string} screenName screen_name of specified Twitter User
 */
function setParamsID(params, userID, screenName) {
	if (userID) params.user_id = userID;
	else params.screen_name = screenName;
	return params;
}

/**
 * Gets the max_id from a sorted Array of Tweets
 *
 * @param {Array<number | string | bigint>} tweets Sorted Array of Tweets
 */
function getMaxID(tweets, keys = null) {
	let maxIDTweet;
	if (tweets[0] < tweets[tweets.length - 1]) maxIDTweet = tweetss[0];
	else maxIDTweet = tweets[tweets.length - 1];
	if (keys !== null) maxIDTweet = getObjVal(maxIDTweet, keys);
	return maxIDTweet;
}

/**
 * Sort Array of Objects by given `key` of said Objects. If Elements of Array aren't objects, omit `key` or explicitly put it to `null`.
 *
 * @param {Array} arr Unsorted Array of Tweets
 * @param {?string|string[]} [keys=null] Key(s) to find value of Object by, to sort Elements of Array by. `keys` can encompass several strings, either by putting them in an array or by seperating them in a single array by given `seperator`
 * @param {boolean} [highestFirst=true] When `true`, the first element of the sorted Array will have the highest Element. Defaults to `true`.
 * @param {string} [seperator=','] String to seperate keys with, if several keys are emitted in a single string
 */
function sortHelper(arr, keys = null, highestFirst = true, seperator = ',') {
	let n = arr.length;
	for (let i = 0; i < n; i++) {
		// Choosing the first element in our unsorted subarray
		let current = arr[i],
			currentNum = current;
		if (keys !== null) {
			currentNum = getObjVal(current, keys, null, seperator);
			console.assert(arr[i] !== currentNum, "Current Num shouldn't be equal to arr[i]");
		}
		// The last element of our sorted subarray
		let j = i - 1;
		if (highestFirst) {
			while (j >= 0 && checkBigInt(currentNum) > checkBigInt(arr[j].id_str)) {
				arr[j + 1] = arr[j];
				j--;
			}
		} else {
			while (j >= 0 && checkBigInt(currentNum) < checkBigInt(arr[j].id_str)) {
				arr[j + 1] = arr[j];
				j--;
			}
		}
		arr[j + 1] = current;
	}
	return arr;
}

/**
 * Checks if `val` is of type `BigInt` and transforms it into a Number of DataType `BigInt` if it isn't already
 *
 * @param {(string|number|bigint)} val Number to transform into a Number of DataType `BigInt`
 * @returns {bigint} Returns Number as Type of `BigInt`
 */
function checkBigInt(val) {
	if (typeof val !== 'bigint') {
		val = BigInt(val);
	}
	return val;
}
