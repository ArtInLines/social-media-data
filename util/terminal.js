const process = require('process');
const readline = require('readline');

const anim = ['.', '.', '...', '.....', '.....', '  ...', '   ..', '    .', '    .', '    .', '  ...', ' ....', '.....', '.....', '...', '..', '.'];

/**
 * Sets and returns JS Interval, which iterates over an waiting animation. Setting `intervalID` to the return value of this function, to end the animation again.
 * @param {?NodeJS.Timeout} intervalID Set this to the return value of this function, to end the animation, or set it to `null` otherwise. Defaults to `null`.
 * @param {Number} speed Time in milisecond, by which the interval should iterate. Defaults to `60`
 */
function waitAnim(intervalID = null, speed = 60) {
	if (intervalID) {
		clearInterval(intervalID);
		write(null, true);
		return;
	}
	let i = 0;
	const interval = setInterval(() => {
		write(' ' + anim[i]);
		i++;
		if (i >= anim.length) i = 0;
	}, speed);
	return interval;
}

/**
 * Starts and returns a JS Interval ID, which can either be cleared manually or it will be cleared once `p >= 100`.
 *
 * Terminal doesn't get cleaned automaatically if `typeof cb === 'Function`, otherwise it does get cleaned afterwards.
 * @param {?Function} cb Callback function, too automatically calculate `p` during the interval's iteration. Defaults to `null`. If set to null, `p` will automatically increment by one each time the interval iterates.
 * @param  {Array} args Optional arguments to feed into `cb`.
 * @param {Number} p Current Percentage to be printed to the terminal. Defaults to `0` as starting Percentage.
 * @param {Number} time Time for the interval to iterate in ms. Defaults to `1000` (1s). Every iteration, `p` is calculated again.
 */
function waitingPercent(cb = null, args = [], p = 0, time = 100) {
	let i = 0;
	const interval = setInterval(() => {
		i++;
		if (i >= anim.length) i = 0;
		if (typeof cb === 'function') p = cb.apply(null, args);
		else if (cb === null) p++;
		write('\t' + `${p}%` + anim[i]);
		if (p >= 100) {
			clearInterval(interval);
			write(null, true);
		}
	}, time);
	return interval;
}

/**
 * Print text to the terminal, without using new lines as `console.log` does.
 * @param {?String} text Text to write to the terminal, without using a new line as `console.log` does. If set to null, no text will be printed.
 * @param {Boolean} done If set to `true`, the line will be cleared, without any new text being printed, even if `text` isn't set to `null`. Defaults to `false`.
 */
function write(text, done = false) {
	if (done) return readline.clearLine(process.stdout);
	readline.clearLine(process.stdout);
	process.stdout.write(text);
	readline.cursorTo(process.stdout, 0);
}

/**
 * Prints the amount of Memory used relative to the total amount of memory available.
 *
 * @deprecated Currently not working.
 */
function logMemory() {
	return;
	// TODO: Check how to get actual memory usage, as this doesn't seem to work correctly.
	const usedMemory = process.memoryUsage();
	console.log({ total_Memory: usedMemory.heapTotal, used_Memory: usedMemory.heapUsed, percentage: Math.ceil((usedMemory.heapUsed / usedMemory.heapTotal) * 100) + '%' });
}

module.exports = { waitingPercent, logMemory, write, waitAnim };
