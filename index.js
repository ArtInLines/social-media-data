/**
 * A Twitter ID for either a User, a Tweet or something else. These IDs are stored as `strings`, may be converted into a `bigint` too, though.
 * @typedef {string|bigint} ID
 */
const statistics = {
	reqNums: { all: 0, allWithoutRateLimit: 0, resolved: 0 },
	userNums: { all: 0, lookedAt: 0, tooBig: 0, inactive: 0, protected: 0 },
	// ADD MORE
};
module.exports = { reqNums: statistics.reqNums };

require('dotenv').config({ path: `${__dirname}/config.env` });
const fs = require('fs');
const { readFile } = require('fs/promises');
const { getCursoredList, getFullList, twitterReq } = require('./util/twitterReq');
const { writeJSON, createDir } = require('./util/fsHelper');
const stringHelper = require('./util/stringHelper');
const { stringifyObj } = require('./util/objectHelper');
const terminal = require('./util/terminal');

const TWITTER_ACCOUNTS = /* ['SphereVexi']; */ /* ['Lord_Plaga']; */ process.env.TWITTER_ACCOUNTS.split(',');
const USERS_LOOK = {
	LOOKED_AT: process.env.USERS_LOOK_LOOKED_AT,
	IGNORE: process.env.USERS_LOOK_IGNORE,
	TOO_BIG: process.env.USERS_LOOK_TOO_BIG,
	INACTIVE: process.env.USERS_LOOK_INACTVE,
	TO_LOOK: process.env.USERS_LOOK_TO_LOOK,
	PROTECTED: process.env.USERS_LOOK_PROTECTED,
};
const TWEETS_MIN = Number(process.env.TWEETS_MIN);
const FOLLOWERS_MAX = Number(process.env.FOLLOWERS_MAX);
const FRIENDS_MAX = Number(process.env.FRIENDS_MAX);
const dataDir = process.env.DATA_DIR;
const lookedAtUsersPath = `${dataDir}/lookedAtUsers.json`,
	notLookedAtUsersPath = `${dataDir}/notLookedAtUsers.json`;
/**
 * Returns Directory Path for specified User.
 * @param {String} username screen_name of Twitter User.
 */
function userDir(username) {
	return `${dataDir}/users/${username}`;
}
/**
 * Map of all users, where the keys are the userIDs and the properties are:
 * - "name" (containing screen_name of User)
 * - "to_look" (containing one of the properties, saved as an enumerable in the `USERS_LOOK` object)
 */
const users = new Map();
const notLookedAtUsers = new Map();
createDir(dataDir);
const usersStream = fs.createWriteStream(lookedAtUsersPath);

////////
////////
////////

/**
 * Main function, that encompasses data collection from Twitter
 */
async function main() {
	usersStream.write('{');

	// Get Data of Starting Users
	await getDataOfStartingUsers();
	// Get Data of Inner Circle
	await getInnerCircle();
	console.log({ users, notLookedAtUsers });

	usersStream.end('}');
	console.log('Done with getting user data');
	terminal.logMemory();
	statistics.userNums.lookedAt = users.size;
	statistics.userNums.all = users.size + notLookedAtUsers.size;
	console.log({ statistics });
	writeJSON(statistics, 'statistics', dataDir);

	const fileContents = stringHelper.replaceAt(await readFile(`${lookedAtUsersPath}`, { encoding: 'utf-8' }), -2, '');
	fs.writeFileSync(lookedAtUsersPath, fileContents);
	writeJSON(notLookedAtUsers, notLookedAtUsersPath);
	writeAllUsersFile();
}

async function getDataOfStartingUsers() {
	for (let i = 0; i < TWITTER_ACCOUNTS.length; i++) {
		const currentUser = await twitterReq('users/show', { screen_name: TWITTER_ACCOUNTS[i] }, 'single');
		await getDataOfUser(currentUser);
	}
}

