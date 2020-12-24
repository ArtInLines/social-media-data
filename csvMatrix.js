require('dotenv').config({ path: `${__dirname}/config.env` });
const fs = require('fs');
const readline = require('readline');
const process = require('process');
const { createDir } = require('./util/fsHelper');

const csvDir = process.env.CSV_DIR;
createDir(csvDir);
const usersObj = {};
let len;
let MATRIX;

const creatingHeader = async () => {
	console.log('Creating Header...\n');
	const USERS = JSON.parse(fs.readFileSync(`${process.env.DATA_DIR}/lookedAtUsers.json`, { encoding: 'utf-8', flag: 'r' }));

	len = Object.keys(USERS).length + 1;
	const MATRIXHEADER = new Array(len);
	MATRIXHEADER[0] = null;
	let i = 1;
	for (let id in USERS) {
		usersObj[USERS[id].name] = { id: id, friends: new Set(USERS[id].friends) };
		MATRIXHEADER[i] = USERS[id].name;
		delete USERS[id];
		i++;
		printProgress(i);
	}
	MATRIX = new Array(len);
	MATRIX[0] = MATRIXHEADER;
};

const creatingData = () => {
	console.log('Creating Data...\n');
	for (let i = 1; i < len; i++) {
		// Goes down in table
		MATRIX[i] = new Array(len);
		MATRIX[i][0] = MATRIX[0][i];
		for (let j = 1; j < len; j++) {
			// Goes right in table
			if (j === i) {
				MATRIX[i][j] = null;
				continue;
			}
			const currentID = usersObj[MATRIX[0][j]].id;
			if (usersObj[MATRIX[i][0]].friends.has(currentID)) MATRIX[i][j] = 1;
			else MATRIX[i][j] = 0;
		}
		printProgress(i);
	}
};

const writingMatrix = () => {
	const stream = fs.createWriteStream(`${csvDir}/Matrix.csv`);
	while (MATRIX.length >= 1) {
		const arr = MATRIX.shift();
		for (let i = 0; i < arr.length; i++) {
			let val = arr[i];
			if (val === null) val = '';
			if (typeof val !== 'string') val = String(val);
			stream.write(val);
			if (i < arr.length - 1) stream.write(',');
		}
		stream.write('\n');
		printProgress(len - MATRIX.length);
	}
};

function printProgress(current, total = len) {
	readline.clearLine(process.stdout);
	const usedMemory = process.memoryUsage();
	process.stdout.write(`\t${Math.ceil((current / total) * 100)}% ... ${Math.ceil((usedMemory.heapUsed / usedMemory.heapTotal) * 100)}`);
	readline.cursorTo(process.stdout, 0);
}

async function main() {
	await creatingHeader();
	creatingData();
	writingMatrix();
}

main();
