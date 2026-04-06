export const getQueryCtrlCAction = ({
	inputValue,
	isProcessing,
	awaitingQuitConfirmation,
}) => {
	if (isProcessing) {
		return 'ignore';
	}

	if (awaitingQuitConfirmation) {
		return 'quit';
	}

	if (inputValue.length > 0) {
		return 'clear-input';
	}

	return 'confirm-quit';
};