async function getInnerCircle() {
	const usersCopy = [...notLookedAtUsers],
		len = usersCopy.length;
	let error = null;
	console.log('Inner Circle:', len);
	for (let i = 0; i < len; i++) {
		try {
			const el = usersCopy.shift();
			await getDataOfUser(await twitterReq('users/show', { user_id: el[0] }, 'single'));
		} catch (err) {
			if (err.errno === -4058) {
				i--;
				error = err;
				if (!error.hasOwnProperty('amount')) error.amount = 0;
				error.amount++;
				fs.writeFileSync('./logs/errorLog.json', JSON.stringify(error));
				console.log({ error });
				continue;
			}
			console.log('getInnerCircle(), unhandled Error:', err);
			process.exit(1);
		}
	}
}

/**
 * Gets & saves the data of a single User
 * @param {?Object} currentUser User Object as per Twitter API, containing at least `screen_name` and `id_str`
 * @param {String} [userID] User ID of `currentUser`
 * @param {String} [username] User Name of `currentUser`
 */
async function getDataOfUser(currentUser = { id_str: null, screen_name: null }, userID = currentUser.id_str, username = currentUser.screen_name) {
	terminal.logMemory();
	const dir = userDir(username);

	// Check if Data of User was already written in a file from one of the many, many earlier test runs of the program:
	if (fs.existsSync(dir + '/User.json')) return await getExistingData(dir);

	console.log('Starting with', username);
	createDir(dir);
	terminal.write(dir); // For debugging purposes
	// await new Promise((resolve, reject) => setTimeout(resolve(), 100)); // Try out if giving more time to create the directory gets rid of the problem of the program crashing because the file can't be found yet.
	const userStream = fs.createWriteStream(`${dir}/User.json`);
	terminal.write('Created User Stream with path ' + dir); // For debugging purposes

	let user = createUser(currentUser, userID, username, true);
	userStream.write(stringHelper.replaceAt(user[1], -2, ',', 2));
	user = user[0];
	notLookedAtUsers.delete(userID);
	terminal.write(null, true); // For debugging purposes

	if (user.to_look === USERS_LOOK.LOOKED_AT) {
		if (user.friends_count !== 0 || user.followers_count !== 0) await getFriendsAndFollowers(userID, username, userStream); // Returns [friends[], followers[]]
		if (user.tweets_counts !== 0) await getTweets(userID, username, userStream); // Returns tweets[] or false
	}

	// To add more to userStream, start with ','
	userStream.end('}');
	const fileContents = await readFile(`${dir}/User.json`, { encoding: 'utf-8' });
	usersStream.write(`\n\t"${userID}":${fileContents},`);

	// ADD MORE: Global Entities Object/File??? Over Streams again.
	// ADD MORE: Liked Posts, Retweets, Replies, etc.
}

async function getFriendsAndFollowers(userID, username, userStream) {
	console.log('Getting Friends of ' + username);
	const friends = await getCursoredList('friends/ids', 'ids', userID);
	userStream.write('\n\t"friends": ' + JSON.stringify(friends, null, '\t') + ',');
	console.log('Getting Followers of ' + username);
	const followers = await getCursoredList('followers/ids', 'ids', userID);
	userStream.write('\n\t"followers": ' + JSON.stringify(followers, null, '\t'));
	return await addAllUsers(friends, followers);
}

/**
 * Adds Users indicated by their IDs from endlessly many arrays via `addUsers`.
 * @param  {...Array<ID>} args Arrays of User IDs
 */
async function addAllUsers(...args) {
	for (let i = 0; i < args.length; i++) {
		await addUsers(args[i]);
	}
	return args;
}

/**
 * Goes through Arrays of UserIDs, checking if the User has been stored in `users` yet. If not, it will asynchronously request boilerplate data of that User from the Twitter API. Users are added to `usersToLookAt`, if `toLookAt` is true.
 * @async
 * @param  {ID[]} arr An Array containing user IDs
 */
