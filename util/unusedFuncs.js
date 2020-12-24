/**
 * Loops through all Tweets, to filter out all entities specified in `entitiesList`
 * @returns An Object built like `Entities`, with the difference, that the values of its properties are Arrays instead of Maps.
 * @param {Array<Object>} tweets An Array of Tweet Objects
 */
function getAllEntities(tweets) {
	let entitiesObj = {};
	for (let i = 0; i < entitiesList.length; i++) {
		entitiesObj[entitiesList[i][0]] = new Map();
	}
	for (let i = 0; i < tweets.length; i++) {
		console.assert(typeof tweets[i] === 'object', 'Tweet Object is not an Object');
		for (let j = 0; j < entitiesList.length; j++) {
			let keys = ['entities', entitiesList[j][0]];
			let arrOfEntities = getObjVal(tweets[i], keys);
			console.assert(Array.isArray(arrOfEntities), 'Array of Entities is not an Array ' + arrOfEntities);
			if (arrOfEntities.length == 0) continue;
			for (let k = 0; k < arrOfEntities.length; k++) {
				let map = entitiesObj[entitiesList[j][0]];
				let entity = arrOfEntities[k][entitiesList[j][1]];
				console.assert(typeof entity === 'string', 'Type of Entity should be string ' + entity);
				if (!map.has(entity)) map.set(entity, 1);
				else {
					const prevVal = map.get(entity);
					map.set(entity, prevVal + 1);
				}
			}
		}
	}
	return entitiesObj;
}

/**
 * Transforms Entities Map into Entities Object and returns it.
 * @param {Map} entities Entities Map
 */
function entitiesToObj(entities) {
	return {
		hashtags: transformMap(entities.hashtags),
		hashtags_count: entities.hashtags.size,
		urls: transformMap(entities.urls),
		urls_count: entities.urls.size,
		entitiesList: entities.entitiesList,
	};
}

/**
 * Get values specified by Object keys of all tweets in an Array of Tweets
 *
 * @param {Array<Object>} tweets Array of Tweets
 * @param {(string | string[])} [keys=[]] List of Keys to get from Object Root to wanted value. Can be emitted as Array of Keys or String, with keys seperated by `seperator`
 * @param {string} [seperator=,] Seperates Stringified List of Keys by specified `seperator`
 */
function getDataOfTweets(tweets, keys = [], seperator = ',') {
	let data = [];
	for (let i = 0, len = tweets.length; i < len; i++) {
		/* console.log(tweets[i], keys); */
		const el = getObjVal(tweets[i], keys, null, seperator);
		data.push(el);
	}
	return data;
}

function trimTweets(newArr) {
	const tweets = [];
	for (i = 0; i < newArr.length; i++) {
		let tweet = newArr[i];
		tweet = {
			id: tweet.id_str,
			text: tweet.text,
			hashtags: tweet.entities.hashtags,
			user_mentions: tweet.entities.user_mentions,
			user: {
				id: tweet.user.id,
				name: tweet.user.name,
				url: tweet.user.url,
			},
			retweet_count: tweet.retweet_count,
			favorite_count: tweet.favorite_count,
		};
		tweets.push(tweet);
	}
	return tweets;
}
