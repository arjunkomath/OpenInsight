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
	brightRed: indexed(9),
	brightGreen: indexed(10),
	brightYellow: indexed(11),
	brightBlue: indexed(12),
	brightMagenta: indexed(13),
	brightCyan: indexed(14),
	brightWhite: indexed(15),
	default: RGBA.defaultForeground(),
	defaultBackground: RGBA.defaultBackground(),
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
