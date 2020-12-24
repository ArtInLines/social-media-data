const process = require('process');
const readline = require('readline');

function waitingPercent(p, cb = null, ...args) {
	let i = 0;
	const interval = setInterval(() => {
		i++;
		if (i >= 6) i = 0;
		let text = '';
		for (let j = 0; j < i; j++) {
			text += '.';
		}
		if (typeof cb === 'function') p = cb.apply(null, args);
		readline.clearLine(process.stdout);
		process.stdout.write('\t' + `${p}%` + text);
		readline.cursorTo(process.stdout, 0);
	}, 1000);
	return interval;
}

function logMemory() {
	return;
	// TODO: Check how to get actual memory usage, as this doesn't seem to work correctly.
	const usedMemory = process.memoryUsage();
	console.log({ total_Memory: usedMemory.heapTotal, used_Memory: usedMemory.heapUsed, percentage: Math.ceil((usedMemory.heapUsed / usedMemory.heapTotal) * 100) + '%' });
}

module.exports = { waitingPercent, logMemory };
