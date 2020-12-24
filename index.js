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
const { logMemory } = require('./util/terminal');

const TWITTER_ACCOUNTS = /* ['OwlbearStanAcct']; */ /* ['SphereVexi']; */ /* ['Lord_Plaga']; */ process.env.TWITTER_ACCOUNTS.split(',');
const USERS_LOOK = {
	LOOKED_AT: process.env.USERS_LOOK_LOOKED_AT,
	IGNORE: process.env.USERS_LOOK_IGNORE,
	TOO_BIG: process.env.USERS_LOOK_TOO_BIG,
	INACTIVE: process.env.USERS_LOOK_INACTVE,
	TO_LOOK: process.env.USERS_LOOK_TO_LOOK,
	PROTECTED: process.env.USERS_LOOK_PROTECTED,
};
const TWEETS_MIN = process.env.TWEETS_MIN;
const FOLLOWERS_MAX = process.env.FOLLOWERS_MAX;
const FRIENDS_MAX = process.env.FRIENDS_MAX;
const dataDir = process.env.DATA_DIR;
const lookedAtUsersPath = `${dataDir}/lookedAtUsers.json`;
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
	logMemory();
	statistics.userNums.lookedAt = users.size;
	statistics.userNums.all = users.size + notLookedAtUsers.size;

	const fileContents = stringHelper.replaceAt(await readFile(`${lookedAtUsersPath}`, { encoding: 'utf-8' }), -2, '');
	fs.writeFileSync(lookedAtUsersPath, fileContents);

	writeJSON(notLookedAtUsers, 'notLookedAtUsers', dataDir);
	// TODO: Write File, containing all Users, by combining notLookedAtUsers & lookedAtUsers
}

async function getDataOfStartingUsers() {
	for (let i = 0; i < TWITTER_ACCOUNTS.length; i++) {
		const currentUser = await twitterReq('users/show', { screen_name: TWITTER_ACCOUNTS[i] });
		await getDataOfUser(currentUser);
	}
}

async function getInnerCircle() {
	const usersCopy = [...notLookedAtUsers],
		len = usersCopy.length;
	console.log('Inner Circle:', len);
	for (let i = 0; i < len; i++) {
		const el = usersCopy.shift();
		if (el[1].to_look === USERS_LOOK.TO_LOOK) await getDataOfUser(null, el[0], el[1].name);
	}
}

/**
 * Gets & saves the data of a single User
 * @param {?Object} currentUser User Object as per Twitter API, containing at least `screen_name` and `id_str`
 * @param {String} [userID] User ID of `currentUser`
 * @param {String} [username] User Name of `currentUser`
 */
async function getDataOfUser(currentUser = { id_str: null, screen_name: null }, userID = currentUser.id_str, username = currentUser.screen_name) {
	logMemory();

	console.log('Starting with', username);
	createDir(userDir(username));
	const userStream = fs.createWriteStream(`${userDir(username)}/User.json`);

	userStream.write(createUser(currentUser, userID, username, true)[1]);
	notLookedAtUsers.delete(userID);
	await getFriendsAndFollowers(userID, username, userStream); // Returns [friends[], followers[]]
	await getTweets(userID, username, userStream); // Returns tweets[]

	// To add more to userStream, start with ','
	userStream.end('}');
	const fileContents = await readFile(`${userDir(username)}/User.json`, { encoding: 'utf-8' });
	usersStream.write(`\n\t"${userID}":${fileContents},`);

	// ADD MORE: Global Entities Object/File???
	// ADD MORE: Liked Posts, Retweets, Replies, etc.
}

async function getFriendsAndFollowers(userID, username, userStream) {
	console.log('Getting Friends of ' + username);
	const friends = await getCursoredList('friends/ids', 'ids', userID);
	userStream.write('"friends": ' + JSON.stringify(friends) + ',');
	console.log('Getting Followers of ' + username);
	const followers = await getCursoredList('followers/ids', 'ids', userID);
	userStream.write('"followers": ' + JSON.stringify(followers));
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
		} else if (temp === false) {
			statistics.userNums.protected++;
			continue;
		}

		console.log(`Looking up ${i / Math.ceil(i / 99)} new Users`);
		let resArr = await twitterReq('users/lookup', { user_id: stringifiedArr }, 'user_id_list');
		for (let j = 0; j < resArr.length; j++) createUser(resArr[j]);
		stringifiedArr = '';
	}
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
		user.bioURL = userObj.url;
		user.desc = userObj.description;
		user.created_at = userObj.created_at;
		user.friends_count = userObj.friends_count;
		user.followers_count = userObj.followers_count;
		user.tweets_counts = userObj.statuses_count;
		user.favourites_count = userObj.favourites_count;
		// Check different cases for `to_look`:
		if (!lookedAt) {
			if (user.statuses_count <= TWEETS_MIN) {
				user.to_look = USERS_LOOK.INACTIVE;
				statistics.userNums.inactive++;
			} else if (user.followers_count >= FOLLOWERS_MAX || user.friends_count >= FRIENDS_MAX) {
				user.to_look = USERS_LOOK.TOO_BIG;
				statistics.userNums.tooBig++;
			}
		}
	}
	if (!users.has(userID)) notLookedAtUsers.set(userID, { name: username, to_look: user.to_look });
	return [user, stringifyObj(user)];
}

async function getTweets(userID, username, userStream) {
	console.log('Getting Tweets of ' + username);
	const tweets = await getFullList('statuses/user_timeline', userID);
	const entities = {
		hashtags: {},
		hashtags_count: 0,
		urls: {},
		urls_count: 0,
	};

	userStream.write(',"tweets": [');
	for (let i = 0; i < tweets.length; i++) {
		if (i < tweets.length - 1) userStream.write(JSON.stringify(tweets[i].id_str) + ',');
		else userStream.write(JSON.stringify(tweets[i].id_str));

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
		const tweetEntities = tweets[i].entities;
		for (let j = 0; j < tweetEntities.hashtags.length; j++) {
			const hashtag = tweetEntities.hashtags[j].text;
			if (!entities.hashtags.hasOwnProperty(hashtag)) entities.hashtags[hashtag] = 1;
			else entities.hashtags[hashtag]++;
			// DECIDE: whether hashtags_count should count several used hashtags several times
			entities.hashtags_count++;
		}
		for (let j = 0; j < tweetEntities.urls.length; j++) {
			const url = tweetEntities.urls[j].expanded_url;
			// DECIDE: whether to keep this line, or to store tweet-urls.
			if (url.startsWith('https://twitter.com/i/web/status/')) continue;
			if (!entities.urls.hasOwnProperty(url)) entities.urls[url] = 1;
			else entities.urls[url]++;
			entities.urls_count++;
		}
	}
	userStream.write(']');
	userStream.write(',"entities":' + JSON.stringify(entities));
	// TODO: Add tweets and entities to global files, without causing a memory leak or wasting an enormous of time by reading files too often.
	writeJSON(entities, 'Entities', userDir(username));
	writeJSON(tweets, 'Tweets', userDir(username));
	return tweets;
}

// Unhandled Errors

process.on('unhandledRejection', (err) => {
	console.log('Unhandled Promise Rejection:', err);
	if (err.errno === -3800) return;
	process.exit(1);
});

// Let it all actually start
main();
