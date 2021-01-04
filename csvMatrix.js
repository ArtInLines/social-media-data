require('dotenv').config({ path: `${__dirname}/config.env` });
const fs = require('fs');
const readline = require('readline');
const process = require('process');
const { hasProperties } = require('./util/objectHelper');
const { createDir } = require('./util/fsHelper');

const csvDir = process.env.CSV_DIR;
createDir(csvDir);

const usersObj = {};
const path = `${process.env.DATA_DIR}/allUsers.json`;
const extraColAmount = 5; // 5 Extra columns: Username - User Size - Friends Amount - Follower Amount - Tweets Amount
let len = 0;
let notLookedAtUsersAmount = 0;
let MATRIX = [];

///
///

const creatingHeader = () => {
	console.log('Creating Header...\n');

	let USERS = '';
	const fileSize = fs.statSync(path).size;
	let readBytes = 0;
	const readStream = fs.createReadStream(path);
	readStream.on('data', (chunk) => {
		readBytes += chunk.length;
		chunk = String(chunk);
		USERS += chunk;
		printProgress(readBytes, fileSize);
	});

	readStream.on('end', () => {
		console.log('File completely read');
		USERS = JSON.parse(USERS);
		let LookedAtUsers = USERS.LookedAt;
		USERS = USERS.lookedAt;
		for (let id in LookedAtUsers) USERS[id] = LookedAtUsers[id];

		const USERSKEYS = Object.keys(USERS);
		len = USERSKEYS.length;

		const MATRIXHEADER = new Array(extraColAmount);
		MATRIXHEADER[0] = 'Username';
		MATRIXHEADER[1] = 'User Size (not yet implemented)';
		MATRIXHEADER[2] = 'Friends Amount';
		MATRIXHEADER[3] = 'Followers Amount';
		MATRIXHEADER[4] = 'Tweets Amount (buggy rn)';

		for (let i = 0; i < USERSKEYS.length; i++) {
			const id = USERSKEYS[i];
			if (!hasProperties(USERS[id], 'friends', 'followers_count', 'tweets_count')) {
				notLookedAtUsersAmount++;
				continue;
			}

			usersObj[USERS[id].name] = { id: id, friends: new Set(USERS[id].friends), size: getSize(USERS[id]), followersAmount: USERS[id].followers_count, tweetsAmount: USERS[id].tweets_count };
			MATRIXHEADER.push(USERS[id].name);
			delete USERS[id];
			printProgress(i, len);
		}
		len = MATRIXHEADER.length;
		console.log(`${len} Users in the Matrix and ${notLookedAtUsersAmount} skipped`);

		MATRIX = new Array(len + 1 - extraColAmount); // + 1 because of Header Line && - extraColAmount because those don't increase amount of rows of table (/amount of users in the table)
		MATRIX[0] = MATRIXHEADER;
	});

	return readStream;
};

const creatingData = () => {
	console.log('\nCreating Data...\n');
	for (let i = 1, nameIndex = extraColAmount; nameIndex < len; i++, nameIndex++) {
		// Goes down in table
		MATRIX[i] = new Array(len);

		for (let j = 0; j < len; j++) {
			// Goes right in table
			const name = MATRIX[i][0];

			switch (j) {
				// 5 Extra columns: Username - User Size - Friends Amount - Follower Amount - Tweets Amount
				case 0:
					// Extra Col: Username
					MATRIX[i][0] = MATRIX[0][nameIndex];
					break;
				case 1:
					// Extra Col: User Size
					MATRIX[i][j] = usersObj[name].size;
					break;
				case 2:
					// Extra Col: Friends Amount
					MATRIX[i][j] = usersObj[name].friends.size;
					break;
				case 3:
					// Extra Col: Follower Amount
					MATRIX[i][j] = usersObj[name].followersAmount;
					break;
				case 4:
					// Extra Col: Tweets Amount
					MATRIX[i][j] = usersObj[name].tweetsAmount;
					break;

				case i:
					// Special Case: Same User
					MATRIX[i][j] = null;
					break;

				default:
					// Default case checks if user of row is following user of column
					const currentID = usersObj[MATRIX[0][j]].id;
					if (usersObj[name].friends.has(currentID)) MATRIX[i][j] = 1;
					else MATRIX[i][j] = 0;
					break;
			}
		}
		printProgress(i);
	}
};

const writingMatrix = () => {
	console.log('Writing file...\n');
	const stream = fs.createWriteStream(`${csvDir}/Matrix.csv`);

	while (MATRIX.length >= 1) {
		const arr = MATRIX.shift();

		for (let i = 0; i < arr.length; i++) {
			let val = arr[i];
			if (val === null) val = '-'; // DECIDE what to write here
			if (val === undefined) process.exit(1); // This should never happen lol
			if (typeof val !== 'string') val = String(val);
			stream.write(val);
			if (i < arr.length - 1) stream.write(',');
		}
		stream.write('\n');
		printProgress(len - MATRIX.length);
	}
};

function getSize(userObj) {
	return 0;
	// TODO
}

function printProgress(current, total = len) {
	const text = `\t${Math.ceil((current / total) * 100)}% ...`; // + ${Math.ceil((usedMemory.heapUsed / usedMemory.heapTotal) * 100)}
	readline.clearLine(process.stdout);
	// const usedMemory = process.memoryUsage();
	process.stdout.write(text);
	readline.cursorTo(process.stdout, 0);
}

function main() {
	const stream = creatingHeader();
	stream.on('end', () => {
		creatingData();
		writingMatrix();
	});
}

main();