async function addUsers(arr) {
	let newUsers = [];
	console.log(`Adding ${arr.length} Users`);
	for (let i = 0; i < arr.length; i++) {
		let id = arr[i];
		if (!id) continue;
		id = String(id);
		if (!users.has(id)) newUsers.push(id);
	}
	let stringifiedArr = '';
	for (let i = 1, len = newUsers.length; i <= len; i++) {
		const temp = newUsers.shift();
		if (temp) {
			stringifiedArr += temp;
			if (i % 99 !== 0 || i >= len - 1) {
				stringifiedArr += ',';
				continue;
			}
		} else if (Boolean(temp) === false) continue;

		terminal.write(`Looked up ${i} of ${len} new Users`);
		let resArr = await twitterReq('users/lookup', { user_id: stringifiedArr }, 'user_id_list');
		for (let j = 0; j < resArr.length; j++) createUser(resArr[j]);
		stringifiedArr = '';
	}
	terminal.write(null, true);
}

/**
 * Creates a new User Object and returns it and a stringified version of it. Adds the stringified user object to `notLookedAtUsers` Array.
 * @returns {User|ID} Returns an Array with two elements. The first element is the User Object, the second element is the same object stringified, with an ending ',', ready for writing into a file.
 * @param {?TwitterUserObj} userObj User Object, that can be retrieved from Twitter's API or `null`. If `null`, `userID` and `username` may not be omitted.
 * @param {Boolean} [lookedAt=false] Indicates whether the user was looked at in the `getDataOfUser` function. Defaults to `false`.
 */
function createUser(userObj = null, userID = userObj.id_str, username = userObj.screen_name, lookedAt = false) {
	const user = { id: userID, name: username };
	if (lookedAt) user.to_look = USERS_LOOK.LOOKED_AT;
	else user.to_look = USERS_LOOK.TO_LOOK;

	if (userObj) {
		user.protected = userObj.protected;
		user.bioURL = userObj.url;
		user.desc = userObj.description;
		user.created_at = userObj.created_at;
		user.friends_count = userObj.friends_count;
		user.followers_count = userObj.followers_count;
		user.tweets_counts = userObj.statuses_count;
		user.favourites_count = userObj.favourites_count;
		// Check different cases for `to_look`:
		if (user.protected) {
			user.to_look = USERS_LOOK.PROTECTED;
			statistics.userNums.protected++;
		} else if (user.statuses_count <= TWEETS_MIN) {
			user.to_look = USERS_LOOK.INACTIVE;
			statistics.userNums.inactive++;
		} else if (user.followers_count >= FOLLOWERS_MAX || user.friends_count >= FRIENDS_MAX) {
			user.to_look = USERS_LOOK.TOO_BIG;
			statistics.userNums.tooBig++;
		}
	}
	if (!lookedAt) notLookedAtUsers.set(userID, { name: username, to_look: user.to_look });
	users.set(userID, { name: user.name, to_look: user.to_look });
	return [user, stringifyObj(user)];
}

