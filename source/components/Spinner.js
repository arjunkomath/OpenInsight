import React, {useEffect, useState} from 'react';
import {theme} from '../theme.js';

const FRAMES = ['⠋', '⠙', '⠹', '⠸', '⠼', '⠴', '⠦', '⠧', '⠇', '⠏'];

export default function Spinner({fg = theme.cyan}) {
	const [frame, setFrame] = useState(0);

	useEffect(() => {
		const interval = setInterval(() => {
			setFrame(f => (f + 1) % FRAMES.length);
		}, 80);
		return () => clearInterval(interval);
	}, []);

	return <span fg={fg}>{FRAMES[frame]}</span>;
}
