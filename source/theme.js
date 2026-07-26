import {RGBA} from '@opentui/core';

const indexed = index => RGBA.fromIndex(index);

export const theme = {
	black: indexed(0),
	red: indexed(1),
	green: indexed(2),
	yellow: indexed(3),
	blue: indexed(4),
	magenta: indexed(5),
	cyan: indexed(6),
	white: indexed(7),
	gray: indexed(8),
	default: RGBA.defaultForeground(),
	transparent: RGBA.fromValues(0, 0, 0, 0),
};

const NAMED = {
	cyan: theme.cyan,
	magenta: theme.magenta,
	yellow: theme.yellow,
	red: theme.red,
	green: theme.green,
	blue: theme.blue,
	gray: theme.gray,
	white: theme.white,
	black: theme.black,
};

export const resolveColor = name => {
	if (!name) return undefined;
	if (typeof name !== 'string') return name;
	return NAMED[name.toLowerCase()] ?? theme.default;
};