async function getTweets(userID, username, userStream) {
	console.log('Getting Tweets of ' + username);
	const tweets = await getFullList('statuses/user_timeline', userID);
	if (!tweets) {
		// Should only happen on Authorization Errors, which means the current User is `protected`.
		users.get(userID).to_look = USERS_LOOK.PROTECTED;
		return;
	}
	const entities = {
		hashtags: {},
		hashtags_count: 0,
		urls: {},
		urls_count: 0,
	};

	userStream.write(',"tweets": [');
	for (let i = 0; i < tweets.length; i++) {
		tweets[i] = {
			created_at: tweets[i].created_at,
			id_str: tweets[i].id_str,
			text: tweets[i].text,
			user: tweets[i].user.id_str,
			favorite_count: tweets[i].favorite_count,
			retweet_count: tweets[i].retweet_count,
			entities: tweets[i].entities,
			lang: tweets[i].lang,
			// ADD MORE: Possibly add more, like retweet/reply statuses
		};

		if (i < tweets.length - 1) userStream.write('\n\t' + tweets[i].id_str + ',');
		else userStream.write('\n\t' + tweets[i].id_str);

		const tweetEntities = tweets[i].entities;
		// Getting hashtags of Tweet for Entities
		for (let j = 0; j < tweetEntities.hashtags.length; j++) {
			const hashtag = tweetEntities.hashtags[j].text;
			if (!entities.hashtags.hasOwnProperty(hashtag)) entities.hashtags[hashtag] = 1;
			else entities.hashtags[hashtag]++;
			// DECIDE: whether hashtags_count should count several used hashtags several times. It does currently.
			entities.hashtags_count++;
		}
		// Getting URLs of Tweet for entities
		for (let j = 0; j < tweetEntities.urls.length; j++) {
			const url = tweetEntities.urls[j].expanded_url;
			if (url.startsWith('https://twitter.com/')) continue; // DECIDE: whether to keep this line, or to store tweet-urls.
			if (!entities.urls.hasOwnProperty(url)) entities.urls[url] = 1;
			else entities.urls[url]++;
			// DECIDE: whether urls_count should count several used urls several times. It does currently.
			entities.urls_count++;
		}
	}
	userStream.write('],');
	userStream.write('\n\t"entities":' + stringifyObj(entities, false));
	// TODO: Add tweets and entities to global files, without causing a memory leak or wasting an enormous of time by reading files too often.
	writeJSON(entities, 'Entities', userDir(username));
	writeJSON(tweets, 'Tweets', userDir(username));
	return tweets;
}

function writeAllUsersFile() {
	const lookedAtUsers = fs.readFileSync(lookedAtUsersPath);
	const notLookedAtUsers = fs.readFileSync(notLookedAtUsersPath);
	const stream = fs.createWriteStream(dataDir + '/allUsers.json');

	stream.write('{');
	stream.write('"lookedAt": ');
	stream.write(lookedAtUsers);
	stream.write(',\n');
	stream.write('"notLookedAt": ');
	stream.write(notLookedAtUsers);
	stream.end('}');
}

async function getExistingData(dir) {
	// Get Data from file
	let data = String(fs.readFileSync(dir + '/User.json'));
	if (typeof data !== 'string') console.log({ data });
	try {
		data = JSON.parse(data);
	} catch (err) {
		data = getExistingDataErrHandling(dir, data);
	}
	if (!data.hasOwnProperty('friends') && !data.hasOwnProperty('followers')) return;
	for (let i = 0; i < data.friends.length; i++) await addUser(data.friends[0]);
	for (let i = 0; i < data.followers.length; i++) await addUser(data.followers[0]);
}

async function addUser(id) {
	if (!users.has(id)) {
		let user = await twitterReq('users/show', { user_id: id }, 'single');
		user = createUser(user)[0];
		users.set(id, { name: user.name, to_look: user.to_look });
	}
}

function getExistingDataErrHandling(dir, data) {
	if (data.split(' ')[-2] === ',') data = stringHelper.replaceAt(data, -2);
	else {
		data = data.split('"tweets":');
		let splitStr = data[1].split('],');
		let tweetIDsStr = splitStr[0];
		tweetIDsStr = tweetIDsStr.split('');
		let tweetIDs = [],
			currentNum = '',
			sameNum = true;
		for (let i = 0; i < tweetIDsStr.length; i++) {
			if (isNaN(Number(tweetIDsStr[i]))) {
				sameNum = false;
				continue;
			}
			if (sameNum) currentNum += tweetIDsStr[i];
			else {
				tweetIDs.push(currentNum);
				currentNum = tweetIDsStr[i];
			}
		}
		tweetIDs.push(currentNum);
		data = data[0];
		for (let i = 1; i < splitStr.length; i++) data += splitStr[i];
		data = JSON.parse(data);
		data.tweets = tweetIDs;
	}
	writeJSON(data, 'User_corrected', dir);
	return data;
}

///
///
///
// Unhandled Errors

process.on('unhandledRejection', (err) => {
	console.log('Unhandled Promise Rejection:', err);
	process.exit(1);
});

// Let it all actually start
main();
